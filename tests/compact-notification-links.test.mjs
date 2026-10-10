import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { PGlite } from '@electric-sql/pglite'

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const moduleFrom = async path => {
  const js = ts.transpileModule(read(path), { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText
  return import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'))
}
const { notificationIdFromCode } = await moduleFrom('src/lib/notificationLink.ts')
const { authLink, afterAuthPath } = await moduleFrom('src/lib/navigation.ts')
const codeFor = id => Buffer.from(id.replaceAll('-', ''), 'hex').toString('base64url')

test('22-character notification locator round trips and survives login for every role', () => {
  for (let i = 0; i < 100; i++) {
    const id = randomUUID(), code = codeFor(id), path = '/n/' + code
    assert.equal(code.length, 22)
    assert.equal(notificationIdFromCode(code), id)
    const next = new URL(authLink('/login', path), 'https://site.test').searchParams.get('next')
    for (const role of ['customer', 'admin', 'staff']) assert.equal(afterAuthPath(next, role), path)
  }
  for (const code of ['', 'bad', 'A'.repeat(21), 'A'.repeat(23), 'A'.repeat(21) + 'B', '../login', 'A'.repeat(21) + '/']) {
    assert.equal(notificationIdFromCode(code), null, code)
  }
})

test('Postgres sender emits one compact URL, keeps full in-app destination, and leaves sent messages alone', async () => {
  const db = new PGlite()
  try {
    await db.exec(`
      create role anon; create role authenticated;
      create schema app_private;
      create table public.notifications(id uuid primary key,user_id uuid,type text,title text,message text,link text,created_at timestamptz);
      create table public.profiles(id uuid primary key,phone text,first_name text,last_name text);
      create table public.app_settings(id boolean primary key,wa_prepare_project_status boolean,
        wa_prepare_task_status boolean,wa_prepare_stage_status boolean,wa_prepare_file_updates boolean,
        wa_prepare_file_review boolean,wa_prepare_priority_events boolean,priority_whatsapp_phone text);
      create table public.whatsapp_message_outbox(notification_id uuid unique,recipient_user_id uuid,
        recipient_name text,destination_phone text,event_type text,title text,message_body text,
        target_link text,status text,source text,created_at timestamptz);
      insert into public.app_settings values(true,true,true,true,true,true,true,null);
    `)
    const user = randomUUID(), id = randomUUID(), sentId = randomUUID(), historicalId = randomUUID()
    const full = '/app/projetos/' + randomUUID() + '/etapas/' + randomUUID() + '/tarefas/' + randomUUID()
    await db.query('insert into public.profiles values($1,$2,$3,$4)', [user, '5562999999999', 'Cliente', 'Teste'])
    for (const notice of [id, sentId, historicalId]) {
      await db.query('insert into public.notifications values($1,$2,$3,$4,$5,$6,now())', [notice, user, 'project_task', 'Tarefa atualizada', 'Confira os arquivos.', full])
    }
    for (const [notice, status] of [[id, 'ready_manual'], [sentId, 'sent_auto'], [historicalId, 'historical']]) {
      await db.query('insert into public.whatsapp_message_outbox(notification_id,message_body,target_link,status) values($1,$2,$3,$4)', [notice, 'Mensagem antiga', full, status])
    }
    await db.exec(read('supabase/migrations/20261011000000_compact_whatsapp_notification_links.sql'))
    const { rows } = await db.query('select * from public.whatsapp_message_outbox where notification_id=$1', [id])
    assert.equal(rows[0].target_link, '/n/' + codeFor(id))
    assert.equal((rows[0].message_body.match(/https:\/\//g) || []).length, 1)
    assert.ok(rows[0].message_body.includes('\n\nVer tarefa e arquivos: https://'))
    assert.ok(!rows[0].message_body.includes(full))
    for (const notice of [sentId, historicalId]) {
      const { rows } = await db.query('select message_body,target_link from public.whatsapp_message_outbox where notification_id=$1', [notice])
      assert.equal(rows[0].message_body, 'Mensagem antiga')
      assert.equal(rows[0].target_link, full)
    }
    const fresh = randomUUID()
    await db.query('insert into public.notifications values($1,$2,$3,$4,$5,$6,now())', [fresh, user, 'project_task', 'Nova tarefa', 'Em revisão.', full])
    await db.query('select app_private.wa_capture_notification($1,false)', [fresh])
    const result = (await db.query('select * from public.whatsapp_message_outbox where notification_id=$1', [fresh])).rows[0]
    assert.equal(result.target_link, '/n/' + codeFor(fresh))
    assert.equal(result.status, 'ready_manual')
    assert.ok(result.message_body.endsWith('https://playsistem-oficial.playmomentsstudios.workers.dev' + result.target_link))
    assert.equal((await db.query('select link from public.notifications where id=$1', [fresh])).rows[0].link, full)
    assert.equal(notificationIdFromCode(result.target_link.slice(3)), fresh)
    // Model the existing recipient policy and verify the locator grants no
    // access to a different signed-in account.
    await db.exec(`
      alter table public.notifications enable row level security;
      grant select on public.notifications to authenticated;
      create policy recipient_read on public.notifications for select to authenticated
        using (user_id = current_setting('test.user_id')::uuid);
    `)
    await db.exec('set role authenticated')
    await db.query("select set_config('test.user_id',$1,false)", [user])
    assert.equal((await db.query('select link from public.notifications where id=$1', [fresh])).rows[0].link, full)
    await db.query("select set_config('test.user_id',$1,false)", [randomUUID()])
    assert.equal((await db.query('select link from public.notifications where id=$1', [fresh])).rows.length, 0)
    await assert.rejects(db.query('select app_private.wa_capture_notification($1,false)', [fresh]), /permission denied/)
  } finally { await db.close() }
})

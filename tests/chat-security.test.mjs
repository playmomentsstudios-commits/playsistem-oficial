import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

test('chat migration enforces customer isolation, staff access and persistent messages', async () => {
  const db = new PGlite()
  try {
    await db.exec(`create role anon; create role authenticated;
      create schema auth;
      create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid$$;
      grant usage on schema auth, public to authenticated, anon;
      grant execute on function auth.uid() to authenticated, anon;`)
    for (const file of ['20260925010000_create_profiles_auth.sql', '20260925040000_create_conversations.sql']) {
      await db.exec(await readFile(new URL('../supabase/migrations/' + file, import.meta.url), 'utf8'))
    }
    const ids = Array.from({ length: 5 }, (_, i) => `00000000-0000-0000-0000-00000000000${i+1}`)
    for (const id of ids) await db.query('insert into auth.users(id,email) values ($1,$2)', [id, id+'@test.invalid'])
    await db.query("update public.profiles set role='staff' where id=$1", [ids[2]])
    await db.query("update public.profiles set role='admin' where id=$1", [ids[3]])
    await db.query("update public.profiles set status='blocked' where id=$1", [ids[4]])
    const asUser = async id => {
      await db.exec('reset role')
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id])
      await db.exec('set role authenticated')
    }
    const open = async () => (await db.query('select public.open_customer_conversation() as id')).rows[0].id
    const count = async table => Number((await db.query(`select count(*) as n from public.${table}`)).rows[0].n)
    await asUser(ids[0])
    const first = await open()
    assert.equal(await open(), first)
    const messageId = '10000000-0000-0000-0000-000000000001'
    await db.query('insert into public.messages(id,conversation_id,sender_id,content) values ($1,$2,$3,$4)', [messageId,first,ids[0],'Preciso de um orçamento'])
    assert.equal(await count('messages'), 1)
    await assert.rejects(db.query('insert into public.messages(conversation_id,sender_id,content) values ($1,$2,$3)', [first,ids[2],'Spoof']))
    await assert.rejects(db.query('insert into public.messages(conversation_id,sender_id,content) values ($1,$2,$3)', [first,ids[0],'   ']))
    await assert.rejects(db.query('insert into public.messages(conversation_id,sender_id,content) values ($1,$2,$3)', [first,ids[0],'x'.repeat(5001)]))
    await asUser(ids[1])
    const second = await open()
    assert.notEqual(first, second)
    assert.equal(await count('conversations'), 1)
    assert.equal(await count('messages'), 0)
    await assert.rejects(db.query('insert into public.messages(conversation_id,sender_id,content) values ($1,$2,$3)', [first,ids[1],'Unauthorized']))
    for (const id of [ids[2],ids[3]]) {
      await asUser(id)
      assert.equal(await count('conversations'), 2)
      await db.query('insert into public.messages(conversation_id,sender_id,content) values ($1,$2,$3)', [first,id,'Resposta da equipe'])
      await assert.rejects(open())
    }
    await asUser(ids[0])
    assert.equal(await count('messages'), 3)
    await assert.rejects(db.exec('delete from public.messages'))
    await assert.rejects(db.exec("update public.profiles set role='admin'"))
    await asUser(ids[4])
    await assert.rejects(open())
    assert.equal(await count('conversations'), 0)
    assert.equal(await count('messages'), 0)
    await db.exec('reset role; set role anon')
    await assert.rejects(open())
    await assert.rejects(db.exec('select * from public.messages'))
  } finally { await db.close() }
})

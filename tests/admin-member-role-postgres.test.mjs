import test from 'node:test'
import assert from 'node:assert/strict'
import { PGlite } from '@electric-sql/pglite'
import { readFile } from 'node:fs/promises'

const migration = await readFile(
  new URL('../supabase/migrations/20261011050100_secure_admin_set_member_role.sql', import.meta.url),
  'utf8',
)

test('admin_set_member_role enforces effective PostgreSQL privileges and preserves profile invariants', async () => {
  const db = new PGlite()
  const admin = '00000000-0000-4000-8000-000000000001'
  const member = '00000000-0000-4000-8000-000000000002'
  const ordinary = '00000000-0000-4000-8000-000000000003'
  const inactiveAdmin = '00000000-0000-4000-8000-000000000004'
  const call = (id, role) => db.query(
    'select public.admin_set_member_role($1::uuid,$2::text)',
    [id, role],
  )
  const withRole = async (role, uid, action) => {
    await db.exec('reset role')
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [uid || ''])
    await db.exec('set role ' + role)
    try { return await action() } finally { await db.exec('reset role') }
  }
  try {
    await db.exec(`
      create role anon nologin;
      create role authenticated nologin;
      create role service_role nologin;
      create schema auth;
      create function auth.uid() returns uuid language sql stable as
        $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      create table public.profiles(id uuid primary key, role text, status text not null);
      create table public.staff_profiles(
        user_id uuid primary key, job_title text, department text,
        permissions text[] not null default '{}', active boolean not null,
        updated_by uuid, updated_at timestamptz not null default now()
      );
      create function public.admin_set_member_role(uuid,text) returns void
        language plpgsql as $$ begin return; end $$;
      grant execute on function public.admin_set_member_role(uuid,text)
        to public, anon, authenticated, service_role;
      insert into public.profiles values
        ('${admin}','admin','active'),
        ('${member}','customer','active'),
        ('${ordinary}','staff','active'),
        ('${inactiveAdmin}','admin','inactive');
      insert into public.staff_profiles(user_id,active) values ('${member}',false);
    `)
    await db.exec(migration)

    const acl = (await db.query(`
      select has_function_privilege('anon','public.admin_set_member_role(uuid,text)','execute') as anon,
             has_function_privilege('authenticated','public.admin_set_member_role(uuid,text)','execute') as authenticated,
             has_function_privilege('service_role','public.admin_set_member_role(uuid,text)','execute') as service_role
    `)).rows[0]
    assert.deepEqual(acl, { anon: false, authenticated: true, service_role: true })

    const denied = async (role, uid, id, nextRole, code = '42501') =>
      withRole(role, uid, async () =>
        assert.rejects(call(id, nextRole), error => error.code === code))
    await denied('anon', null, member, 'admin')
    await denied('service_role', null, member, 'admin')
    await denied('authenticated', ordinary, member, 'admin')
    await denied('authenticated', inactiveAdmin, member, 'admin')
    await denied('authenticated', admin, admin, 'customer', '22023')

    const unchanged = (await db.query(
      'select role from public.profiles where id=$1::uuid', [member],
    )).rows[0].role
    const unchangedStaff = (await db.query(
      'select active from public.staff_profiles where user_id=$1::uuid', [member],
    )).rows[0].active
    assert.equal(unchanged, 'customer')
    assert.equal(unchangedStaff, false)
    assert.equal((await db.query('select role from public.profiles where id=$1::uuid', [admin])).rows[0].role, 'admin')

    await withRole('authenticated', admin, () => call(member, 'staff'))
    const staff = (await db.query(
      'select active,updated_by from public.staff_profiles where user_id=$1::uuid', [member],
    )).rows[0]
    assert.equal(staff.active, true)
    assert.equal(staff.updated_by, admin)

    await withRole('authenticated', admin, () => call(member, 'customer'))
    const customer = (await db.query(
      'select role from public.profiles where id=$1::uuid', [member],
    )).rows[0]
    const inactiveStaff = (await db.query(
      'select active,updated_by from public.staff_profiles where user_id=$1::uuid', [member],
    )).rows[0]
    assert.equal(customer.role, 'customer')
    assert.equal(inactiveStaff.active, false)
    assert.equal(inactiveStaff.updated_by, admin)
  } finally {
    await db.close()
  }
})

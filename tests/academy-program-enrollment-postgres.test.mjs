import test from 'node:test'
import assert from 'node:assert/strict'
import { PGlite } from '@electric-sql/pglite'
import { readFile } from 'node:fs/promises'

const migration = await readFile(
  new URL('../supabase/migrations/20261011033500_academy_program_enrollment_rpc_guard.sql', import.meta.url),
  'utf8',
)

test('academy program refresh authenticates before lookup and limits recalculation to owner or active admin', async () => {
  const db = new PGlite()
  const student = '10000000-0000-4000-8000-000000000001'
  const other = '10000000-0000-4000-8000-000000000002'
  const admin = '10000000-0000-4000-8000-000000000003'
  const program = '20000000-0000-4000-8000-000000000001'
  const enrollment = '30000000-0000-4000-8000-000000000001'
  const otherEnrollment = '30000000-0000-4000-8000-000000000002'
  const missing = '30000000-0000-4000-8000-000000000099'
  const withRole = async (role, uid, action) => {
    await db.exec('reset role')
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [uid || ''])
    await db.exec('set role ' + role)
    try { return await action() } finally { await db.exec('reset role') }
  }
  const call = id => db.query(
    'select progress_percent,status from public.academy_refresh_program_enrollment($1::uuid)',
    [id],
  )
  try {
    await db.exec(`
      create role anon nologin;
      create role authenticated nologin;
      create schema auth;
      create function auth.uid() returns uuid language sql stable as
        $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      create table public.profiles(id uuid primary key, role text, status text not null);
      create function public.is_active_admin() returns boolean language sql stable security definer
        set search_path=public as
        $$ select exists(select 1 from public.profiles where id=auth.uid() and role='admin' and status='active') $$;
      create table public.academy_students(id uuid primary key, profile_id uuid);
      create table public.academy_program_enrollments(
        id uuid primary key, student_id uuid not null, program_id uuid not null,
        progress_percent numeric(5,2) not null default 0, status text not null default 'active',
        completed_at timestamptz
      );
      create table public.academy_program_courses(program_id uuid, course_id uuid, requirement_type text);
      create table public.course_enrollments(user_id uuid, course_id uuid, status text);
      create function public.academy_refresh_program_enrollment(uuid)
        returns public.academy_program_enrollments language sql as $$ select null::public.academy_program_enrollments $$;
      grant execute on function public.academy_refresh_program_enrollment(uuid) to public, anon, authenticated;
      insert into public.profiles values ('${admin}','admin','active');
      insert into public.academy_students values ('${student}','${student}'), ('${other}','${other}');
      insert into public.academy_program_enrollments(id,student_id,program_id) values
        ('${enrollment}','${student}','${program}'),
        ('${otherEnrollment}','${other}','${program}');
      insert into public.academy_program_courses values
        ('${program}','40000000-0000-4000-8000-000000000001','required'),
        ('${program}','40000000-0000-4000-8000-000000000002','required');
      insert into public.course_enrollments values ('${student}','40000000-0000-4000-8000-000000000001','completed');
    `)
    await db.exec(migration)
    assert.equal((await db.query("select has_function_privilege('anon','public.academy_refresh_program_enrollment(uuid)','execute')")).rows[0].has_function_privilege, false)
    await withRole('authenticated', null, async () => {
      await assert.rejects(call(missing), error => error.code === '42501')
    })
    await withRole('authenticated', other, async () => {
      await assert.rejects(call(enrollment), error => error.code === '42501')
    })
    const owner = await withRole('authenticated', student, () => call(enrollment))
    assert.equal(Number(owner.rows[0].progress_percent), 50)
    assert.equal(owner.rows[0].status, 'active')
    const adminResult = await withRole('authenticated', admin, () => call(otherEnrollment))
    assert.equal(Number(adminResult.rows[0].progress_percent), 0)
  } finally {
    await db.close()
  }
})

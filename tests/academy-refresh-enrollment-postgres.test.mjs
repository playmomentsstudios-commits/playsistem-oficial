import test from 'node:test'
import assert from 'node:assert/strict'
import { PGlite } from '@electric-sql/pglite'
import { readFile } from 'node:fs/promises'

const migration = await readFile(
  new URL('../supabase/migrations/20261011060000_restrict_academy_refresh_enrollment.sql', import.meta.url),
  'utf8',
)

test('academy enrollment refresh enforces caller scope and keeps internal completion flows', async () => {
  const db = new PGlite()
  const learner = '10000000-0000-4000-8000-000000000001'
  const other = '10000000-0000-4000-8000-000000000002'
  const admin = '10000000-0000-4000-8000-000000000003'
  const inactiveAdmin = '10000000-0000-4000-8000-000000000004'
  const course = '20000000-0000-4000-8000-000000000001'
  const curriculum = '30000000-0000-4000-8000-000000000001'
  const module = '40000000-0000-4000-8000-000000000001'
  const lesson = '50000000-0000-4000-8000-000000000001'
  const assessment = '60000000-0000-4000-8000-000000000001'
  const enrollment = '70000000-0000-4000-8000-000000000001'
  const otherEnrollment = '70000000-0000-4000-8000-000000000002'
  const call = id => db.query(
    'select status,progress_percent,attendance_percent,final_grade from public.academy_refresh_enrollment($1::uuid)',
    [id],
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
      create function public.is_active_admin() returns boolean language sql stable security definer
        set search_path=public as
        $$ select exists(select 1 from public.profiles where id=auth.uid() and role='admin' and status='active') $$;

      create table public.course_enrollments(
        id uuid primary key, user_id uuid not null, student_id uuid not null,
        course_id uuid not null, curriculum_id uuid not null, status text not null,
        progress_percent numeric not null default 0, attendance_percent numeric,
        final_grade numeric, completed_at timestamptz
      );
      create table public.academy_curricula(id uuid primary key, academic_rules jsonb);
      create table public.course_modules(id uuid primary key, course_id uuid not null);
      create table public.course_lessons(id uuid primary key, module_id uuid not null, status text not null);
      create table public.lesson_progress(
        id bigserial primary key, enrollment_id uuid not null, lesson_id uuid not null, completed boolean not null
      );
      create table public.academy_assessments(
        id uuid primary key, module_id uuid not null, passing_percent numeric not null, status text not null
      );
      create table public.academy_attempts(
        id bigserial primary key, assessment_id uuid not null, user_id uuid not null,
        status text not null, snapshot jsonb not null, score numeric not null
      );
      create table public.academy_attendance(
        id bigserial primary key, enrollment_id uuid not null, attendance_type text not null, attended boolean not null
      );
      create table public.academy_events(
        id bigserial primary key, student_id uuid not null, enrollment_id uuid not null,
        event_type text not null, title text not null, metadata jsonb not null
      );
      create table public.notifications(
        id bigserial primary key, user_id uuid not null, type text not null, title text not null,
        message text not null, link text not null, metadata jsonb not null
      );
      create function public.academy_refresh_enrollment(uuid)
        returns public.course_enrollments language plpgsql security definer
        as $$ begin return null; end $$;
      grant execute on function public.academy_refresh_enrollment(uuid)
        to public, anon, authenticated, service_role;

      insert into public.profiles values
        ('${learner}','customer','active'),
        ('${other}','customer','active'),
        ('${admin}','admin','active'),
        ('${inactiveAdmin}','admin','inactive');
      insert into public.course_enrollments
        (id,user_id,student_id,course_id,curriculum_id,status,progress_percent,attendance_percent)
      values
        ('${enrollment}','${learner}','${learner}','${course}','${curriculum}','active',5,0),
        ('${otherEnrollment}','${other}','${other}','${course}','${curriculum}','active',5,0);
      insert into public.academy_curricula values
        ('${curriculum}','{"attendance_required":true,"minimum_attendance_percent":80}');
      insert into public.course_modules values ('${module}','${course}');
      insert into public.course_lessons values ('${lesson}','${module}','published');
      insert into public.lesson_progress(enrollment_id,lesson_id,completed)
        values ('${enrollment}','${lesson}',true);
      insert into public.academy_assessments values ('${assessment}','${module}',70,'published');
      insert into public.academy_attempts(assessment_id,user_id,status,snapshot,score)
        values ('${assessment}','${learner}','completed','[{"points":100}]',80);
      insert into public.academy_attendance(enrollment_id,attendance_type,attended)
        values ('${enrollment}','present',true),('${otherEnrollment}','absent',false);

      create table public.courses(id uuid primary key,status text not null,certificate_enabled boolean not null);
      create table public.academy_certificates(
        id bigserial primary key, course_id uuid not null, user_id uuid not null,
        enrollment_id uuid not null, unique(course_id,user_id)
      );
      insert into public.courses values ('${course}','published',true);
    `)
    await db.exec(migration)

    const acl = (await db.query(`
      select has_function_privilege('anon','public.academy_refresh_enrollment(uuid)','execute') as anon,
             has_function_privilege('authenticated','public.academy_refresh_enrollment(uuid)','execute') as authenticated,
             has_function_privilege('service_role','public.academy_refresh_enrollment(uuid)','execute') as service_role
    `)).rows[0]
    assert.deepEqual(acl, { anon: false, authenticated: true, service_role: true })

    await db.exec(`
      create function public.academy_refresh_my_enrollments()
        returns setof public.course_enrollments language sql security definer
        set search_path=public as
        $$ select public.academy_refresh_enrollment(e.id)
           from public.course_enrollments e where e.user_id=auth.uid() $$;
      grant execute on function public.academy_refresh_my_enrollments()
        to public, anon, authenticated, service_role;

      create function public.academy_issue_my_certificate(p_course_id uuid)
        returns public.academy_certificates language plpgsql security definer
        set search_path=public as $$
        declare e public.course_enrollments; c public.courses; cert public.academy_certificates;
        begin
          select * into c from public.courses where id=p_course_id and status='published';
          if not found or not coalesce(c.certificate_enabled,false) then raise exception 'Certificate unavailable'; end if;
          select * into e from public.course_enrollments
            where course_id=p_course_id and user_id=auth.uid() and status in ('active','completed') limit 1;
          if not found then raise exception 'Enrollment not found'; end if;
          e:=public.academy_refresh_enrollment(e.id);
          if e.status<>'completed' then raise exception 'Course incomplete'; end if;
          insert into public.academy_certificates(course_id,user_id,enrollment_id)
            values(p_course_id,auth.uid(),e.id)
            on conflict(course_id,user_id) do update set enrollment_id=excluded.enrollment_id
            returning * into cert;
          return cert;
        end $$;
      grant execute on function public.academy_issue_my_certificate(uuid) to authenticated;
    `)

    const denied = async (role, uid, id) =>
      withRole(role, uid, async () =>
        assert.rejects(call(id), error => error.code === '42501'))
    await denied('anon', null, enrollment)
    await denied('service_role', null, enrollment)
    await denied('authenticated', other, enrollment)
    await denied('authenticated', inactiveAdmin, otherEnrollment)
    const unchanged = (await db.query(
      'select status,progress_percent from public.course_enrollments where id=$1::uuid', [enrollment],
    )).rows[0]
    assert.equal(unchanged.status, 'active')
    assert.equal(Number(unchanged.progress_percent), 5)
    assert.equal((await db.query('select count(*)::int as n from public.academy_events')).rows[0].n, 0)
    assert.equal((await db.query('select count(*)::int as n from public.notifications')).rows[0].n, 0)

    const result = await withRole('authenticated', learner, () => call(enrollment))
    assert.equal(result.rows[0].status, 'completed')
    assert.equal(Number(result.rows[0].progress_percent), 100)
    assert.equal(Number(result.rows[0].attendance_percent), 100)
    assert.equal(Number(result.rows[0].final_grade), 80)
    assert.equal((await db.query('select count(*)::int as n from public.academy_events')).rows[0].n, 1)
    assert.equal((await db.query('select count(*)::int as n from public.notifications')).rows[0].n, 1)

    const own = await withRole('authenticated', learner, () =>
      db.query('select id from public.academy_refresh_my_enrollments()'))
    assert.deepEqual(own.rows.map(row => row.id), [enrollment])
    await withRole('anon', null, async () => {
      const empty = await db.query('select id from public.academy_refresh_my_enrollments()')
      assert.equal(empty.rows.length, 0)
    })

    const certificate = await withRole('authenticated', learner, () =>
      db.query('select id from public.academy_issue_my_certificate($1::uuid)', [course]))
    assert.equal(certificate.rows.length, 1)
    assert.equal((await db.query('select count(*)::int as n from public.academy_certificates')).rows[0].n, 1)
    assert.equal((await db.query('select count(*)::int as n from public.academy_events')).rows[0].n, 1)
    assert.equal((await db.query('select count(*)::int as n from public.notifications')).rows[0].n, 1)

    const adminResult = await withRole('authenticated', admin, () => call(otherEnrollment))
    assert.equal(adminResult.rows[0].status, 'active')
  } finally {
    await db.close()
  }
})

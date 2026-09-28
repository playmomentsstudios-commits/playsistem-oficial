-- Publish Produto 01 end-to-end and enroll the existing Felipe Designer test profile when uniquely identifiable.
-- Safe to re-run: updates are scoped to the course slug and enrollment uses the existing unique(course_id,user_id).
begin;

do $publish$
declare
  cid uuid;
  test_user_id uuid;
  matches integer := 0;
begin
  select id into cid
  from public.courses
  where slug = 'do-zero-ao-digital'
  limit 1;

  if cid is null then
    raise exception 'Curso do-zero-ao-digital não encontrado. Aplique primeiro o seed do Produto 01.';
  end if;

  update public.courses
  set status = 'published',
      published_at = coalesce(published_at, now()),
      updated_at = now()
  where id = cid;

  update public.course_lessons l
  set status = 'published',
      updated_at = now()
  from public.course_modules m
  where m.id = l.module_id
    and m.course_id = cid;

  update public.academy_assessments a
  set status = 'published',
      updated_at = now()
  from public.course_modules m
  where m.id = a.module_id
    and m.course_id = cid;

  -- Match the test account without assuming a single profiles naming column.
  -- to_jsonb keeps this compatible with the current profile schema.
  select count(*), min(p.id)
    into matches, test_user_id
  from public.profiles p
  where lower(trim(coalesce(
    to_jsonb(p)->>'full_name',
    to_jsonb(p)->>'name',
    to_jsonb(p)->>'nome',
    to_jsonb(p)->>'display_name',
    ''
  ))) = 'felipe designer';

  if matches = 1 then
    insert into public.course_enrollments(course_id, user_id, status, source)
    values (cid, test_user_id, 'active', 'manual')
    on conflict (course_id, user_id) do update
      set status = 'active',
          source = 'manual',
          completed_at = null;
    raise notice 'Felipe Designer matriculado no Do Zero ao Digital.';
  elsif matches = 0 then
    raise notice 'Perfil Felipe Designer não localizado por nome; publicação concluída e matrícula deve ser feita pelo Admin.';
  else
    raise notice 'Mais de um perfil Felipe Designer localizado; publicação concluída sem matrícula automática por segurança.';
  end if;
end
$publish$;

commit;

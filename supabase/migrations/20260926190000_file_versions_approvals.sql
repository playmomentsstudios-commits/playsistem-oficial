-- File versions, client approvals and review history.

alter table public.client_files
  add column if not exists version_group_id uuid,
  add column if not exists version_number integer not null default 1 check (version_number >= 1),
  add column if not exists supersedes_file_id uuid references public.client_files(id) on delete set null,
  add column if not exists review_required boolean not null default false,
  add column if not exists review_status text not null default 'not_required'
    check (review_status in ('not_required','pending','approved','changes_requested')),
  add column if not exists review_requested_at timestamptz,
  add column if not exists review_requested_by uuid references public.profiles(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references public.profiles(id) on delete set null;

update public.client_files
set version_group_id=id
where version_group_id is null;

alter table public.client_files
  alter column version_group_id set not null;

create index if not exists client_files_version_group_idx
  on public.client_files(version_group_id,version_number desc);

create index if not exists client_files_review_status_idx
  on public.client_files(review_status,review_requested_at desc);

create unique index if not exists client_files_version_unique
  on public.client_files(version_group_id,version_number);

create table if not exists public.file_reviews (
  id uuid primary key default gen_random_uuid(),
  file_id uuid not null references public.client_files(id) on delete cascade,
  customer_id uuid not null references public.profiles(id) on delete cascade,
  action text not null check (action in ('requested','approved','changes_requested','cancelled')),
  comment text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists file_reviews_file_idx
  on public.file_reviews(file_id,created_at desc);

alter table public.file_reviews enable row level security;

drop policy if exists file_reviews_read on public.file_reviews;
create policy file_reviews_read
on public.file_reviews for select to authenticated
using (
  customer_id=auth.uid()
  or public.current_user_is_admin()
  or public.current_user_has_permission('files.view')
  or public.current_user_has_permission('files.manage')
);

grant select on public.file_reviews to authenticated;

create or replace function public.request_file_review(
  p_file_id uuid
)
returns public.client_files
language plpgsql
security definer
set search_path=public
as $$
declare
  f public.client_files%rowtype;
begin
  if not (
    public.current_user_is_admin()
    or public.current_user_has_permission('files.manage')
  ) then
    raise exception 'File management permission required' using errcode='42501';
  end if;

  update public.client_files
  set
    client_visible=true,
    review_required=true,
    review_status='pending',
    review_requested_at=now(),
    review_requested_by=auth.uid(),
    reviewed_at=null,
    reviewed_by=null
  where id=p_file_id
  returning * into f;

  if not found then
    raise exception 'File not found' using errcode='P0002';
  end if;

  insert into public.file_reviews(file_id,customer_id,action,created_by)
  values(f.id,f.customer_id,'requested',auth.uid());

  insert into public.notifications(user_id,type,title,message,link,metadata)
  values(
    f.customer_id,
    'file_review_requested',
    'Arquivo aguardando sua aprovação',
    'A equipe enviou uma versão para sua análise.',
    '/app/arquivos',
    jsonb_build_object('file_id',f.id,'project_id',f.project_id,'version_number',f.version_number)
  );

  return f;
end;
$$;

revoke all on function public.request_file_review(uuid) from public;
grant execute on function public.request_file_review(uuid) to authenticated;

create or replace function public.cancel_file_review(
  p_file_id uuid
)
returns public.client_files
language plpgsql
security definer
set search_path=public
as $$
declare
  f public.client_files%rowtype;
begin
  if not (
    public.current_user_is_admin()
    or public.current_user_has_permission('files.manage')
  ) then
    raise exception 'File management permission required' using errcode='42501';
  end if;

  update public.client_files
  set
    review_required=false,
    review_status='not_required',
    review_requested_at=null,
    review_requested_by=null,
    reviewed_at=null,
    reviewed_by=null
  where id=p_file_id
  returning * into f;

  if not found then
    raise exception 'File not found' using errcode='P0002';
  end if;

  insert into public.file_reviews(file_id,customer_id,action,created_by)
  values(f.id,f.customer_id,'cancelled',auth.uid());

  return f;
end;
$$;

revoke all on function public.cancel_file_review(uuid) from public;
grant execute on function public.cancel_file_review(uuid) to authenticated;

create or replace function public.submit_file_review(
  p_file_id uuid,
  p_action text,
  p_comment text default null
)
returns public.client_files
language plpgsql
security definer
set search_path=public
as $$
declare
  f public.client_files%rowtype;
begin
  if p_action not in ('approved','changes_requested') then
    raise exception 'Invalid review action' using errcode='22023';
  end if;

  select * into f
  from public.client_files
  where id=p_file_id
  for update;

  if not found then
    raise exception 'File not found' using errcode='P0002';
  end if;

  if f.customer_id<>auth.uid()
    or not f.client_visible
    or not f.review_required
    or f.review_status<>'pending'
    or not public.current_user_is_active_customer()
  then
    raise exception 'This file is not awaiting your review' using errcode='42501';
  end if;

  update public.client_files
  set
    review_status=p_action,
    reviewed_at=now(),
    reviewed_by=auth.uid()
  where id=p_file_id
  returning * into f;

  insert into public.file_reviews(file_id,customer_id,action,comment,created_by)
  values(
    f.id,
    f.customer_id,
    p_action,
    nullif(btrim(coalesce(p_comment,'')),''),
    auth.uid()
  );

  insert into public.notifications(user_id,type,title,message,link,metadata)
  select
    p.id,
    case when p_action='approved' then 'file_approved' else 'file_changes_requested' end,
    case when p_action='approved' then 'Arquivo aprovado pelo cliente' else 'Cliente solicitou ajustes' end,
    case when p_action='approved'
      then 'O cliente aprovou uma versão enviada.'
      else 'O cliente solicitou alterações em uma versão enviada.'
    end,
    '/admin/projetos/'||coalesce(f.project_id::text,''),
    jsonb_build_object(
      'file_id',f.id,
      'customer_id',f.customer_id,
      'project_id',f.project_id,
      'version_number',f.version_number
    )
  from public.profiles p
  left join public.staff_profiles sp on sp.user_id=p.id
  where p.status='active'
    and (
      p.role='admin'
      or (
        p.role='staff'
        and sp.active
        and ('*'=any(sp.permissions) or 'files.manage'=any(sp.permissions))
      )
    );

  return f;
end;
$$;

revoke all on function public.submit_file_review(uuid,text,text) from public;
grant execute on function public.submit_file_review(uuid,text,text) to authenticated;

create or replace function public.link_file_version(
  p_new_file_id uuid,
  p_previous_file_id uuid
)
returns public.client_files
language plpgsql
security definer
set search_path=public
as $$
declare
  previous_file public.client_files%rowtype;
  new_file public.client_files%rowtype;
  next_version integer;
begin
  if not (
    public.current_user_is_admin()
    or public.current_user_has_permission('files.manage')
  ) then
    raise exception 'File management permission required' using errcode='42501';
  end if;

  select * into previous_file
  from public.client_files
  where id=p_previous_file_id
  for update;

  if not found then
    raise exception 'Previous file not found' using errcode='P0002';
  end if;

  select * into new_file
  from public.client_files
  where id=p_new_file_id
  for update;

  if not found then
    raise exception 'New file not found' using errcode='P0002';
  end if;

  if previous_file.project_id is distinct from new_file.project_id
    or previous_file.customer_id is distinct from new_file.customer_id
  then
    raise exception 'Files must belong to the same customer and project' using errcode='22023';
  end if;

  select coalesce(max(version_number),0)+1 into next_version
  from public.client_files
  where version_group_id=previous_file.version_group_id;

  update public.client_files
  set
    version_group_id=previous_file.version_group_id,
    version_number=next_version,
    supersedes_file_id=previous_file.id,
    review_required=false,
    review_status='not_required',
    review_requested_at=null,
    review_requested_by=null,
    reviewed_at=null,
    reviewed_by=null
  where id=new_file.id
  returning * into new_file;

  return new_file;
end;
$$;

revoke all on function public.link_file_version(uuid,uuid) from public;
grant execute on function public.link_file_version(uuid,uuid) to authenticated;

create or replace function public.client_file_default_version_group()
returns trigger
language plpgsql
set search_path=public
as $$
begin
  if new.version_group_id is null then
    new.version_group_id:=new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists client_files_default_version_group on public.client_files;
create trigger client_files_default_version_group
before insert on public.client_files
for each row execute function public.client_file_default_version_group();

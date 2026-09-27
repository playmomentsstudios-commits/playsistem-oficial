-- Structured client adjustment requests with checklist items and reference attachments.

alter table public.file_reviews
  add column if not exists subject text,
  add column if not exists items jsonb not null default '[]'::jsonb,
  add column if not exists attachments jsonb not null default '[]'::jsonb;

create or replace function public.submit_file_review_v2(
  p_file_id uuid,
  p_action text,
  p_comment text default null,
  p_subject text default null,
  p_items jsonb default '[]'::jsonb,
  p_attachments jsonb default '[]'::jsonb
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
  if jsonb_typeof(coalesce(p_items,'[]'::jsonb)) <> 'array'
    or jsonb_typeof(coalesce(p_attachments,'[]'::jsonb)) <> 'array' then
    raise exception 'Review items and attachments must be arrays' using errcode='22023';
  end if;

  select * into f from public.client_files where id=p_file_id for update;
  if not found then raise exception 'File not found' using errcode='P0002'; end if;

  if f.customer_id<>auth.uid()
    or not f.client_visible
    or not f.review_required
    or f.review_status<>'pending'
    or not public.current_user_is_active_customer()
  then
    raise exception 'This file is not awaiting your review' using errcode='42501';
  end if;

  update public.client_files
  set review_status=p_action, reviewed_at=now(), reviewed_by=auth.uid()
  where id=p_file_id returning * into f;

  insert into public.file_reviews(file_id,customer_id,action,comment,subject,items,attachments,created_by)
  values(
    f.id,f.customer_id,p_action,
    nullif(btrim(coalesce(p_comment,'')),''),
    nullif(btrim(coalesce(p_subject,'')),''),
    coalesce(p_items,'[]'::jsonb),
    coalesce(p_attachments,'[]'::jsonb),
    auth.uid()
  );

  insert into public.notifications(user_id,type,title,message,link,metadata)
  select p.id,
    case when p_action='approved' then 'file_approved' else 'file_changes_requested' end,
    case when p_action='approved' then 'Arquivo aprovado pelo cliente' else 'Cliente solicitou ajustes' end,
    case when p_action='approved' then 'O cliente aprovou uma versão enviada.'
      else coalesce(nullif(btrim(p_subject),''),'O cliente solicitou alterações em uma versão enviada.') end,
    '/admin/arquivos',
    jsonb_build_object('file_id',f.id,'customer_id',f.customer_id,'project_id',f.project_id,'version_number',f.version_number)
  from public.profiles p
  left join public.staff_profiles sp on sp.user_id=p.id
  where p.status='active'
    and (p.role='admin' or (p.role='staff' and sp.active and ('*'=any(sp.permissions) or 'files.manage'=any(sp.permissions))));

  return f;
end;
$$;

revoke all on function public.submit_file_review_v2(uuid,text,text,text,jsonb,jsonb) from public;
grant execute on function public.submit_file_review_v2(uuid,text,text,text,jsonb,jsonb) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit)
values('file-review-attachments','file-review-attachments',false,10485760)
on conflict(id) do update set public=false,file_size_limit=10485760;

drop policy if exists file_review_attachments_customer_insert on storage.objects;
create policy file_review_attachments_customer_insert on storage.objects
for insert to authenticated
with check (
  bucket_id='file-review-attachments'
  and (storage.foldername(name))[1]=auth.uid()::text
  and public.current_user_is_active_customer()
);

drop policy if exists file_review_attachments_customer_read on storage.objects;
create policy file_review_attachments_customer_read on storage.objects
for select to authenticated
using (
  bucket_id='file-review-attachments'
  and (
    (storage.foldername(name))[1]=auth.uid()::text
    or public.current_user_is_admin()
    or public.current_user_has_permission('files.view')
    or public.current_user_has_permission('files.manage')
  )
);

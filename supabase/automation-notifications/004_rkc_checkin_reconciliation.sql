-- RKC voice check-in: approval-gated task reconciliation (no WhatsApp changes).
-- Apply after reviewing project-specific access. This migration does not update production tasks.
create table if not exists public.rkc_checkin_reviews (
 id uuid primary key default gen_random_uuid(),
 project_id uuid not null references public.projects(id),
 request_key text not null unique,
 source text not null default 'chatgpt_voice' check (source in ('chatgpt_voice','chatgpt_text','admin')),
 transcript_summary text not null check(length(transcript_summary) between 1 and 6000),
 proposed_changes jsonb not null default '[]'::jsonb check (jsonb_typeof(proposed_changes)='array'),
 consultant_notes text not null default '',
 status text not null default 'draft' check(status in ('draft','applied','rejected')),
 created_by uuid references auth.users(id),
 approved_by uuid references auth.users(id),
 created_at timestamptz not null default now(),
 applied_at timestamptz,
 result jsonb
);
create index if not exists rkc_checkin_reviews_project_created on public.rkc_checkin_reviews(project_id,created_at desc);
alter table public.rkc_checkin_reviews enable row level security;
revoke all on public.rkc_checkin_reviews from public,anon,authenticated;
grant select on public.rkc_checkin_reviews to authenticated;
create policy rkc_reviews_admin_read on public.rkc_checkin_reviews for select to authenticated
 using ((select auth.uid()) is not null and public.current_user_is_admin());
-- No direct write grants: only privileged RPCs, with verified admin session.

create or replace function public.rkc_checkin_prepare(
 p_key text, p_summary text, p_changes jsonb, p_notes text default ''
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_change jsonb; v_task public.tasks%rowtype; v_check public.task_checklist_items%rowtype;
 v_project constant uuid := '33706aee-6c49-48fb-aa8d-1de3cfce01a9';
begin
 if auth.uid() is null or not public.current_user_is_admin() then raise exception 'Admin required' using errcode='42501'; end if;
 if p_key is null or p_key !~ '^[a-zA-Z0-9:_-]{12,120}$' or p_summary is null or length(btrim(p_summary)) not between 1 and 6000
  or p_changes is null or jsonb_typeof(p_changes)<>'array' or jsonb_array_length(p_changes)>25
  or length(coalesce(p_notes,''))>4000 then raise exception 'Invalid check-in' using errcode='22023'; end if;
 for v_change in select value from jsonb_array_elements(p_changes) loop
  if jsonb_typeof(v_change)<>'object' or not (v_change ? 'task_id')
    or coalesce(v_change->>'task_id','') !~* '^[0-9a-f]{8}-[0-9a-f-]{27,36}$'
    or coalesce(v_change->>'action','') not in ('task_status','checklist') then
    raise exception 'Unsupported change' using errcode='22023'; end if;
  select * into v_task from public.tasks where id=(v_change->>'task_id')::uuid and project_id=v_project;
  if not found then raise exception 'Task outside RKC' using errcode='22023'; end if;
  if v_change->>'action'='task_status' then
   if coalesce(v_change->>'expected_status','')<>v_task.status
    or coalesce(v_change->>'new_status','') not in ('pending','in_progress','review','completed','cancelled')
    or (v_change->>'new_status'='completed' and v_change->>'completion_confirmed' is distinct from 'true') then
    raise exception 'Status conflict or missing confirmation' using errcode='22023'; end if;
  else
   if coalesce(v_change->>'checklist_id','') !~* '^[0-9a-f]{8}-[0-9a-f-]{27,36}$'
    or jsonb_typeof(v_change->'completed') is distinct from 'boolean' then
    raise exception 'Invalid checklist change' using errcode='22023'; end if;
   select * into v_check from public.task_checklist_items where id=(v_change->>'checklist_id')::uuid and task_id=v_task.id;
   if not found or (v_change->>'expected_completed')::boolean is distinct from v_check.completed
    or (v_change->>'completed'='true' and v_change->>'completion_confirmed' is distinct from 'true') then
    raise exception 'Checklist conflict or missing confirmation' using errcode='22023'; end if;
  end if;
 end loop;
 insert into public.rkc_checkin_reviews(project_id,request_key,transcript_summary,proposed_changes,consultant_notes,created_by)
 values(v_project,p_key,btrim(p_summary),p_changes,coalesce(p_notes,''),auth.uid())
 on conflict(request_key) do nothing returning id into v_id;
 if v_id is null then
  select id into v_id from public.rkc_checkin_reviews where request_key=p_key and project_id=v_project
   and transcript_summary=btrim(p_summary) and proposed_changes=p_changes;
  if v_id is null then raise exception 'Idempotency conflict' using errcode='22023'; end if;
 end if;
 return jsonb_build_object('review_id',v_id,'status','draft','changes',jsonb_array_length(p_changes));
end $$;
revoke all on function public.rkc_checkin_prepare(text,text,jsonb,text) from public,anon;
grant execute on function public.rkc_checkin_prepare(text,text,jsonb,text) to authenticated;

create or replace function public.rkc_checkin_apply(p_review_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_review public.rkc_checkin_reviews%rowtype; v_change jsonb;
 v_task public.tasks%rowtype; v_check public.task_checklist_items%rowtype;
 v_count integer:=0;
begin
 if auth.uid() is null or not public.current_user_is_admin() then raise exception 'Admin required' using errcode='42501'; end if;
 select * into v_review from public.rkc_checkin_reviews where id=p_review_id for update;
 if not found then raise exception 'Review not found' using errcode='22023'; end if;
 if v_review.status='applied' then return coalesce(v_review.result,'{}'::jsonb); end if;
 if v_review.status<>'draft' or v_review.project_id<>'33706aee-6c49-48fb-aa8d-1de3cfce01a9'::uuid then
  raise exception 'Invalid review state' using errcode='22023'; end if;
 -- Recheck every optimistic precondition BEFORE any changes. A failure rolls back all writes.
 for v_change in select value from jsonb_array_elements(v_review.proposed_changes) loop
  select * into v_task from public.tasks where id=(v_change->>'task_id')::uuid
   and project_id=v_review.project_id for update;
  if not found then raise exception 'Task missing' using errcode='22023'; end if;
  if v_change->>'action'='task_status' then
   if v_task.status is distinct from v_change->>'expected_status' then raise exception 'Task changed since review' using errcode='40001'; end if;
  elsif v_change->>'action'='checklist' then
   select * into v_check from public.task_checklist_items
    where id=(v_change->>'checklist_id')::uuid and task_id=v_task.id for update;
   if not found or v_check.completed is distinct from (v_change->>'expected_completed')::boolean
   then raise exception 'Checklist changed since review' using errcode='40001'; end if;
  else raise exception 'Unsupported change' using errcode='22023'; end if;
 end loop;
 for v_change in select value from jsonb_array_elements(v_review.proposed_changes) loop
  if v_change->>'action'='task_status' then
   update public.tasks set status=v_change->>'new_status',
    completed_at=case when v_change->>'new_status'='completed' then now() else null end
   where id=(v_change->>'task_id')::uuid;
  else
   update public.task_checklist_items set completed=(v_change->>'completed')::boolean
    where id=(v_change->>'checklist_id')::uuid;
  end if;
  v_count:=v_count+1;
 end loop;
 update public.rkc_checkin_reviews set status='applied',approved_by=auth.uid(),applied_at=now(),
  result=jsonb_build_object('status','applied','updated',v_count,'project_id',v_review.project_id)
 where id=p_review_id;
 return jsonb_build_object('status','applied','updated',v_count,'project_id',v_review.project_id);
end $$;
revoke all on function public.rkc_checkin_apply(uuid) from public,anon;
grant execute on function public.rkc_checkin_apply(uuid) to authenticated;

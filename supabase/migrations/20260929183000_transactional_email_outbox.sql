-- Provider-neutral transactional email outbox. External delivery stays disabled until a provider/domain is configured.
begin;

create table if not exists public.transactional_email_outbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_key text not null,
  entity_type text not null,
  entity_id uuid not null,
  template_key text not null,
  recipient_email text not null,
  subject text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check(status in ('pending','processing','sent','failed','cancelled')),
  attempts integer not null default 0,
  provider text,
  provider_message_id text,
  last_error text,
  next_attempt_at timestamptz not null default now(),
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(event_key,entity_type,entity_id,user_id)
);
create index if not exists transactional_email_outbox_pending_idx
  on public.transactional_email_outbox(status,next_attempt_at,created_at);

alter table public.transactional_email_outbox enable row level security;
drop policy if exists transactional_email_outbox_staff_read on public.transactional_email_outbox;
create policy transactional_email_outbox_staff_read on public.transactional_email_outbox
for select to authenticated using(public.current_user_is_staff_or_admin());
grant select on public.transactional_email_outbox to authenticated;

create or replace function public.queue_transactional_email(
  p_user_id uuid,p_event_key text,p_entity_type text,p_entity_id uuid,
  p_template_key text,p_subject text,p_payload jsonb default '{}'::jsonb
) returns uuid
language plpgsql security definer set search_path=public as $$
declare v_email text; v_id uuid;
begin
  select email into v_email from public.profiles where id=p_user_id and status='active';
  if coalesce(btrim(v_email),'')='' then return null; end if;
  insert into public.transactional_email_outbox(
    user_id,event_key,entity_type,entity_id,template_key,recipient_email,subject,payload
  ) values(p_user_id,p_event_key,p_entity_type,p_entity_id,p_template_key,v_email,p_subject,coalesce(p_payload,'{}'::jsonb))
  on conflict(event_key,entity_type,entity_id,user_id) do update
    set payload=excluded.payload,subject=excluded.subject,updated_at=now()
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.queue_transactional_email(uuid,text,text,uuid,text,text,jsonb) from public;

create or replace function public.queue_transactional_email_from_notification()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_entity_type text; v_entity_id uuid; v_template text;
begin
  case new.type
    when 'payment_confirmed' then
      v_entity_type:='payment'; v_entity_id:=nullif(new.metadata->>'payment_id','')::uuid; v_template:='payment_confirmed';
    when 'academy_enrollment' then
      v_entity_type:='enrollment'; v_entity_id:=nullif(new.metadata->>'enrollment_id','')::uuid; v_template:='academy_enrollment';
    when 'project_completed' then
      v_entity_type:='project'; v_entity_id:=nullif(new.metadata->>'project_id','')::uuid; v_template:='project_completed';
    else return new;
  end case;
  if v_entity_id is not null then
    perform public.queue_transactional_email(new.user_id,new.type,v_entity_type,v_entity_id,v_template,new.title,
      jsonb_build_object('message',new.message,'link',new.link,'notification_id',new.id)||new.metadata);
  end if;
  return new;
end $$;
drop trigger if exists notifications_queue_transactional_email on public.notifications;
create trigger notifications_queue_transactional_email
after insert on public.notifications for each row execute function public.queue_transactional_email_from_notification();

commit;

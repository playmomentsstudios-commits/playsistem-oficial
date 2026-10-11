-- Scoped, expiring, no-login file access for WhatsApp notices.
-- Never make Google Drive folders or files public.
create table if not exists public.wa_file_message_links (
 token_hash text primary key check (token_hash ~ '^[0-9a-f]{64}$'),
 notification_id uuid not null references public.notifications(id) on delete cascade,
 file_id uuid not null references public.client_files(id) on delete cascade,
 recipient_user_id uuid not null references public.profiles(id) on delete cascade,
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default (now()+interval '48 hours'),
 revoked_at timestamptz,
 constraint wa_file_token_valid_expiry check (expires_at>created_at and expires_at<=created_at+interval '48 hours')
);
create index if not exists wa_file_message_links_expiration_idx
 on public.wa_file_message_links(expires_at);
alter table public.wa_file_message_links enable row level security;
revoke all on public.wa_file_message_links from anon,authenticated;
-- This helper is reachable only from our server-side Edge Function through the service role.
create or replace function public.wa_resolve_file_link(p_token text)
returns table(drive_file_id text,file_name text,mime_type text)
language plpgsql stable security definer set search_path='' as $$
begin
 if p_token is null or p_token !~ '^[0-9a-f]{64}$' then return; end if;
 return query
 select f.drive_file_id,f.name,f.mime_type
 from public.wa_file_message_links l
 join public.client_files f on f.id=l.file_id
 join public.profiles u on u.id=l.recipient_user_id
 join public.projects p on p.id=f.project_id
 left join public.project_stages s on s.id=f.stage_id and s.project_id=f.project_id
 left join public.tasks t on t.id=f.task_id and t.project_id=f.project_id
 where l.token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex')
  and l.expires_at>now() and l.revoked_at is null
  and f.client_visible and f.storage_provider='google_drive' and f.drive_file_id is not null
  and u.role='customer' and u.status='active'
  and p.project_type<>'internal'
  and (p.customer_id=l.recipient_user_id or exists(
    select 1 from public.project_customer_access a
    where a.project_id=p.id and a.customer_id=l.recipient_user_id
  ))
  and (f.stage_id is null or s.client_visible=true)
  and (f.task_id is null or t.client_visible=true)
 limit 1;
end $$;
revoke all on function public.wa_resolve_file_link(text) from public,anon,authenticated;
grant execute on function public.wa_resolve_file_link(text) to service_role;

-- Augment newly generated customer notifications, without modifying historic
-- sent messages. The token is high-entropy, stored only as a SHA-256 hash and
-- expires after 48 hours. Links resolve without Sagamente login but can be
-- forwarded during their validity; users should not share them.
create or replace function app_private.wa_add_file_link_to_outbox()
returns trigger language plpgsql security definer set search_path='' as $$
declare
 n public.notifications%rowtype;
 f public.client_files%rowtype;
 v_token text;
 v_file_url text;
 v_task uuid;
 v_stage uuid;
 v_project uuid;
 v_title text;
 v_link_label text;
begin
 if new.source<>'live' or new.status not in ('ready_manual','missing_phone')
 or new.event_type not in ('project_task','project_stage','file_available','file_received','file_review_requested')
 then return new; end if;
 select * into n from public.notifications where id=new.notification_id;
 if not found or n.user_id is distinct from new.recipient_user_id then return new; end if;
 if coalesce(n.metadata->>'project_id','') !~ '^[0-9a-fA-F-]{36}$' then return new; end if;
 v_project:=(n.metadata->>'project_id')::uuid;
 if not exists (
  select 1 from public.projects p join public.profiles u on u.id=n.user_id
  where p.id=v_project and p.project_type<>'internal'
   and u.role='customer' and u.status='active'
   and (p.customer_id=u.id or exists(
    select 1 from public.project_customer_access a
    where a.project_id=p.id and a.customer_id=u.id
   ))
 ) then return new; end if;

 if n.type='project_task' and coalesce(n.metadata->>'task_id','') ~ '^[0-9a-fA-F-]{36}$' then
   v_task:=(n.metadata->>'task_id')::uuid;
   if not exists(select 1 from public.tasks t where t.id=v_task and t.project_id=v_project and t.client_visible
    and (t.stage_id is null or exists (select 1 from public.project_stages s
      where s.id=t.stage_id and s.project_id=v_project and s.client_visible)))
   then return new; end if;
   select * into f from public.client_files candidate
   where candidate.project_id=v_project and candidate.task_id=v_task
    and candidate.client_visible and candidate.storage_provider='google_drive'
    and candidate.drive_file_id is not null
    and (candidate.stage_id is null or exists(select 1 from public.project_stages s
      where s.id=candidate.stage_id and s.project_id=v_project and s.client_visible))
   order by candidate.created_at desc,candidate.version_number desc,candidate.id desc limit 1;
 elsif n.type='project_stage' and coalesce(n.metadata->>'stage_id','') ~ '^[0-9a-fA-F-]{36}$' then
   v_stage:=(n.metadata->>'stage_id')::uuid;
   if not exists(select 1 from public.project_stages s
      where s.id=v_stage and s.project_id=v_project and s.client_visible)
   then return new; end if;
   select * into f from public.client_files candidate
   where candidate.project_id=v_project and candidate.stage_id=v_stage
    and candidate.client_visible and candidate.storage_provider='google_drive'
    and candidate.drive_file_id is not null
    and (candidate.task_id is null or exists(select 1 from public.tasks t
      where t.id=candidate.task_id and t.project_id=v_project and t.client_visible))
   order by candidate.created_at desc,candidate.version_number desc,candidate.id desc limit 1;
 elsif n.type in ('file_available','file_received','file_review_requested')
 and coalesce(n.metadata->>'file_id','') ~ '^[0-9a-fA-F-]{36}$' then
   select * into f from public.client_files candidate
    where candidate.id=(n.metadata->>'file_id')::uuid and candidate.project_id=v_project
     and candidate.client_visible and candidate.storage_provider='google_drive'
     and candidate.drive_file_id is not null
     and (candidate.stage_id is null or exists (select 1 from public.project_stages s
        where s.id=candidate.stage_id and s.project_id=v_project and s.client_visible))
     and (candidate.task_id is null or exists (select 1 from public.tasks t
        where t.id=candidate.task_id and t.project_id=v_project and t.client_visible));
 end if;
 if f.id is null then return new; end if;
 v_token:=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');
 insert into public.wa_file_message_links(token_hash,notification_id,file_id,recipient_user_id)
 values(encode(sha256(convert_to(v_token,'UTF8')),'hex'),n.id,f.id,n.user_id);
 v_file_url:='https://lfmjqctiutajgtacvxfq.supabase.co/functions/v1/whatsapp-file-open?t='||v_token;
 v_title:=left(regexp_replace(f.name,'[\r\n\t]',' ','g'),100);
 v_link_label:=case when n.type='project_task' then 'Ver tarefa e detalhes: '
  when n.type='project_stage' then 'Ver etapa e detalhes: '
  else 'Ver projeto e detalhes: ' end;
 -- Keep the compact notification locator in the last paragraph.
 update public.whatsapp_message_outbox o
 set message_body='SAGAMENTE — '||n.title||E'\n\n'||n.message||
    E'\n\n📎 Arquivo desta '||
    case when n.type='project_task' then 'tarefa' else 'etapa' end||
    ': '||v_title||E'\n'||v_file_url||
    E'\n\n'||v_link_label||
    'https://playsistem-oficial.playmomentsstudios.workers.dev'||o.target_link
 where o.id=new.id and o.target_link ~ '^/n/[A-Za-z0-9_-]{22}$';
 return new;
end $$;
revoke all on function app_private.wa_add_file_link_to_outbox() from public,anon,authenticated;
drop trigger if exists wa_enrich_notification_with_file on public.whatsapp_message_outbox;
create trigger wa_enrich_notification_with_file
 after insert on public.whatsapp_message_outbox
 for each row execute function app_private.wa_add_file_link_to_outbox();

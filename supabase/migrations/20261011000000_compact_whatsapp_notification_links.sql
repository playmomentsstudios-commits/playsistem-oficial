-- Deploy the frontend /n/:code resolver BEFORE applying this migration.
-- Compact UUID locator; authentication and notifications_own_read still apply.
-- In-app/push destinations remain full task links. No new public lookup API.

create or replace function app_private.wa_capture_notification(p_id uuid,p_historical boolean default false)
returns void language plpgsql security definer set search_path='' as $$
declare
 n public.notifications%rowtype;
 cfg public.app_settings%rowtype;
 v_raw text;
 v_phone text;
 v_name text;
 v_allowed boolean := false;
 v_message text;
 v_target_link text;
begin
 select * into n from public.notifications where id=p_id;
 if not found then return; end if;
 select * into cfg from public.app_settings where id=true;
 if not found then return; end if;
 v_allowed := case
  when n.type in ('project_status','project_updated') then cfg.wa_prepare_project_status
  when n.type='project_task' then cfg.wa_prepare_task_status
  when n.type='project_stage' then cfg.wa_prepare_stage_status
  when n.type in ('file_available','file_received') then cfg.wa_prepare_file_updates
  when n.type='file_review_requested' then cfg.wa_prepare_file_review
  when n.type in ('payment_confirmed_priority','project_created_priority','project_completed_priority') then cfg.wa_prepare_priority_events
  else false end;
 if not v_allowed then return; end if;
 select regexp_replace(coalesce(p.phone,''),'[^0-9]','','g'),
    btrim(concat_ws(' ',nullif(p.first_name,''),nullif(p.last_name,'')))
 into v_raw,v_name from public.profiles p where p.id=n.user_id;
 if not found then return; end if;
 if n.type in ('payment_confirmed_priority','project_created_priority','project_completed_priority') then
   v_raw := regexp_replace(coalesce(cfg.priority_whatsapp_phone,''),'[^0-9]','','g');
 end if;
 v_phone := case
  when v_raw ~ '^55[0-9]{10,11}$' then v_raw
  when v_raw ~ '^[0-9]{10,11}$' then '55'||v_raw
  else null end;
 v_target_link := n.link;
 v_message := 'SAGAMENTE — '||n.title||E'\n\n'||n.message;
 if n.type in ('project_task','project_stage','project_status','project_updated',
    'file_available','file_received','file_review_requested')
  and n.link ~ '^/app(/|$)' then
    v_target_link := '/n/'||translate(rtrim(encode(uuid_send(n.id),'base64'),'='),'+/','-_');
    v_message := v_message||E'\n\n'||case
      when n.link like '%/tarefas/%' then 'Ver tarefa e arquivos: '
      when n.link like '%/etapas/%' then 'Ver etapa: '
      else 'Ver projeto: ' end
      ||'https://playsistem-oficial.playmomentsstudios.workers.dev'||v_target_link;
 end if;
 insert into public.whatsapp_message_outbox
 (notification_id,recipient_user_id,recipient_name,destination_phone,event_type,title,
  message_body,target_link,status,source,created_at)
 values (n.id,n.user_id,coalesce(nullif(v_name,''),'Destinatário'),v_phone,n.type,n.title,
  v_message,v_target_link,
  case when p_historical then 'historical'
       when v_phone is null then 'missing_phone'
       else 'ready_manual' end,
  case when p_historical then 'historical' else 'live' end,
  n.created_at)
 on conflict (notification_id) do nothing;
end $$;

-- Prevent direct invocation of the existing private trigger helper.
revoke all on function app_private.wa_capture_notification(uuid,boolean) from public,anon,authenticated;

-- Refresh only unsent notices. Already sent and historical messages are untouched.
update public.whatsapp_message_outbox o
set target_link='/n/'||translate(rtrim(encode(uuid_send(n.id),'base64'),'='),'+/','-_'),
 message_body='SAGAMENTE — '||n.title||E'\n\n'||n.message||E'\n\n'||case
   when n.link like '%/tarefas/%' then 'Ver tarefa e arquivos: '
   when n.link like '%/etapas/%' then 'Ver etapa: '
   else 'Ver projeto: ' end
   ||'https://playsistem-oficial.playmomentsstudios.workers.dev/n/'
   ||translate(rtrim(encode(uuid_send(n.id),'base64'),'='),'+/','-_')
from public.notifications n
where o.notification_id=n.id
 and n.type in ('project_task','project_stage','project_status','project_updated',
   'file_available','file_received','file_review_requested')
 and n.link ~ '^/app(/|$)'
 and o.status in ('ready_manual','missing_phone');

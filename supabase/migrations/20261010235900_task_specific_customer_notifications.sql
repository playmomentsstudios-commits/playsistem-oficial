-- Task-level delivery links: notices about an individual task must not open
-- the full stage. Stage notices continue to open the full stage summary.
-- The page and file visibility are still checked by project RLS at read time.

create or replace function public.notify_task_change()
returns trigger language plpgsql security definer set search_path='public' as $$
begin
  if new.client_visible and old.status is distinct from new.status then
    insert into public.notifications(user_id,type,title,message,link,metadata)
    select recipients.user_id,'project_task','Tarefa atualizada',
      'A tarefa "'||new.title||'" agora está '||
        case new.status
          when 'review' then 'em revisão'
          when 'completed' then 'concluída'
          when 'in_progress' then 'em andamento'
          when 'pending' then 'pendente'
          when 'cancelled' then 'cancelada'
          else 'com status '||new.status end||'. Confira os arquivos e os procedimentos desta tarefa.',
      case when new.stage_id is not null and exists (
        select 1 from public.project_stages stage
        where stage.id=new.stage_id and stage.project_id=new.project_id and stage.client_visible
      ) then '/app/projetos/'||new.project_id::text||'/etapas/'||new.stage_id::text||'/tarefas/'||new.id::text
      else '/app/projetos/'||new.project_id::text end,
      jsonb_build_object('project_id',new.project_id,'task_id',new.id,
        'stage_id',new.stage_id,'status',new.status)
    from app_private.project_notice_recipients(new.project_id) recipients
    where public.customer_portal_notification_enabled(recipients.user_id,'project');
  end if;
  return new;
end; $$;

-- Both QR and manual messages use the outbox body. Include a canonical HTTPS
-- task/stage link at creation time; do not depend on older wa_bridge_claim
-- revisions, which might forward message_body without appending target_link.
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
 v_message := 'SAGAMENTE — '||n.title||E'\n\n'||n.message;
 if n.type in ('project_task','project_stage')
  and n.link ~ '^/app/projetos/[0-9a-fA-F-]{36}(/etapas/[0-9a-fA-F-]{36}(/tarefas/[0-9a-fA-F-]{36})?)?$' then
    v_message := v_message||E'\n\n'||case
      when n.link like '%/tarefas/%' then 'Ver tarefa e arquivos: '
      when n.link like '%/etapas/%' then 'Ver etapa: '
      else 'Ver projeto: ' end
      ||'https://playsistem-oficial.playmomentsstudios.workers.dev'||n.link;
 end if;
 insert into public.whatsapp_message_outbox
 (notification_id,recipient_user_id,recipient_name,destination_phone,event_type,title,
  message_body,target_link,status,source,created_at)
 values (n.id,n.user_id,coalesce(nullif(v_name,''),'Destinatário'),v_phone,n.type,n.title,
  v_message,n.link,
  case when p_historical then 'historical'
       when v_phone is null then 'missing_phone'
       else 'ready_manual' end,
  case when p_historical then 'historical' else 'live' end,
  n.created_at)
 on conflict (notification_id) do nothing;
end $$;

-- Update the destination of earlier *in-app* task notices when their task is
-- still published in that stage. No historical notification is re-sent.
update public.notifications n
set link='/app/projetos/'||t.project_id::text||'/etapas/'||t.stage_id::text||'/tarefas/'||t.id::text
from public.tasks t
join public.project_stages s on s.id=t.stage_id and s.project_id=t.project_id
where n.type='project_task'
  and n.metadata->>'task_id'=t.id::text
  and n.metadata->>'project_id'=t.project_id::text
  and n.metadata->>'stage_id'=t.stage_id::text
  and t.client_visible and s.client_visible
  and n.link is distinct from '/app/projetos/'||t.project_id::text||'/etapas/'||t.stage_id::text||'/tarefas/'||t.id::text;

-- Pending/historical outbox links may point to the updated page; actual
-- WhatsApp messages already sent cannot be edited or recalled.
update public.whatsapp_message_outbox o
set target_link=n.link
from public.notifications n
where o.notification_id=n.id and n.type='project_task'
 and o.status in ('ready_manual','missing_phone','historical')
 and o.target_link is distinct from n.link;

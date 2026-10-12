-- No status changes, replay, Drive sharing or historical outbox rewrites.
-- Access evidence is written only by server-side Drive inventory verification.
create table public.wa_drive_access_checks (
 file_id uuid primary key references public.client_files(id) on delete cascade,
 drive_file_id text not null,
 drive_folder_id text not null,
 file_name text not null,
 web_view_link text not null,
 public_readable boolean not null default false,
 reader_emails text[] not null default '{}',
 checked_at timestamptz not null default now()
);
alter table public.wa_drive_access_checks enable row level security;
revoke all on public.wa_drive_access_checks from public,anon,authenticated;
grant select,insert,update,delete on public.wa_drive_access_checks to service_role;
alter table public.whatsapp_message_outbox drop constraint whatsapp_message_outbox_status_check;
alter table public.whatsapp_message_outbox add constraint whatsapp_message_outbox_status_check
check(status in ('ready_manual','missing_phone','historical','opened_manual','reported_sent',
 'sending_auto','sent_auto','failed_auto','blocked_files'));

alter table public.whatsapp_message_outbox add column event_key text, add column file_manifest jsonb not null default '[]';
create unique index wa_outbox_event_key_unique on public.whatsapp_message_outbox(event_key)
where event_key is not null;

-- Preserve administrator copy, replacing only the prohibited default wording.
update public.wa_message_templates
set body=regexp_replace(regexp_replace(body,'(tarefa|etapa) concluída','Materiais finalizados','gi'),
 'A etapa','A produção','gi')
where body ~* '(tarefa|etapa) concluída';

-- Valid replacement generated from working 0600 baseline; supersedes malformed 0700 file.
-- Human-friendly customer WhatsApp copy, without internal task/stage terminology.
-- Keep the established consent flags, outbox idempotency and authenticated /n/ links.
CREATE OR REPLACE FUNCTION app_private.wa_capture_notification(p_id uuid, p_historical boolean DEFAULT false)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE
 n public.notifications%rowtype;
 cfg public.app_settings%rowtype;
 v_raw text;
 v_phone text;
 v_name text;
 v_allowed boolean := false;
 v_message text;
 v_target_link text;
 v_project_name text;
 v_item_name text;
 v_status text;
 v_files text;
 v_project_id uuid;
 v_task_id uuid;
 v_stage_id uuid;
BEGIN
 SELECT * INTO n FROM public.notifications WHERE id=p_id;
 IF NOT FOUND THEN RETURN; END IF;
 SELECT * INTO cfg FROM public.app_settings WHERE id=true;
 IF NOT FOUND THEN RETURN; END IF;
 v_allowed := CASE
  WHEN n.type IN ('project_status','project_updated') THEN cfg.wa_prepare_project_status
  WHEN n.type='project_task' THEN cfg.wa_prepare_task_status
  WHEN n.type='project_stage' THEN cfg.wa_prepare_stage_status
  WHEN n.type IN ('file_available','file_received') THEN cfg.wa_prepare_file_updates
  WHEN n.type='file_review_requested' THEN cfg.wa_prepare_file_review
  WHEN n.type IN ('payment_confirmed_priority','project_created_priority','project_completed_priority') THEN cfg.wa_prepare_priority_events
  ELSE false END;
 IF NOT v_allowed THEN RETURN; END IF;
 IF NOT p_historical AND n.type IN ('project_task','project_stage','project_status','project_updated','file_available','file_received','file_review_requested')
    AND cfg.wa_bridge_delivery_mode='single_client'
    AND n.user_id IS DISTINCT FROM cfg.wa_bridge_single_customer_id THEN RETURN; END IF;
 IF n.type='project_task' AND n.metadata->>'status'='completed' THEN RETURN; END IF;
 SELECT regexp_replace(coalesce(p.phone,''),'[^0-9]','','g'),
   btrim(concat_ws(' ',nullif(p.first_name,''),nullif(p.last_name,'')))
 INTO v_raw,v_name FROM public.profiles p WHERE p.id=n.user_id;
 IF NOT FOUND THEN RETURN; END IF;
 IF n.type IN ('payment_confirmed_priority','project_created_priority','project_completed_priority') THEN
   v_raw := regexp_replace(coalesce(cfg.priority_whatsapp_phone,''),'[^0-9]','','g');
 END IF;
 v_phone := CASE WHEN v_raw ~ '^55[0-9]{10,11}$' THEN v_raw
   WHEN v_raw ~ '^[0-9]{10,11}$' THEN '55'||v_raw ELSE null END;
 v_target_link := n.link;
 v_message := 'SAGAMENTE — '||n.title||E'\n\n'||n.message;
 v_status := coalesce(n.metadata->>'status','');
 IF n.type IN ('project_task','project_stage','project_status','project_updated',
  'file_available','file_received','file_review_requested')
  AND n.link ~ '^/app(/|$)' THEN
   v_target_link := '/n/'||translate(rtrim(encode(uuid_send(n.id),'base64'),'='),'+/','-_');
 END IF;
 INSERT INTO public.whatsapp_message_outbox
  (notification_id,recipient_user_id,recipient_name,destination_phone,event_type,title,
   message_body,target_link,status,source,created_at)
 VALUES(n.id,n.user_id,coalesce(nullif(v_name,''),'Destinatário'),v_phone,n.type,n.title,
  v_message,v_target_link,
  CASE WHEN p_historical THEN 'historical'
   WHEN v_phone IS NULL THEN 'missing_phone' ELSE 'ready_manual' END,
  CASE WHEN p_historical THEN 'historical' ELSE 'live' END,n.created_at)
 ON CONFLICT DO NOTHING;
END;
$function$;

create or replace function app_private.wa_add_file_link_to_outbox()
returns trigger language plpgsql security definer set search_path='' as $$
declare
  n public.notifications%rowtype;
  f record;
  v_project uuid;
  v_project_name text;
  v_adjustments_done boolean:=false;
  v_task uuid;
  v_stage uuid;
  v_task_name text;
  v_stage_name text;
  v_status text;
  v_body text;
  v_footer text;
  v_label text;
  v_file_name text;
  v_file_url text;
  v_link text;
  v_group text;
  v_main integer:=0;
  v_support integer:=0;
  v_other integer:=0;
  v_count integer:=0;
  v_template_key text;
  v_template_body text;
  v_previous_material text;
  v_unverified integer:=0;
  v_file_signature text:='';
  v_manifest jsonb:='[]';
begin
  if new.source<>'live' or new.status not in ('ready_manual','missing_phone')
    or new.event_type not in ('project_task','project_stage','project_status','project_updated','file_available','file_received','file_review_requested')
    then return new; end if;

  select * into n from public.notifications where id=new.notification_id;
  if not found or n.user_id is distinct from new.recipient_user_id then new.status:='blocked_files'; return new; end if;
  if coalesce(n.metadata->>'project_id','') !~ '^[0-9a-fA-F-]{36}$' then new.status:='blocked_files'; return new; end if;
  v_project:=(n.metadata->>'project_id')::uuid;
  select p.title into v_project_name from public.projects p where p.id=v_project;
  v_project_name:=left(regexp_replace(coalesce(v_project_name,'projeto'),'[\r\n\t*]',' ','g'),100);
  if not exists (
    select 1 from public.projects p join public.profiles u on u.id=n.user_id
    where p.id=v_project and p.project_type<>'internal'
      and u.role='customer' and u.status='active'
      and (p.customer_id=u.id or exists (
        select 1 from public.project_customer_access a
        where a.project_id=p.id and a.customer_id=u.id
      ))
  ) then new.status:='blocked_files'; return new; end if;

  v_status:=coalesce(n.metadata->>'status','');
  if n.type='project_task' then
    if coalesce(n.metadata->>'task_id','') !~ '^[0-9a-fA-F-]{36}$' then new.status:='blocked_files'; return new; end if;
    v_task:=(n.metadata->>'task_id')::uuid;
    select t.title,t.stage_id into v_task_name,v_stage
    from public.tasks t
    where t.id=v_task and t.project_id=v_project and t.client_visible
      and (t.stage_id is null or exists (
        select 1 from public.project_stages s
        where s.id=t.stage_id and s.project_id=v_project and s.client_visible
      ));
    if v_task_name is null then new.status:='blocked_files'; return new; end if;
    -- Never trust arbitrary names or messages to control the WhatsApp formatting.
    v_task_name:=left(regexp_replace(v_task_name,'[\r\n\t*]',' ','g'),95);
    v_body:=case v_status
      when 'review' then '🔎 *Revisão disponível*'||E'\n\n'||
         'O material *'||v_task_name||'* do projeto *'||v_project_name||'* está pronto para sua análise.'
      when 'completed' then '✅ *Atualização concluída*'||E'\n\n'||
         'A entrega *'||v_task_name||'* do projeto *'||v_project_name||'* foi concluída.'
      when 'in_progress' then '✨ *Seu projeto deu mais um passo*'||E'\n\n'||
         'A atualização *'||v_task_name||'* do projeto *'||v_project_name||'* está em andamento.'
      when 'changes_requested' then '🔄 *Ajustes em andamento*'||E'\n\n'||
         'Estamos atualizando *'||v_task_name||'* no projeto *'||v_project_name||'*.'
      when 'cancelled' then '📌 *Atualização no projeto*'||E'\n\n'||
         'A entrega *'||v_task_name||'* do projeto *'||v_project_name||'* foi interrompida.'
      else '📌 *Seu projeto tem uma novidade*'||E'\n\n'||
         'A atualização *'||v_task_name||'* do projeto *'||v_project_name||'* está disponível.'
    end;
    v_label:='🔗 *Acompanhe:*';
  elsif n.type='project_stage' then
    if coalesce(n.metadata->>'stage_id','') !~ '^[0-9a-fA-F-]{36}$' then new.status:='blocked_files'; return new; end if;
    v_stage:=(n.metadata->>'stage_id')::uuid;
    select s.name into v_stage_name from public.project_stages s
      where s.id=v_stage and s.project_id=v_project and s.client_visible;
    if v_stage_name is null then new.status:='blocked_files'; return new; end if;
    v_stage_name:=left(regexp_replace(v_stage_name,'[\r\n\t*]',' ','g'),95);
    v_body:=case v_status
      when 'completed' then '✅ *Materiais finalizados!*'
      when 'review' then '🔎 *Revisão disponível*'
      when 'in_progress' then '✨ *Seu projeto deu mais um passo*'
      else '📌 *Seu projeto tem uma novidade*'
    end||E'\n\n'||'Produção: *'||v_stage_name||'*'||E'\n'||
      'Projeto: *'||v_project_name||'*.';
    if v_status='completed' and exists (
      select 1 from public.tasks t where t.project_id=v_project and t.stage_id=v_stage and t.client_visible
      and (t.status is distinct from 'completed' or not exists (
        select 1 from public.client_files c where c.project_id=v_project and c.task_id=t.id
          and c.client_visible and c.drive_folder_kind='delivery' and c.storage_provider='google_drive'
      ))
    ) then new.status:='blocked_files'; new.message_body:='Preparação bloqueada: produção incompleta ou materiais sem arquivos finais publicados.'; return new; end if;
    v_label:='🔗 *Acompanhe:*';
  elsif n.type in ('project_status','project_updated') then
    v_body:=case
      when n.type='project_updated' then '📌 *Atualização do projeto*'||E'\n\n'||
        'O projeto *'||v_project_name||'* teve uma atualização de prazo.'
      when v_status='active' then '🚀 *Projeto iniciado*'||E'\n\n'||
        'O projeto *'||v_project_name||'* já está em andamento.'
      when v_status='completed' then '🎉 *Entrega final disponível*'||E'\n\n'||
        'Concluímos o projeto *'||v_project_name||'*. Os materiais finais estão disponíveis.'
      when v_status='review' then '🔎 *Revisão disponível*'||E'\n\n'||
        'O projeto *'||v_project_name||'* está pronto para sua análise.'
      else '📌 *Seu projeto tem uma novidade*'||E'\n\n'||
        'O projeto *'||v_project_name||'* teve uma atualização.'
    end;
    v_label:='🔗 *Acompanhe:*';
  else
    if coalesce(n.metadata->>'file_id','') !~ '^[0-9a-fA-F-]{36}$' then new.status:='blocked_files'; return new; end if;
    select left(regexp_replace(c.name,'[\r\n\t*]',' ','g'),110) into v_file_name
      from public.client_files c where c.id=(n.metadata->>'file_id')::uuid and c.project_id=v_project;
    select exists(
      select 1
      from public.client_files current_file
      join public.client_files previous_file on previous_file.id=current_file.supersedes_file_id
      join public.file_reviews review on review.file_id=previous_file.id
      where current_file.id=(n.metadata->>'file_id')::uuid
        and review.action='changes_requested'
    ) into v_adjustments_done;
    v_body:=case
      when n.type='file_review_requested' then '🔎 *Revisão disponível*'
      when v_adjustments_done then '🛠️ *Ajustes concluídos*'
      else '📎 *Novo material disponível*'
    end||E'\n\n'||
      'Material: *'||coalesce(v_file_name,'arquivo')||'*'||E'\n'||
      'Projeto: *'||v_project_name||'*'||case when v_adjustments_done then ' recebeu uma nova versão.' else '.' end;
    v_label:='🔗 *Acompanhe:*';
  end if;

  if n.type='project_status' and v_status='completed' and exists (
    select 1 from public.tasks t where t.project_id=v_project and t.client_visible
    and (t.status is distinct from 'completed' or not exists (
      select 1 from public.client_files c where c.project_id=v_project and c.task_id=t.id
        and c.client_visible and c.drive_folder_kind='delivery' and c.storage_provider='google_drive'
    ))
  ) then new.status:='blocked_files'; new.message_body:='Preparação bloqueada: projeto incompleto ou materiais sem arquivos finais publicados.'; return new; end if;

  -- Apply administrator-approved copy only to supported customer events.
  -- Preserve the existing eligibility gates, file selection, and trusted link suffix.
  v_template_key:=case
    when n.type='project_status' and v_status='active' then 'project_started'
    when n.type='project_status' and v_status='completed' then 'final_delivery'
    when n.type='project_stage' and v_status='completed' then 'stage_completed'
    when n.type in ('project_task','project_stage') and v_status='review'
      then 'review_available'
    when n.type='file_review_requested' then 'review_available'
    when n.type in ('file_available','file_received') and v_adjustments_done
      then 'adjustments_completed'
    else null
  end;
  if v_template_key is not null then
    select body into v_template_body from public.wa_message_templates
      where template_key=v_template_key;
    if v_template_body is not null then
      v_body:=replace(v_template_body,'{{project_name}}',v_project_name);
      v_body:=replace(v_body,'{{stage_name}}',coalesce(v_stage_name,'produção'));
      v_body:=replace(v_body,'{{material_name}}',
        coalesce(v_file_name,v_task_name,v_stage_name,'material'));
      v_body:=replace(v_body,'{{customer_name}}',
        left(regexp_replace(coalesce(new.recipient_name,'cliente'),'[\r\n\t*]',' ','g'),100));
      -- Link is positioned by the secure existing footer, after applicable Drive files.
      v_body:=btrim(replace(v_body,'{{link}}',''),E'\n\r\t ');
    end if;
  end if;

  v_body:=regexp_replace(v_body,'(tarefa|etapa) concluída','Material finalizado','gi');
  v_label:='🔗 *Confira também no seu espaço de acompanhamento:*';

  -- Use only the compact, internal task/stage locator. Never concatenate a
  -- user-controlled external URL or a javascript scheme into the message.
  if new.target_link ~ '^/n/[A-Za-z0-9_-]{22}$'
    then v_link:='https://playsistem-oficial.playmomentsstudios.workers.dev'||new.target_link;
  elsif new.target_link ~ '^/app/projetos/[0-9a-fA-F-]{36}(/.*)?$'
    then v_link:='https://playsistem-oficial.playmomentsstudios.workers.dev'||new.target_link;
  else new.status:='blocked_files'; return new; end if;

  -- File selection mirrors task visibility. Task status -> only that task's
  -- attached files, never other tasks' files. Stage -> visible stage files +
  -- files attached to visible tasks in that same stage. Explicit file event ->
  -- just the mentioned file. Grouped versions: latest version only.
  for f in
    with eligible as (
      select c.*, coalesce(t.title,v_stage_name,'Materiais do projeto') as material_title,
        (lower(c.name) ~ '(pauta|briefing|refer.ncia|roteiro|instru..es|material de apoio)') as is_support
      from public.client_files c
      left join public.tasks t on t.id=c.task_id and t.project_id=v_project
      where c.project_id=v_project
        and c.client_visible and c.storage_provider='google_drive'
        and c.drive_file_id ~ '^[A-Za-z0-9_-]{10,128}$'
        and (
          (v_status='review' or n.type='file_review_requested') and coalesce(c.drive_folder_kind,(select pdf.folder_kind from public.project_drive_folders pdf where pdf.project_id=c.project_id and pdf.drive_folder_id=c.drive_folder_id limit 1),(select pc.parent_kind from public.project_custom_folders pc where pc.project_id=c.project_id and pc.drive_folder_id=c.drive_folder_id limit 1))='preview'
          or v_status='completed' and n.type in ('project_stage','project_status') and coalesce(c.drive_folder_kind,(select pdf.folder_kind from public.project_drive_folders pdf where pdf.project_id=c.project_id and pdf.drive_folder_id=c.drive_folder_id limit 1),(select pc.parent_kind from public.project_custom_folders pc where pc.project_id=c.project_id and pc.drive_folder_id=c.drive_folder_id limit 1))='delivery'
          or n.type in ('file_available','file_received') and coalesce(c.drive_folder_kind,(select pdf.folder_kind from public.project_drive_folders pdf where pdf.project_id=c.project_id and pdf.drive_folder_id=c.drive_folder_id limit 1),(select pc.parent_kind from public.project_custom_folders pc where pc.project_id=c.project_id and pc.drive_folder_id=c.drive_folder_id limit 1)) in ('preview','delivery')
        )
        and (c.task_id is null or (
          t.id is not null and t.client_visible and (
            t.stage_id is null or exists(
              select 1 from public.project_stages s
              where s.id=t.stage_id and s.project_id=v_project and s.client_visible
            )
          )
          and (c.stage_id is null or c.stage_id=t.stage_id)
        ))
        and (c.stage_id is null or exists (
          select 1 from public.project_stages s
          where s.id=c.stage_id and s.project_id=v_project and s.client_visible
        ))
        and (
          (n.type='project_task' and c.task_id=v_task)
          or (n.type='project_stage' and (
            (c.task_id is null and c.stage_id=v_stage)
            or (t.id is not null and t.stage_id=v_stage and
                (c.stage_id is null or c.stage_id=v_stage))
          ))
          or (n.type in ('file_available','file_received','file_review_requested')
              and c.id=(n.metadata->>'file_id')::uuid)
          or (n.type in ('project_status','project_updated') and c.project_id=v_project)
        )
    ), versions as (
      select e.*,
        row_number() over(partition by coalesce(e.version_group_id,e.id)
          order by e.version_number desc nulls last,e.created_at desc,e.id desc) as version_rank
      from eligible e
    )
    select * from (
      select distinct on (drive_file_id) * from versions where version_rank=1
      order by drive_file_id, version_number desc nulls last, created_at desc, id
    ) unique_files order by material_title, name, id
  loop
    if not exists (
      select 1 from public.wa_drive_access_checks a
      join auth.users u on u.id=n.user_id
      where a.file_id=f.id and a.drive_file_id=f.drive_file_id
        and a.drive_folder_id=f.drive_folder_id and a.file_name=f.name
        and a.checked_at>now()-interval '15 minutes'
        and (a.public_readable or lower(u.email)=any(a.reader_emails))
        and a.web_view_link ~ ('^https://drive[.]google[.]com/file/d/'||f.drive_file_id||'/view([?][A-Za-z0-9_=&%-]*)?$')
    ) then v_unverified:=v_unverified+1; continue; end if;
    v_count:=v_count+1;
    v_manifest:=v_manifest||jsonb_build_array(jsonb_build_object('id',f.id,'name',f.name,'drive_file_id',f.drive_file_id,'drive_folder_id',f.drive_folder_id,'drive_folder_kind',f.drive_folder_kind,'task_id',f.task_id,'stage_id',f.stage_id));
    v_file_signature:=v_file_signature||f.drive_file_id||':'||coalesce(f.version_number,1)::text||';';
    if v_count=1 then
      v_body:=v_body||E'\n\n'||'📂 *Arquivos desta '||
        case when v_status='review' or n.type='file_review_requested' then 'revisão' else 'entrega' end||':*';
    end if;
    v_group:=case when f.is_support then '📄 Apoio: ' else '🖼️ ' end;
    v_file_name:=left(regexp_replace(f.name,'[\r\n\t*]',' ','g'),110);
    select web_view_link into v_file_url from public.wa_drive_access_checks where file_id=f.id;
    if v_previous_material is distinct from f.material_title then
      v_body:=v_body||E'\n\n*'||regexp_replace(f.material_title,'[\r\n\t*]',' ','g')||'*';
      v_previous_material:=f.material_title;
    end if;
    v_body:=v_body||E'\n\n'||v_group||'*'||v_file_name||'*'||E'\n'||
      v_file_url;
  end loop;

  if (v_status in ('review','completed') or n.type in ('file_available','file_received','file_review_requested'))
     and (v_count=0 or v_unverified>0) then
    new.status:='blocked_files';
    new.message_body:='Preparação bloqueada: arquivos ausentes, privados ou acesso ao Drive não verificado. Sincronize e confira os vínculos antes de preparar uma nova atualização.';
    return new;
  end if;
  v_body:=v_body||E'\n\n'||v_label||E'\n'||v_link||E'\n\nSAGAMENTE';

  if v_status in ('review','completed') then
    new.event_key:=md5(n.user_id::text||':'||n.type||':'||v_project::text||':'||
      coalesce(v_task::text,v_stage::text,'project')||':'||v_status||':'||v_file_signature);
  end if;
  new.file_manifest:=v_manifest;
  new.message_body:=v_body;
  return new;
end $$;
revoke all on function app_private.wa_add_file_link_to_outbox()
 from public,anon,authenticated;
-- One formatter runs atomically before the row becomes sendable.
drop trigger if exists wa_enrich_notification_with_file on public.whatsapp_message_outbox;
create trigger wa_enrich_notification_with_file before insert on public.whatsapp_message_outbox
for each row execute function app_private.wa_add_file_link_to_outbox();

-- Rechecking a blocked NEW notice never creates a new notification or changes a material status.
create trigger wa_retry_blocked_copy before update of status on public.whatsapp_message_outbox
for each row when (old.status='blocked_files' and new.status='ready_manual')
execute function app_private.wa_add_file_link_to_outbox();

create or replace function public.wa_retry_blocked_notification(p_outbox_id uuid)
returns text language plpgsql security definer set search_path='' as $$
declare v_status text;
begin
 if not public.current_user_is_admin() then raise exception 'Apenas administradores.' using errcode='42501'; end if;
 select status into v_status from public.whatsapp_message_outbox
 where id=p_outbox_id and source='live' for update;
 if v_status is distinct from 'blocked_files' then raise exception 'Somente novos avisos bloqueados podem ser preparados.' using errcode='22023'; end if;
 begin
   update public.whatsapp_message_outbox set status='ready_manual' where id=p_outbox_id returning status into v_status;
 exception when unique_violation then
   update public.whatsapp_message_outbox set message_body='Preparação bloqueada: esta atualização já foi preparada para este destinatário.' where id=p_outbox_id;
   v_status:='blocked_files';
 end;
 return v_status;
end $$;
revoke all on function public.wa_retry_blocked_notification(uuid) from public,anon,authenticated;
grant execute on function public.wa_retry_blocked_notification(uuid) to authenticated;

-- Check the exact manifest again at claim/open time. Existing pacing and consent rules stay intact.
create or replace function app_private.wa_verify_dispatch_manifest()
returns trigger language plpgsql security definer set search_path='' as $$
declare item jsonb; v_allowed boolean;
begin
 if new.status not in ('sending_auto','opened_manual') or new.status=old.status then return new; end if;
 for item in select value from jsonb_array_elements(new.file_manifest) loop
   select exists(
    select 1 from public.client_files c join public.wa_drive_access_checks a on a.file_id=c.id
      join auth.users u on u.id=new.recipient_user_id
    where c.id=(item->>'id')::uuid and c.client_visible
      and c.name=item->>'name' and c.drive_file_id=item->>'drive_file_id'
      and c.drive_folder_id=item->>'drive_folder_id'
      and c.drive_folder_kind is not distinct from item->>'drive_folder_kind'
      and c.task_id::text is not distinct from item->>'task_id'
      and c.stage_id::text is not distinct from item->>'stage_id'
      and a.drive_file_id=c.drive_file_id and a.drive_folder_id=c.drive_folder_id and a.file_name=c.name
      and a.checked_at>now()-interval '15 minutes'
      and (a.public_readable or lower(u.email)=any(a.reader_emails))
   ) into v_allowed;
   if not v_allowed then raise exception 'Envio bloqueado: arquivo alterado ou acesso ao Drive não verificado. Sincronize antes de enviar.' using errcode='42501'; end if;
 end loop;
 return new;
end $$;
revoke all on function app_private.wa_verify_dispatch_manifest() from public,anon,authenticated;
create trigger wa_verify_dispatch_manifest before update of status on public.whatsapp_message_outbox
for each row execute function app_private.wa_verify_dispatch_manifest();

-- Old queued customer copy is kept for audit, but cannot be replayed by the new worker.
update public.whatsapp_message_outbox set status='historical'
where source='live' and status in ('ready_manual','missing_phone') and event_key is null
and event_type in ('project_task','project_stage','project_status','project_updated','file_available','file_received','file_review_requested');

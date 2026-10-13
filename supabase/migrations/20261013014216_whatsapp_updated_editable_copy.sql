-- Refresh only old default copy; retain subsequent administrator edits.
insert into public.wa_message_templates(template_key,body) values ('project_started','🚀 *Seu projeto começou!*

O projeto *{{project_name}}* já está em andamento. Você poderá acompanhar as atualizações e os materiais no seu espaço de acompanhamento.

{{link}}'),('stage_completed','✅ *Materiais finalizados!*

Os materiais de *{{stage_name}}* do projeto *{{project_name}}* foram finalizados. Confira abaixo os arquivos liberados desta entrega.

{{link}}'),('review_available','🔎 *Material disponível para revisão*

O material *{{material_name}}* do projeto *{{project_name}}* está disponível para sua análise. Confira abaixo os arquivos liberados para revisão.

{{link}}'),('adjustments_completed','🛠️ *Ajustes concluídos!*

Os ajustes do material *{{material_name}}* do projeto *{{project_name}}* foram concluídos. Confira abaixo os arquivos da nova versão liberada para sua análise.

{{link}}'),('final_delivery','✅ *Entrega final disponível!*

O projeto *{{project_name}}* foi concluído. Confira abaixo todos os arquivos finais liberados desta entrega.

{{link}}'),('new_message','💬 *Nova mensagem no projeto*

Há uma nova mensagem sobre o projeto *{{project_name}}*. Abra seu espaço de acompanhamento para conferir e responder.

{{link}}')
on conflict(template_key) do update set body=excluded.body,updated_at=now()
where wa_message_templates.body=case wa_message_templates.template_key when 'project_started' then '*Seu projeto começou!*

O projeto *{{project_name}}* já está em andamento.

{{link}}' when 'stage_completed' then '*Etapa concluída*

A etapa *{{stage_name}}* do projeto *{{project_name}}* foi concluída.

{{link}}' when 'review_available' then '*Revisão disponível*

O material *{{material_name}}* do projeto *{{project_name}}* está pronto para sua análise.

{{link}}' when 'adjustments_completed' then '*Ajustes concluídos*

Uma nova versão do material *{{material_name}}* do projeto *{{project_name}}* está disponível.

{{link}}' when 'final_delivery' then '*Entrega final disponível*

Concluímos o projeto *{{project_name}}*. Os materiais finais estão disponíveis.

{{link}}' when 'new_message' then '*Nova mensagem no projeto*

Há uma nova mensagem sobre *{{project_name}}*.

{{link}}' end;

-- A completed individual material can be announced only after final files are published.
CREATE OR REPLACE FUNCTION app_private.wa_capture_notification(p_id uuid, p_historical boolean DEFAULT false)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
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
 IF n.type='project_task' AND n.metadata->>'status'='completed' AND NOT EXISTS (
   SELECT 1 FROM public.client_files f
   WHERE f.project_id::text=n.metadata->>'project_id'
     AND f.task_id::text=n.metadata->>'task_id'
     AND f.client_visible AND f.storage_provider='google_drive'
     AND f.drive_folder_kind='delivery' AND f.drive_file_id ~ '^[A-Za-z0-9_-]{10,128}$'
 ) THEN RETURN; END IF;
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
 IF n.type IN ('project_task','project_stage') THEN
   SELECT title INTO v_project_name FROM public.projects WHERE id=
     CASE WHEN coalesce(n.metadata->>'project_id','') ~ '^[0-9a-fA-F-]{36}$'
       THEN (n.metadata->>'project_id')::uuid ELSE null END;
   IF n.type='project_task' THEN
     SELECT title INTO v_item_name FROM public.tasks WHERE id=
       CASE WHEN coalesce(n.metadata->>'task_id','') ~ '^[0-9a-fA-F-]{36}$'
         THEN (n.metadata->>'task_id')::uuid ELSE null END;
   ELSE
     SELECT name INTO v_item_name FROM public.project_stages WHERE id=
       CASE WHEN coalesce(n.metadata->>'stage_id','') ~ '^[0-9a-fA-F-]{36}$'
         THEN (n.metadata->>'stage_id')::uuid ELSE null END;
   END IF;
   v_message := CASE v_status
     WHEN 'in_progress' THEN '✨ *Seu projeto avançou!*'
     WHEN 'review' THEN '🔎 *Material disponível para revisão*'
     WHEN 'completed' THEN '✅ *Materiais finalizados*'
     ELSE '📌 *Atualização do projeto*' END
     || E'\n\n' || CASE v_status
       WHEN 'in_progress' THEN 'Começamos a trabalhar em '
       WHEN 'review' THEN 'Já é possível conferir '
       WHEN 'completed' THEN 'Os materiais de '
       ELSE 'Há novidades em ' END
     || '*'||coalesce(nullif(v_item_name,''),coalesce(nullif(v_project_name,''),'seu projeto'))||'*'
     || CASE WHEN v_project_name IS NOT NULL
       THEN ' do projeto *'||v_project_name||'*.' ELSE '.' END;
 END IF;
 -- File links are limited to published records for this project and event.
 IF ((n.type='project_task' AND v_status='review') OR (n.type='project_stage' AND v_status='completed')) THEN
   v_project_id := nullif(n.metadata->>'project_id','')::uuid;
   v_task_id := nullif(n.metadata->>'task_id','')::uuid;
   v_stage_id := nullif(n.metadata->>'stage_id','')::uuid;
   SELECT string_agg('📎 *'||replace(f.name,'*','')||'*'||E'\n'||
     'https://drive.google.com/file/d/'||f.drive_file_id||'/view',
     E'\n\n' ORDER BY f.name,f.id)
   INTO v_files
   FROM public.client_files f
   WHERE f.project_id=v_project_id AND f.storage_provider='google_drive'
     AND f.client_visible AND f.drive_file_id IS NOT NULL
     AND ((n.type='project_task' AND f.task_id=v_task_id)
          OR (n.type='project_stage' AND f.stage_id=v_stage_id))
     AND f.drive_folder_kind=CASE WHEN v_status='review' THEN 'preview' ELSE 'delivery' END;
   IF v_files IS NOT NULL THEN
     v_message := v_message||E'\n\n📂 *Arquivos disponíveis:*\n\n'||v_files;
   ELSIF n.type='project_stage' AND v_status='completed' THEN
     RETURN;
   END IF;
 END IF;
 IF n.type IN ('project_task','project_stage','project_status','project_updated',
  'file_available','file_received','file_review_requested')
  AND n.link ~ '^/app(/|$)' THEN
   v_target_link := '/n/'||translate(rtrim(encode(uuid_send(n.id),'base64'),'='),'+/','-_');
   v_message := v_message||E'\n\n🔗 *Confira também no seu espaço de acompanhamento:*\n'
    ||'https://playsistem-oficial.playmomentsstudios.workers.dev'||v_target_link;
 END IF;
 INSERT INTO public.whatsapp_message_outbox
  (notification_id,recipient_user_id,recipient_name,destination_phone,event_type,title,
   message_body,target_link,status,source,created_at)
 VALUES(n.id,n.user_id,coalesce(nullif(v_name,''),'Destinatário'),v_phone,n.type,n.title,
  v_message,v_target_link,
  CASE WHEN p_historical THEN 'historical'
   WHEN v_phone IS NULL THEN 'missing_phone' ELSE 'ready_manual' END,
  CASE WHEN p_historical THEN 'historical' ELSE 'live' END,n.created_at)
 ON CONFLICT(notification_id) DO NOTHING;
END;
$function$
;
CREATE OR REPLACE FUNCTION app_private.wa_add_file_link_to_outbox()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  v_invalid integer:=0;
  v_complete_file_list boolean:=false;
  v_template_key text;
  v_template_body text;
begin
  if new.source<>'live' or new.status not in ('ready_manual','missing_phone')
    or new.event_type not in ('project_task','project_stage','project_status','project_updated','file_available','file_received','file_review_requested')
    then return new; end if;

  select * into n from public.notifications where id=new.notification_id;
  if not found or n.user_id is distinct from new.recipient_user_id then return new; end if;
  if coalesce(n.metadata->>'project_id','') !~ '^[0-9a-fA-F-]{36}$' then return new; end if;
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
  ) then return new; end if;

  v_status:=coalesce(n.metadata->>'status','');
  -- Every link in an authorized review or delivery is available in WhatsApp.
  -- Ordinary progress updates keep their shorter file preview.
  v_complete_file_list:=(
    n.type in ('project_task','project_stage','project_status')
    and v_status in ('review','completed')
  ) or n.type='file_review_requested';
  if n.type='project_task' then
    if coalesce(n.metadata->>'task_id','') !~ '^[0-9a-fA-F-]{36}$' then return new; end if;
    v_task:=(n.metadata->>'task_id')::uuid;
    select t.title,t.stage_id into v_task_name,v_stage
    from public.tasks t
    where t.id=v_task and t.project_id=v_project and t.client_visible
      and (t.stage_id is null or exists (
        select 1 from public.project_stages s
        where s.id=t.stage_id and s.project_id=v_project and s.client_visible
      ));
    if v_task_name is null then return new; end if;
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
    if coalesce(n.metadata->>'stage_id','') !~ '^[0-9a-fA-F-]{36}$' then return new; end if;
    v_stage:=(n.metadata->>'stage_id')::uuid;
    select s.name into v_stage_name from public.project_stages s
      where s.id=v_stage and s.project_id=v_project and s.client_visible;
    if v_stage_name is null then return new; end if;
    v_stage_name:=left(regexp_replace(v_stage_name,'[\r\n\t*]',' ','g'),95);
    v_body:=case v_status
      when 'completed' then '✅ *Etapa concluída*'
      when 'review' then '🔎 *Revisão disponível*'
      when 'in_progress' then '✨ *Seu projeto deu mais um passo*'
      else '📌 *Seu projeto tem uma novidade*'
    end||E'\n\n'||'Etapa: *'||v_stage_name||'*'||E'\n'||
      'Projeto: *'||v_project_name||'*.';
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
    if coalesce(n.metadata->>'file_id','') !~ '^[0-9a-fA-F-]{36}$' then return new; end if;
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

  -- Apply administrator-approved copy only to supported customer events.
  -- Preserve the existing eligibility gates, file selection, and trusted link suffix.
  v_template_key:=case
    when n.type='project_status' and v_status='active' then 'project_started'
    when n.type='project_status' and v_status='completed' then 'final_delivery'
    when n.type in ('project_task','project_stage') and v_status='completed' then 'stage_completed'
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
      v_body:=replace(v_body,'{{stage_name}}',coalesce(v_task_name,v_stage_name,'material'));
      v_body:=replace(v_body,'{{material_name}}',
        coalesce(v_file_name,v_task_name,v_stage_name,'material'));
      v_body:=replace(v_body,'{{customer_name}}',
        left(regexp_replace(coalesce(new.recipient_name,'cliente'),'[\r\n\t*]',' ','g'),100));
      -- Link is positioned by the secure existing footer, after applicable Drive files.
      v_body:=btrim(replace(v_body,'{{link}}',''),E'\n\r\t ');
    end if;
  end if;

  -- Use only the compact, internal task/stage locator. Never concatenate a
  -- user-controlled external URL or a javascript scheme into the message.
  if new.target_link ~ '^/n/[A-Za-z0-9_-]{22}$'
    then v_link:='https://playsistem-oficial.playmomentsstudios.workers.dev'||new.target_link;
  elsif new.target_link ~ '^/app/projetos/[0-9a-fA-F-]{36}(/.*)?$'
    then v_link:='https://playsistem-oficial.playmomentsstudios.workers.dev'||new.target_link;
  else return new; end if;

  -- File selection mirrors task visibility. Task status -> only that task's
  -- attached files, never other tasks' files. Stage -> visible stage files +
  -- files attached to visible tasks in that same stage. Explicit file event ->
  -- just the mentioned file. Grouped versions: latest version only.
  for f in
    with eligible as (
      select c.*,
        (lower(c.name) ~ '(pauta|briefing|refer.ncia|roteiro|instru..es|material de apoio)') as is_support
      from public.client_files c
      left join public.tasks t on t.id=c.task_id and t.project_id=v_project
      where c.project_id=v_project
        and c.client_visible and c.storage_provider='google_drive'
        and c.drive_file_id is not null
        and (n.type<>'project_task' or v_status<>'completed' or c.drive_folder_kind='delivery')
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
    select * from versions where version_rank=1
    order by is_support asc, created_at desc, version_number desc nulls last, id desc
  loop
    -- Only count files that can receive a valid, canonical Drive link.
    if f.drive_file_id !~ '^[A-Za-z0-9_-]{10,128}$' then
      v_invalid:=v_invalid+1;
      continue;
    end if;
    if not v_complete_file_list and f.is_support and v_support>=2 then
      v_other:=v_other+1;
      continue;
    end if;
    if not v_complete_file_list and not f.is_support and v_main>=6 then
      v_other:=v_other+1;
      continue;
    end if;
    v_count:=v_count+1;
    if f.is_support then
      v_support:=v_support+1;
    else
      v_main:=v_main+1;
    end if;

    if v_count=1 then
      v_body:=v_body||E'\n\n'||'📂 *Arquivos desta '||
        case when v_status='review' or n.type='file_review_requested' then 'revisão' else 'entrega' end||':*';
    end if;
    v_group:=case when f.is_support then '📄 Apoio: ' else '🖼️ ' end;
    v_file_name:=left(regexp_replace(f.name,'[\r\n\t*]',' ','g'),110);
    -- Only the original Drive file URL with the same verified file id
    -- (or its canonical Google Drive fallback) is emitted. No public share.
    if f.external_url ~ ('^https://drive[.]google[.]com/file/d/'||
         f.drive_file_id||'/view([?][A-Za-z0-9_=&%-]*)?$') then
      v_file_url:=f.external_url;
    else
      v_file_url:='https://drive.google.com/file/d/'||f.drive_file_id||'/view';
    end if;
    v_body:=v_body||E'\n\n'||v_group||'*'||v_file_name||'*'||E'\n'||
      v_file_url;
  end loop;

  if v_count=0 then
    v_body:=v_body||E'\n\n'||
      case when v_complete_file_list then
        'Ainda não há links do Google Drive liberados para esta revisão ou entrega.'
      else
        'Os materiais relacionados a esta atualização estão no link de acompanhamento.'
      end;
  elsif v_other>0 and not v_complete_file_list then
    v_body:=v_body||E'\n\n'||'+'||v_other::text||
      ' outro(s) arquivo(s) disponível(is) nos detalhes do projeto.';
  end if;
  if v_invalid>0 then
    v_body:=v_body||E'\n\n'||'⚠️ '||v_invalid::text||
      ' arquivo(s) sem link válido no Drive. Solicite a correção à equipe.';
  end if;
  v_body:=v_body||E'\n\n'||v_label||E'\n'||v_link;

  update public.whatsapp_message_outbox
  set message_body=v_body where id=new.id;
  return new;
end $function$
;

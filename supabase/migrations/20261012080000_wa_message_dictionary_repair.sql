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
$function$;

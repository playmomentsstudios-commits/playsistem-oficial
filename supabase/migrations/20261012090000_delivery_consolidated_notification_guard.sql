-- In an explicitly controlled, single-transaction delivery publication, suppress
-- per-file and stage-change notices; create one consolidated notification instead.
-- Default behavior is unchanged for all ordinary publication operations.
CREATE OR REPLACE FUNCTION public.notify_client_file_published()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if current_setting('sagamente.consolidated_delivery_batch',true) = 'on' then return new; end if;

 if not old.client_visible and new.client_visible then
  insert into public.notifications(user_id,type,title,message,link,metadata)
  select recipients.user_id,'file_available','Arquivo liberado para você',
    'O arquivo "'||new.name||'" foi liberado no seu portal.',
    '/app/arquivos',
    jsonb_build_object('file_id',new.id,'project_id',new.project_id)
  from (
    select user_id from app_private.project_notice_recipients(new.project_id)
      where new.project_id is not null
    union
    select new.customer_id where new.project_id is null and new.customer_id is not null
  ) recipients
  where public.customer_portal_notification_enabled(recipients.user_id,'file');
 end if;
 return new;
end; $function$;

CREATE OR REPLACE FUNCTION public.notify_project_stage_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare project_title text;
begin
  if current_setting('sagamente.consolidated_delivery_batch',true) = 'on' then return new; end if;

  if new.client_visible and (
    tg_op='INSERT'
    or old.status is distinct from new.status
    or old.name is distinct from new.name
    or old.client_visible is distinct from new.client_visible
  ) then
    select title into project_title from public.projects where id=new.project_id;
    insert into public.notifications(user_id,type,title,message,link,metadata)
    select recipients.user_id,'project_stage',
      case new.status
        when 'review' then 'Etapa disponível para revisão'
        when 'completed' then 'Etapa concluída'
        else 'Etapa do projeto atualizada'
      end,
      case new.status
        when 'review' then 'A etapa "'||new.name||'" do projeto "'||project_title||'" está em revisão. Confira os materiais disponibilizados.'
        when 'completed' then 'A etapa "'||new.name||'" do projeto "'||project_title||'" foi concluída. Veja os arquivos e as tarefas finalizadas.'
        else 'A etapa "'||new.name||'" do projeto "'||project_title||'" foi atualizada.'
      end,
      '/app/projetos/'||new.project_id::text||'/etapas/'||new.id::text,
      jsonb_build_object('project_id',new.project_id,'stage_id',new.id,'status',new.status)
    from app_private.project_notice_recipients(new.project_id) recipients
    where public.customer_portal_notification_enabled(recipients.user_id,'project');
  end if;
  return new;
end; $function$;

-- Notificações de projeto para todos os clientes com acesso (principal e adicionais).
-- Não amplia acesso: reutiliza os vínculos autorizados em project_customer_access.
create or replace function app_private.project_notice_recipients(p_project_id uuid)
returns table(user_id uuid)
language sql stable security definer
set search_path = ''
as $$
  select profile.id as user_id
  from public.profiles profile
  join (
    select project.customer_id as customer_id
      from public.projects project
      where project.id=p_project_id and project.project_type <> 'internal'
    union
    select access.customer_id
      from public.project_customer_access access
      join public.projects project on project.id=access.project_id
      where project.id=p_project_id and project.project_type <> 'internal'
  ) recipient on recipient.customer_id=profile.id
  where profile.role='customer' and profile.status='active';
$$;
revoke all on function app_private.project_notice_recipients(uuid) from public,anon,authenticated;

-- O gatilho genérico trata somente mudanças de prazo.
-- Mudanças de status ficam no gatilho específico, evitando duas mensagens para o mesmo fato.
create or replace function public.notify_project_change()
returns trigger language plpgsql security definer set search_path='public' as $$
begin
 if old.due_date is distinct from new.due_date then
  insert into public.notifications(user_id,type,title,message,link,metadata)
  select recipients.user_id, 'project_updated','Prazo do projeto atualizado',
    'O prazo do projeto "'||new.title||'" foi atualizado.',
    '/app/projetos/'||new.id::text,
    jsonb_build_object('project_id',new.id,'due_date',new.due_date)
  from app_private.project_notice_recipients(new.id) recipients
  where public.customer_portal_notification_enabled(recipients.user_id,'project');
 end if;
 return new;
end; $$;

create or replace function public.notify_project_status_change()
returns trigger language plpgsql security definer set search_path='public' as $$
begin
 if old.status is distinct from new.status then
  insert into public.notifications(user_id,type,title,message,link,metadata)
  select recipients.user_id,'project_status','Projeto atualizado',
   'O projeto "'||new.title||'" mudou para '||replace(new.status,'_',' ')||'.',
   '/app/projetos/'||new.id::text,
   jsonb_build_object('project_id',new.id,'status',new.status)
  from app_private.project_notice_recipients(new.id) recipients
  where public.customer_portal_notification_enabled(recipients.user_id,'project');
 end if;
 return new;
end; $$;

create or replace function public.notify_project_stage_change()
returns trigger language plpgsql security definer set search_path='public' as $$
declare project_title text;
begin
 if new.client_visible and
  (tg_op='INSERT' or old.status is distinct from new.status or old.name is distinct from new.name) then
  select title into project_title from public.projects where id=new.project_id;
  insert into public.notifications(user_id,type,title,message,link,metadata)
  select recipients.user_id,'project_stage','Etapa do projeto atualizada',
   'A etapa "'||new.name||'" do projeto "'||project_title||'" foi atualizada.',
   '/app/projetos/'||new.project_id::text,
   jsonb_build_object('project_id',new.project_id,'stage_id',new.id,'status',new.status)
  from app_private.project_notice_recipients(new.project_id) recipients
  where public.customer_portal_notification_enabled(recipients.user_id,'project');
 end if;
 return new;
end; $$;

create or replace function public.notify_task_change()
returns trigger language plpgsql security definer set search_path='public' as $$
begin
 if new.client_visible and old.status is distinct from new.status then
  insert into public.notifications(user_id,type,title,message,link,metadata)
  select recipients.user_id,'project_task','Etapa de trabalho atualizada',
   '"'||new.title||'" agora está em '||new.status||'.',
   '/app/projetos/'||new.project_id::text,
   jsonb_build_object('project_id',new.project_id,'task_id',new.id,'status',new.status)
  from app_private.project_notice_recipients(new.project_id) recipients
  where public.customer_portal_notification_enabled(recipients.user_id,'project');
 end if;
 return new;
end; $$;

-- Antes havia dois gatilhos de INSERT para arquivos e ambos avisavam o cliente principal.
-- Preservamos o gatilho que respeita preferências e removemos a cópia antiga.
drop trigger if exists client_files_notify on public.client_files;

create or replace function public.notify_client_file_available()
returns trigger language plpgsql security definer set search_path='public' as $$
begin
 if new.client_visible then
  insert into public.notifications(user_id,type,title,message,link,metadata)
  select recipients.user_id,'file_available','Novo arquivo disponível',
    'O arquivo "'||new.name||'" está disponível no seu portal.',
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
end; $$;

create or replace function public.notify_client_file_published()
returns trigger language plpgsql security definer set search_path='public' as $$
begin
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
end; $$;

-- Etapas com revisão e avisos que abrem diretamente a etapa correspondente.
-- Aplicar no Supabase antes de liberar o status "Em revisão" no painel.
alter table public.project_stages
  drop constraint if exists project_stages_status_check;
alter table public.project_stages
  add constraint project_stages_status_check
  check (status in ('pending','in_progress','review','completed'));

-- Preserva o modelo atual de notificações/preferências e destinatários
-- (cliente principal e adicionais), mas troca o destino para a etapa.
create or replace function public.notify_project_stage_change()
returns trigger language plpgsql security definer set search_path='public' as $$
declare project_title text;
begin
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
end; $$;

-- Tarefas ligadas a uma etapa pública também abrem a página específica.
-- Tarefas soltas ou com etapa privada continuam apontando para o projeto.
create or replace function public.notify_task_change()
returns trigger language plpgsql security definer set search_path='public' as $$
begin
  if new.client_visible and old.status is distinct from new.status then
    insert into public.notifications(user_id,type,title,message,link,metadata)
    select recipients.user_id,'project_task','Etapa de trabalho atualizada',
      '"'||new.title||'" agora está em '||
        case new.status when 'review' then 'revisão'
          when 'completed' then 'concluída'
          when 'in_progress' then 'andamento'
          when 'pending' then 'pendente'
          when 'cancelled' then 'cancelada'
          else new.status end||'.',
      case when new.stage_id is not null and exists (
        select 1 from public.project_stages stage
        where stage.id=new.stage_id and stage.project_id=new.project_id and stage.client_visible
      ) then '/app/projetos/'||new.project_id::text||'/etapas/'||new.stage_id::text
      else '/app/projetos/'||new.project_id::text end,
      jsonb_build_object('project_id',new.project_id,'task_id',new.id,
        'stage_id',new.stage_id,'status',new.status)
    from app_private.project_notice_recipients(new.project_id) recipients
    where public.customer_portal_notification_enabled(recipients.user_id,'project');
  end if;
  return new;
end; $$;

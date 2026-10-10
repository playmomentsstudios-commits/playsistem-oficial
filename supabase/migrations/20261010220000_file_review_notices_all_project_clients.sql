-- Distribui solicitações de aprovação para todos os clientes vinculados ao projeto.
-- Somente o cliente autorizado a aprovar mantém essa ação; para os demais o aviso é informativo.
create or replace function public.request_file_review(p_file_id uuid)
returns public.client_files
language plpgsql security definer set search_path='public'
as $$
declare f public.client_files%rowtype;
begin
  if not (public.current_user_is_admin() or public.current_user_has_permission('files.manage')) then
    raise exception 'File management permission required' using errcode='42501';
  end if;
  update public.client_files set
    client_visible=true,review_required=true,review_status='pending',
    review_requested_at=now(),review_requested_by=auth.uid(),
    reviewed_at=null,reviewed_by=null
  where id=p_file_id returning * into f;
  if not found then
    raise exception 'File not found' using errcode='P0002';
  end if;
  insert into public.file_reviews(file_id,customer_id,action,created_by)
  values(f.id,f.customer_id,'requested',auth.uid());

  insert into public.notifications(user_id,type,title,message,link,metadata)
  select recipients.user_id,'file_review_requested',
    case when recipients.user_id=f.customer_id
      then 'Arquivo aguardando sua aprovação'
      else 'Versão enviada para análise' end,
    case when recipients.user_id=f.customer_id
      then 'A equipe enviou uma versão para sua análise.'
      else 'Uma versão do projeto foi enviada ao responsável para análise.' end,
    '/app/arquivos',
    jsonb_build_object('file_id',f.id,'project_id',f.project_id,'version_number',f.version_number)
  from (
    select user_id from app_private.project_notice_recipients(f.project_id)
    where f.project_id is not null
    union
    select f.customer_id where f.project_id is null and f.customer_id is not null
  ) recipients
  where public.customer_portal_notification_enabled(recipients.user_id,'file');
  return f;
end $$;

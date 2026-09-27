-- Preference-aware operational notifications.
-- Requires migrations through 20260926240000_admin_operational_settings.sql.

create or replace function public.customer_portal_notification_enabled(
  p_user_id uuid,
  p_kind text
)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select
    coalesce((select internal_operation_notifications from public.app_settings where id=true),true)
    and coalesce((select notify_portal from public.user_preferences where user_id=p_user_id),true)
    and case
      when p_kind='project' then coalesce((select notify_project_updates from public.user_preferences where user_id=p_user_id),true)
      when p_kind='file' then coalesce((select notify_file_updates from public.user_preferences where user_id=p_user_id),true)
      when p_kind='commercial' then
        coalesce((select commercial_notifications from public.app_settings where id=true),true)
        and coalesce((select notify_commercial_updates from public.user_preferences where user_id=p_user_id),true)
      else true
    end;
$$;

revoke all on function public.customer_portal_notification_enabled(uuid,text) from public;

create or replace function public.notify_order_status_change()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if old.status is distinct from new.status
    and public.customer_portal_notification_enabled(new.customer_id,'commercial') then
    insert into public.notifications(user_id,type,title,message,link,metadata)
    values(
      new.customer_id,'order_status','Pedido atualizado',
      'O pedido '||new.order_number||' mudou para '||replace(new.status,'_',' ')||'.',
      '/app/pedidos/'||new.id::text,
      jsonb_build_object('order_id',new.id,'status',new.status)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists orders_notify_status_change on public.orders;
create trigger orders_notify_status_change
after update of status on public.orders
for each row execute function public.notify_order_status_change();

create or replace function public.notify_project_status_change()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if new.customer_id is not null
    and old.status is distinct from new.status
    and public.customer_portal_notification_enabled(new.customer_id,'project') then
    insert into public.notifications(user_id,type,title,message,link,metadata)
    values(
      new.customer_id,'project_status','Projeto atualizado',
      'O projeto "'||new.title||'" mudou para '||replace(new.status,'_',' ')||'.',
      '/app/projetos/'||new.id::text,
      jsonb_build_object('project_id',new.id,'status',new.status)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists projects_notify_status_change on public.projects;
create trigger projects_notify_status_change
after update of status on public.projects
for each row execute function public.notify_project_status_change();

create or replace function public.notify_client_file_available()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if new.client_visible
    and public.customer_portal_notification_enabled(new.customer_id,'file') then
    insert into public.notifications(user_id,type,title,message,link,metadata)
    values(
      new.customer_id,'file_available','Novo arquivo disponível',
      'O arquivo "'||new.name||'" está disponível no seu portal.',
      '/app/arquivos',
      jsonb_build_object('file_id',new.id,'project_id',new.project_id)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists client_files_notify_available on public.client_files;
create trigger client_files_notify_available
after insert on public.client_files
for each row execute function public.notify_client_file_available();

create or replace function public.notify_client_file_published()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if not old.client_visible and new.client_visible
    and public.customer_portal_notification_enabled(new.customer_id,'file') then
    insert into public.notifications(user_id,type,title,message,link,metadata)
    values(
      new.customer_id,'file_available','Arquivo liberado para você',
      'O arquivo "'||new.name||'" foi liberado no seu portal.',
      '/app/arquivos',
      jsonb_build_object('file_id',new.id,'project_id',new.project_id)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists client_files_notify_published on public.client_files;
create trigger client_files_notify_published
after update of client_visible on public.client_files
for each row execute function public.notify_client_file_published();

-- Make quote conversion respect global/customer commercial notification preferences.
create or replace function public.admin_convert_quote(
  p_quote_id uuid,
  p_create_project boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  q public.quotes%rowtype;
  order_uuid uuid;
  project_uuid uuid;
begin
  if not public.current_user_is_staff_or_admin() then
    raise exception 'Staff access required' using errcode='42501';
  end if;

  select * into q from public.quotes where id=p_quote_id for update;
  if not found then raise exception 'Quote not found' using errcode='P0002'; end if;
  if q.status <> 'accepted' then raise exception 'Only accepted quotes can be converted' using errcode='22023'; end if;

  if q.converted_order_id is not null then
    return jsonb_build_object('order_id',q.converted_order_id,'project_id',q.converted_project_id,'already_converted',true);
  end if;

  insert into public.orders(customer_id,status,payment_status,subtotal,total,notes)
  values(q.customer_id,'awaiting_payment','pending',q.subtotal,q.total,'Gerado a partir do orçamento '||q.quote_number)
  returning id into order_uuid;

  insert into public.order_items(order_id,item_type,name_snapshot,quantity,unit_price,total_price)
  select order_uuid,'service',description,quantity,unit_price,total_price
  from public.quote_items where quote_id=q.id;

  if q.total > 0 then
    insert into public.payments(customer_id,order_id,quote_id,amount,method,status,provider)
    values(q.customer_id,order_uuid,q.id,q.total,'pix_manual','pending','manual');
  end if;

  if p_create_project then
    insert into public.projects(title,description,project_type,customer_id,order_id,quote_id,status,priority,created_by)
    values(q.title,q.description,'service',q.customer_id,order_uuid,q.id,'planning','medium',auth.uid())
    returning id into project_uuid;
  end if;

  update public.quotes set converted_order_id=order_uuid,converted_project_id=project_uuid where id=q.id;

  if public.customer_portal_notification_enabled(q.customer_id,'commercial') then
    insert into public.notifications(user_id,type,title,message,link,metadata)
    values(
      q.customer_id,'quote_converted','Orçamento convertido em pedido',
      'Seu orçamento '||q.quote_number||' foi convertido em pedido.',
      '/app/pedidos/'||order_uuid::text,
      jsonb_build_object('quote_id',q.id,'order_id',order_uuid,'project_id',project_uuid)
    );
  end if;

  return jsonb_build_object('order_id',order_uuid,'project_id',project_uuid,'already_converted',false);
end;
$$;

revoke all on function public.admin_convert_quote(uuid,boolean) from public;
grant execute on function public.admin_convert_quote(uuid,boolean) to authenticated;

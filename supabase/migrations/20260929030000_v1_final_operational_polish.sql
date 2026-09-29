-- #220 — Final operational polish: project deletion, catalog separation and targeted announcements.
begin;

-- Master-only project deletion. Drive objects are intentionally preserved; only platform records are removed/unlinked.
create or replace function public.admin_delete_project(p_project_id uuid)
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  if not public.current_user_is_admin() then
    raise exception 'Admin Master access required' using errcode='42501';
  end if;
  if not exists(select 1 from public.projects where id=p_project_id) then
    raise exception 'Project not found' using errcode='P0002';
  end if;
  delete from public.projects where id=p_project_id;
end;
$$;
revoke all on function public.admin_delete_project(uuid) from public;
grant execute on function public.admin_delete_project(uuid) to authenticated;

-- Safe product -> service conversion. Keeps the original product archived for order/history integrity.
create or replace function public.admin_convert_product_to_service(p_product_id uuid)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  p public.products%rowtype;
  result_id uuid;
  next_slug text;
  next_price_type text;
  next_price integer;
begin
  if not public.current_user_is_admin() then
    raise exception 'Admin Master access required' using errcode='42501';
  end if;
  select * into p from public.products where id=p_product_id for update;
  if not found then raise exception 'Product not found' using errcode='P0002'; end if;

  next_slug := p.slug;
  if exists(select 1 from public.services where slug=next_slug) then
    next_slug := p.slug || '-servico-' || substr(p.id::text,1,8);
  end if;
  next_price := coalesce(p.promotional_price,p.sale_price);
  next_price_type := case when next_price is null then 'quote' else 'fixed' end;

  insert into public.services(
    name,slug,short_description,description,category,price_type,price,
    active,featured,status,created_by
  )
  values(
    p.name,next_slug,p.short_description,p.description,
    (select name from public.product_categories where id=p.category_id),
    next_price_type,next_price,p.active,p.featured,
    case when p.status='published' then 'published' else 'draft' end,
    auth.uid()
  )
  returning id into result_id;

  update public.products set status='archived',active=false,updated_at=now() where id=p.id;
  return result_id;
end;
$$;
revoke all on function public.admin_convert_product_to_service(uuid) from public;
grant execute on function public.admin_convert_product_to_service(uuid) to authenticated;

-- Targeted announcements. Empty recipient list means all active customers.
alter table public.announcements
  add column if not exists target_mode text not null default 'all_customers'
    check(target_mode in ('all_customers','selected_customers','academy_students','service_customers')),
  add column if not exists recipient_ids uuid[] not null default '{}',
  add column if not exists target_reference_id uuid;

create index if not exists announcements_recipient_ids_gin on public.announcements using gin(recipient_ids);

create or replace function public.admin_create_targeted_announcement(
  p_title text,
  p_content text,
  p_target_mode text default 'all_customers',
  p_target_ids uuid[] default '{}'::uuid[],
  p_target_reference_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  result_id uuid;
  resolved uuid[] := '{}'::uuid[];
begin
  if not public.current_user_is_admin() and not public.current_user_has_permission('community.manage') then
    raise exception 'Communication permission required' using errcode='42501';
  end if;
  if p_target_mode not in ('all_customers','selected_customers','academy_students','service_customers') then
    raise exception 'Invalid target mode' using errcode='22023';
  end if;

  if p_target_mode='selected_customers' then
    select coalesce(array_agg(id),'{}'::uuid[]) into resolved
    from public.profiles where role='customer' and status='active' and id=any(p_target_ids);
  elsif p_target_mode='academy_students' then
    select coalesce(array_agg(distinct ce.user_id),'{}'::uuid[]) into resolved
    from public.course_enrollments ce
    join public.profiles p on p.id=ce.user_id
    where p.role='customer' and p.status='active'
      and ce.status in ('active','completed')
      and (p_target_reference_id is null or ce.course_id=p_target_reference_id);
  elsif p_target_mode='service_customers' then
    select coalesce(array_agg(distinct o.customer_id),'{}'::uuid[]) into resolved
    from public.orders o
    join public.order_items oi on oi.order_id=o.id
    join public.profiles p on p.id=o.customer_id
    where p.role='customer' and p.status='active'
      and oi.item_type='service'
      and (p_target_reference_id is null or oi.service_id=p_target_reference_id);
  end if;

  insert into public.announcements(title,content,audience,active,created_by,target_mode,recipient_ids,target_reference_id)
  values(btrim(p_title),btrim(p_content),'customers',true,auth.uid(),p_target_mode,resolved,p_target_reference_id)
  returning id into result_id;
  return result_id;
end;
$$;
revoke all on function public.admin_create_targeted_announcement(text,text,text,uuid[],uuid) from public;
grant execute on function public.admin_create_targeted_announcement(text,text,text,uuid[],uuid) to authenticated;

drop policy if exists announcements_customer_read on public.announcements;
create policy announcements_customer_read on public.announcements for select to authenticated
using (
  public.current_user_is_staff_or_admin()
  or (
    active and (expires_at is null or expires_at>now())
    and audience in ('all','customers')
    and (
      target_mode='all_customers'
      or auth.uid()=any(recipient_ids)
    )
  )
);

create or replace function public.notify_announcement()
returns trigger language plpgsql security definer set search_path=public
as $$
begin
  if new.active and new.audience in ('all','customers') then
    if new.target_mode='all_customers' then
      insert into public.notifications(user_id,type,title,message,link,metadata)
      select id,'announcement',new.title,left(new.content,240),'/app/comunicados',
        jsonb_build_object('announcement_id',new.id,'target_mode',new.target_mode)
      from public.profiles where role='customer' and status='active';
    else
      insert into public.notifications(user_id,type,title,message,link,metadata)
      select id,'announcement',new.title,left(new.content,240),'/app/comunicados',
        jsonb_build_object('announcement_id',new.id,'target_mode',new.target_mode)
      from public.profiles where role='customer' and status='active' and id=any(new.recipient_ids);
    end if;
  end if;
  return new;
end $$;

commit;

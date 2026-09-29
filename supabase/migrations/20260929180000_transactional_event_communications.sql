-- Event-driven transactional portal communications.
begin;

create or replace function public.notify_transactional_payment()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_customer uuid; v_order_number text;
begin
  if lower(coalesce(new.status,'')) not in ('paid','received','confirmed','approved')
     or (tg_op='UPDATE' and lower(coalesce(old.status,'')) in ('paid','received','confirmed','approved')) then
    return new;
  end if;
  select customer_id,order_number into v_customer,v_order_number from public.orders where id=new.order_id;
  if v_customer is null then return new; end if;
  insert into public.notifications(user_id,type,title,message,link,metadata)
  select v_customer,'payment_confirmed','Pagamento confirmado',
    'Recebemos o pagamento do pedido '||coalesce(v_order_number,'')||'. Você pode acompanhar as próximas etapas no seu painel.',
    '/app/pedidos/'||new.order_id,
    jsonb_build_object('payment_id',new.id,'order_id',new.order_id)
  where not exists(select 1 from public.notifications n where n.user_id=v_customer
    and n.type='payment_confirmed' and n.metadata->>'payment_id'=new.id::text);
  return new;
end $$;
drop trigger if exists trg_notify_transactional_payment on public.payments;
create trigger trg_notify_transactional_payment after insert or update of status on public.payments
for each row execute function public.notify_transactional_payment();

create or replace function public.notify_academy_enrollment_onboarding()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_course text;
begin
  if new.status<>'active' then return new; end if;
  select title into v_course from public.courses where id=new.course_id;
  insert into public.notifications(user_id,type,title,message,link,metadata)
  select new.user_id,'academy_enrollment','Matrícula confirmada',
    'Sua matrícula em '||coalesce(v_course,'curso')||' está ativa. Acesse a Academia para começar.',
    '/app/academia/'||new.course_id,
    jsonb_build_object('enrollment_id',new.id,'course_id',new.course_id)
  where not exists(select 1 from public.notifications n where n.user_id=new.user_id
    and n.type='academy_enrollment' and n.metadata->>'enrollment_id'=new.id::text);
  return new;
end $$;
drop trigger if exists trg_notify_academy_enrollment_onboarding on public.course_enrollments;
create trigger trg_notify_academy_enrollment_onboarding after insert on public.course_enrollments
for each row execute function public.notify_academy_enrollment_onboarding();

create or replace function public.notify_project_completion()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.status<>'completed' or old.status='completed' or new.customer_id is null then return new; end if;
  insert into public.notifications(user_id,type,title,message,link,metadata)
  select new.customer_id,'project_completed','Projeto concluído',
    'O projeto '||new.title||' foi concluído. Seus arquivos e histórico continuam disponíveis no portal.',
    '/app/projetos/'||new.id,
    jsonb_build_object('project_id',new.id)
  where not exists(select 1 from public.notifications n where n.user_id=new.customer_id
    and n.type='project_completed' and n.metadata->>'project_id'=new.id::text);

  update public.customer_crm
  set stage='delivered',next_action=null,next_action_at=null,last_contact_at=now(),updated_at=now()
  where customer_id=new.customer_id and stage not in ('delivered','lost');
  return new;
end $$;
drop trigger if exists trg_notify_project_completion on public.projects;
create trigger trg_notify_project_completion after update of status on public.projects
for each row execute function public.notify_project_completion();

commit;

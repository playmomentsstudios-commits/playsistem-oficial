-- Revenue/re-engagement signals: internal, idempotent and preference-aware.
begin;
create or replace function public.sync_reengagement_opportunities()
returns integer language plpgsql security definer set search_path=public as $$
declare v_count integer:=0;
begin
 if not public.current_user_is_staff_or_admin() then raise exception 'Staff access required' using errcode='42501';end if;
 with candidates as(
  select c.customer_id,c.owner_id,c.updated_at,
   case when c.stage='delivered' and c.updated_at<=now()-interval '30 days' then 'post_sale'
        when c.stage='lost' and c.updated_at<=now()-interval '45 days' then 'lost_recovery' end reason
  from public.customer_crm c
  where (c.stage='delivered' and c.updated_at<=now()-interval '30 days') or(c.stage='lost' and c.updated_at<=now()-interval '45 days')
 ),recipients as(
  select x.*,coalesce(x.owner_id,a.id) recipient_id from candidates x left join lateral(select id from public.profiles where role='admin' and status='active' order by created_at limit 1)a on x.owner_id is null
 ),ins as(
  insert into public.notifications(user_id,type,title,message,link,metadata)
  select recipient_id,'crm_reengagement',
   case reason when 'post_sale' then 'Oportunidade de pós-venda' else 'Oportunidade de reengajamento' end,
   case reason when 'post_sale' then 'Cliente entregue há 30+ dias. Avalie satisfação, recompra ou serviço complementar.' else 'Oportunidade perdida há 45+ dias. Reavalie somente se houver contexto comercial relevante.' end,
   '/admin/clientes/'||customer_id,jsonb_build_object('customer_id',customer_id,'reason',reason)
  from recipients r where recipient_id is not null and not exists(select 1 from public.notifications n where n.user_id=r.recipient_id and n.type='crm_reengagement' and n.metadata->>'customer_id'=r.customer_id::text and n.metadata->>'reason'=r.reason and n.created_at>=now()-interval '30 days')
  returning 1)
 select count(*) into v_count from ins;
 return v_count;
end $$;
revoke all on function public.sync_reengagement_opportunities() from public;
grant execute on function public.sync_reengagement_opportunities() to authenticated;
commit;

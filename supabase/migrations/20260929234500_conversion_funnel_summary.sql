-- Complete server-side conversion summary; avoids client row caps.
begin;
create or replace function public.conversion_funnel_summary(p_days integer default 30)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_since timestamptz;v_counts jsonb;v_campaigns jsonb;v_checkout bigint;v_payment bigint;
begin
 if not (public.current_user_is_admin() or public.current_user_has_permission('reports.view')) then raise exception 'Reports permission required' using errcode='42501';end if;
 if p_days not in(7,30,90) then raise exception 'Invalid period' using errcode='22023';end if;
 v_since:=now()-make_interval(days=>p_days);
 select coalesce(jsonb_object_agg(event_name,total),'{}'::jsonb) into v_counts from(select event_name,count(*) total from public.conversion_events where created_at>=v_since group by event_name)s;
 select count(*) into v_checkout from public.conversion_events where created_at>=v_since and event_name='checkout_started';
 select count(*) into v_payment from public.conversion_events where created_at>=v_since and event_name='payment_created';
 select coalesce(jsonb_agg(jsonb_build_object('campaign_code',campaign_code,'total',total) order by total desc),'[]'::jsonb) into v_campaigns from(select campaign_code,count(*) total from public.conversion_events where created_at>=v_since and campaign_code is not null group by campaign_code order by total desc limit 8)s;
 return jsonb_build_object('counts',v_counts,'campaigns',v_campaigns,'checkout_started',v_checkout,'payment_created',v_payment,'checkout_to_payment_percent',case when v_checkout=0 then 0 else round(v_payment::numeric*100/v_checkout,1) end);
end $$;
revoke all on function public.conversion_funnel_summary(integer) from public;
grant execute on function public.conversion_funnel_summary(integer) to authenticated;
commit;

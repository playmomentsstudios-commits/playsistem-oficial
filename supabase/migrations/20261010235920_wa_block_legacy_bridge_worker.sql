-- A worker from an older code version MUST NOT send real messages.
-- Any claimed attempt is rejected unless the connected worker recently
-- declared support for verified destination lookup and receipt tracking.
alter table public.whatsapp_bridge_state
 add column if not exists worker_capability text,
 add column if not exists worker_capability_at timestamptz;

create or replace function public.wa_bridge_worker_capability(
 p_instance uuid,p_capability text
) returns boolean language plpgsql security invoker set search_path='' as $$
begin
 if p_capability is distinct from 'registered-jid-receipts-v1' then return false; end if;
 update public.whatsapp_bridge_state set
  worker_capability=p_capability,worker_capability_at=now()
 where id=true and instance_id=p_instance and status='connected'
   and heartbeat_at>now()-interval '35 seconds' and requested_mode='connect';
 return found;
end $$;
revoke all on function public.wa_bridge_worker_capability(uuid,text) from public,anon,authenticated;
grant execute on function public.wa_bridge_worker_capability(uuid,text) to service_role;

create or replace function public.wa_bridge_block_legacy_worker()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if not exists(
  select 1 from public.whatsapp_bridge_state b
  where b.id=true and b.instance_id=new.instance_id
   and b.status='connected' and b.requested_mode='connect'
   and b.worker_capability='registered-jid-receipts-v1'
   and b.worker_capability_at>now()-interval '35 seconds'
   and b.heartbeat_at>now()-interval '35 seconds'
 ) then
  raise exception 'Ponte WhatsApp desatualizada ou inativa. Atualize os arquivos do serviço local antes de enviar.'
    using errcode='55000';
 end if;
 return new;
end $$;
drop trigger if exists wa_bridge_block_legacy_on_attempt on public.whatsapp_bridge_attempts;
create trigger wa_bridge_block_legacy_on_attempt
 before insert on public.whatsapp_bridge_attempts
 for each row execute function public.wa_bridge_block_legacy_worker();
revoke all on function public.wa_bridge_block_legacy_worker() from public,anon,authenticated;

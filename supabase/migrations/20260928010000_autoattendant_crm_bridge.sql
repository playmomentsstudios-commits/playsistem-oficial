-- Safe bridge from customer self-service to the commercial CRM.
-- Customers can only update their own CRM row and cannot force advanced stages.

create or replace function public.customer_autoattendant_crm_event(
  p_event text,
  p_detail text default null
)
returns public.customer_crm
language plpgsql
security definer
set search_path=public
as $$
declare
  v_customer_id uuid:=auth.uid();
  current_row public.customer_crm%rowtype;
  result_row public.customer_crm%rowtype;
  event_label text;
  action_label text;
  note_text text;
  next_stage text;
begin
  if v_customer_id is null or not exists(
    select 1 from public.profiles
    where id=v_customer_id and role='customer' and status='active'
  ) then
    raise exception 'Active customer session required' using errcode='42501';
  end if;

  if p_event not in ('service_interest','product_interest','custom_project','support_request') then
    raise exception 'Invalid autoattendant event' using errcode='22023';
  end if;

  insert into public.customer_crm(customer_id)
  values(v_customer_id)
  on conflict(customer_id) do nothing;

  select * into current_row
  from public.customer_crm
  where customer_crm.customer_id=v_customer_id
  for update;

  event_label:=case p_event
    when 'service_interest' then 'Interesse em serviço'
    when 'product_interest' then 'Interesse em produto'
    when 'custom_project' then 'Projeto personalizado'
    else 'Suporte solicitado'
  end;

  action_label:=case p_event
    when 'service_interest' then 'Qualificar interesse em serviço'
    when 'product_interest' then 'Acompanhar interesse em produto'
    when 'custom_project' then 'Analisar briefing do projeto personalizado'
    else 'Responder solicitação encaminhada pelo autoatendimento'
  end;

  -- Auto-service may qualify a new contact, but never regress or skip an advanced commercial stage.
  next_stage:=case when current_row.stage='new_contact' then 'in_service' else current_row.stage end;
  note_text:='Autoatendimento: '||event_label||
    case when nullif(btrim(coalesce(p_detail,'')),'') is not null
      then ' — '||left(btrim(p_detail),1000) else '' end;

  update public.customer_crm
  set
    stage=next_stage,
    source=coalesce(nullif(source,''),'Autoatendimento'),
    next_action=case
      when stage in ('new_contact','in_service') then action_label
      else next_action
    end,
    last_contact_at=now(),
    internal_notes=case
      when coalesce(internal_notes,'')='' then note_text
      when position(note_text in internal_notes)>0 then internal_notes
      else internal_notes||E'\n'||note_text
    end,
    updated_at=now(),
    updated_by=v_customer_id
  where customer_crm.customer_id=v_customer_id
  returning * into result_row;

  if current_row.stage is distinct from next_stage then
    insert into public.customer_crm_history(customer_id,from_stage,to_stage,changed_by,note)
    values(v_customer_id,current_row.stage,next_stage,customer_id,'Movido automaticamente pelo autoatendimento: '||event_label);
  end if;

  return result_row;
end;
$$;

revoke all on function public.customer_autoattendant_crm_event(text,text) from public;
grant execute on function public.customer_autoattendant_crm_event(text,text) to authenticated;

-- SAGAMENTE | Editable WhatsApp copy and reversible admin-only history archiving.
-- SQL must be applied before deploying the UI; existing prepared messages stay unchanged.
create table if not exists public.wa_message_templates (
 template_key text primary key check (template_key in (
   'project_started','stage_completed','review_available',
   'adjustments_completed','final_delivery','new_message'
 )),
 body text not null check (char_length(body) between 1 and 1500),
 updated_at timestamptz not null default now(),
 updated_by uuid references auth.users(id)
);
alter table public.wa_message_templates enable row level security;
revoke all on public.wa_message_templates from public,anon,authenticated;
grant select on public.wa_message_templates to authenticated;
drop policy if exists wa_message_templates_admin_read on public.wa_message_templates;
create policy wa_message_templates_admin_read on public.wa_message_templates
  for select to authenticated using (public.current_user_is_admin());

insert into public.wa_message_templates(template_key,body) values
 ('project_started', E'*Seu projeto começou!*\n\nO projeto *{{project_name}}* já está em andamento.\n\n{{link}}'),
 ('stage_completed', E'*Etapa concluída*\n\nA etapa *{{stage_name}}* do projeto *{{project_name}}* foi concluída.\n\n{{link}}'),
 ('review_available', E'*Revisão disponível*\n\nO material *{{material_name}}* do projeto *{{project_name}}* está pronto para sua análise.\n\n{{link}}'),
 ('adjustments_completed', E'*Ajustes concluídos*\n\nUma nova versão do material *{{material_name}}* do projeto *{{project_name}}* está disponível.\n\n{{link}}'),
 ('final_delivery', E'*Entrega final disponível*\n\nConcluímos o projeto *{{project_name}}*. Os materiais finais estão disponíveis.\n\n{{link}}'),
 ('new_message', E'*Nova mensagem no projeto*\n\nHá uma nova mensagem sobre *{{project_name}}*.\n\n{{link}}')
on conflict (template_key) do nothing;

-- Saves go through this RPC; no direct writes from authenticated clients.
create or replace function public.wa_save_template(p_key text,p_body text)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.current_user_is_admin() then
   raise exception 'Apenas administradores podem editar modelos.' using errcode='42501';
 end if;
 if p_body is null or char_length(btrim(p_body)) not between 1 and 1500
    or p_body !~ E'\\{\\{link\\}\\}[[:space:]]*$'
    or (char_length(p_body)-char_length(replace(p_body,'{{link}}','')))/8 <> 1
    or regexp_replace(p_body, E'\\{\\{(project_name|stage_name|material_name|customer_name|link)\\}\\}', '', 'g') ~ E'\\{\\{|\\}\\}'
    or p_body ~* 'https?://' then
   raise exception 'Texto inválido: até 1500 caracteres; apenas variáveis permitidas, sem links externos e {{link}} uma vez no final.' using errcode='22023';
 end if;
 update public.wa_message_templates
 set body=p_body, updated_at=now(), updated_by=auth.uid()
 where template_key=p_key;
 if not found then
   raise exception 'Modelo não encontrado.' using errcode='22023';
 end if;
end $$;
revoke all on function public.wa_save_template(text,text) from public,anon,authenticated;
grant execute on function public.wa_save_template(text,text) to authenticated;

-- Archiving never deletes source/audit records or changes the delivery queue.
alter table public.whatsapp_message_outbox
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references auth.users(id);
create index if not exists wa_outbox_archive_created_idx
 on public.whatsapp_message_outbox(archived_at,created_at desc);
create or replace function public.wa_set_archive(p_outbox_id uuid,p_archive boolean)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.current_user_is_admin() then
   raise exception 'Apenas administradores podem arquivar mensagens.' using errcode='42501';
 end if;
 update public.whatsapp_message_outbox
 set archived_at=case when p_archive then now() else null end,
     archived_by=case when p_archive then auth.uid() else null end
 where id=p_outbox_id;
 if not found then
   raise exception 'Registro não encontrado.' using errcode='22023';
 end if;
end $$;
revoke all on function public.wa_set_archive(uuid,boolean) from public,anon,authenticated;
grant execute on function public.wa_set_archive(uuid,boolean) to authenticated;

-- Update the current message builder, without altering attachments, consent or delivery.

create or replace function app_private.wa_add_file_link_to_outbox()
returns trigger language plpgsql security definer set search_path='' as $$
declare
  n public.notifications%rowtype;
  f record;
  v_project uuid;
  v_project_name text;
  v_adjustments_done boolean:=false;
  v_task uuid;
  v_stage uuid;
  v_task_name text;
  v_stage_name text;
  v_status text;
  v_body text;
  v_footer text;
  v_label text;
  v_file_name text;
  v_file_url text;
  v_link text;
  v_group text;
  v_main integer:=0;
  v_support integer:=0;
  v_other integer:=0;
  v_count integer:=0;
  v_template_key text;
  v_template_body text;
begin
  if new.source<>'live' or new.status not in ('ready_manual','missing_phone')
    or new.event_type not in ('project_task','project_stage','project_status','project_updated','file_available','file_received','file_review_requested')
    then return new; end if;

  select * into n from public.notifications where id=new.notification_id;
  if not found or n.user_id is distinct from new.recipient_user_id then return new; end if;
  if coalesce(n.metadata->>'project_id','') !~ '^[0-9a-fA-F-]{36}$' then return new; end if;
  v_project:=(n.metadata->>'project_id')::uuid;
  select p.title into v_project_name from public.projects p where p.id=v_project;
  v_project_name:=left(regexp_replace(coalesce(v_project_name,'projeto'),'[\r\n\t*]',' ','g'),100);
  if not exists (
    select 1 from public.projects p join public.profiles u on u.id=n.user_id
    where p.id=v_project and p.project_type<>'internal'
      and u.role='customer' and u.status='active'
      and (p.customer_id=u.id or exists (
        select 1 from public.project_customer_access a
        where a.project_id=p.id and a.customer_id=u.id
      ))
  ) then return new; end if;

  v_status:=coalesce(n.metadata->>'status','');
  if n.type='project_task' then
    if coalesce(n.metadata->>'task_id','') !~ '^[0-9a-fA-F-]{36}$' then return new; end if;
    v_task:=(n.metadata->>'task_id')::uuid;
    select t.title,t.stage_id into v_task_name,v_stage
    from public.tasks t
    where t.id=v_task and t.project_id=v_project and t.client_visible
      and (t.stage_id is null or exists (
        select 1 from public.project_stages s
        where s.id=t.stage_id and s.project_id=v_project and s.client_visible
      ));
    if v_task_name is null then return new; end if;
    -- Never trust arbitrary names or messages to control the WhatsApp formatting.
    v_task_name:=left(regexp_replace(v_task_name,'[\r\n\t*]',' ','g'),95);
    v_body:=case v_status
      when 'review' then '🔎 *Revisão disponível*'||E'\n\n'||
         'O material *'||v_task_name||'* do projeto *'||v_project_name||'* está pronto para sua análise.'
      when 'completed' then '✅ *Atualização concluída*'||E'\n\n'||
         'A entrega *'||v_task_name||'* do projeto *'||v_project_name||'* foi concluída.'
      when 'in_progress' then '✨ *Seu projeto deu mais um passo*'||E'\n\n'||
         'A atualização *'||v_task_name||'* do projeto *'||v_project_name||'* está em andamento.'
      when 'changes_requested' then '🔄 *Ajustes em andamento*'||E'\n\n'||
         'Estamos atualizando *'||v_task_name||'* no projeto *'||v_project_name||'*.'
      when 'cancelled' then '📌 *Atualização no projeto*'||E'\n\n'||
         'A entrega *'||v_task_name||'* do projeto *'||v_project_name||'* foi interrompida.'
      else '📌 *Seu projeto tem uma novidade*'||E'\n\n'||
         'A atualização *'||v_task_name||'* do projeto *'||v_project_name||'* está disponível.'
    end;
    v_label:='🔗 *Acompanhe:*';
  elsif n.type='project_stage' then
    if coalesce(n.metadata->>'stage_id','') !~ '^[0-9a-fA-F-]{36}$' then return new; end if;
    v_stage:=(n.metadata->>'stage_id')::uuid;
    select s.name into v_stage_name from public.project_stages s
      where s.id=v_stage and s.project_id=v_project and s.client_visible;
    if v_stage_name is null then return new; end if;
    v_stage_name:=left(regexp_replace(v_stage_name,'[\r\n\t*]',' ','g'),95);
    v_body:=case v_status
      when 'completed' then '✅ *Etapa concluída*'
      when 'review' then '🔎 *Revisão disponível*'
      when 'in_progress' then '✨ *Seu projeto deu mais um passo*'
      else '📌 *Seu projeto tem uma novidade*'
    end||E'\n\n'||'Etapa: *'||v_stage_name||'*'||E'\n'||
      'Projeto: *'||v_project_name||'*.';
    v_label:='🔗 *Acompanhe:*';
  elsif n.type in ('project_status','project_updated') then
    v_body:=case
      when n.type='project_updated' then '📌 *Atualização do projeto*'||E'\n\n'||
        'O projeto *'||v_project_name||'* teve uma atualização de prazo.'
      when v_status='active' then '🚀 *Projeto iniciado*'||E'\n\n'||
        'O projeto *'||v_project_name||'* já está em andamento.'
      when v_status='completed' then '🎉 *Entrega final disponível*'||E'\n\n'||
        'Concluímos o projeto *'||v_project_name||'*. Os materiais finais estão disponíveis.'
      when v_status='review' then '🔎 *Revisão disponível*'||E'\n\n'||
        'O projeto *'||v_project_name||'* está pronto para sua análise.'
      else '📌 *Seu projeto tem uma novidade*'||E'\n\n'||
        'O projeto *'||v_project_name||'* teve uma atualização.'
    end;
    v_label:='🔗 *Acompanhe:*';
  else
    if coalesce(n.metadata->>'file_id','') !~ '^[0-9a-fA-F-]{36}$' then return new; end if;
    select left(regexp_replace(c.name,'[\r\n\t*]',' ','g'),110) into v_file_name
      from public.client_files c where c.id=(n.metadata->>'file_id')::uuid and c.project_id=v_project;
    select exists(
      select 1
      from public.client_files current_file
      join public.client_files previous_file on previous_file.id=current_file.supersedes_file_id
      join public.file_reviews review on review.file_id=previous_file.id
      where current_file.id=(n.metadata->>'file_id')::uuid
        and review.action='changes_requested'
    ) into v_adjustments_done;
    v_body:=case
      when n.type='file_review_requested' then '🔎 *Revisão disponível*'
      when v_adjustments_done then '🛠️ *Ajustes concluídos*'
      else '📎 *Novo material disponível*'
    end||E'\n\n'||
      'Material: *'||coalesce(v_file_name,'arquivo')||'*'||E'\n'||
      'Projeto: *'||v_project_name||'*'||case when v_adjustments_done then ' recebeu uma nova versão.' else '.' end;
    v_label:='🔗 *Acompanhe:*';
  end if;

  -- Apply administrator-approved copy only to supported customer events.
  -- Preserve the existing eligibility gates, file selection, and trusted link suffix.
  v_template_key:=case
    when n.type='project_status' and v_status='active' then 'project_started'
    when n.type='project_status' and v_status='completed' then 'final_delivery'
    when n.type='project_stage' and v_status='completed' then 'stage_completed'
    when n.type in ('project_task','project_stage') and v_status='review'
      then 'review_available'
    when n.type='file_review_requested' then 'review_available'
    when n.type in ('file_available','file_received') and v_adjustments_done
      then 'adjustments_completed'
    else null
  end;
  if v_template_key is not null then
    select body into v_template_body from public.wa_message_templates
      where template_key=v_template_key;
    if v_template_body is not null then
      v_body:=replace(v_template_body,'{{project_name}}',v_project_name);
      v_body:=replace(v_body,'{{stage_name}}',coalesce(v_stage_name,'etapa'));
      v_body:=replace(v_body,'{{material_name}}',
        coalesce(v_file_name,v_task_name,v_stage_name,'material'));
      v_body:=replace(v_body,'{{customer_name}}',
        left(regexp_replace(coalesce(new.recipient_name,'cliente'),'[\r\n\t*]',' ','g'),100));
      -- Link is positioned by the secure existing footer, after applicable Drive files.
      v_body:=btrim(replace(v_body,'{{link}}',''),E'\n\r\t ');
    end if;
  end if;

  -- Use only the compact, internal task/stage locator. Never concatenate a
  -- user-controlled external URL or a javascript scheme into the message.
  if new.target_link ~ '^/n/[A-Za-z0-9_-]{22}$'
    then v_link:='https://playsistem-oficial.playmomentsstudios.workers.dev'||new.target_link;
  elsif new.target_link ~ '^/app/projetos/[0-9a-fA-F-]{36}(/.*)?$'
    then v_link:='https://playsistem-oficial.playmomentsstudios.workers.dev'||new.target_link;
  else return new; end if;

  -- File selection mirrors task visibility. Task status -> only that task's
  -- attached files, never other tasks' files. Stage -> visible stage files +
  -- files attached to visible tasks in that same stage. Explicit file event ->
  -- just the mentioned file. Grouped versions: latest version only.
  for f in
    with eligible as (
      select c.*,
        (lower(c.name) ~ '(pauta|briefing|refer.ncia|roteiro|instru..es|material de apoio)') as is_support
      from public.client_files c
      left join public.tasks t on t.id=c.task_id and t.project_id=v_project
      where c.project_id=v_project
        and c.client_visible and c.storage_provider='google_drive'
        and c.drive_file_id is not null
        and (c.task_id is null or (
          t.id is not null and t.client_visible and (
            t.stage_id is null or exists(
              select 1 from public.project_stages s
              where s.id=t.stage_id and s.project_id=v_project and s.client_visible
            )
          )
          and (c.stage_id is null or c.stage_id=t.stage_id)
        ))
        and (c.stage_id is null or exists (
          select 1 from public.project_stages s
          where s.id=c.stage_id and s.project_id=v_project and s.client_visible
        ))
        and (
          (n.type='project_task' and c.task_id=v_task)
          or (n.type='project_stage' and (
            (c.task_id is null and c.stage_id=v_stage)
            or (t.id is not null and t.stage_id=v_stage and
                (c.stage_id is null or c.stage_id=v_stage))
          ))
          or (n.type in ('file_available','file_received','file_review_requested')
              and c.id=(n.metadata->>'file_id')::uuid)
          or (n.type in ('project_status','project_updated') and c.project_id=v_project)
        )
    ), versions as (
      select e.*,
        row_number() over(partition by coalesce(e.version_group_id,e.id)
          order by e.version_number desc nulls last,e.created_at desc,e.id desc) as version_rank
      from eligible e
    )
    select * from versions where version_rank=1
    order by is_support asc, created_at desc, version_number desc nulls last, id desc
  loop
    if f.is_support and v_support>=2 then v_other:=v_other+1; continue; end if;
    if not f.is_support and v_main>=6 then v_other:=v_other+1; continue; end if;
    v_count:=v_count+1;
    if f.is_support then
      v_support:=v_support+1;
    else
      v_main:=v_main+1;
    end if;

    if v_count=1 then
      v_body:=v_body||E'\n\n'||'📂 *Arquivos desta '||
        case when n.type='project_stage' then 'etapa' when n.type='project_status' and v_status='completed' then 'entrega final' else 'entrega' end||':*';
    end if;
    v_group:=case when f.is_support then '📄 Apoio: ' else '🖼️ ' end;
    v_file_name:=left(regexp_replace(f.name,'[\r\n\t*]',' ','g'),110);
    -- Only the original Drive file URL with the same verified file id
    -- (or its canonical Google Drive fallback) is emitted. No public share.
    if f.drive_file_id !~ '^[A-Za-z0-9_-]{10,128}$' then
      v_other:=v_other+1;
      continue;
    end if;
    if f.external_url ~ ('^https://drive[.]google[.]com/file/d/'||
         f.drive_file_id||'/view([?][A-Za-z0-9_=&%-]*)?$') then
      v_file_url:=f.external_url;
    else
      v_file_url:='https://drive.google.com/file/d/'||f.drive_file_id||'/view';
    end if;
    v_body:=v_body||E'\n\n'||v_group||'*'||v_file_name||'*'||E'\n'||
      v_file_url;
  end loop;

  if v_count=0 then
    v_body:=v_body||E'\n\n'||
      'Os materiais relacionados a esta atualização estão no link de acompanhamento.';
  elsif v_other>0 then
    v_body:=v_body||E'\n\n'||'+'||v_other::text||
      ' outro(s) arquivo(s) disponível(is) nos detalhes do projeto.';
  end if;
  v_body:=v_body||E'\n\n'||v_label||E'\n'||v_link;

  update public.whatsapp_message_outbox
  set message_body=v_body where id=new.id;
  return new;
end $$;
revoke all on function app_private.wa_add_file_link_to_outbox()
 from public,anon,authenticated;
-- Existing AFTER INSERT trigger keeps invoking this replacement.

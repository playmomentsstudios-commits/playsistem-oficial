-- WhatsApp: use original Google Drive browser links already stored in client_files.external_url.
-- Preserve original notification text, task/file eligibility, ordering, and compact task link.
-- No temporary preview links or media attachments; no Drive permission changes.
-- Original Drive URLs honor Google Drive sharing permissions. No automatic sharing.
-- Human, status-specific WhatsApp updates with all relevant deliverables first.
-- Supersedes the single-newest-file trigger. Existing notifications are unchanged.
-- No Drive public-sharing, no increase in message frequency, no auto replay.
create or replace function app_private.wa_add_file_link_to_outbox()
returns trigger language plpgsql security definer set search_path='' as $$
declare
  n public.notifications%rowtype;
  f record;
  v_project uuid;
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
begin
  if new.source<>'live' or new.status not in ('ready_manual','missing_phone')
    or new.event_type not in ('project_task','project_stage','file_available','file_received','file_review_requested')
    then return new; end if;

  select * into n from public.notifications where id=new.notification_id;
  if not found or n.user_id is distinct from new.recipient_user_id then return new; end if;
  if coalesce(n.metadata->>'project_id','') !~ '^[0-9a-fA-F-]{36}$' then return new; end if;
  v_project:=(n.metadata->>'project_id')::uuid;
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
      when 'review' then '✨ *Seu projeto deu mais um passo!*'||E'\n\n'||
         'A tarefa *'||v_task_name||'* está pronta para sua revisão. Confira os materiais abaixo.'
      when 'completed' then '✅ *Mais uma entrega concluída!*'||E'\n\n'||
         'A tarefa *'||v_task_name||'* foi concluída. Os materiais estão disponíveis para você.'
      when 'in_progress' then '🚀 *Estamos avançando na sua entrega!*'||E'\n\n'||
         'A tarefa *'||v_task_name||'* está em andamento. Veja os materiais disponíveis.'
      when 'changes_requested' then '🔄 *Estamos preparando os ajustes!*'||E'\n\n'||
         'A tarefa *'||v_task_name||'* recebeu uma solicitação de ajustes. Acompanhe os próximos passos.'
      when 'cancelled' then '📌 *Houve uma mudança no planejamento*'||E'\n\n'||
         'A tarefa *'||v_task_name||'* foi cancelada. Confira os detalhes.'
      else '📌 *Tem novidade no seu projeto!*'||E'\n\n'||
         'A tarefa *'||v_task_name||'* teve uma atualização. Confira os detalhes.'
    end;
    v_label:='🔎 *Acompanhe a tarefa:*';
  elsif n.type='project_stage' then
    if coalesce(n.metadata->>'stage_id','') !~ '^[0-9a-fA-F-]{36}$' then return new; end if;
    v_stage:=(n.metadata->>'stage_id')::uuid;
    select s.name into v_stage_name from public.project_stages s
      where s.id=v_stage and s.project_id=v_project and s.client_visible;
    if v_stage_name is null then return new; end if;
    v_stage_name:=left(regexp_replace(v_stage_name,'[\r\n\t*]',' ','g'),95);
    v_body:=case v_status
      when 'completed' then '✅ *Concluímos mais uma etapa!*'
      when 'review' then '✨ *Seu projeto deu mais um passo!*'
      when 'in_progress' then '🚀 *Uma nova etapa está em andamento!*'
      else '📌 *Seu projeto tem novidades!*'
    end||E'\n\n'||'Etapa: *'||v_stage_name||'*.'||E'\n'||
      'Confira os materiais disponíveis e acompanhe o progresso.';
    v_label:='🔎 *Acompanhe a etapa:*';
  else
    if coalesce(n.metadata->>'file_id','') !~ '^[0-9a-fA-F-]{36}$' then return new; end if;
    v_body:='📎 *Um novo material está disponível!*'||E'\n\n'||
      'Preparamos um arquivo para você conferir. Veja abaixo.';
    v_label:='🔎 *Acompanhe o projeto:*';
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
        case when n.type='project_task' then 'tarefa' when n.type='project_stage' then 'etapa'
             else 'atualização' end||':*';
    end if;
    v_group:=case when f.is_support then '📄 Apoio: ' else '🖼️ ' end;
    v_file_name:=left(regexp_replace(f.name,'[\r\n\t*]',' ','g'),110);
    -- Send the real Google Drive browser URL, not a temporary Sagamente
    -- file preview. Never build an unrelated or untrusted external URL.
    if f.drive_file_id !~ '^[A-Za-z0-9_-]{10,128}
  end loop;

  if v_count=0 then
    v_body:=v_body||E'\n\n'||
      'Os materiais liberados para você podem ser consultados na tarefa.';
  elsif v_other>0 then
    v_body:=v_body||E'\n\n'||'+'||v_other::text||
      ' outro(s) arquivo(s) disponível(is) nos detalhes da tarefa ou etapa.';
  end if;
  v_body:=v_body||E'\n\n'||v_label||E'\n'||v_link;

  update public.whatsapp_message_outbox
  set message_body=v_body where id=new.id;
  return new;
end $$;
revoke all on function app_private.wa_add_file_link_to_outbox()
 from public,anon,authenticated;
-- Existing AFTER INSERT trigger keeps invoking this replacement.
 then
      v_other:=v_other+1;
      continue;
    end if;
    if f.external_url ~ ('^https://drive[.]google[.]com/file/d/'||
          f.drive_file_id||'/view([?][A-Za-z0-9_=&%-]*)?
  end loop;

  if v_count=0 then
    v_body:=v_body||E'\n\n'||
      'Os materiais liberados para você podem ser consultados na tarefa.';
  elsif v_other>0 then
    v_body:=v_body||E'\n\n'||'+'||v_other::text||
      ' outro(s) arquivo(s) disponível(is) nos detalhes da tarefa ou etapa.';
  end if;
  v_body:=v_body||E'\n\n'||v_label||E'\n'||v_link||
    E'\n\n'||'_Links dos arquivos válidos por 48 horas. Não compartilhe._';

  update public.whatsapp_message_outbox
  set message_body=v_body where id=new.id;
  return new;
end $$;
revoke all on function app_private.wa_add_file_link_to_outbox()
 from public,anon,authenticated;
-- Existing AFTER INSERT trigger keeps invoking this replacement.
) then
      v_file_url:=f.external_url;
    else
      v_file_url:='https://drive.google.com/file/d/'||f.drive_file_id||'/view';
    end if;
    v_body:=v_body||E'\n\n'||v_group||'*'||v_file_name||'*'||E'\n'||
      v_file_url;
  end loop;

  if v_count=0 then
    v_body:=v_body||E'\n\n'||
      'Os materiais liberados para você podem ser consultados na tarefa.';
  elsif v_other>0 then
    v_body:=v_body||E'\n\n'||'+'||v_other::text||
      ' outro(s) arquivo(s) disponível(is) nos detalhes da tarefa ou etapa.';
  end if;
  v_body:=v_body||E'\n\n'||v_label||E'\n'||v_link||
    E'\n\n'||'_Links dos arquivos válidos por 48 horas. Não compartilhe._';

  update public.whatsapp_message_outbox
  set message_body=v_body where id=new.id;
  return new;
end $$;
revoke all on function app_private.wa_add_file_link_to_outbox()
 from public,anon,authenticated;
-- Existing AFTER INSERT trigger keeps invoking this replacement.

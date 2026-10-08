-- SAGAMENTE — migração institucional, sem renomear identificadores técnicos.
-- IMPORTANTE: aplicar SOMENTE após o frontend SAGAMENTE estar implantado no Cloudflare.
-- Os contatos, IDs de projetos, storage, Drive, OAuth, URLs e histórico financeiro permanecem intactos.
begin;

update public.site_settings
set company_name = 'Sagamente',
    description = 'Empresa brasileira de soluções criativas e tecnológicas em design, comunicação, audiovisual e desenvolvimento digital.',
    footer_description = 'SAGAMENTE — Design, Tecnologia e Comunicação. Soluções para pessoas, empresas e projetos culturais.',
    meta_description = 'SAGAMENTE: soluções em design, sites, sistemas, comunicação, audiovisual e formação.',
    hero_headline = 'Ideias inteligentes. Soluções que transformam.',
    primary_color = '#A65A2A',
    contact_email = case when contact_email = 'contato@playmoments.com.br'
                         then 'playmomentsstudios@gmail.com' else contact_email end,
    updated_at = now()
where id = true and company_name in ('Play Moments','Sagamente');

update public.app_settings
set business_name = 'Sagamente',
    staff_primary_color = '#A65A2A',
    staff_logo_url = '/sagamente-logo-light.svg',
    favicon_url = '/favicon.svg',
    updated_at = now()
where id = true and business_name in ('Play Moments','Sagamente');

-- Introduções institucionais: não sobrescrever depoimentos, entregas ou a história de antigos projetos.
update public.site_profile
set intro = replace(intro, 'Play Moments', 'Sagamente'),
    objective = replace(objective, 'Play Moments', 'Sagamente'),
    updated_at = now()
where id = true and (intro like '%Play Moments%' or objective like '%Play Moments%');

-- Somente respostas para novos atendimentos, sem reescrever conversas já realizadas.
update public.autoattendant_solutions
set response = replace(response, 'Play Moments', 'Sagamente')
where response like '%Play Moments%';

-- Modelos para documentos futuros; os snapshots e PDFs antigos são preservados.
update public.academy_certificate_templates
set body_template = replace(body_template, 'Play Moments', 'Sagamente'),
    layout = case when layout::text like '%Play Moments%'
             then replace(layout::text, 'Play Moments', 'Sagamente')::jsonb
             else layout end
where body_template like '%Play Moments%' or layout::text like '%Play Moments%';

-- Mensagens novas de três funções existentes, preservando assinaturas, permissões, triggers e regras.
do $do$
declare fn record; source text; updated text;
begin
  for fn in
    select p.oid
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.proname in ('notify_client_file','notify_new_message','academy_admin_reissue_certificate')
  loop
    source := pg_get_functiondef(fn.oid);
    updated := replace(source, 'Play Moments', 'Sagamente');
    if updated is distinct from source then execute updated; end if;
  end loop;
end
$do$;

commit;

-- Verificação após aplicar:
-- select company_name, primary_color, contact_email from public.site_settings;
-- select business_name, staff_logo_url from public.app_settings;
-- Não renomear drive_settings.root_folder_name antes de renomear a pasta REAL no Drive.

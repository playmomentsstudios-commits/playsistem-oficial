-- Formulários reutilizáveis sem alterar project_type nem projetos antigos.
create table if not exists public.project_form_templates (
 id uuid primary key default gen_random_uuid(),
 slug text not null unique,
 name text not null,
 version integer not null default 1 check (version > 0),
 configuration jsonb not null check (jsonb_typeof(configuration) = 'object'),
 active boolean not null default true,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists public.project_form_instances (
 project_id uuid primary key references public.projects(id) on delete cascade,
 template_id uuid not null references public.project_form_templates(id) on delete restrict,
 template_slug text not null,
 snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
 answers jsonb not null default '{}'::jsonb check (jsonb_typeof(answers) = 'object'),
 review_states jsonb not null default '{}'::jsonb check (jsonb_typeof(review_states) = 'object'),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists project_form_instances_template_slug_idx on public.project_form_instances(template_slug);
alter table public.project_form_templates enable row level security;
alter table public.project_form_instances enable row level security;
create policy project_form_templates_read on public.project_form_templates for select to authenticated
 using (public.current_user_is_admin() or public.current_user_has_permission('projects.view') or public.current_user_has_permission('projects.manage'));
create policy project_form_templates_admin_write on public.project_form_templates for all to authenticated
 using (public.current_user_is_admin()) with check (public.current_user_is_admin());
create policy project_form_instances_read on public.project_form_instances for select to authenticated
 using (public.current_user_is_admin() or public.current_user_has_permission('projects.view') or public.current_user_has_permission('projects.manage'));
create policy project_form_instances_staff_write on public.project_form_instances for all to authenticated
 using (public.current_user_is_admin() or public.current_user_has_permission('projects.manage'))
 with check ((public.current_user_is_admin() or public.current_user_has_permission('projects.manage'))
 and exists(select 1 from public.projects p where p.id=project_id and p.project_type='internal'));
insert into public.project_form_templates (slug,name,version,configuration)
values ('editais','Editais',1,'{"schemaVersion":1,"slug":"editais","name":"Editais","scope":"internal","drive":{"parent":"Editais","subfolders":["Documentos","Comprovações","Inscrição"],"privacyDefault":"private"},"defaultStages":["Identificação e análise","Elegibilidade","Documentação","Conteúdo e respostas","Comprovações e links","Revisão","Inscrição e protocolo","Acompanhamento","Encerramento"],"sections":[{"id":"identificacao","title":"Identificação do edital","fields":[{"id":"titulo_edital","label":"Nome do edital","type":"text","required":true},{"id":"instituicao","label":"Instituição responsável","type":"text","required":false},{"id":"url_edital","label":"Link oficial","type":"url","required":true},{"id":"abertura_inscricoes","label":"Abertura das inscrições","type":"datetime","required":false},{"id":"prazo_final","label":"Prazo final (com fuso)","type":"datetime","required":true},{"id":"categoria","label":"Categoria","type":"text","required":true},{"id":"subcategoria","label":"Subcategoria","type":"text","required":false},{"id":"valor_premio","label":"Valor/benefício","type":"text","required":false},{"id":"inscricao_tipo","label":"Modalidade","type":"select","required":true,"options":["individual","coletivo","pessoa_juridica"]},{"id":"resultado_previsto","label":"Data prevista do resultado","type":"date","required":false}]},{"id":"elegibilidade","title":"Elegibilidade","fields":[{"id":"requisitos","label":"Requisitos de participação","type":"long_text","required":true},{"id":"impedimentos","label":"Impedimentos e exclusões","type":"long_text","required":true},{"id":"periodo_realizacao","label":"Período de realização exigido","type":"text","required":false},{"id":"enquadramento","label":"Justificativa de enquadramento","type":"long_text","required":true},{"id":"elegivel_revisado","label":"Elegibilidade conferida","type":"checkbox","required":true}]},{"id":"proponente","title":"Proponente e documentação","fields":[{"id":"nome_proponente","label":"Nome do proponente","type":"text","required":true},{"id":"perfil_proponente","label":"Perfil/minicurrículo","type":"long_text","required":true},{"id":"curriculo_anexo","label":"Link do currículo/portfólio","type":"url","required":false},{"id":"autodeclaracao","label":"Link da autodeclaração","type":"url","required":false},{"id":"documentos_pessoais","label":"Referência de documentos privados","type":"text","required":false},{"id":"carta_representacao","label":"Carta de representação: link privado","type":"url","required":false,"showWhen":{"field":"inscricao_tipo","in":["coletivo","pessoa_juridica"]}},{"id":"declaracao_maioria","label":"Declaração de maioria negra: link privado","type":"url","required":false,"showWhen":{"field":"inscricao_tipo","in":["coletivo","pessoa_juridica"]}}]},{"id":"proposta","title":"Proposta submetida","fields":[{"id":"titulo_proposta","label":"Título da proposta","type":"text","required":true},{"id":"descricao","label":"Apresentação da proposta","type":"long_text","required":true},{"id":"realizacao","label":"Data/período de realização","type":"text","required":false},{"id":"territorio","label":"Território de atuação","type":"text","required":false},{"id":"trajetoria","label":"Trajetória cultural","type":"long_text","required":false},{"id":"impacto","label":"Impacto e resultados","type":"long_text","required":false},{"id":"inovacao","label":"Diferencial e exemplaridade","type":"long_text","required":false},{"id":"retorno_social","label":"Retorno social","type":"long_text","required":false},{"id":"participacao","label":"Participação/protagonismo","type":"long_text","required":false}]},{"id":"formulario","title":"Perguntas do formulário externo","fields":[{"id":"perguntas_extras","label":"Perguntas personalizadas (adicione novos campos pela interface)","type":"long_text","required":false}]},{"id":"comprovacoes","title":"Comprovações","fields":[{"id":"links","label":"Links comprobatórios (um por linha)","type":"long_text","required":true},{"id":"anexos","label":"Referências dos anexos","type":"text","required":false},{"id":"visibilidade","label":"Links testados sem login?","type":"checkbox","required":false},{"id":"metricas","label":"Métricas e fonte","type":"long_text","required":false}]},{"id":"revisao","title":"Revisão e submissão","fields":[{"id":"pendencias","label":"Pendências","type":"long_text","required":false},{"id":"revisor","label":"Responsável pela revisão","type":"text","required":false},{"id":"data_envio","label":"Data do envio efetivo","type":"datetime","required":false},{"id":"protocolo","label":"Protocolo ou link do comprovante","type":"text","required":false},{"id":"status_externo","label":"Situação REAL da inscrição","type":"select","required":true,"options":["em_preparacao","em_revisao","rascunho_externo","enviado","habilitado","inabilitado","contemplado","nao_contemplado","desistencia"]}]},{"id":"acompanhamento","title":"Acompanhamento e pós-resultado","fields":[{"id":"resultado","label":"Resultado e comunicado","type":"text","required":false},{"id":"recurso","label":"Recurso (prazo e arquivo)","type":"text","required":false},{"id":"formacao","label":"Formações e obrigações","type":"text","required":false},{"id":"contrato","label":"Contrato (referência privada)","type":"text","required":false},{"id":"encerramento","label":"Encerramento concluído","type":"checkbox","required":false}]}]}'::jsonb)
on conflict (slug) do nothing;

-- Garante privilégios SQL, preservando a checagem de RLS por usuário.
grant select on public.project_form_templates to authenticated;
grant select,insert,update,delete on public.project_form_instances to authenticated;
create or replace function public.create_internal_project_from_template(
 p_template_id uuid,
 p_title text,
 p_description text default null,
 p_priority text default 'medium',
 p_status text default 'planning',
 p_start_date date default null,
 p_due_date date default null
) returns uuid language plpgsql security invoker set search_path = public as $$
declare
 v_template public.project_form_templates%rowtype;
 v_project_id uuid;
begin
 if not (public.current_user_is_admin() or public.current_user_has_permission('projects.manage')) then
   raise exception 'Sem permissão para criar projeto' using errcode='42501';
 end if;
 select * into v_template from public.project_form_templates where id=p_template_id and active=true;
 if not found then raise exception 'Modelo indisponível'; end if;
 if v_template.configuration->>'scope' is distinct from 'internal' then raise exception 'Modelo incompatível'; end if;
 if length(btrim(p_title))=0 then raise exception 'Nome do projeto obrigatório'; end if;
 insert into public.projects(title,description,project_type,priority,status,start_date,due_date,created_by)
 values (btrim(p_title),nullif(btrim(coalesce(p_description,'')),''),'internal',p_priority,p_status,p_start_date,p_due_date,auth.uid())
 returning id into v_project_id;
 insert into public.project_form_instances(project_id,template_id,template_slug,snapshot,answers)
 values(v_project_id,v_template.id,v_template.slug,v_template.configuration,'{"status_externo":"em_preparacao"}'::jsonb);
 insert into public.project_stages(project_id,name,description,position,status,client_visible)
 select v_project_id,stage.value,null,(stage.ordinality-1)::integer,'pending',false
 from jsonb_array_elements_text(coalesce(v_template.configuration->'defaultStages','[]'::jsonb))
 with ordinality as stage(value,ordinality);
 return v_project_id;
end;
$$;
revoke all on function public.create_internal_project_from_template(uuid,text,text,text,text,date,date) from public;
grant execute on function public.create_internal_project_from_template(uuid,text,text,text,text,date,date) to authenticated;


create table if not exists public.seo_pages(
 path text primary key check(path ~ '^/[a-z0-9/_-]*$' and length(path)<=180),
 title text not null check(length(title) between 10 and 100),
 description text not null check(length(description) between 40 and 320),
 primary_keyword text not null default '',
 secondary_keywords text[] not null default '{}',
 og_image_url text,
 canonical_url text check(canonical_url is null or canonical_url ~ '^https://[^[:space:]]+$'),
 noindex boolean not null default false,
 published boolean not null default true,
 updated_at timestamptz not null default now(),
 updated_by uuid references public.profiles(id) on delete set null
);
create index if not exists seo_pages_indexable_idx on public.seo_pages(path) where published and not noindex;
alter table public.seo_pages enable row level security;
revoke all on public.seo_pages from anon,authenticated;
grant select on public.seo_pages to anon,authenticated;
grant insert,update,delete on public.seo_pages to authenticated;
drop policy if exists seo_pages_public_read on public.seo_pages;
create policy seo_pages_public_read on public.seo_pages for select to anon,authenticated
 using (published or (select public.current_user_is_admin()) or (select public.current_user_has_permission('site.manage')));
drop policy if exists seo_pages_admin_insert on public.seo_pages;
create policy seo_pages_admin_insert on public.seo_pages for insert to authenticated
 with check ((select public.current_user_is_admin()) or (select public.current_user_has_permission('site.manage')));
drop policy if exists seo_pages_admin_update on public.seo_pages;
create policy seo_pages_admin_update on public.seo_pages for update to authenticated
 using ((select public.current_user_is_admin()) or (select public.current_user_has_permission('site.manage')))
 with check ((select public.current_user_is_admin()) or (select public.current_user_has_permission('site.manage')));
drop policy if exists seo_pages_admin_delete on public.seo_pages;
create policy seo_pages_admin_delete on public.seo_pages for delete to authenticated
 using ((select public.current_user_is_admin()) or (select public.current_user_has_permission('site.manage')));

create table if not exists public.seo_keywords(
 id uuid primary key default gen_random_uuid(),
 phrase text not null unique check(length(phrase) between 3 and 120),
 page_path text references public.seo_pages(path) on update cascade on delete set null,
 intent text not null default 'commercial' check(intent in ('commercial','informational','navigational','transactional')),
 priority text not null default 'medium' check(priority in ('low','medium','high')),
 notes text not null default '',
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.seo_keywords enable row level security;
revoke all on public.seo_keywords from anon,authenticated;
grant select,insert,update,delete on public.seo_keywords to authenticated;
drop policy if exists seo_keywords_admin_access on public.seo_keywords;
create policy seo_keywords_admin_access on public.seo_keywords for all to authenticated
 using ((select public.current_user_is_admin()) or (select public.current_user_has_permission('site.manage')))
 with check ((select public.current_user_is_admin()) or (select public.current_user_has_permission('site.manage')));

insert into public.seo_pages(path,title,description,primary_keyword,published,noindex) values
 ('/','Sagamente — Design, Tecnologia e Comunicação','Conheça as soluções da Sagamente em identidade visual, desenvolvimento digital, audiovisual e comunicação estratégica.','Sagamente',true,false),
 ('/produtos','Produtos e Equipamentos | Sagamente','Conheça o catálogo de produtos e equipamentos de tecnologia disponíveis na Sagamente.','equipamentos de tecnologia',true,false),
 ('/equipamentos','Equipamentos de Tecnologia | Sagamente','Explore equipamentos e soluções tecnológicas disponibilizados pela Sagamente.','equipamentos para projetos',true,false),
 ('/servicos','Serviços de Design e Tecnologia | Sagamente','Encontre serviços de design, produção audiovisual, tecnologia e comunicação para seu projeto.','serviços de design e tecnologia',true,false),
 ('/academia','Academia Sagamente — Cursos e Formação','Aprenda com cursos e conteúdos de tecnologia, design e comunicação oferecidos pela Academia Sagamente.','cursos de tecnologia',true,false),
 ('/curso/letramento-digital','Curso Gratuito de Letramento Digital','Aprenda fundamentos de tecnologia e cidadania digital no curso gratuito de letramento digital da Sagamente.','curso de letramento digital gratuito',true,false),
 ('/quem-somos','Quem Somos | Sagamente','Conheça a Sagamente, sua trajetória, serviços e projetos em design, comunicação e tecnologia.','sobre a Sagamente',true,false),
 ('/studio','Studio e Produção Audiovisual | Sagamente','Produção audiovisual, edição, fotografia e criação de conteúdos com o Studio Sagamente.','produção audiovisual',true,false),
 ('/design','Design e Identidade Visual | Sagamente','Projetos de identidade visual, branding, interfaces e design digital desenvolvidos pela Sagamente.','identidade visual',true,false),
 ('/tech','Tecnologia e Soluções Digitais | Sagamente','Conheça as soluções de tecnologia, sites e projetos digitais da Sagamente.','desenvolvimento de sites',true,false),
 ('/contato','Contato e Orçamentos | Sagamente','Entre em contato com a Sagamente para conversar sobre design, tecnologia, audiovisual e comunicação.','contato Sagamente',true,false),
 ('/instalar','Instalar o Aplicativo Sagamente','Instale o aplicativo Sagamente para acompanhar projetos, serviços, produtos e cursos na plataforma.','instalar Sagamente',true,false)
on conflict(path) do nothing;
insert into public.seo_keywords(phrase,page_path,intent,priority,notes) values
 ('identidade visual','/design','commercial','medium','Hipótese editorial inicial; volume e classificação não medidos'),
 ('criação de logotipo','/design','commercial','medium','Hipótese editorial inicial; volume e classificação não medidos'),
 ('identidade visual para empresas','/design','commercial','medium','Hipótese editorial inicial; volume e classificação não medidos'),
 ('branding','/design','commercial','medium','Hipótese editorial inicial; volume e classificação não medidos'),
 ('design gráfico','/design','commercial','medium','Hipótese editorial inicial; volume e classificação não medidos'),
 ('design de marcas','/design','commercial','medium','Hipótese editorial inicial; volume e classificação não medidos'),
 ('UI UX design','/design','commercial','medium','Hipótese editorial inicial; volume e classificação não medidos'),
 ('web design','/design','commercial','medium','Hipótese editorial inicial; volume e classificação não medidos'),
 ('criação de sites','/tech','commercial','medium','Hipótese editorial inicial; volume e classificação não medidos'),
 ('desenvolvimento de sites','/tech','commercial','medium','Hipótese editorial inicial; volume e classificação não medidos'),
 ('sistemas digitais','/tech','commercial','medium','Hipótese editorial inicial; volume e classificação não medidos'),
 ('soluções digitais','/tech','commercial','medium','Hipótese editorial inicial; volume e classificação não medidos'),
 ('automação de processos','/tech','commercial','medium','Hipótese editorial inicial; volume e classificação não medidos'),
 ('sites responsivos','/tech','commercial','medium','Hipótese editorial inicial; volume e classificação não medidos'),
 ('tecnologia para negócios','/tech','commercial','medium','Hipótese editorial inicial; volume e classificação não medidos'),
 ('produção audiovisual','/studio','commercial','medium','Hipótese editorial inicial; volume e classificação não medidos'),
 ('edição de vídeo','/studio','commercial','medium','Hipótese editorial inicial; volume e classificação não medidos'),
 ('vídeo institucional','/studio','commercial','medium','Hipótese editorial inicial; volume e classificação não medidos'),
 ('fotografia profissional','/studio','commercial','medium','Hipótese editorial inicial; volume e classificação não medidos'),
 ('produção de conteúdo audiovisual','/studio','commercial','medium','Hipótese editorial inicial; volume e classificação não medidos'),
 ('comunicação estratégica','/servicos','commercial','medium','Hipótese editorial inicial; volume e classificação não medidos'),
 ('comunicação visual','/servicos','commercial','medium','Hipótese editorial inicial; volume e classificação não medidos'),
 ('serviços criativos','/servicos','commercial','medium','Hipótese editorial inicial; volume e classificação não medidos'),
 ('design e tecnologia','/servicos','commercial','medium','Hipótese editorial inicial; volume e classificação não medidos'),
 ('comunicação digital','/servicos','commercial','medium','Hipótese editorial inicial; volume e classificação não medidos'),
 ('orçamento de identidade visual','/contato','commercial','medium','Hipótese editorial inicial; volume e classificação não medidos'),
 ('cursos gratuitos de tecnologia','/academia','commercial','medium','Hipótese editorial inicial; volume e classificação não medidos'),
 ('letramento digital','/curso/letramento-digital','commercial','medium','Hipótese editorial inicial; volume e classificação não medidos'),
 ('curso gratuito de letramento digital','/curso/letramento-digital','commercial','medium','Hipótese editorial inicial; volume e classificação não medidos'),
 ('formação digital','/academia','commercial','medium','Hipótese editorial inicial; volume e classificação não medidos'),
 ('aprendizado de tecnologia','/academia','commercial','medium','Hipótese editorial inicial; volume e classificação não medidos'),
 ('equipamentos de tecnologia','/equipamentos','commercial','medium','Hipótese editorial inicial; volume e classificação não medidos'),
 ('tecnologia e equipamentos','/equipamentos','commercial','medium','Hipótese editorial inicial; volume e classificação não medidos'),
 ('catálogo de equipamentos','/produtos','commercial','medium','Hipótese editorial inicial; volume e classificação não medidos'),
 ('sagamente','/','commercial','medium','Hipótese editorial inicial; volume e classificação não medidos'),
 ('agência de design','/','commercial','medium','Hipótese editorial inicial; volume e classificação não medidos'),
 ('estúdio criativo','/studio','commercial','medium','Hipótese editorial inicial; volume e classificação não medidos'),
 ('contato sagamente','/contato','commercial','medium','Hipótese editorial inicial; volume e classificação não medidos')
on conflict(phrase) do nothing;

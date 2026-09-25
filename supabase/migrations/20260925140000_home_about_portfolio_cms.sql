-- Public profile, homepage metrics and portfolio CMS for Play Moments.
-- Safe to apply after previous migrations.

create table if not exists public.site_profile (
  id boolean primary key default true check (id = true),
  display_name text not null default 'Felipe Costa',
  headline text not null default 'Designer, desenvolvedor, videomaker, DJ e produtor musical',
  eyebrow text not null default 'Quem Somos',
  intro text not null default 'A Play Moments reúne design, tecnologia e audiovisual em uma operação criativa pensada para transformar ideias em entregas reais.',
  story text not null default 'A trajetória começa em 2008, passando por design gráfico, publicidade, comunicação, audiovisual, rádio, web, tecnologia e produção musical. Ao longo dos anos, projetos para empresas, instituições, iniciativas culturais e clientes independentes ajudaram a construir uma atuação multidisciplinar e prática.',
  objective text not null default 'Criar soluções com direção, clareza e acabamento profissional, conectando estratégia, identidade visual, conteúdo, tecnologia e execução.',
  photo_url text,
  resume_url text,
  market_since integer not null default 2008,
  projects_delivered_label text not null default '8 mil+',
  clients_served_label text not null default '2 mil+',
  satisfaction_label text not null default '85%',
  skills jsonb not null default '["Design gráfico","Branding","Web design","Desenvolvimento web","Edição de vídeo","Videomaker","Motion","Social media","Áudio","Produção musical","DJ"]'::jsonb,
  experience jsonb not null default '[
    {"title":"Play Moments","role":"Direção criativa, design, tecnologia e audiovisual","description":"Operação própria reunindo design, web, vídeo, áudio, conteúdo, produtos e atendimento digital."},
    {"title":"Rede Kalunga Comunicações","role":"Design, comunicação e projetos digitais","description":"Identidades visuais, materiais culturais e comunitários, audiovisual e desenvolvimento de presença digital."},
    {"title":"Instituto Delta Proto","role":"Gestão de estúdio, design e audiovisual","description":"Coordenação de estúdio de gravação, conteúdos educacionais, edição de vídeo, design e marketing."},
    {"title":"96 FM / Rio Verde FM","role":"Marketing, vídeo e operação técnica","description":"Criação de materiais de comunicação, edição de vídeo e apoio técnico para rádio."},
    {"title":"Futura Imóveis","role":"Design e mídias sociais","description":"Conteúdo visual, comunicação institucional e presença digital."},
    {"title":"Inove Brindes e Uniformes","role":"Design e finalização","description":"Criação e preparação de materiais gráficos para produção."},
    {"title":"Play Publicidade","role":"Design e publicidade","description":"Peças promocionais, campanhas e comunicação visual."}
  ]'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

insert into public.site_profile(id)
values(true)
on conflict(id) do nothing;

create table if not exists public.portfolio_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  display_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.portfolio_items (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.portfolio_categories(id) on delete set null,
  title text not null,
  slug text not null unique,
  client text,
  short_description text,
  description text,
  cover_url text,
  project_url text,
  year integer,
  featured boolean not null default false,
  active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.portfolio_categories(name,slug,display_order)
values
  ('Design & Branding','design-branding',10),
  ('Web & Sistemas','web-sistemas',20),
  ('Audiovisual','audiovisual',30),
  ('Comunicação & Conteúdo','comunicacao-conteudo',40),
  ('Cultura & Institucional','cultura-institucional',50),
  ('Áudio & Música','audio-musica',60)
on conflict(slug) do update set
  name=excluded.name,
  display_order=excluded.display_order,
  active=true;

with seed(category_slug,title,slug,client,short_description,description,year,featured,display_order) as (
  values
    ('cultura-institucional','Rede Kalunga Comunicações','rede-kalunga-comunicacoes','Rede Kalunga Comunicações','Design, comunicação e presença digital','Identidades visuais, materiais gráficos, audiovisual e desenvolvimento de soluções digitais ligadas à comunicação quilombola.',2026,true,10),
    ('web-sistemas','Portal de Pesquisas Instituto Sumaúma','portal-pesquisas-instituto-sumauma','Instituto Sumaúma','Portal digital de pesquisa e relatório','Desenvolvimento de portal de pesquisa, navegação de conteúdo, relatório digital e estrutura web para projeto institucional.',2026,true,20),
    ('audiovisual','Instituto Delta Proto — Estúdio e Conteúdo','instituto-delta-proto-estudio-conteudo','Instituto Delta Proto','Gestão de estúdio e produção audiovisual','Coordenação de estúdio, gravação, edição de vídeos educacionais e institucionais, design e apoio de marketing.',2025,true,30),
    ('comunicacao-conteudo','96 FM / Rio Verde FM','96fm-rio-verde-fm','96 FM / Rio Verde FM','Marketing, vídeo e operação técnica','Criação de materiais de comunicação, edição de vídeo e apoio técnico para rádio e presença digital.',2025,false,40),
    ('design-branding','Futura Imóveis','futura-imoveis','Futura Imóveis','Design institucional e mídias sociais','Criação visual, conteúdo para redes sociais e materiais institucionais para comunicação imobiliária.',2025,false,50),
    ('design-branding','Inove Brindes e Uniformes','inove-brindes-uniformes','Inove Brindes e Uniformes','Design e finalização gráfica','Criação, adaptação e preparação de materiais gráficos para produção e personalização.',2024,false,60),
    ('design-branding','Play Publicidade','play-publicidade','Play Publicidade','Publicidade e comunicação visual','Desenvolvimento de peças promocionais, campanhas, layouts e materiais de comunicação visual.',2024,false,70),
    ('web-sistemas','Play Moments — Plataforma e Portal do Cliente','play-moments-plataforma','Play Moments','Produto digital, automação e experiência do cliente','Desenvolvimento da plataforma Play Moments com catálogo, clientes, projetos, arquivos, conversas, pagamentos e produtividade.',2026,true,80)
)
insert into public.portfolio_items(
  category_id,title,slug,client,short_description,description,year,featured,active,display_order
)
select
  c.id,s.title,s.slug,s.client,s.short_description,s.description,s.year,s.featured,true,s.display_order
from seed s
join public.portfolio_categories c on c.slug=s.category_slug
on conflict(slug) do nothing;

alter table public.site_profile enable row level security;
alter table public.portfolio_categories enable row level security;
alter table public.portfolio_items enable row level security;

drop policy if exists "public read site profile" on public.site_profile;
create policy "public read site profile"
on public.site_profile for select
using (true);

drop policy if exists "staff manage site profile" on public.site_profile;
create policy "staff manage site profile"
on public.site_profile for all
to authenticated
using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('admin','staff') and p.status='active'))
with check (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('admin','staff') and p.status='active'));

drop policy if exists "public read portfolio categories" on public.portfolio_categories;
create policy "public read portfolio categories"
on public.portfolio_categories for select
using (active=true);

drop policy if exists "staff manage portfolio categories" on public.portfolio_categories;
create policy "staff manage portfolio categories"
on public.portfolio_categories for all
to authenticated
using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('admin','staff') and p.status='active'))
with check (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('admin','staff') and p.status='active'));

drop policy if exists "public read portfolio items" on public.portfolio_items;
create policy "public read portfolio items"
on public.portfolio_items for select
using (active=true);

drop policy if exists "staff manage portfolio items" on public.portfolio_items;
create policy "staff manage portfolio items"
on public.portfolio_items for all
to authenticated
using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('admin','staff') and p.status='active'))
with check (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('admin','staff') and p.status='active'));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values(
  'site-assets',
  'site-assets',
  true,
  26214400,
  array['image/jpeg','image/png','image/webp','image/avif','application/pdf']
)
on conflict(id) do update set
  public=true,
  file_size_limit=26214400,
  allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "public read site assets" on storage.objects;
create policy "public read site assets"
on storage.objects for select
using (bucket_id='site-assets');

drop policy if exists "staff insert site assets" on storage.objects;
create policy "staff insert site assets"
on storage.objects for insert
to authenticated
with check (
  bucket_id='site-assets'
  and exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('admin','staff') and p.status='active')
);

drop policy if exists "staff update site assets" on storage.objects;
create policy "staff update site assets"
on storage.objects for update
to authenticated
using (
  bucket_id='site-assets'
  and exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('admin','staff') and p.status='active')
)
with check (
  bucket_id='site-assets'
  and exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('admin','staff') and p.status='active')
);

drop policy if exists "staff delete site assets" on storage.objects;
create policy "staff delete site assets"
on storage.objects for delete
to authenticated
using (
  bucket_id='site-assets'
  and exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('admin','staff') and p.status='active')
);

-- Flexible public resume/CV CMS.
-- Visible content fields are intentionally optional so the same engine can power
-- a mini resume, a complete CV, a portfolio-led profile or a custom version.

create table if not exists public.resumes (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique default ('curriculo-' || substr(gen_random_uuid()::text, 1, 8)),
  resume_type text not null default 'mini' check (resume_type in ('mini','complete','portfolio','custom')),
  status text not null default 'draft' check (status in ('draft','published','archived')),
  internal_title text,
  eyebrow text,
  display_name text,
  headline text,
  summary text,
  identity_text text,
  callout text,
  location text,
  market_since integer,
  photo_url text,
  photo_drive_file_id text,
  contact_email text,
  contact_phone text,
  instagram text,
  linkedin_url text,
  website_url text,
  whatsapp text,
  skills jsonb not null default '[]'::jsonb,
  experience jsonb not null default '[]'::jsonb,
  portfolio jsonb not null default '[]'::jsonb,
  extra_sections jsonb not null default '[]'::jsonb,
  seo_title text,
  seo_description text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

create index if not exists resumes_status_idx on public.resumes(status);
create index if not exists resumes_updated_at_idx on public.resumes(updated_at desc);

alter table public.resumes enable row level security;

drop policy if exists "public read published resumes" on public.resumes;
create policy "public read published resumes"
on public.resumes for select
using (status = 'published');

drop policy if exists "staff manage resumes" on public.resumes;
create policy "staff manage resumes"
on public.resumes for all
to authenticated
using (
  exists(
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin','staff')
      and p.status = 'active'
  )
)
with check (
  exists(
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin','staff')
      and p.status = 'active'
  )
);

insert into public.resumes (
  slug,
  resume_type,
  status,
  internal_title,
  eyebrow,
  display_name,
  headline,
  summary,
  identity_text,
  callout,
  location,
  market_since,
  contact_email,
  contact_phone,
  instagram,
  skills,
  seo_title,
  seo_description,
  published_at
)
values (
  'felipe-costa-designer-quilombola',
  'mini',
  'published',
  'Minicurrículo — Felipe Costa · Designer Quilombola Kalunga',
  'Minicurrículo · Design & Comunicação',
  'Felipe Costa Souza',
  'Designer e comunicador quilombola Kalunga',
  'Sou Felipe Costa Souza, designer e comunicador quilombola Kalunga, natural de Cavalcante (GO). Atuo com design e comunicação visual desde 2008, construindo uma trajetória que atravessa identidade visual, design gráfico, comunicação digital, audiovisual e web.',
  'Minha vivência no território Kalunga atravessa o meu olhar profissional e a forma como penso representação, identidade e comunicação. Em projetos voltados aos povos quilombolas, acredito na importância de construir narrativas com presença, conhecimento do território e autoria de quem vive essa realidade.',
  'Design também é território, identidade e memória.',
  'Cavalcante, Goiás',
  2008,
  'eufedesigner@gmail.com',
  '(62) 99324-1277',
  '@felipecosta.brasileiro',
  '["Identidade visual","Design gráfico","Direção de arte","Comunicação digital","Audiovisual","Web design"]'::jsonb,
  'Felipe Costa — Designer Quilombola Kalunga',
  'Minicurrículo de Felipe Costa Souza, designer e comunicador quilombola Kalunga com atuação em design e comunicação visual desde 2008.',
  now()
)
on conflict (slug) do nothing;

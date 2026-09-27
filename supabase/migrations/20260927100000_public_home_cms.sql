-- Public CMS: editable Home service areas and footer/location settings
alter table public.site_settings
  add column if not exists city text,
  add column if not exists state text,
  add column if not exists footer_description text,
  add column if not exists home_areas_eyebrow text not null default 'Nossas áreas',
  add column if not exists home_areas_title text not null default 'Tudo em um só lugar';

create table if not exists public.home_service_areas (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  icon text,
  accent_color text not null default '#E30613',
  image_url text,
  href text not null default '/servicos',
  topics text[] not null default '{}',
  display_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.home_service_areas enable row level security;

drop policy if exists "Public can read active home service areas" on public.home_service_areas;
create policy "Public can read active home service areas"
on public.home_service_areas for select
using (
  active = true
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('admin','staff') and p.status = 'active'
  )
);

drop policy if exists "Admins can manage home service areas" on public.home_service_areas;
create policy "Admins can manage home service areas"
on public.home_service_areas for all
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin' and p.status = 'active'
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin' and p.status = 'active'
  )
);

insert into public.home_service_areas (title,icon,accent_color,image_url,href,topics,display_order)
select * from (values
  ('Studio & Criação','🎬','#ff6b35','https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=1200&fit=crop&auto=format','/studio',array['Produção de Vídeo','Fotografia Profissional','Motion Design','Streaming'],10),
  ('Design & Digital','✦','#4cc9f0','https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1200&fit=crop&auto=format','/design',array['Identidade Visual','UI/UX Design','Criação de Sites','Marketing Digital'],20),
  ('Tech & Equipamentos','⚡','#06d6a0','https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=1200&fit=crop&auto=format','/tech',array['Aluguel de Câmeras','Setup de Estúdio','Infraestrutura AV','Suporte Técnico'],30)
) as seed(title,icon,accent_color,image_url,href,topics,display_order)
where not exists (select 1 from public.home_service_areas);

create index if not exists home_service_areas_order_idx on public.home_service_areas(active,display_order);

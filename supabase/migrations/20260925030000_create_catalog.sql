-- =========================================================
-- CATEGORIAS
-- =========================================================

create table if not exists public.product_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================================================
-- PRODUTOS
-- =========================================================

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),

  name text not null,
  slug text not null unique,
  sku text unique,

  short_description text,
  description text not null default '',

  category_id uuid
    references public.product_categories(id)
    on delete set null,

  product_type text not null default 'physical'
    check (
      product_type in (
        'physical',
        'digital',
        'equipment',
        'package'
      )
    ),

  commercial_mode text not null default 'sale'
    check (
      commercial_mode in (
        'sale',
        'rental',
        'sale_and_rental'
      )
    ),

  sale_price integer
    check (
      sale_price is null
      or sale_price >= 0
    ),

  promotional_price integer
    check (
      promotional_price is null
      or promotional_price >= 0
    ),

  rental_daily_price integer
    check (
      rental_daily_price is null
      or rental_daily_price >= 0
    ),

  stock integer not null default 0
    check (stock >= 0),

  featured boolean not null default false,
  active boolean not null default true,

  status text not null default 'draft'
    check (
      status in (
        'draft',
        'published',
        'archived'
      )
    ),

  specifications jsonb not null default '{}'::jsonb,

  created_by uuid
    references public.profiles(id)
    on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================================================
-- IMAGENS DOS PRODUTOS
-- =========================================================

create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(),

  product_id uuid not null
    references public.products(id)
    on delete cascade,

  storage_path text not null,
  public_url text,

  alt_text text,
  display_order integer not null default 0,
  is_cover boolean not null default false,

  created_at timestamptz not null default now()
);

-- =========================================================
-- ÍNDICES
-- =========================================================

create index if not exists products_slug_idx
on public.products(slug);

create index if not exists products_status_idx
on public.products(status);

create index if not exists products_category_idx
on public.products(category_id);

create index if not exists products_featured_idx
on public.products(featured);

create index if not exists product_images_product_idx
on public.product_images(product_id);

-- =========================================================
-- UPDATED_AT
-- =========================================================

create or replace function public.set_catalog_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists product_categories_set_updated_at
on public.product_categories;

create trigger product_categories_set_updated_at
before update on public.product_categories
for each row
execute function public.set_catalog_updated_at();

drop trigger if exists products_set_updated_at
on public.products;

create trigger products_set_updated_at
before update on public.products
for each row
execute function public.set_catalog_updated_at();

-- =========================================================
-- RLS
-- =========================================================

alter table public.product_categories enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;

-- CATEGORIAS

drop policy if exists "categories_public_read"
on public.product_categories;

create policy "categories_public_read"
on public.product_categories
for select
to anon, authenticated
using (
  active = true
  or public.current_user_is_staff_or_admin()
);

drop policy if exists "categories_admin_insert"
on public.product_categories;

create policy "categories_admin_insert"
on public.product_categories
for insert
to authenticated
with check (
  public.current_user_is_staff_or_admin()
);

drop policy if exists "categories_admin_update"
on public.product_categories;

create policy "categories_admin_update"
on public.product_categories
for update
to authenticated
using (
  public.current_user_is_staff_or_admin()
)
with check (
  public.current_user_is_staff_or_admin()
);

drop policy if exists "categories_admin_delete"
on public.product_categories;

create policy "categories_admin_delete"
on public.product_categories
for delete
to authenticated
using (
  public.current_user_is_staff_or_admin()
);

-- PRODUTOS

drop policy if exists "products_public_read"
on public.products;

create policy "products_public_read"
on public.products
for select
to anon, authenticated
using (
  (
    active = true
    and status = 'published'
  )
  or public.current_user_is_staff_or_admin()
);

drop policy if exists "products_admin_insert"
on public.products;

create policy "products_admin_insert"
on public.products
for insert
to authenticated
with check (
  public.current_user_is_staff_or_admin()
);

drop policy if exists "products_admin_update"
on public.products;

create policy "products_admin_update"
on public.products
for update
to authenticated
using (
  public.current_user_is_staff_or_admin()
)
with check (
  public.current_user_is_staff_or_admin()
);

drop policy if exists "products_admin_delete"
on public.products;

create policy "products_admin_delete"
on public.products
for delete
to authenticated
using (
  public.current_user_is_staff_or_admin()
);

-- IMAGENS

drop policy if exists "product_images_public_read"
on public.product_images;

create policy "product_images_public_read"
on public.product_images
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.products p
    where p.id = product_images.product_id
      and (
        (
          p.active = true
          and p.status = 'published'
        )
        or public.current_user_is_staff_or_admin()
      )
  )
);

drop policy if exists "product_images_admin_insert"
on public.product_images;

create policy "product_images_admin_insert"
on public.product_images
for insert
to authenticated
with check (
  public.current_user_is_staff_or_admin()
);

drop policy if exists "product_images_admin_update"
on public.product_images;

create policy "product_images_admin_update"
on public.product_images
for update
to authenticated
using (
  public.current_user_is_staff_or_admin()
)
with check (
  public.current_user_is_staff_or_admin()
);

drop policy if exists "product_images_admin_delete"
on public.product_images;

create policy "product_images_admin_delete"
on public.product_images
for delete
to authenticated
using (
  public.current_user_is_staff_or_admin()
);

-- =========================================================
-- PERMISSÕES
-- =========================================================

grant select
on public.product_categories
to anon, authenticated;

grant insert, update, delete
on public.product_categories
to authenticated;

grant select
on public.products
to anon, authenticated;

grant insert, update, delete
on public.products
to authenticated;

grant select
on public.product_images
to anon, authenticated;

grant insert, update, delete
on public.product_images
to authenticated;

-- =========================================================
-- CATEGORIAS INICIAIS
-- =========================================================

insert into public.product_categories (
  name,
  slug,
  description,
  display_order
)
values
  (
    'Equipamentos',
    'equipamentos',
    'Equipamentos profissionais para produção, tecnologia e audiovisual.',
    1
  ),
  (
    'Tecnologia',
    'tecnologia',
    'Produtos e acessórios de tecnologia.',
    2
  ),
  (
    'Studio',
    'studio',
    'Produtos e equipamentos para studio e criação.',
    3
  )
on conflict (slug) do nothing;

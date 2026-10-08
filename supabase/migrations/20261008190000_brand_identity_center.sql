-- SAGAMENTE: fonte central de identidade; apenas URLs, imagens continuam no Google Drive.
begin;
alter table public.site_settings
  add column if not exists brand_logo_dark_url text not null default '/sagamente-logo-dark.svg',
  add column if not exists brand_logo_light_url text not null default '/sagamente-logo-light.svg',
  add column if not exists brand_logo_compact_url text not null default '/sagamente-logo-dark.svg',
  add column if not exists brand_symbol_url text not null default '/sagamente-mark.svg',
  add column if not exists brand_favicon_url text not null default '/favicon.svg',
  add column if not exists brand_staff_logo_url text not null default '/sagamente-logo-light.svg',
  add column if not exists brand_social_image_url text;
update public.site_settings s
set brand_favicon_url = coalesce(nullif(a.favicon_url,''),'/favicon.svg'),
    brand_staff_logo_url = coalesce(nullif(a.staff_logo_url,''),'/sagamente-logo-light.svg')
from public.app_settings a
where s.id=true and a.id=true;
comment on column public.site_settings.brand_logo_dark_url is 'Logo horizontal em fundo escuro (sem alteração de arquivos existentes).';
comment on column public.site_settings.brand_logo_light_url is 'Logo horizontal em fundo claro.';
comment on column public.site_settings.brand_logo_compact_url is 'Logo horizontal compacta para telas pequenas.';
comment on column public.site_settings.brand_symbol_url is 'Símbolo isolado para menus recolhidos e composições.';
comment on column public.site_settings.brand_staff_logo_url is 'Logo da equipe em layout claro.';
comment on column public.site_settings.brand_social_image_url is 'Imagem institucional de compartilhamento; títulos e capas específicos têm prioridade.';
commit;

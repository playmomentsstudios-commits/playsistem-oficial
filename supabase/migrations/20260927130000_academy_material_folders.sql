alter table public.lesson_materials
  add column if not exists folder_name text;

comment on column public.lesson_materials.folder_name is
  'Optional Academy material folder inside the lesson module Drive folder.';

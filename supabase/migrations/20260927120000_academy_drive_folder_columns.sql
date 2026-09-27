-- Repair Academy schema drift after the original foundation migration was applied
-- before Drive folder columns were added to its source file.
alter table public.courses
  add column if not exists drive_folder_id text;

alter table public.course_modules
  add column if not exists drive_folder_id text;

comment on column public.courses.drive_folder_id is
  'Google Drive folder used to store this course Academy assets.';
comment on column public.course_modules.drive_folder_id is
  'Google Drive folder used to store this module Academy assets.';

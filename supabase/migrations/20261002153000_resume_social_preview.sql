-- Social preview image for each public resume.
alter table public.resumes
  add column if not exists seo_image_url text,
  add column if not exists seo_image_drive_file_id text;

comment on column public.resumes.seo_image_url is 'Public Open Graph/Twitter preview image URL for this resume.';
comment on column public.resumes.seo_image_drive_file_id is 'Google Drive file id backing the resume social preview image.';

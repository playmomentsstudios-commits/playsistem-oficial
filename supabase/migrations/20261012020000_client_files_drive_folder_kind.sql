-- File folder kind is used by Drive finalization and inventory synchronization.
-- Keep it nullable for historical files and other storage providers.
ALTER TABLE public.client_files ADD COLUMN IF NOT EXISTS drive_folder_kind text;
UPDATE public.client_files f
SET drive_folder_kind = d.folder_kind
FROM public.project_drive_folders d
WHERE f.project_id=d.project_id
  AND f.drive_folder_id=d.drive_folder_id
  AND f.drive_folder_kind IS NULL;
UPDATE public.client_files f
SET drive_folder_kind = c.parent_kind
FROM public.project_custom_folders c
WHERE f.project_id=c.project_id
  AND f.drive_folder_id=c.drive_folder_id
  AND f.drive_folder_kind IS NULL;

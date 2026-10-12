-- Permit manually created folders directly under a project's Drive root.
-- Existing folder records and their parent kinds remain unchanged.
ALTER TABLE public.project_custom_folders
  DROP CONSTRAINT IF EXISTS project_custom_folders_parent_kind_check;
ALTER TABLE public.project_custom_folders
  ADD CONSTRAINT project_custom_folders_parent_kind_check
  CHECK (parent_kind = ANY (ARRAY['root','received','raw','production','preview','approved','delivery']));

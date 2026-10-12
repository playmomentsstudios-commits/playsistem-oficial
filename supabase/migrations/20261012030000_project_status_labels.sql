-- Display-only custom labels for existing state-machine statuses.
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS status_labels jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.projects ADD CONSTRAINT projects_status_labels_object_check CHECK (jsonb_typeof(status_labels) = 'object');

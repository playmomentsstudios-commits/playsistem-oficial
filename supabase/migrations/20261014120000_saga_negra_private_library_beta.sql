-- SAGA NEGRA private library beta: separate books/audio from course enrollments.
CREATE TABLE IF NOT EXISTS public.academy_library_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  release_code text NOT NULL,
  format text NOT NULL CHECK (format IN ('ebook','audiobook')),
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  drive_file_id text NOT NULL,
  source_filename text NOT NULL,
  mime_type text NOT NULL CHECK (mime_type IN ('application/pdf','audio/mpeg')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','private_beta','published','archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT academy_library_items_release_format_unique UNIQUE (release_code,format)
);
CREATE TABLE IF NOT EXISTS public.academy_library_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.academy_library_items(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'manual_beta' CHECK (source IN ('manual_beta','purchase','gift','admin')),
  active boolean NOT NULL DEFAULT true,
  granted_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT academy_library_grants_unique UNIQUE (item_id,user_id)
);
CREATE INDEX IF NOT EXISTS academy_library_grants_user_idx ON public.academy_library_grants (user_id) WHERE active;
CREATE TABLE IF NOT EXISTS public.academy_library_tickets (
  token uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.academy_library_items(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL DEFAULT (now()+interval '45 minutes'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS academy_library_tickets_expires_idx ON public.academy_library_tickets (expires_at);
ALTER TABLE public.academy_library_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_library_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_library_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY academy_library_items_admin ON public.academy_library_items FOR ALL TO authenticated
 USING (public.is_active_admin()) WITH CHECK (public.is_active_admin());
CREATE POLICY academy_library_grants_admin ON public.academy_library_grants FOR ALL TO authenticated
 USING (public.is_active_admin()) WITH CHECK (public.is_active_admin());
CREATE POLICY academy_library_grants_read_self ON public.academy_library_grants FOR SELECT TO authenticated
 USING (user_id=auth.uid());
CREATE POLICY academy_library_tickets_admin ON public.academy_library_tickets FOR ALL TO authenticated
 USING (public.is_active_admin()) WITH CHECK (public.is_active_admin());
-- Expose only a safe catalog for the actual logged-in recipient; never expose Drive IDs.
CREATE OR REPLACE FUNCTION public.academy_my_library()
RETURNS TABLE(id uuid, release_code text, format text, title text, slug text, mime_type text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=public,pg_temp
AS $$
  SELECT i.id,i.release_code,i.format,i.title,i.slug,i.mime_type
  FROM public.academy_library_items i
  JOIN public.academy_library_grants g ON g.item_id=i.id
  JOIN public.profiles p ON p.id=g.user_id
  WHERE g.user_id=auth.uid() AND g.active=true AND p.status='active'
    AND i.status IN ('private_beta','published')
  ORDER BY i.release_code ASC, CASE WHEN i.format='ebook' THEN 0 ELSE 1 END, i.title;
$$;
REVOKE ALL ON FUNCTION public.academy_my_library() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.academy_my_library() FROM anon;
GRANT EXECUTE ON FUNCTION public.academy_my_library() TO authenticated;

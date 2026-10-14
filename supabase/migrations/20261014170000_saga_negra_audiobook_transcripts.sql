-- SAGA NEGRA audiobook captions: one editable, versioned transcript per private item.
-- No changes to streaming, tickets, grants, or original Drive media.
CREATE TABLE IF NOT EXISTS public.academy_library_transcripts (
  item_id uuid PRIMARY KEY REFERENCES public.academy_library_items(id) ON DELETE CASCADE,
  language text NOT NULL DEFAULT 'pt-BR' CHECK (language = 'pt-BR'),
  cues jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(cues) = 'array' AND jsonb_array_length(cues) <= 1200),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.academy_library_transcripts ENABLE ROW LEVEL SECURITY;

-- A client can only read subtitles for a media item they are actively allowed to access.
CREATE POLICY academy_library_transcripts_read_granted
ON public.academy_library_transcripts FOR SELECT TO authenticated USING (
  public.is_active_admin() OR EXISTS (
    SELECT 1
    FROM public.academy_library_grants g
    JOIN public.academy_library_items i ON i.id = g.item_id
    JOIN public.profiles p ON p.id = g.user_id
    WHERE g.item_id = academy_library_transcripts.item_id
      AND g.user_id = auth.uid()
      AND g.active = true
      AND p.status = 'active'
      AND i.status IN ('private_beta','published')
  )
);

CREATE POLICY academy_library_transcripts_admin_insert
ON public.academy_library_transcripts FOR INSERT TO authenticated
WITH CHECK (public.is_active_admin());
CREATE POLICY academy_library_transcripts_admin_update
ON public.academy_library_transcripts FOR UPDATE TO authenticated
USING (public.is_active_admin()) WITH CHECK (public.is_active_admin());
CREATE POLICY academy_library_transcripts_admin_delete
ON public.academy_library_transcripts FOR DELETE TO authenticated
USING (public.is_active_admin());

REVOKE ALL ON public.academy_library_transcripts FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academy_library_transcripts TO authenticated;

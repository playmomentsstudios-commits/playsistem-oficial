-- Fix private audiobook subtitle visibility without making Drive IDs visible.
-- The library item table is admin-only; a regular RLS subquery to that table
-- silently returns no rows for customers with a valid audiobook grant.
-- A narrowly-scoped boolean helper can verify entitlement without returning
-- the private source record (including its Drive identifier).
CREATE SCHEMA IF NOT EXISTS private_academy;
REVOKE ALL ON SCHEMA private_academy FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private_academy TO authenticated;

CREATE OR REPLACE FUNCTION private_academy.can_read_transcript(p_item_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS (
  SELECT 1
  FROM public.academy_library_grants AS g
  JOIN public.academy_library_items AS i ON i.id = g.item_id
  JOIN public.profiles AS p ON p.id = g.user_id
  WHERE g.user_id = auth.uid()
    AND g.item_id = p_item_id
    AND g.active = true
    AND p.status = 'active'
    AND i.status IN ('private_beta', 'published')
    AND i.format = 'audiobook'
 )
$$;

REVOKE ALL ON FUNCTION private_academy.can_read_transcript(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private_academy.can_read_transcript(uuid) TO authenticated;

DROP POLICY IF EXISTS academy_library_transcripts_read_granted ON public.academy_library_transcripts;
CREATE POLICY academy_library_transcripts_read_granted
ON public.academy_library_transcripts FOR SELECT TO authenticated
USING (
 public.is_active_admin() OR private_academy.can_read_transcript(item_id)
);

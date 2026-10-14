-- Public-facing copy for the independent Academia PWA. No credentials, tickets or Drive links.
-- Administrators can update the home screen without rebuilding or changing the main app.
CREATE TABLE IF NOT EXISTS public.academy_app_settings (
 id boolean PRIMARY KEY DEFAULT true CHECK (id),
 hero_eyebrow text NOT NULL DEFAULT 'ACADEMIA SAGAMENTE' CHECK (length(hero_eyebrow) BETWEEN 1 AND 48),
 hero_title text NOT NULL DEFAULT 'Histórias para ouvir. Ideias para transformar.' CHECK (length(hero_title) BETWEEN 1 AND 110),
 hero_subtitle text NOT NULL DEFAULT 'Seus conteúdos favoritos, no seu ritmo.' CHECK (length(hero_subtitle) BETWEEN 1 AND 200),
 show_quick_links boolean NOT NULL DEFAULT true,
 show_courses boolean NOT NULL DEFAULT true,
 updated_at timestamptz NOT NULL DEFAULT now(),
 updated_by uuid REFERENCES auth.users(id)
);
INSERT INTO public.academy_app_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;
ALTER TABLE public.academy_app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY academy_app_settings_read ON public.academy_app_settings
 FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY academy_app_settings_admin_update ON public.academy_app_settings
 FOR UPDATE TO authenticated
 USING (public.is_active_admin())
 WITH CHECK (public.is_active_admin());

REVOKE ALL ON public.academy_app_settings FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.academy_app_settings TO anon,authenticated;
GRANT UPDATE ON public.academy_app_settings TO authenticated;

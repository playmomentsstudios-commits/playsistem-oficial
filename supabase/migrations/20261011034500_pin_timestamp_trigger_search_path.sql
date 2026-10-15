-- Pin the search path on the four timestamp trigger functions flagged by Supabase.
-- Their trigger behavior is unchanged.
alter function public.set_profiles_updated_at() set search_path = public;
alter function public.set_catalog_updated_at() set search_path = public;
alter function public.set_operational_updated_at() set search_path = public;
alter function public.set_settings_updated_at() set search_path = public;

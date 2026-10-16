-- Saga: permitir preferências do painel sem permitir ativação via navegador.
-- O Supabase Play Sistem já recebeu esta migration, versionada com o ID real.
-- O acesso de admin continua limitado pela RLS sagamente_assistant_settings_admin_update.
revoke update on table public.sagamente_assistant_settings from authenticated;
grant update (internal_notifications, digest_times, updated_at)
  on table public.sagamente_assistant_settings to authenticated;

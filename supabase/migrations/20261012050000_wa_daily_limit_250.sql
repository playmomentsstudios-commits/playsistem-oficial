-- Raise the configurable daily cap without changing the sending mode or enabling recipients.
ALTER TABLE public.app_settings DROP CONSTRAINT IF EXISTS wa_bridge_limit_check;
ALTER TABLE public.app_settings ADD CONSTRAINT wa_bridge_limit_check
  CHECK (wa_bridge_daily_limit BETWEEN 0 AND 250);
UPDATE public.app_settings SET wa_bridge_daily_limit = 250 WHERE id = true;

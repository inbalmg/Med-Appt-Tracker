-- Schedules the reminder pipeline: every minute, pg_cron POSTs to the
-- send-notifications edge function, which delivers any pending_reminders whose
-- trigger_at has passed.
--
-- This originally hardcoded a different project's URL and an anon JWT in the
-- Authorization header. Both are gone: the function runs with verify_jwt = false
-- (supabase/config.toml), so no auth header is needed and no key belongs in a
-- migration. The URL is this project's.

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Idempotent: drop any prior definition before (re)creating.
SELECT cron.unschedule('check-reminders')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'check-reminders');

SELECT cron.schedule(
  'check-reminders',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://tuvoumlrewbedlnloznx.supabase.co/functions/v1/send-notifications',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{"source":"cron"}'::jsonb
  ) as request_id;
  $$
);

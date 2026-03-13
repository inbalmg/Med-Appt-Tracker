
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Schedule cron job to call send-notifications every minute
SELECT cron.schedule(
  'check-reminders',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://mjdcjlmgtcafvhhyuqmq.supabase.co/functions/v1/send-notifications',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1qZGNqbG1ndGNhZnZoaHl1cW1xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2NDU5MDksImV4cCI6MjA4ODIyMTkwOX0.2EVv-PF5SVrg9sPrJz6zHHS9VaWV36onNAjeVsSzWfU"}'::jsonb,
    body := '{"source":"cron"}'::jsonb
  ) as request_id;
  $$
);

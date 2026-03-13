CREATE TABLE public.pending_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_key text NOT NULL UNIQUE,
  trigger_at timestamp with time zone NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  tag text NOT NULL,
  type text NOT NULL DEFAULT 'med',
  sent boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.pending_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can manage pending reminders"
  ON public.pending_reminders
  FOR ALL
  USING (true)
  WITH CHECK (true);
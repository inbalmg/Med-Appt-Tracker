-- The notification tables predate auth in this app, so they had no user
-- scoping: every reminder and every push subscription was global. With more
-- than one user, each would receive the other's medication reminders -- a
-- privacy leak of medical data.
--
-- Access pattern this establishes:
--   vapid_keys        -- app-wide keypair, edge functions only (RLS, no policy)
--   push_subscriptions-- per-user, edge functions only (RLS, no policy)
--   notification_log  -- dedupe only, edge functions only (RLS, no policy)
--   pending_reminders -- per-user, written directly by the browser (RLS + policy)

-- === pending_reminders ===
ALTER TABLE public.pending_reminders
  ADD COLUMN user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX pending_reminders_user_id_idx ON public.pending_reminders (user_id);

-- The unique key must be per-user: two users can legitimately hold the same
-- notification_key, and a cross-user conflict would let one user's upsert
-- collide with another's row.
ALTER TABLE public.pending_reminders
  DROP CONSTRAINT IF EXISTS pending_reminders_notification_key_key;

ALTER TABLE public.pending_reminders
  ADD CONSTRAINT pending_reminders_user_notification_key_key
  UNIQUE (user_id, notification_key);

DROP POLICY IF EXISTS "Anyone can manage pending reminders" ON public.pending_reminders;
DROP POLICY IF EXISTS "Authenticated users can manage pending reminders" ON public.pending_reminders;

CREATE POLICY "Users can manage own pending reminders"
  ON public.pending_reminders
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- === push_subscriptions ===
ALTER TABLE public.push_subscriptions
  ADD COLUMN user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX push_subscriptions_user_id_idx ON public.push_subscriptions (user_id);

-- endpoint stays globally unique: one browser endpoint belongs to exactly one
-- user, so re-subscribing on a shared device moves it rather than leaving a
-- stale row that would keep delivering the previous user's reminders.

DROP POLICY IF EXISTS "Anyone can manage push subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Anyone can read vapid public key" ON public.vapid_keys;
DROP POLICY IF EXISTS "Anyone can manage notification log" ON public.notification_log;

-- These three are reached only through the edge functions, which use the
-- service role and therefore bypass RLS. Enabling RLS with no policy denies
-- anon/authenticated outright while the functions keep working.
ALTER TABLE public.vapid_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_reminders ENABLE ROW LEVEL SECURITY;

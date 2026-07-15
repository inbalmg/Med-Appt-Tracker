-- The user data tables were created by hand rather than from
-- 20260308212523_*.sql, which declares each user_id as
--   REFERENCES auth.users(id) ON DELETE CASCADE
-- The hand-made versions came out as NO ACTION, so deleting a user failed on a
-- foreign key violation and left their medical records in the database.
--
-- Replacing a constraint does not touch rows; only the delete behaviour changes.

ALTER TABLE public.medications
  DROP CONSTRAINT medications_user_id_fkey,
  ADD CONSTRAINT medications_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.appointments
  DROP CONSTRAINT appointments_user_id_fkey,
  ADD CONSTRAINT appointments_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.completions
  DROP CONSTRAINT completions_user_id_fkey,
  ADD CONSTRAINT completions_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.arrivals
  DROP CONSTRAINT arrivals_user_id_fkey,
  ADD CONSTRAINT arrivals_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

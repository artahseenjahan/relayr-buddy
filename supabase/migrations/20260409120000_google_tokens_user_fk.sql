-- Link google_tokens to auth.users (was missing in original migration)
ALTER TABLE public.google_tokens
  DROP CONSTRAINT IF EXISTS google_tokens_user_id_fkey;

ALTER TABLE public.google_tokens
  ADD CONSTRAINT google_tokens_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

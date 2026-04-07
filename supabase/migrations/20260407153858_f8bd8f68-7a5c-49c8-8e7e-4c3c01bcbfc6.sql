
-- Create google_tokens table for server-side Gmail OAuth token storage
CREATE TABLE public.google_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  scopes TEXT NOT NULL DEFAULT '',
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.google_tokens ENABLE ROW LEVEL SECURITY;

-- Users can view their own tokens (for connection status checks)
CREATE POLICY "Users can view their own tokens"
ON public.google_tokens
FOR SELECT
USING (auth.uid() = user_id);

-- Users can delete their own tokens (revoke access)
CREATE POLICY "Users can delete their own tokens"
ON public.google_tokens
FOR DELETE
USING (auth.uid() = user_id);

-- Service role handles insert/update via edge functions (no user INSERT/UPDATE policies needed)

-- Timestamp trigger
CREATE TRIGGER update_google_tokens_updated_at
BEFORE UPDATE ON public.google_tokens
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

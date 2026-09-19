-- Deriv OAuth 2.0 state used for short-lived PKCE authorization handshakes.
-- The verifier is server-side only; it must never be sent back to the browser.
CREATE TABLE public.deriv_oauth_states (
  state text PRIMARY KEY,
  user_id uuid NOT NULL,
  code_verifier text NOT NULL,
  redirect_uri text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.deriv_oauth_states ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.deriv_oauth_states FROM anon, authenticated;
GRANT ALL ON public.deriv_oauth_states TO service_role;

ALTER TABLE public.deriv_accounts
  ADD COLUMN IF NOT EXISTS auth_method text NOT NULL DEFAULT 'PAT',
  ADD COLUMN IF NOT EXISTS access_token_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS refresh_token text,
  ADD COLUMN IF NOT EXISTS app_id text;

-- OAuth access/refresh credentials are server-managed. The existing frontend
-- token column remains only for the legacy migration path and will be removed
-- from client reads once the OAuth WebSocket transport is live.

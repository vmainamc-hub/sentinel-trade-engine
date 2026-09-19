import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function base64Url(bytes: Uint8Array): string {
  let value = "";
  for (const byte of bytes) value += String.fromCharCode(byte);
  return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function createPkcePair() {
  const verifierBytes = new Uint8Array(32);
  crypto.getRandomValues(verifierBytes);
  const verifier = base64Url(verifierBytes);
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier),
  );
  return { verifier, challenge: base64Url(new Uint8Array(digest)) };
}

export const Route = createFileRoute("/api/deriv/oauth/start")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authHeader = request.headers.get("authorization") ?? "";
        const accessToken = authHeader.startsWith("Bearer ")
          ? authHeader.slice(7)
          : "";

        if (!accessToken) {
          return Response.json({ error: "Missing Supabase session token" }, { status: 401 });
        }

        const { data: userData, error: userError } =
          await supabaseAdmin.auth.getUser(accessToken);
        if (userError || !userData.user) {
          return Response.json({ error: "Invalid application session" }, { status: 401 });
        }

        const clientId =
          process.env.DERIV_CLIENT_ID || process.env.VITE_DERIV_APP_ID || "";
        if (!clientId) {
          return Response.json({ error: "Deriv OAuth client is not configured" }, { status: 500 });
        }

        const redirectUri =
          process.env.DERIV_OAUTH_REDIRECT_URI ||
          new URL("/api/deriv/oauth/callback", request.url).toString();

        const { verifier, challenge } = await createPkcePair();
        const stateBytes = new Uint8Array(24);
        crypto.getRandomValues(stateBytes);
        const state = base64Url(stateBytes);
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

        const { error: stateError } = await supabaseAdmin
          .from("deriv_oauth_states")
          .insert({
            state,
            user_id: userData.user.id,
            code_verifier: verifier,
            redirect_uri: redirectUri,
            expires_at: expiresAt,
          });

        if (stateError) {
          return Response.json({ error: "Unable to start Deriv authorization" }, { status: 500 });
        }

        const url = new URL("https://auth.deriv.com/oauth2/auth");
        url.searchParams.set("response_type", "code");
        url.searchParams.set("client_id", clientId);
        url.searchParams.set("redirect_uri", redirectUri);
        url.searchParams.set("scope", "trade");
        url.searchParams.set("state", state);
        url.searchParams.set("code_challenge", challenge);
        url.searchParams.set("code_challenge_method", "S256");

        return Response.json({ authorizationUrl: url.toString() });
      },
    },
  },
});

import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/deriv/oauth/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const error = url.searchParams.get("error");

        if (error) {
          return Response.redirect(
            new URL(`/app/executor?deriv=denied&reason=${encodeURIComponent(error)}`, url.origin),
            303,
          );
        }

        if (!code || !state) {
          return Response.redirect(
            new URL("/app/executor?deriv=error&reason=missing_callback_parameters", url.origin),
            303,
          );
        }

        const { data: stateRow, error: stateError } = await supabaseAdmin
          .from("deriv_oauth_states")
          .select("state, user_id, code_verifier, redirect_uri, expires_at")
          .eq("state", state)
          .maybeSingle();

        if (
          stateError ||
          !stateRow ||
          new Date(stateRow.expires_at).getTime() < Date.now()
        ) {
          return Response.redirect(
            new URL("/app/executor?deriv=error&reason=invalid_or_expired_state", url.origin),
            303,
          );
        }

        const clientId =
          process.env.DERIV_CLIENT_ID || process.env.VITE_DERIV_APP_ID || "";
        const clientSecret = process.env.DERIV_CLIENT_SECRET || "";

        const body = new URLSearchParams({
          grant_type: "authorization_code",
          client_id: clientId,
          code,
          code_verifier: stateRow.code_verifier,
          redirect_uri: stateRow.redirect_uri,
        });
        if (clientSecret) body.set("client_secret", clientSecret);

        const tokenResponse = await fetch("https://auth.deriv.com/oauth2/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body,
        });

        const tokenData = await tokenResponse.json() as {
          access_token?: string;
          refresh_token?: string;
          expires_in?: number;
          error?: string;
        };

        if (!tokenResponse.ok || !tokenData.access_token) {
          await supabaseAdmin.from("deriv_oauth_states").delete().eq("state", state);
          return Response.redirect(
            new URL("/app/executor?deriv=error&reason=token_exchange_failed", url.origin),
            303,
          );
        }

        const accountsResponse = await fetch(
          "https://api.derivws.com/trading/v1/options/accounts",
          {
            headers: {
              Authorization: `Bearer ${tokenData.access_token}`,
              "Content-Type": "application/json",
            },
          },
        );
        const accountsPayload = await accountsResponse.json() as {
          data?: unknown;
        };

        if (!accountsResponse.ok) {
          await supabaseAdmin.from("deriv_oauth_states").delete().eq("state", state);
          return Response.redirect(
            new URL("/app/executor?deriv=error&reason=account_lookup_failed", url.origin),
            303,
          );
        }

        const rawAccounts = Array.isArray(accountsPayload.data)
          ? accountsPayload.data
          : accountsPayload.data
            ? [accountsPayload.data]
            : [];

        const accounts = rawAccounts
          .map((raw) => raw as Record<string, unknown>)
          .map((raw) => ({
            user_id: stateRow.user_id,
            loginid: String(raw.account_id ?? raw.loginid ?? raw.id ?? ""),
            token: tokenData.access_token!,
            currency: raw.currency ? String(raw.currency) : "USD",
            is_virtual:
              raw.account_type === "demo" ||
              raw.is_virtual === true,
            balance:
              raw.balance === undefined || raw.balance === null
                ? null
                : Number(raw.balance),
            is_active: false,
            auth_method: "OAUTH",
            access_token_expires_at: new Date(
              Date.now() + Number(tokenData.expires_in ?? 3600) * 1000,
            ).toISOString(),
            refresh_token: tokenData.refresh_token ?? null,
            app_id: clientId,
          }))
          .filter((account) => account.loginid);

        if (!accounts.length) {
          await supabaseAdmin.from("deriv_oauth_states").delete().eq("state", state);
          return Response.redirect(
            new URL("/app/executor?deriv=error&reason=no_options_account", url.origin),
            303,
          );
        }

        await supabaseAdmin
          .from("deriv_accounts")
          .update({ is_active: false })
          .eq("user_id", stateRow.user_id);

        accounts[0].is_active = true;

        const { error: upsertError } = await supabaseAdmin
          .from("deriv_accounts")
          .upsert(accounts, { onConflict: "user_id,loginid" });

        await supabaseAdmin.from("deriv_oauth_states").delete().eq("state", state);

        if (upsertError) {
          return Response.redirect(
            new URL("/app/executor?deriv=error&reason=account_save_failed", url.origin),
            303,
          );
        }

        return Response.redirect(
          new URL("/app/executor?deriv=connected", url.origin),
          303,
        );
      },
    },
  },
});

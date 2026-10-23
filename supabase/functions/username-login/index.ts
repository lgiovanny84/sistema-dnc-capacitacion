import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { temporaryPasswordExpired, loginBucketHash } from "../_shared/authSecurity.ts";

const cors = {
  "Access-Control-Allow-Origin": "https://sistema-dnc-capacitacion.vercel.app",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function response(body: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store", ...extraHeaders },
  });
}

export default {
  async fetch(request: Request) {
    if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
    if (request.method !== "POST") return response({ error: "Método no permitido." }, 405);

    try {
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return response({ error: "Solicitud no válida." }, 400);
      }
      if (!body || typeof body !== "object" || Array.isArray(body))
        return response({ error: "Solicitud no válida." }, 400);
      const input = body as Record<string, unknown>;
      const username = typeof input.username === "string" ? input.username.trim().toLowerCase() : input.username;
      const password = input.password;
      if (typeof username !== "string" || typeof password !== "string" ||
          !/^[a-z0-9._-]{3,32}$/.test(username) || !password.length || password.length > 1024) {
        return response({ error: "Credenciales inválidas." }, 401);
      }

      const url = Deno.env.get("SUPABASE_URL");
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
      if (!url || !serviceKey || !anonKey) {
        console.error("username-login: configuration unavailable");
        return response({ error: "Servicio de ingreso no disponible." }, 503);
      }
      const admin = createClient(url, serviceKey, {
        auth: { persistSession: false },
      });
      // The gateway's last forwarded address is supplemental. Account and
      // global buckets remain effective even when an origin header is absent/spoofed.
      const origin = request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim().slice(0, 128) || "unknown";
      const [accountHash, originHash] = await Promise.all([
        loginBucketHash(serviceKey, `account:${username}`), loginBucketHash(serviceKey, `origin:${origin}`),
      ]);
      const { data: limit, error: limitError } = await admin.rpc("consume_login_attempt", { p_account_hash: accountHash, p_origin_hash: originHash });
      if (limitError || !limit || typeof limit.allowed !== "boolean")
        return response({ error: "Servicio de ingreso no disponible." }, 503);
      if (!limit.allowed) {
        const retryAfter = Math.max(1, Math.min(600, Number(limit.retry_after) || 600));
        return response({ error: `Demasiados intentos. Vuelva a intentarlo en ${Math.ceil(retryAfter / 60)} minutos.` }, 429, { "Retry-After": String(retryAfter) });
      }
      const { data: profile, error: lookupError } = await admin.from("profiles")
        .select("id,email,active,deleted_at,must_change_password,temporary_password_expires_at").eq("username", username).maybeSingle();
      if (lookupError) {
        console.error("username-login: profile lookup failed", { lookupCode: lookupError.code });
        return response({ error: "Servicio de ingreso no disponible." }, 503);
      }
      if (!profile || !profile.active || profile.deleted_at || temporaryPasswordExpired(profile)) {
        return response({ error: "Credenciales inválidas." }, 401);
      }

      const auth = createClient(url, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data, error } = await auth.auth.signInWithPassword({
        email: profile.email, password,
      });
      if (error) {
        console.warn("username-login: auth rejected", {
          authCode: error?.code ?? null,
          authStatus: error?.status ?? null,
        });
        if (error.status === 429)
          return response({ error: "Demasiados intentos. Espere y vuelva a intentarlo." }, 429);
        if (!error.status || error.status >= 500)
          return response({ error: "Servicio de ingreso no disponible." }, 503);
        return response({ error: "Credenciales inválidas." }, 401);
      }
      if (!data.session || data.user?.id !== profile.id) {
        console.error("username-login: invalid authentication result");
        return response({ error: "Servicio de ingreso no disponible." }, 503);
      }
      return response({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      });
    } catch {
      console.error("username-login: unexpected failure");
      return response({ error: "No se pudo iniciar sesión." }, 500);
    }
  },
};

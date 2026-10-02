import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "https://sistema-dnc-capacitacion.vercel.app",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export default {
  async fetch(request: Request) {
    if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
    if (request.method !== "POST") return response({ error: "Método no permitido." }, 405);

    try {
      const { username, password } = await request.json();
      if (typeof username !== "string" || typeof password !== "string" ||
          !/^[a-z0-9._-]{3,32}$/.test(username) || password.length > 1024) {
        return response({ error: "Credenciales inválidas." }, 401);
      }

      const url = Deno.env.get("SUPABASE_URL")!;
      const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
        auth: { persistSession: false },
      });
      const { data: profile, error: lookupError } = await admin.from("profiles")
        .select("id,email,active,deleted_at").eq("username", username).maybeSingle();
      if (lookupError || !profile || !profile.active || profile.deleted_at) {
        console.warn("username-login: profile unavailable", {
          lookupCode: lookupError?.code ?? null,
          found: Boolean(profile),
          active: profile?.active ?? null,
          deleted: Boolean(profile?.deleted_at),
        });
        return response({ error: "Credenciales inválidas." }, 401);
      }

      const auth = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data, error } = await auth.auth.signInWithPassword({
        email: profile.email, password,
      });
      if (error || !data.session || data.user?.id !== profile.id) {
        console.warn("username-login: auth rejected", {
          authCode: error?.code ?? null,
          authStatus: error?.status ?? null,
          sessionIssued: Boolean(data.session),
          identityMatches: Boolean(data.user?.id === profile.id),
        });
        return response({ error: "Credenciales inválidas." }, 401);
      }
      return response({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      });
    } catch (error) {
      console.error("username-login: unexpected failure", error instanceof Error ? error.message : "unknown");
      return response({ error: "No se pudo iniciar sesión." }, 500);
    }
  },
};

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const appOrigin = "https://sistema-dnc-capacitacion.vercel.app";
const cors = {
  "Access-Control-Allow-Origin": appOrigin,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

export default {
  async fetch(req: Request) {
    if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
    if (req.method !== "POST")
      return json({ error: "Método no permitido." }, 405);

    try {
      const url = Deno.env.get("SUPABASE_URL")!;
      const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
      const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const authorization = req.headers.get("Authorization") ?? "";
      const caller = createClient(url, anon, {
        global: { headers: { Authorization: authorization } },
      });
      const {
        data: { user },
        error: userError,
      } = await caller.auth.getUser();
      if (userError || !user) return json({ error: "Sesión no válida." }, 401);

      const admin = createClient(url, service, {
        auth: { persistSession: false },
      });
      const { data: profile, error: profileError } = await caller
        .from("profiles")
        .select("role,active")
        .eq("id", user.id)
        .single();
      if (profileError)
        console.error("profile lookup failed", profileError.message);
      if (profile?.role !== "admin" || !profile.active)
        return json({ error: "Acceso exclusivo para administradores." }, 403);

      const body = await req.json();
      const email = String(body.email ?? "")
        .trim()
        .toLowerCase();
      const fullName = String(body.fullName ?? "").trim();
      const role = body.role === "admin" ? "admin" : "user";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        return json({ error: "Correo electrónico no válido." }, 400);

      const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
        data: { full_name: fullName },
        redirectTo: appOrigin,
      });
      if (error) return json({ error: error.message }, 400);
      if (data.user) {
        await admin
          .from("profiles")
          .update({ full_name: fullName, role, active: true })
          .eq("id", data.user.id);
      }
      return json({ ok: true }, 200);
    } catch {
      return json({ error: "No fue posible procesar la invitación." }, 500);
    }
  },
};

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

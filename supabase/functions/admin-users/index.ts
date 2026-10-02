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
      const { data: profile, error: profileError } = await caller.from("profiles")
        .select("role,active,deleted_at")
        .eq("id", user.id)
        .single();
      if (profileError) {
        console.error("profile lookup failed", profileError.message);
        return json({ error: "No se pudo verificar el perfil. Vuelva a iniciar sesión e inténtelo de nuevo." }, 500);
      }
      if (!profile?.active || profile.deleted_at)
        return json({ error: "Acceso inactivo o no disponible." }, 403);
      const body = await req.json();
      if (body.action === "complete-first-login") {
        const password = String(body.password ?? "");
        if (password.length < 12 || password.length > 128)
          return json({ error: "La contraseña debe tener entre 12 y 128 caracteres." }, 400);
        const { error: passwordError } = await admin.auth.admin.updateUserById(user.id, { password });
        if (passwordError) return json({ error: passwordError.message }, 400);
        const { error: updateError } = await admin.rpc("finish_first_login_for_user", { p_user_id: user.id });
        if (updateError) return json({ error: "Se cambió la contraseña, pero no se pudo completar el primer acceso. Intente de nuevo." }, 500);
        return json({ ok: true }, 200);
      }
      if (profile.role !== "admin")
        return json({ error: "Acceso exclusivo para administradores." }, 403);

      const email = String(body.email ?? "")
        .trim()
        .toLowerCase();
      const fullName = String(body.fullName ?? "").trim();
      const role = body.role === "admin" ? "admin" : "user";
      const username = String(body.username ?? "").trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        return json({ error: "Correo electrónico no válido." }, 400);
      if (!fullName) return json({ error: "Ingrese el nombre completo." }, 400);
      if (username && !/^[a-z0-9._-]{3,32}$/.test(username))
        return json({ error: "El usuario debe tener entre 3 y 32 caracteres válidos." }, 400);
      const temporaryPassword = temporaryPasswordForUser();
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password: temporaryPassword,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      });
      if (error) return json({ error: error.message }, 400);
      if (!data.user) return json({ error: "No se pudo crear el usuario." }, 500);
      const { data: createdProfile, error: updateError } = await caller.from("profiles")
        .update({ full_name: fullName, role, active: true, must_change_password: true,
          ...(username ? { username } : {}) })
        .eq("id", data.user.id).select("username").single();
      if (updateError || !createdProfile) {
        if (updateError) console.error("created profile update failed", updateError.code, updateError.message);
        await admin.auth.admin.deleteUser(data.user.id);
        return json({ error: updateError?.code === "23505" ? "Este nombre de usuario ya está asignado." : "No se pudo configurar el acceso." }, 400);
      }
      const verifier = createClient(url, anon, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data: verification, error: verificationError } = await verifier.auth.signInWithPassword({
        email,
        password: temporaryPassword,
      });
      if (verificationError || verification.user?.id !== data.user.id || !verification.session) {
        console.error("temporary credential verification failed", verificationError?.code ?? "identity mismatch");
        await admin.auth.admin.deleteUser(data.user.id);
        return json({ error: "No se pudo validar la clave temporal. Intente crear el usuario nuevamente." }, 500);
      }
      await verifier.auth.signOut();
      return json({ ok: true, username: createdProfile.username, temporaryPassword, loginUrl: appOrigin }, 200);
    } catch {
      return json({ error: "No fue posible procesar la invitación." }, 500);
    }
  },
};

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function temporaryPasswordForUser() {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

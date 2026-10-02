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
      let body: Record<string, unknown>;
      try {
        const value = await req.json();
        if (!value || typeof value !== "object" || Array.isArray(value))
          return json({ error: "Solicitud no válida." }, 400);
        body = value;
      } catch {
        return json({ error: "Solicitud no válida." }, 400);
      }
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

      if (body.action === "reset-temporary-password") {
        const targetId = typeof body.userId === "string" ? body.userId : "";
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetId))
          return json({ error: "Usuario no válido." }, 400);
        if (targetId === user.id)
          return json({ error: "Use la recuperación de contraseña para su propia cuenta." }, 400);
        const { data: target, error: targetError } = await admin.from("profiles")
          .select("id,email,username,role,active,deleted_at").eq("id", targetId).maybeSingle();
        if (targetError) return json({ error: "No se pudo consultar el usuario." }, 500);
        if (!target || target.deleted_at)
          return json({ error: "El usuario no existe o su acceso fue eliminado." }, 404);
        if (target.role !== "user")
          return json({ error: "Esta opción está disponible para cuentas con rol Usuario." }, 403);
        const { data: identity, error: identityError } = await admin.auth.admin.getUserById(targetId);
        if (identityError || identity?.user?.id !== target.id ||
            identity?.user?.email?.toLowerCase() !== target.email.toLowerCase())
          return json({ error: "El perfil no coincide con la cuenta de ingreso. Revise el usuario." }, 409);

        // Fail closed: never issue a new password before requiring its replacement.
        const { data: marked, error: markError } = await caller.from("profiles")
          .update({ must_change_password: true, profile_updated_at: new Date().toISOString() })
          .eq("id", targetId).is("deleted_at", null).select("id").maybeSingle();
        if (markError || !marked)
          return json({ error: "No se pudo configurar el cambio obligatorio de contraseña." }, 500);
        const temporaryPassword = temporaryPasswordForUser();
        const { error: passwordError } = await admin.auth.admin.updateUserById(targetId, { password: temporaryPassword });
        if (passwordError)
          return json({ error: "No se pudo confirmar la nueva clave temporal. Genere otra antes de compartirla." }, 500);
        if (!await verifyTemporaryPassword(url, anon, target.email, temporaryPassword, target.id))
          return json({ error: "Se reemplazó la contraseña, pero no se pudo validar la clave temporal. Genere una nueva clave antes de compartirla." }, 500);
        return json({ ok: true, email: target.email, username: target.username, temporaryPassword, loginUrl: appOrigin, active: target.active }, 200);
      }
      if (body.action !== undefined && body.action !== "create")
        return json({ error: "Acción no válida." }, 400);

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
      if (!await verifyTemporaryPassword(url, anon, email, temporaryPassword, data.user.id)) {
        await admin.auth.admin.deleteUser(data.user.id);
        return json({ error: "No se pudo validar la clave temporal. Intente crear el usuario nuevamente." }, 500);
      }
      return json({ ok: true, username: createdProfile.username, temporaryPassword, loginUrl: appOrigin }, 200);
    } catch {
      return json({ error: "No fue posible procesar la solicitud." }, 500);
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

async function verifyTemporaryPassword(url: string, anon: string, email: string, password: string, userId: string) {
  try {
    const verifier = createClient(url, anon, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await verifier.auth.signInWithPassword({ email, password });
    if (error || data.user?.id !== userId || !data.session) {
      console.error("temporary credential verification failed", error?.code ?? "identity mismatch");
      if (data.session) await verifier.auth.signOut({ scope: "local" });
      return false;
    }
    await verifier.auth.signOut();
    return true;
  } catch {
    console.error("temporary credential verification unavailable");
    return false;
  }
}

import { FormEvent, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { configured, supabase } from "./supabase";
type Role = "admin" | "user";
type Need = {
  id: string;
  created_at: string;
  updated_at: string;
  owner_id: string;
  status: string;
  type: string;
  factor: string;
  competency: string;
  gap: string;
  objective: string;
  occupational_group: string;
  area: string;
  department: string;
  position: string;
  participants: number;
  hours: number;
  goal: string;
  indicator: string;
  evidence: string;
  priority: string;
  planned_date: string | null;
  quarter: string;
  modality: string;
  estimated_cost: number;
  provider: string;
  observations: string;
};
type Catalog = { id: string; kind: string; name: string; active: boolean };
type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  role: Role;
  active: boolean;
  created_at: string;
  position: string | null;
  occupational_group: string | null;
  area: string | null;
  department: string | null;
  onboarding_completed_at: string | null;
  can_view_entire_area: boolean;
  profile_updated_at: string;
};
type OrgUnit = {
  id: string;
  group_name: string;
  area_name: string;
  department_name: string;
  active: boolean;
  created_at: string;
};
type CorrectionRequest = {
  id: string;
  need_id: string;
  requester_id: string;
  requested_field: string;
  explanation: string;
  status: "Pendiente" | "Atendida" | "Rechazada";
  created_at: string;
  resolved_at: string | null;
};
const kinds: Record<string, string> = {
  factor: "Factores",
  competency: "Competencias",
  position: "Cargos",
  occupational_group: "Grupos ocupacionales",
  area: "Áreas",
  department: "Departamentos",
  modality: "Modalidades",
};
const fallback: Catalog[] = [
  { id: "f1", kind: "factor", name: "Cumplimiento normativo", active: true },
  { id: "f2", kind: "factor", name: "Competencias técnicas", active: true },
  { id: "f3", kind: "factor", name: "Competencias blandas", active: true },
  {
    id: "f4",
    kind: "factor",
    name: "Buenas prácticas y pasantías",
    active: true,
  },
  { id: "g1", kind: "occupational_group", name: "Directivo", active: true },
  { id: "g2", kind: "occupational_group", name: "Jefatura", active: true },
  { id: "g3", kind: "occupational_group", name: "Operativo", active: true },
  { id: "m1", kind: "modality", name: "Presencial", active: true },
  { id: "m2", kind: "modality", name: "Virtual", active: true },
  { id: "m3", kind: "modality", name: "Híbrida", active: true },
];
const blank = {
  type: "Interna",
  factor: "",
  competency: "",
  gap: "",
  objective: "",
  position: "",
  occupational_group: "",
  area: "",
  department: "",
  participants: 1,
  hours: 1,
  goal: "",
  indicator: "",
  evidence: "",
  priority: "Media",
  planned_date: "",
  quarter: "Q1",
  modality: "",
  estimated_cost: 0,
  provider: "",
  observations: "",
};
const esc = (v: unknown) => `"${String(v ?? "").replaceAll('"', '""')}"`;
export default function App() {
  const [session, setSession] = useState<Session | null>(null),
    [role, setRole] = useState<Role>("user"),
    [tab, setTab] = useState("dashboard"),
    [needs, setNeeds] = useState<Need[]>([]),
    [catalogs, setCatalogs] = useState<Catalog[]>(fallback),
    [orgUnits, setOrgUnits] = useState<OrgUnit[]>([]),
    [profile, setProfile] = useState<Profile | null>(null),
    [loading, setLoading] = useState(true),
    [notice, setNotice] = useState(""),
    [recovery, setRecovery] = useState(false),
    [filters, setFilters] = useState({
      type: "",
      factor: "",
      status: "",
      area: "",
    });
  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (session && supabase && !recovery) void load();
  }, [session, recovery]);
  async function load() {
    setLoading(true);
    const [
      { data: n, error: ne },
      { data: c, error: ce },
      { data: p, error: pe },
      { data: o, error: oe },
    ] = await Promise.all([
      supabase!
        .from("training_needs")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase!.from("catalogs").select("*").order("name"),
      supabase!
        .from("profiles")
        .select("*")
        .eq("id", session!.user.id)
        .single(),
      supabase!
        .from("organizational_structure")
        .select("*")
        .eq("active", true)
        .order("group_name")
        .order("area_name")
        .order("department_name"),
    ]);
    const firstError = ne || ce || pe || oe;
    setNotice(
      firstError
        ? `No fue posible cargar los datos: ${firstError.message}`
        : "",
    );
    setNeeds((n ?? []) as Need[]);
    setCatalogs(c?.length ? (c as Catalog[]) : fallback);
    setRole((p?.role as Role) || "user");
    setProfile((p as Profile) ?? null);
    setOrgUnits((o ?? []) as OrgUnit[]);
    setLoading(false);
  }
  if (!configured) return <Setup />;
  if (recovery && session)
    return <UpdatePassword onDone={() => setRecovery(false)} />;
  if (!session) return <Login />;
  if (loading) return <Loading />;
  if (profile && !profile.onboarding_completed_at)
    return (
      <ProfileSetup
        profile={profile}
        catalogs={catalogs}
        orgUnits={orgUnits}
        onDone={load}
      />
    );
  const visible = needs.filter(
    (n) =>
      (!filters.type || n.type === filters.type) &&
      (!filters.factor || n.factor === filters.factor) &&
      (!filters.status || n.status === filters.status) &&
      (!filters.area || n.area === filters.area),
  );
  const totalHours = visible.reduce(
      (s, n) => s + Number(n.hours) * Number(n.participants),
      0,
    ),
    budget = visible.reduce((s, n) => s + Number(n.estimated_cost), 0);
  const options = (kind: string) => {
    if (kind === "area") return unique(orgUnits.map((o) => o.area_name));
    if (kind === "occupational_group")
      return unique(orgUnits.map((o) => o.group_name));
    return catalogs.filter((c) => c.kind === kind && c.active).map((c) => c.name);
  };
  function exportCSV() {
    const cols = [
      "created_at",
      "updated_at",
      "type",
      "factor",
      "competency",
      "gap",
      "objective",
      "position",
      "occupational_group",
      "area",
      "department",
      "participants",
      "hours",
      "goal",
      "indicator",
      "evidence",
      "priority",
      "planned_date",
      "quarter",
      "modality",
      "estimated_cost",
      "provider",
      "status",
    ];
    const csv =
      "\ufeff" +
      cols.join(";") +
      "\n" +
      visible
        .map((n) => cols.map((c) => esc(n[c as keyof Need])).join(";"))
        .join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    a.download = `reporte-dnc-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }
  return (
    <div className="shell">
      <aside>
        <button className="brand" onClick={() => setTab("dashboard")} aria-label="Ir al inicio">
          <img src="/logo-atuntaqui-horizontal.png" alt="Cooperativa Atuntaqui" />
          <small>Sistema DNC · Talento Humano</small>
        </button>
        <nav>
          {[
            ["dashboard", "Resumen"],
            ["new", "Nueva necesidad"],
            ["list", "Necesidades"],
            ["reports", "Reportes"],
            ...(role === "admin" ? [["admin", "Administración"]] : []),
          ].map(([id, label]) => (
            <button
              className={tab === id ? "active" : ""}
              onClick={() => setTab(id)}
              key={id}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="account">
          <small>{session.user.email}</small>
          <b>{role === "admin" ? "Administrador" : "Usuario"}</b>
          {role !== "admin" && profile?.department && (
            <small>
              {profile.can_view_entire_area ? `Área: ${profile.area}` : `Departamento: ${profile.department}`}
            </small>
          )}
          <button onClick={() => supabase!.auth.signOut()}>
            Cerrar sesión
          </button>
        </div>
      </aside>
      <main>
        <header>
          <div>
            <small>DESARROLLO ORGANIZACIONAL</small>
            <h1>
              {tab === "dashboard"
                ? "Panel ejecutivo"
                : tab === "new"
                  ? "Levantamiento de necesidad"
                  : tab === "list"
                    ? "Gestión de necesidades"
                    : tab === "reports"
                      ? "Reportes y análisis"
                      : "Administración"}
            </h1>
          </div>
          <span className="secure">● Conexión segura</span>
        </header>
        {notice && (
          <div className="alert">
            {notice}
            <button onClick={() => setNotice("")}>×</button>
          </div>
        )}
        {loading ? (
          <p>Cargando…</p>
        ) : tab === "dashboard" ? (
          <Dashboard needs={needs} totalHours={totalHours} budget={budget} />
        ) : tab === "new" ? (
          <NeedForm
            catalogs={catalogs}
            orgUnits={orgUnits}
            profile={profile}
            onDone={() => {
              void load();
              setTab("list");
            }}
            userId={session.user.id}
          />
        ) : tab === "list" ? (
          <List
            needs={visible}
            role={role}
            reload={load}
            catalogs={catalogs}
            orgUnits={orgUnits}
            profile={profile}
            userId={session.user.id}
          />
        ) : tab === "reports" ? (
          <Reports
            needs={visible}
            filters={filters}
            setFilters={setFilters}
            options={options}
            totalHours={totalHours}
            budget={budget}
            exportCSV={exportCSV}
          />
        ) : (
          <Admin catalogs={catalogs} orgUnits={orgUnits} needs={needs} reload={load} />
        )}
        <footer>
          Información de uso interno · Acceso y modificaciones sujetos a
          trazabilidad
        </footer>
      </main>
    </div>
  );
}
function Setup() {
  return (
    <div className="center">
      <div className="login wide">
        <img className="login-logo" src="/logo-atuntaqui-icon.png" alt="Cooperativa Atuntaqui" />
        <h1>Configuración requerida</h1>
        <p>Configure Supabase para activar autenticación y datos protegidos.</p>
        <ol>
          <li>Cree un proyecto en Supabase.</li>
          <li>
            Ejecute <code>supabase/schema.sql</code>.
          </li>
          <li>
            Copie <code>.env.example</code> como <code>.env.local</code>.
          </li>
          <li>
            Ejecute <code>npm run dev</code>.
          </li>
        </ol>
      </div>
    </div>
  );
}
function Loading() {
  return (
    <div className="center">
      <div className="login loading-card">
        <img className="login-logo" src="/logo-atuntaqui-icon.png" alt="Cooperativa Atuntaqui" />
        <p>Cargando información segura…</p>
      </div>
    </div>
  );
}
function Login() {
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [msg, setMsg] = useState(""),
    [forgot, setForgot] = useState(false),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase!.auth.signInWithPassword({
      email,
      password,
    });
    setMsg(error?.message ?? "");
    setBusy(false);
  }
  async function reset(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase!.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    setMsg(
      error?.message ??
        "Si el correo está registrado, recibirá un enlace para crear una nueva contraseña.",
    );
    setBusy(false);
  }
  return (
    <div className="center">
      <form className="login" onSubmit={forgot ? reset : submit}>
        <img className="login-logo" src="/logo-atuntaqui-icon.png" alt="Cooperativa Atuntaqui" />
        <h1>{forgot ? "Recuperar contraseña" : "Ingreso seguro"}</h1>
        <p>
          {forgot
            ? "Ingrese su correo para recibir un enlace seguro."
            : "Detección de Necesidades de Capacitación"}
        </p>
        <label>
          Correo institucional
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        {!forgot && (
          <label>
            Contraseña
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
        )}
        {msg && (
          <div className={msg.startsWith("Si el") ? "success" : "error"}>
            {msg}
          </div>
        )}
        <button className="primary" disabled={busy}>
          {busy ? "Procesando…" : forgot ? "Enviar enlace" : "Ingresar"}
        </button>
        <button
          type="button"
          className="linkbutton"
          onClick={() => {
            setForgot(!forgot);
            setMsg("");
          }}
        >
          {forgot ? "Volver al ingreso" : "¿Olvidó su contraseña?"}
        </button>
        <small>Las acciones quedan registradas para fines de control.</small>
      </form>
    </div>
  );
}
function UpdatePassword({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState(""),
    [msg, setMsg] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setMsg("Las contraseñas no coinciden.");
      return;
    }
    setBusy(true);
    const { error } = await supabase!.auth.updateUser({ password });
    setBusy(false);
    if (error) setMsg(error.message);
    else onDone();
  }
  return (
    <div className="center">
      <form className="login" onSubmit={submit}>
        <img className="login-logo" src="/logo-atuntaqui-icon.png" alt="Cooperativa Atuntaqui" />
        <h1>Nueva contraseña</h1>
        <p>Defina una contraseña segura de al menos 8 caracteres.</p>
        <label>
          Nueva contraseña
          <input
            type="password"
            minLength={8}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <label>
          Confirmar contraseña
          <input
            type="password"
            minLength={8}
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </label>
        {msg && <div className="error">{msg}</div>}
        <button className="primary" disabled={busy}>
          {busy ? "Guardando…" : "Guardar contraseña"}
        </button>
      </form>
    </div>
  );
}
function unique(values: string[]) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b, "es"));
}
function ProfileSetup({
  profile,
  catalogs,
  orgUnits,
  onDone,
}: {
  profile: Profile;
  catalogs: Catalog[];
  orgUnits: OrgUnit[];
  onDone: () => Promise<void>;
}) {
  const currentUnit = orgUnits.find(
    (o) =>
      o.group_name === profile.occupational_group &&
      o.area_name === profile.area &&
      o.department_name === profile.department,
  );
  const [position, setPosition] = useState(profile.position ?? ""),
    [unitId, setUnitId] = useState(currentUnit?.id ?? ""),
    [saving, setSaving] = useState(false),
    [error, setError] = useState("");
  const selectedUnit = orgUnits.find((o) => o.id === unitId);
  const positions = catalogs
    .filter((c) => c.kind === "position" && c.active)
    .map((c) => c.name);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const { error: rpcError } = await supabase!.rpc("complete_own_profile", {
      p_position: position.trim(),
      p_group: selectedUnit?.group_name ?? "",
      p_area: selectedUnit?.area_name ?? "",
      p_department: selectedUnit?.department_name ?? "",
    });
    setSaving(false);
    if (rpcError) setError(rpcError.message);
    else await onDone();
  }
  return (
    <div className="center">
      <form className="login profile-setup" onSubmit={submit}>
        <img className="login-logo" src="/logo-atuntaqui-horizontal.png" alt="Cooperativa Atuntaqui" />
        <div>
          <h1>Complete su perfil</h1>
          <p>Seleccione su departamento. El grupo ocupacional y el área se asignarán automáticamente y definirán la información que puede consultar.</p>
        </div>
        <div className="fields">
          <Input label="Cargo" value={position} onChange={setPosition} list={positions} required />
          <label>
            Departamento
            <select value={unitId} onChange={(e) => setUnitId(e.target.value)} required>
              <option value="">Seleccione…</option>
              {orgUnits.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.department_name} — {unit.area_name}
                </option>
              ))}
            </select>
          </label>
          <Input label="Grupo ocupacional asignado" value={selectedUnit?.group_name ?? ""} onChange={() => {}} disabled />
          <Input label="Área asignada" value={selectedUnit?.area_name ?? ""} onChange={() => {}} disabled />
        </div>
        {error && <div className="error">{error}</div>}
        <button className="primary" disabled={saving}>
          {saving ? "Guardando…" : "Guardar y continuar"}
        </button>
        <small>La fecha y hora de este registro quedarán guardadas para trazabilidad.</small>
      </form>
    </div>
  );
}
function Dashboard({
  needs,
  totalHours,
  budget,
}: {
  needs: Need[];
  totalHours: number;
  budget: number;
}) {
  return (
    <>
      <section className="cards">
        <Card label="Necesidades registradas" value={needs.length} />
        <Card
          label="Pendientes de revisión"
          value={needs.filter((n) => n.status === "Pendiente").length}
        />
        <Card label="Banco de horas meta" value={totalHours} />
        <Card
          label="Presupuesto estimado"
          value={budget.toLocaleString("es-EC", {
            style: "currency",
            currency: "USD",
          })}
        />
      </section>
      <section className="grid2">
        <div className="panel">
          <h2>Distribución por factor</h2>
          <Bars needs={needs} field="factor" />
        </div>
        <div className="panel">
          <h2>Alertas de gestión</h2>
          <div className="callout">
            <b>
              {
                needs.filter((n) => n.factor === "Cumplimiento normativo")
                  .length
              }
            </b>
            <span>necesidades de cumplimiento normativo</span>
          </div>
          <div className="callout">
            <b>
              {
                needs.filter((n) => ["Crítica", "Alta"].includes(n.priority))
                  .length
              }
            </b>
            <span>necesidades de prioridad alta o crítica</span>
          </div>
        </div>
      </section>
      <div className="panel">
        <h2>Últimos registros</h2>
        <MiniTable needs={needs.slice(0, 6)} />
      </div>
    </>
  );
}
function Card({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card">
      <small>{label}</small>
      <strong>{value}</strong>
    </div>
  );
}
function Bars({ needs, field }: { needs: Need[]; field: keyof Need }) {
  const groups = Object.entries(
      needs.reduce(
        (a, n) => {
          const k = String(n[field] || "Sin definir");
          a[k] = (a[k] || 0) + 1;
          return a;
        },
        {} as Record<string, number>,
      ),
    ).sort((a, b) => b[1] - a[1]),
    max = Math.max(1, ...groups.map((x) => x[1]));
  return (
    <div className="bars">
      {groups.length ? (
        groups.map(([k, v]) => (
          <div key={k}>
            <span>{k}</span>
            <i>
              <em style={{ width: `${(v / max) * 100}%` }} />
            </i>
            <b>{v}</b>
          </div>
        ))
      ) : (
        <p>Sin registros.</p>
      )}
    </div>
  );
}
function MiniTable({
  needs,
  onEdit,
  onDelete,
  onRequest,
  requestUserId,
}: {
  needs: Need[];
  onEdit?: (need: Need) => void;
  onDelete?: (need: Need) => void;
  onRequest?: (need: Need) => void;
  requestUserId?: string;
}) {
  return (
    <div className="table">
      <table>
        <thead>
          <tr>
            <th>Competencia</th>
            <th>Factor</th>
            <th>Área</th>
            <th>Departamento</th>
            <th>Cargo</th>
            <th>Tipo</th>
            <th>Prioridad</th>
            <th>Estado</th>
            <th>Fecha y hora de registro</th>
            {(onEdit || onDelete || onRequest) && <th>Acciones</th>}
          </tr>
        </thead>
        <tbody>
          {needs.map((n) => (
            <tr key={n.id}>
              <td>
                <b>{n.competency}</b>
              </td>
              <td>{n.factor}</td>
              <td>{n.area}</td>
              <td>{n.department}</td>
              <td>{n.position || "—"}</td>
              <td>{n.type}</td>
              <td>
                <span className={`pill ${n.priority.toLowerCase()}`}>
                  {n.priority}
                </span>
              </td>
              <td>{n.status}</td>
              <td>{new Date(n.created_at).toLocaleString("es-EC")}</td>
              {(onEdit || onDelete || onRequest) && (
                <td className="row-actions">
                  {onEdit && (
                    <button className="secondary" onClick={() => onEdit(n)}>
                      Modificar
                    </button>
                  )}
                  {onDelete && (
                    <button className="secondary danger" onClick={() => onDelete(n)}>
                      Eliminar
                    </button>
                  )}
                  {onRequest && n.owner_id === requestUserId && (
                    <button className="secondary" onClick={() => onRequest(n)}>
                      Solicitar corrección
                    </button>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function NeedForm({
  catalogs,
  orgUnits,
  profile,
  onDone,
  userId,
  initialNeed,
  onCancel,
}: {
  catalogs: Catalog[];
  orgUnits: OrgUnit[];
  profile: Profile | null;
  onDone: () => void | Promise<void>;
  userId: string;
  initialNeed?: Need;
  onCancel?: () => void;
}) {
  const initialForm = initialNeed
    ? {
        type: initialNeed.type,
        factor: initialNeed.factor,
        competency: initialNeed.competency,
        gap: initialNeed.gap,
        objective: initialNeed.objective,
        position: initialNeed.position,
        occupational_group: initialNeed.occupational_group,
        area: initialNeed.area,
        department: initialNeed.department,
        participants: Number(initialNeed.participants),
        hours: Number(initialNeed.hours),
        goal: initialNeed.goal,
        indicator: initialNeed.indicator,
        evidence: initialNeed.evidence,
        priority: initialNeed.priority,
        planned_date: initialNeed.planned_date ?? "",
        quarter: initialNeed.quarter,
        modality: initialNeed.modality,
        estimated_cost: Number(initialNeed.estimated_cost),
        provider: initialNeed.provider,
        observations: initialNeed.observations,
      }
    : {
        ...blank,
        position: profile?.position ?? "",
        occupational_group: profile?.occupational_group ?? "",
        area: profile?.area ?? "",
        department: profile?.department ?? "",
      };
  const [f, setF] = useState(initialForm),
    [saving, setSaving] = useState(false),
    [error, setError] = useState("");
  const opts = (k: string) =>
      catalogs.filter((c) => c.kind === k && c.active).map((c) => c.name),
    set = (k: string, v: string | number) => setF((x) => ({ ...x, [k]: v }));
  const groups = unique(orgUnits.map((o) => o.group_name));
  const areas = unique(
    orgUnits
      .filter((o) => o.group_name === f.occupational_group)
      .map((o) => o.area_name),
  );
  const departments = unique(
    orgUnits
      .filter(
        (o) =>
          o.group_name === f.occupational_group && o.area_name === f.area,
      )
      .map((o) => o.department_name),
  );
  const structureLocked = profile?.role !== "admin";
  function setDate(value: string) {
    const month = value ? Number(value.slice(5, 7)) : 0;
    setF((x) => ({
      ...x,
      planned_date: value,
      quarter: month ? `Q${Math.ceil(month / 3)}` : x.quarter,
    }));
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (f.type === "Interna" && !f.planned_date) {
      setError(
        "La fecha planificada es obligatoria para capacitación interna.",
      );
      return;
    }
    setSaving(true);
    const values = { ...f, planned_date: f.planned_date || null };
    const { error } = initialNeed
      ? await supabase!
          .from("training_needs")
          .update(values)
          .eq("id", initialNeed.id)
      : await supabase!.from("training_needs").insert({
          ...values,
          owner_id: userId,
          status: "Pendiente",
        });
    setSaving(false);
    if (error) setError(error.message);
    else await onDone();
  }
  return (
    <form className="panel form" onSubmit={submit}>
      <div className="intro">
        <h2>{initialNeed ? "Modificar necesidad de capacitación" : "Necesidad basada en una brecha verificable"}</h2>
        <p>
          Vincule la brecha con una competencia, resultado esperado y evidencia.
        </p>
      </div>
      <div className="fields">
        <Select
          label="Tipo de capacitación"
          value={f.type}
          values={["Interna", "Externa"]}
          onChange={(v) => set("type", v)}
        />
        <Select
          label="Factor"
          value={f.factor}
          values={opts("factor")}
          onChange={(v) => set("factor", v)}
          required
        />
        <Input
          label="Competencia a desarrollar"
          value={f.competency}
          onChange={(v) => set("competency", v)}
          list={opts("competency")}
          required
        />
        <Input
          label="Brecha identificada"
          value={f.gap}
          onChange={(v) => set("gap", v)}
          required
        />
        <Input
          label="Objetivo de aprendizaje"
          value={f.objective}
          onChange={(v) => set("objective", v)}
          required
        />
        <Input
          label="Cargo beneficiario"
          value={f.position}
          list={opts("position")}
          onChange={(v) => set("position", v)}
          required
        />
        <Select
          label="Grupo ocupacional"
          value={f.occupational_group}
          values={groups}
          onChange={(v) =>
            setF((x) => ({
              ...x,
              occupational_group: v,
              area: "",
              department: "",
            }))
          }
          required
          disabled={structureLocked}
        />
        <Select
          label="Área"
          value={f.area}
          values={areas}
          onChange={(v) =>
            setF((x) => ({ ...x, area: v, department: "" }))
          }
          required
          disabled={structureLocked}
        />
        <Select
          label="Departamento"
          value={f.department}
          values={departments}
          onChange={(v) => set("department", v)}
          required
          disabled={structureLocked}
        />
        {structureLocked && (
          <div className="structure-note full">
            Grupo, área y departamento provienen de su perfil y no pueden modificarse en este registro.
          </div>
        )}
        <Input
          label="N.º de participantes"
          type="number"
          min="1"
          value={f.participants}
          onChange={(v) => set("participants", Number(v))}
          required
        />
        <Input
          label="Horas por participante"
          type="number"
          min="1"
          value={f.hours}
          onChange={(v) => set("hours", Number(v))}
          required
        />
        <Input
          label="Meta esperada"
          value={f.goal}
          onChange={(v) => set("goal", v)}
          required
        />
        <Input
          label="Indicador de transferencia"
          value={f.indicator}
          onChange={(v) => set("indicator", v)}
          required
        />
        <Input
          label="Medio de verificación"
          value={f.evidence}
          onChange={(v) => set("evidence", v)}
          required
        />
        <Select
          label="Prioridad"
          value={f.priority}
          values={["Baja", "Media", "Alta", "Crítica"]}
          onChange={(v) => set("priority", v)}
        />
        <Input
          label={`Fecha planificada${f.type === "Interna" ? " (obligatoria)" : ""}`}
          type="date"
          value={f.planned_date}
          onChange={setDate}
          required={f.type === "Interna"}
        />
        <Select
          label="Trimestre"
          value={f.quarter}
          values={["Q1", "Q2", "Q3", "Q4"]}
          onChange={(v) => set("quarter", v)}
          disabled={Boolean(f.planned_date)}
        />
        <Select
          label="Modalidad"
          value={f.modality}
          values={opts("modality")}
          onChange={(v) => set("modality", v)}
          required
        />
        {f.type === "Externa" && (
          <>
            <Input
              label="Proveedor sugerido"
              value={f.provider}
              onChange={(v) => set("provider", v)}
            />
            <Input
              label="Costo estimado (USD)"
              type="number"
              min="0"
              step="0.01"
              value={f.estimated_cost}
              onChange={(v) => set("estimated_cost", Number(v))}
            />
          </>
        )}
        <label className="full">
          Observaciones
          <textarea
            value={f.observations}
            onChange={(e) => set("observations", e.target.value)}
            rows={3}
          />
        </label>
      </div>
      {error && <div className="error">{error}</div>}
      <div className="actions">
        <button
          type="button"
          className="secondary"
          onClick={() => (initialNeed && onCancel ? onCancel() : setF(initialForm))}
        >
          {initialNeed ? "Cancelar" : "Limpiar"}
        </button>
        <button className="primary" disabled={saving}>
          {saving ? "Guardando…" : initialNeed ? "Guardar cambios" : "Registrar necesidad"}
        </button>
      </div>
    </form>
  );
}
function Input({
  label,
  value,
  onChange,
  type = "text",
  list,
  min,
  step,
  required = false,
  disabled = false,
}: {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  type?: string;
  list?: string[];
  min?: string;
  step?: string;
  required?: boolean;
  disabled?: boolean;
}) {
  const id = label.replaceAll(" ", "-");
  return (
    <label>
      {label}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        list={list?.length ? id : undefined}
        min={min}
        step={step}
        required={required}
        disabled={disabled}
      />
      {list?.length ? (
        <datalist id={id}>
          {list.map((x) => (
            <option key={x}>{x}</option>
          ))}
        </datalist>
      ) : null}
    </label>
  );
}
function Select({
  label,
  value,
  values,
  onChange,
  required = false,
  disabled = false,
}: {
  label: string;
  value: string;
  values: string[];
  onChange: (v: string) => void;
  required?: boolean;
  disabled?: boolean;
}) {
  return (
    <label>
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        disabled={disabled}
      >
        <option value="">Seleccione…</option>
        {values.map((x) => (
          <option key={x}>{x}</option>
        ))}
      </select>
    </label>
  );
}
function List({
  needs,
  role,
  reload,
  catalogs,
  orgUnits,
  profile,
  userId,
}: {
  needs: Need[];
  role: Role;
  reload: () => Promise<void>;
  catalogs: Catalog[];
  orgUnits: OrgUnit[];
  profile: Profile | null;
  userId: string;
}) {
  const [editing, setEditing] = useState<Need | null>(null),
    [requesting, setRequesting] = useState<Need | null>(null),
    [requestedField, setRequestedField] = useState(""),
    [explanation, setExplanation] = useState(""),
    [requestMsg, setRequestMsg] = useState(""),
    [sendingRequest, setSendingRequest] = useState(false);
  async function status(id: string, value: string) {
    await supabase!
      .from("training_needs")
      .update({ status: value })
      .eq("id", id);
    await reload();
  }
  async function remove(need: Need) {
    if (role !== "admin") return;
    if (!window.confirm(`¿Eliminar el registro “${need.competency}”? La acción quedará auditada.`)) return;
    const { error } = await supabase!
      .from("training_needs")
      .delete()
      .eq("id", need.id);
    if (error) window.alert(error.message);
    else await reload();
  }
  async function sendCorrectionRequest(e: FormEvent) {
    e.preventDefault();
    if (!requesting || requesting.owner_id !== userId) return;
    setSendingRequest(true);
    setRequestMsg("");
    const { error } = await supabase!.from("correction_requests").insert({
      need_id: requesting.id,
      requester_id: userId,
      requested_field: requestedField,
      explanation: explanation.trim(),
    });
    setSendingRequest(false);
    if (error) setRequestMsg(error.message);
    else {
      setRequestMsg("Solicitud enviada al administrador.");
      setRequesting(null);
      setRequestedField("");
      setExplanation("");
    }
  }
  if (editing) {
    return (
      <NeedForm
        catalogs={catalogs}
        orgUnits={orgUnits}
        profile={profile}
        userId={userId}
        initialNeed={editing}
        onCancel={() => setEditing(null)}
        onDone={async () => {
          await reload();
          setEditing(null);
        }}
      />
    );
  }
  return (
    <div className="panel">
      <div className="panelhead">
        <h2>Matriz consolidada</h2>
        <span>{needs.length} registros visibles</span>
      </div>
      <div className="permission-note">
        {role === "admin"
          ? "Como administrador puede modificar o eliminar cualquier registro."
          : "No puede modificar directamente una necesidad. Si detecta un error, envíe una solicitud breve al administrador."}
      </div>
      {requestMsg && <div className={requestMsg.startsWith("Solicitud") ? "success" : "error"}>{requestMsg}</div>}
      {requesting && role !== "admin" && (
        <form className="correction-form" onSubmit={sendCorrectionRequest}>
          <div>
            <h3>Solicitar corrección</h3>
            <p>{requesting.competency} · {requesting.department}</p>
          </div>
          <Select
            label="Campo que necesita modificar"
            value={requestedField}
            values={["Tema o competencia", "Factor", "Cargo beneficiario", "Área o departamento", "Participantes u horas", "Fecha o trimestre", "Modalidad", "Presupuesto o proveedor", "Otro"]}
            onChange={setRequestedField}
            required
          />
          <label>
            Explicación breve
            <textarea
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              minLength={10}
              maxLength={300}
              rows={3}
              required
              placeholder="Explique qué dato está incorrecto y cuál debería ser el valor correcto."
            />
            <small>{explanation.length}/300 caracteres</small>
          </label>
          <div className="actions">
            <button type="button" className="secondary" onClick={() => setRequesting(null)}>Cancelar</button>
            <button className="primary" disabled={sendingRequest}>{sendingRequest ? "Enviando…" : "Enviar al administrador"}</button>
          </div>
        </form>
      )}
      <MiniTable
        needs={needs}
        onEdit={role === "admin" ? setEditing : undefined}
        onDelete={role === "admin" ? remove : undefined}
        onRequest={role === "user" ? setRequesting : undefined}
        requestUserId={userId}
      />
      {role === "admin" && (
        <div className="review">
          <h3>Revisión administrativa</h3>
          {needs
            .filter((n) => n.status === "Pendiente")
            .slice(0, 8)
            .map((n) => (
              <div key={n.id}>
                <span>
                  {n.competency} · {n.area}
                </span>
                <button onClick={() => status(n.id, "Aprobada")}>
                  Aprobar
                </button>
                <button
                  className="secondary"
                  onClick={() => status(n.id, "Observada")}
                >
                  Observar
                </button>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
function Reports({
  needs,
  filters,
  setFilters,
  options,
  totalHours,
  budget,
  exportCSV,
}: {
  needs: Need[];
  filters: Record<string, string>;
  setFilters: (x: any) => void;
  options: (k: string) => string[];
  totalHours: number;
  budget: number;
  exportCSV: () => void;
}) {
  const set = (k: string, v: string) =>
    setFilters((x: any) => ({ ...x, [k]: v }));
  return (
    <>
      <div className="report-heading">
        <img className="report-logo" src="/logo-atuntaqui-horizontal.png" alt="Cooperativa Atuntaqui" />
        <div>
          <h2>Reporte de necesidades de capacitación</h2>
          <small>Generado: {new Date().toLocaleString("es-EC")}</small>
        </div>
      </div>
      <div className="panel filters">
        <Select
          label="Tipo"
          value={filters.type}
          values={["Interna", "Externa"]}
          onChange={(v) => set("type", v)}
        />
        <Select
          label="Factor"
          value={filters.factor}
          values={options("factor")}
          onChange={(v) => set("factor", v)}
        />
        <Select
          label="Área"
          value={filters.area}
          values={options("area")}
          onChange={(v) => set("area", v)}
        />
        <Select
          label="Estado"
          value={filters.status}
          values={[
            "Pendiente",
            "Aprobada",
            "Observada",
            "Planificada",
            "Ejecutada",
            "Cerrada",
          ]}
          onChange={(v) => set("status", v)}
        />
        <button
          className="secondary"
          onClick={() =>
            setFilters({ type: "", factor: "", status: "", area: "" })
          }
        >
          Limpiar
        </button>
      </div>
      <section className="cards">
        <Card label="Registros filtrados" value={needs.length} />
        <Card label="Horas-persona" value={totalHours} />
        <Card
          label="Presupuesto"
          value={budget.toLocaleString("es-EC", {
            style: "currency",
            currency: "USD",
          })}
        />
      </section>
      <section className="grid2">
        <div className="panel">
          <h2>Por área</h2>
          <Bars needs={needs} field="area" />
        </div>
        <div className="panel">
          <h2>Por prioridad</h2>
          <Bars needs={needs} field="priority" />
        </div>
      </section>
      <div className="panel">
        <div className="panelhead">
          <h2>Detalle para toma de decisiones</h2>
          <div>
            <button className="secondary" onClick={() => window.print()}>
              Imprimir / PDF
            </button>{" "}
            <button className="primary" onClick={exportCSV}>
              Exportar CSV
            </button>
          </div>
        </div>
        <MiniTable needs={needs} />
      </div>
    </>
  );
}
function Admin({
  catalogs,
  orgUnits,
  needs,
  reload,
}: {
  catalogs: Catalog[];
  orgUnits: OrgUnit[];
  needs: Need[];
  reload: () => Promise<void>;
}) {
  const [kind, setKind] = useState("factor"),
    [name, setName] = useState(""),
    [msg, setMsg] = useState(""),
    [users, setUsers] = useState<Profile[]>([]),
    [email, setEmail] = useState(""),
    [fullName, setFullName] = useState(""),
    [newRole, setNewRole] = useState<Role>("user"),
    [editingUser, setEditingUser] = useState<Profile | null>(null),
    [sending, setSending] = useState(false);
  useEffect(() => {
    void loadUsers();
  }, []);
  async function loadUsers() {
    const { data, error } = await supabase!
      .from("profiles")
      .select("*")
      .order("created_at");
    if (error) setMsg(error.message);
    else setUsers((data ?? []) as Profile[]);
  }
  async function add(e: FormEvent) {
    e.preventDefault();
    const { error } = await supabase!
      .from("catalogs")
      .insert({ kind, name: name.trim(), active: true });
    setMsg(error?.message ?? "Categoría creada.");
    if (!error) {
      setName("");
      await reload();
    }
  }
  async function toggle(c: Catalog) {
    const { error } = await supabase!
      .from("catalogs")
      .update({ active: !c.active })
      .eq("id", c.id);
    if (error) setMsg(error.message);
    else await reload();
  }
  async function renameCatalog(c: Catalog) {
    const value = window.prompt("Nuevo nombre", c.name)?.trim();
    if (!value || value === c.name) return;
    const { error } = await supabase!
      .from("catalogs")
      .update({ name: value })
      .eq("id", c.id);
    setMsg(error?.message ?? "Elemento actualizado.");
    if (!error) await reload();
  }
  async function deleteCatalog(c: Catalog) {
    if (!window.confirm(`¿Eliminar definitivamente “${c.name}”?`)) return;
    const { error } = await supabase!.from("catalogs").delete().eq("id", c.id);
    setMsg(error?.message ?? "Elemento eliminado.");
    if (!error) await reload();
  }
  async function invite(e: FormEvent) {
    e.preventDefault();
    setSending(true);
    const { data, error } = await supabase!.functions.invoke("admin-users", {
      body: {
        email: email.trim(),
        fullName: fullName.trim(),
        role: newRole,
      },
    });
    setSending(false);
    if (error || data?.error) {
      let detail = data?.error || error?.message || "Error no identificado.";
      const context = (error as (Error & { context?: Response }) | null)
        ?.context;
      if (context) {
        try {
          const body = await context.clone().json();
          if (body?.error) detail = body.error;
        } catch {
          // Conserva el mensaje general cuando la respuesta no es JSON.
        }
      }
      setMsg(`No se pudo crear la invitación: ${detail}`);
    } else {
      setMsg("Invitación enviada correctamente.");
      setEmail("");
      setFullName("");
      setNewRole("user");
      setTimeout(() => void loadUsers(), 1200);
    }
  }
  async function updateUser(id: string, changes: Partial<Profile>) {
    const { error } = await supabase!
      .from("profiles")
      .update(changes)
      .eq("id", id);
    if (error) setMsg(error.message);
    else await loadUsers();
  }
  return (
    <>
      <CorrectionRequests needs={needs} users={users} />
      <AdminNeeds needs={needs} reload={reload} />
      {editingUser && (
        <AdminUserEditor
          user={editingUser}
          catalogs={catalogs}
          orgUnits={orgUnits}
          onCancel={() => setEditingUser(null)}
          onSaved={async () => {
            await loadUsers();
            setEditingUser(null);
          }}
        />
      )}
      <div className="panel">
        <h2>Usuarios y accesos</h2>
        <p>
          Invite usuarios, asigne el rol mínimo necesario y desactive accesos
          que ya no correspondan.
        </p>
        <form className="userform" onSubmit={invite}>
          <Input
            label="Nombre completo"
            value={fullName}
            onChange={setFullName}
            required
          />
          <Input
            label="Correo electrónico"
            type="email"
            value={email}
            onChange={setEmail}
            required
          />
          <Select
            label="Rol inicial"
            value={newRole}
            values={["user", "admin"]}
            onChange={(value) => setNewRole(value as Role)}
          />
          <button className="primary" disabled={sending}>
            {sending ? "Enviando…" : "Crear e invitar usuario"}
          </button>
        </form>
        {msg && <div className="statusmsg">{msg}</div>}
        <div className="table users">
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Correo</th>
                <th>Rol</th>
                <th>Estado</th>
                <th>Alcance visible</th>
                <th>Perfil completado</th>
                <th>Fecha de creación</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>{user.full_name || "Sin nombre"}</td>
                  <td>{user.email}</td>
                  <td>
                    <select
                      value={user.role}
                      onChange={(e) =>
                        updateUser(user.id, { role: e.target.value as Role })
                      }
                    >
                      <option value="user">Usuario</option>
                      <option value="admin">Administrador</option>
                    </select>
                  </td>
                  <td>
                    <button
                      className={user.active ? "tag" : "tag off"}
                      onClick={() =>
                        updateUser(user.id, { active: !user.active })
                      }
                    >
                      {user.active ? "Activo" : "Inactivo"}
                    </button>
                  </td>
                  <td>
                    {user.role === "admin" ? (
                      <span>Toda la organización</span>
                    ) : (
                      <select
                        value={user.can_view_entire_area ? "area" : "department"}
                        disabled={!user.onboarding_completed_at}
                        title={!user.onboarding_completed_at ? "El usuario debe completar primero su perfil" : undefined}
                        onChange={(e) =>
                          updateUser(user.id, {
                            can_view_entire_area: e.target.value === "area",
                          })
                        }
                      >
                        <option value="department">Solo su departamento</option>
                        <option value="area">Toda su área</option>
                      </select>
                    )}
                  </td>
                  <td>{user.onboarding_completed_at ? new Date(user.onboarding_completed_at).toLocaleString("es-EC") : "Pendiente"}</td>
                  <td>{new Date(user.created_at).toLocaleString("es-EC")}</td>
                  <td>
                    <button className="secondary" onClick={() => setEditingUser(user)}>
                      Editar perfil
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="panel">
        <h2>Catálogos configurables</h2>
        <p>
          Los cambios afectan las opciones de nuevos registros y quedan
          asociados al administrador.
        </p>
        <form className="inline" onSubmit={add}>
          <Select
            label="Catálogo"
            value={kind}
            values={Object.keys(kinds)}
            onChange={setKind}
          />
          <Input
            label="Nueva categoría"
            value={name}
            onChange={setName}
            required
          />
          <button className="primary">Agregar</button>
        </form>
      </div>
      <div className="panel catalog">
        <h2>Elementos configurados</h2>
        {Object.entries(kinds).map(([k, label]) => (
          <div key={k}>
            <h3>{label}</h3>
            <div className="tags">
              {catalogs
                .filter((c) => c.kind === k)
                .map((c) => (
                  <span className="catalog-item" key={c.id}>
                    <button onClick={() => toggle(c)} className={c.active ? "tag" : "tag off"}>
                      {c.name}
                    </button>
                    <button className="mini-action" onClick={() => renameCatalog(c)}>Editar</button>
                    <button className="mini-action danger" onClick={() => deleteCatalog(c)}>Eliminar</button>
                  </span>
                ))}
            </div>
          </div>
        ))}
      </div>
      <div className="panel">
        <h2>Estructura organizacional cargada</h2>
        <p>{orgUnits.length} relaciones activas de grupo, área y departamento.</p>
        <div className="table">
          <table>
            <thead><tr><th>Grupo</th><th>Área</th><th>Departamento</th><th>Fecha de carga</th></tr></thead>
            <tbody>{orgUnits.map((o) => <tr key={o.id}><td>{o.group_name}</td><td>{o.area_name}</td><td>{o.department_name}</td><td>{new Date(o.created_at).toLocaleString("es-EC")}</td></tr>)}</tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function CorrectionRequests({ needs, users }: { needs: Need[]; users: Profile[] }) {
  const [requests, setRequests] = useState<CorrectionRequest[]>([]),
    [message, setMessage] = useState("");
  useEffect(() => {
    void loadRequests();
  }, []);
  async function loadRequests() {
    const { data, error } = await supabase!
      .from("correction_requests")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) setMessage(error.message);
    else setRequests((data ?? []) as CorrectionRequest[]);
  }
  async function resolveRequest(id: string, status: "Atendida" | "Rechazada") {
    const { data: authData } = await supabase!.auth.getUser();
    const { error } = await supabase!
      .from("correction_requests")
      .update({
        status,
        resolved_at: new Date().toISOString(),
        resolved_by: authData.user?.id ?? null,
      })
      .eq("id", id);
    if (error) setMessage(error.message);
    else {
      setMessage(`Solicitud marcada como ${status.toLowerCase()}.`);
      await loadRequests();
    }
  }
  return (
    <div className="panel">
      <div className="panelhead">
        <div>
          <h2>Solicitudes de corrección</h2>
          <p>Revise el mensaje, modifique la necesidad desde la matriz y marque el resultado.</p>
        </div>
        <span>{requests.filter((r) => r.status === "Pendiente").length} pendientes</span>
      </div>
      {message && <div className="statusmsg">{message}</div>}
      <div className="table correction-requests">
        <table>
          <thead><tr><th>Fecha y hora</th><th>Usuario</th><th>Tema</th><th>Área / Departamento</th><th>Campo</th><th>Explicación</th><th>Estado</th><th>Acciones</th></tr></thead>
          <tbody>
            {requests.map((request) => {
              const need = needs.find((n) => n.id === request.need_id);
              const requester = users.find((u) => u.id === request.requester_id);
              return (
                <tr key={request.id}>
                  <td>{new Date(request.created_at).toLocaleString("es-EC")}</td>
                  <td>{requester?.full_name || requester?.email || "Usuario"}</td>
                  <td>{need?.competency || "Registro no disponible"}</td>
                  <td>{need ? `${need.area} / ${need.department}` : "—"}</td>
                  <td>{request.requested_field}</td>
                  <td className="request-explanation">{request.explanation}</td>
                  <td>{request.status}</td>
                  <td className="row-actions">
                    {request.status === "Pendiente" && (
                      <>
                        <button className="primary" onClick={() => resolveRequest(request.id, "Atendida")}>Atendida</button>
                        <button className="secondary danger" onClick={() => resolveRequest(request.id, "Rechazada")}>Rechazar</button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AdminUserEditor({
  user,
  catalogs,
  orgUnits,
  onCancel,
  onSaved,
}: {
  user: Profile;
  catalogs: Catalog[];
  orgUnits: OrgUnit[];
  onCancel: () => void;
  onSaved: () => Promise<void>;
}) {
  const currentUnit = orgUnits.find(
    (o) =>
      o.group_name === user.occupational_group &&
      o.area_name === user.area &&
      o.department_name === user.department,
  );
  const [fullName, setFullName] = useState(user.full_name ?? ""),
    [position, setPosition] = useState(user.position ?? ""),
    [unitId, setUnitId] = useState(currentUnit?.id ?? ""),
    [editRole, setEditRole] = useState<Role>(user.role),
    [active, setActive] = useState(user.active),
    [areaAccess, setAreaAccess] = useState(user.can_view_entire_area),
    [saving, setSaving] = useState(false),
    [error, setError] = useState("");
  const selectedUnit = orgUnits.find((o) => o.id === unitId);
  const positions = catalogs
    .filter((c) => c.kind === "position" && c.active)
    .map((c) => c.name);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!selectedUnit) {
      setError("Seleccione un departamento válido.");
      return;
    }
    setSaving(true);
    setError("");
    const { error: updateError } = await supabase!
      .from("profiles")
      .update({
        full_name: fullName.trim(),
        position: position.trim(),
        occupational_group: selectedUnit.group_name,
        area: selectedUnit.area_name,
        department: selectedUnit.department_name,
        role: editRole,
        active,
        can_view_entire_area: editRole === "admin" ? false : areaAccess,
        onboarding_completed_at:
          user.onboarding_completed_at ?? new Date().toISOString(),
        profile_updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);
    setSaving(false);
    if (updateError) setError(updateError.message);
    else await onSaved();
  }

  return (
    <form className="panel form admin-user-editor" onSubmit={submit}>
      <div className="panelhead">
        <div>
          <h2>Actualizar información del usuario</h2>
          <p>{user.email}</p>
        </div>
        <button type="button" className="secondary" onClick={onCancel}>
          Cerrar
        </button>
      </div>
      <div className="fields">
        <Input label="Nombre completo" value={fullName} onChange={setFullName} required />
        <Input label="Cargo" value={position} onChange={setPosition} list={positions} required />
        <label>
          Departamento
          <select value={unitId} onChange={(e) => setUnitId(e.target.value)} required>
            <option value="">Seleccione…</option>
            {orgUnits.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.department_name} — {unit.area_name}
              </option>
            ))}
          </select>
        </label>
        <Input label="Grupo ocupacional" value={selectedUnit?.group_name ?? ""} onChange={() => {}} disabled />
        <Input label="Área" value={selectedUnit?.area_name ?? ""} onChange={() => {}} disabled />
        <Select label="Rol" value={editRole} values={["user", "admin"]} onChange={(value) => setEditRole(value as Role)} required />
        <Select label="Estado" value={active ? "Activo" : "Inactivo"} values={["Activo", "Inactivo"]} onChange={(value) => setActive(value === "Activo")} required />
        <Select
          label="Información visible"
          value={editRole === "admin" ? "Toda la organización" : areaAccess ? "Toda su área" : "Solo su departamento"}
          values={editRole === "admin" ? ["Toda la organización"] : ["Solo su departamento", "Toda su área"]}
          onChange={(value) => setAreaAccess(value === "Toda su área")}
          disabled={editRole === "admin"}
          required
        />
      </div>
      {error && <div className="error">{error}</div>}
      <div className="actions">
        <button type="button" className="secondary" onClick={onCancel}>Cancelar</button>
        <button className="primary" disabled={saving}>{saving ? "Guardando…" : "Guardar usuario"}</button>
      </div>
    </form>
  );
}

function AdminNeeds({ needs, reload }: { needs: Need[]; reload: () => Promise<void> }) {
  const [drafts, setDrafts] = useState<Record<string, { competency: string; estimated_cost: number; planned_date: string; quarter: string }>>({});
  const draft = (n: Need) => drafts[n.id] ?? {
    competency: n.competency,
    estimated_cost: Number(n.estimated_cost),
    planned_date: n.planned_date ?? "",
    quarter: n.quarter,
  };
  function change(n: Need, values: Partial<ReturnType<typeof draft>>) {
    setDrafts((all) => ({ ...all, [n.id]: { ...draft(n), ...values } }));
  }
  function changeDate(n: Need, value: string) {
    const month = value ? Number(value.slice(5, 7)) : 0;
    change(n, { planned_date: value, quarter: month ? `Q${Math.ceil(month / 3)}` : draft(n).quarter });
  }
  async function save(n: Need) {
    const d = draft(n);
    const { error } = await supabase!.from("training_needs").update({
      competency: d.competency.trim(),
      estimated_cost: d.estimated_cost,
      planned_date: d.planned_date || null,
      quarter: d.quarter,
    }).eq("id", n.id);
    if (error) window.alert(error.message);
    else {
      setDrafts((all) => { const next = { ...all }; delete next[n.id]; return next; });
      await reload();
    }
  }
  async function remove(n: Need) {
    if (!window.confirm(`¿Eliminar la necesidad “${n.competency}”? Esta acción quedará auditada.`)) return;
    const { error } = await supabase!.from("training_needs").delete().eq("id", n.id);
    if (error) window.alert(error.message);
    else await reload();
  }
  return (
    <div className="panel">
      <h2>Temas y presupuesto</h2>
      <p>Edite el tema, la fecha y el presupuesto. El trimestre se calcula automáticamente.</p>
      <div className="table admin-needs"><table>
        <thead><tr><th>Tema / competencia</th><th>Área</th><th>Departamento</th><th>Fecha</th><th>Trimestre</th><th>Presupuesto USD</th><th>Acciones</th></tr></thead>
        <tbody>{needs.map((n) => {
          const d = draft(n);
          return <tr key={n.id}>
            <td><input value={d.competency} onChange={(e) => change(n, { competency: e.target.value })} /></td>
            <td>{n.area}</td>
            <td>{n.department}</td>
            <td><input type="date" value={d.planned_date} onChange={(e) => changeDate(n, e.target.value)} /></td>
            <td>{d.quarter}</td>
            <td><input type="number" min="0" step="0.01" value={d.estimated_cost} onChange={(e) => change(n, { estimated_cost: Number(e.target.value) })} /></td>
            <td className="row-actions"><button className="primary" onClick={() => save(n)}>Guardar</button><button className="secondary danger" onClick={() => remove(n)}>Eliminar</button></td>
          </tr>;
        })}</tbody>
      </table></div>
    </div>
  );
}

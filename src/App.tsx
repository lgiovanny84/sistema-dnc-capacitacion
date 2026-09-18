import { FormEvent, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { configured, supabase } from "./supabase";
type Role = "admin" | "user";
type Need = {
  id: string;
  created_at: string;
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
};
const kinds: Record<string, string> = {
  factor: "Factores",
  competency: "Competencias",
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
    ] = await Promise.all([
      supabase!
        .from("training_needs")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase!.from("catalogs").select("*").order("name"),
      supabase!
        .from("profiles")
        .select("role")
        .eq("id", session!.user.id)
        .single(),
    ]);
    const firstError = ne || ce || pe;
    setNotice(
      firstError
        ? `No fue posible cargar los datos: ${firstError.message}`
        : "",
    );
    setNeeds((n ?? []) as Need[]);
    setCatalogs(c?.length ? (c as Catalog[]) : fallback);
    setRole((p?.role as Role) || "user");
    setLoading(false);
  }
  if (!configured) return <Setup />;
  if (recovery && session)
    return <UpdatePassword onDone={() => setRecovery(false)} />;
  if (!session) return <Login />;
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
  const options = (kind: string) =>
    catalogs.filter((c) => c.kind === kind && c.active).map((c) => c.name);
  function exportCSV() {
    const cols = [
      "type",
      "factor",
      "competency",
      "gap",
      "objective",
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
        <div className="brand">
          <span>TH</span>
          <div>
            <b>Sistema DNC</b>
            <small>Talento Humano</small>
          </div>
        </div>
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
            onDone={() => {
              void load();
              setTab("list");
            }}
            userId={session.user.id}
          />
        ) : tab === "list" ? (
          <List needs={visible} role={role} reload={load} />
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
          <Admin catalogs={catalogs} reload={load} />
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
        <div className="logo">DNC</div>
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
        <div className="logo">DNC</div>
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
        <div className="logo">DNC</div>
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
function MiniTable({ needs }: { needs: Need[] }) {
  return (
    <div className="table">
      <table>
        <thead>
          <tr>
            <th>Competencia</th>
            <th>Factor</th>
            <th>Área</th>
            <th>Tipo</th>
            <th>Prioridad</th>
            <th>Estado</th>
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
              <td>{n.type}</td>
              <td>
                <span className={`pill ${n.priority.toLowerCase()}`}>
                  {n.priority}
                </span>
              </td>
              <td>{n.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function NeedForm({
  catalogs,
  onDone,
  userId,
}: {
  catalogs: Catalog[];
  onDone: () => void;
  userId: string;
}) {
  const [f, setF] = useState(blank),
    [saving, setSaving] = useState(false),
    [error, setError] = useState("");
  const opts = (k: string) =>
      catalogs.filter((c) => c.kind === k && c.active).map((c) => c.name),
    set = (k: string, v: string | number) => setF((x) => ({ ...x, [k]: v }));
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (f.type === "Interna" && !f.planned_date) {
      setError(
        "La fecha planificada es obligatoria para capacitación interna.",
      );
      return;
    }
    setSaving(true);
    const { error } = await supabase!.from("training_needs").insert({
      ...f,
      owner_id: userId,
      status: "Pendiente",
      planned_date: f.planned_date || null,
    });
    setSaving(false);
    if (error) setError(error.message);
    else onDone();
  }
  return (
    <form className="panel form" onSubmit={submit}>
      <div className="intro">
        <h2>Necesidad basada en una brecha verificable</h2>
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
        <Select
          label="Grupo ocupacional"
          value={f.occupational_group}
          values={opts("occupational_group")}
          onChange={(v) => set("occupational_group", v)}
          required
        />
        <Select
          label="Área"
          value={f.area}
          values={opts("area")}
          onChange={(v) => set("area", v)}
          required
        />
        <Select
          label="Departamento"
          value={f.department}
          values={opts("department")}
          onChange={(v) => set("department", v)}
          required
        />
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
        {f.type === "Interna" && (
          <Input
            label="Fecha planificada"
            type="date"
            value={f.planned_date}
            onChange={(v) => set("planned_date", v)}
            required
          />
        )}
        <Select
          label="Trimestre"
          value={f.quarter}
          values={["Q1", "Q2", "Q3", "Q4"]}
          onChange={(v) => set("quarter", v)}
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
        <button type="button" className="secondary" onClick={() => setF(blank)}>
          Limpiar
        </button>
        <button className="primary" disabled={saving}>
          {saving ? "Guardando…" : "Registrar necesidad"}
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
}: {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  type?: string;
  list?: string[];
  min?: string;
  step?: string;
  required?: boolean;
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
}: {
  label: string;
  value: string;
  values: string[];
  onChange: (v: string) => void;
  required?: boolean;
}) {
  return (
    <label>
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
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
}: {
  needs: Need[];
  role: Role;
  reload: () => Promise<void>;
}) {
  async function status(id: string, value: string) {
    await supabase!
      .from("training_needs")
      .update({ status: value })
      .eq("id", id);
    await reload();
  }
  return (
    <div className="panel">
      <div className="panelhead">
        <h2>Matriz consolidada</h2>
        <span>{needs.length} registros visibles</span>
      </div>
      <MiniTable needs={needs} />
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
  reload,
}: {
  catalogs: Catalog[];
  reload: () => Promise<void>;
}) {
  const [kind, setKind] = useState("factor"),
    [name, setName] = useState(""),
    [msg, setMsg] = useState(""),
    [users, setUsers] = useState<Profile[]>([]),
    [email, setEmail] = useState(""),
    [fullName, setFullName] = useState(""),
    [newRole, setNewRole] = useState<Role>("user"),
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
                  <button
                    key={c.id}
                    onClick={() => toggle(c)}
                    className={c.active ? "tag" : "tag off"}
                  >
                    {c.name}
                  </button>
                ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

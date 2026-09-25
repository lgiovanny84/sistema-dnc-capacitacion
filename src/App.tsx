import { FormEvent, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { configured, supabase } from "./supabase";
import {
  BudgetAllocation,
  BudgetSummary,
  ImportBatch,
  TrainingExecutionModule,
  TrainingRecord,
} from "./trainingExecution";
import { CompetencyMatrixManager, CompetencyMatrixRow } from "./competencyMatrix";
import { CollapsibleTable } from "./CollapsibleTable";
type Role = "admin" | "user";
type Need = {
  id: string;
  period_id: string | null;
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
  planned_start_date: string | null;
  planned_end_date: string | null;
  quarter: string;
  modality: string;
  estimated_cost: number;
  provider: string;
  observations: string;
};
type PlanningPeriod = { id: string; name: string; start_date: string; end_date: string; active: boolean; created_at: string };
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
  deleted_at: string | null;
  deleted_by: string | null;
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
  planned_start_date: "",
  planned_end_date: "",
  quarter: "Q1",
  modality: "",
  estimated_cost: 0,
  provider: "",
  observations: "",
};
const esc = (v: unknown) => `"${String(v ?? "").replaceAll('"', '""')}"`;
const pageMeta: Record<string, { title: string; description: string }> = {
  dashboard: { title: "Panel ejecutivo", description: "Visión consolidada de necesidades, presupuesto y avance del período." },
  new: { title: "Detección de Necesidades de Capacitación (DNC)", description: "Registro estructurado de brechas, competencias y resultados esperados." },
  list: { title: "Gestión de necesidades", description: "Consulta, seguimiento y actualización de las necesidades registradas." },
  reports: { title: "Reportes y análisis", description: "Indicadores y reportes filtrados para la toma de decisiones." },
  execution: { title: "Capacitación ejecutada", description: "Control de ejecución, inversión, horas y cobertura institucional." },
  admin: { title: "Administración", description: "Configuración de períodos, usuarios, catálogos y matrices institucionales." },
};

function NavIcon({ name }: { name: string }) {
  const paths: Record<string, React.ReactNode> = {
    dashboard: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    new: <><path d="M12 5v14M5 12h14" /><circle cx="12" cy="12" r="9" /></>,
    list: <><path d="M9 6h11M9 12h11M9 18h11" /><path d="M4 6h.01M4 12h.01M4 18h.01" /></>,
    reports: <><path d="M4 19V9M10 19V5M16 19v-7M22 19V3" /><path d="M2 21h22" /></>,
    execution: <><path d="M4 19V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14" /><path d="M8 8h8M8 12h8M8 16h5M2 21h20" /></>,
    admin: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21h-4v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H3v-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6V3h4v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.1v4H21a1.7 1.7 0 0 0-1.6 1Z" /></>,
  };
  return <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
async function fetchCompetencyMatrix() {
  const rows: CompetencyMatrixRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase!.from("competency_matrix").select("*").order("department").order("factor").order("competency").range(from, from + 999);
    if (error) return { data: rows, error };
    rows.push(...((data ?? []) as CompetencyMatrixRow[]));
    if (!data || data.length < 1000) return { data: rows, error: null };
  }
}
export default function App() {
  const [session, setSession] = useState<Session | null>(null),
    [role, setRole] = useState<Role>("user"),
    [tab, setTab] = useState("dashboard"),
    [needs, setNeeds] = useState<Need[]>([]),
    [catalogs, setCatalogs] = useState<Catalog[]>(fallback),
    [orgUnits, setOrgUnits] = useState<OrgUnit[]>([]),
    [trainingRecords, setTrainingRecords] = useState<TrainingRecord[]>([]),
    [budgetAllocations, setBudgetAllocations] = useState<BudgetAllocation[]>([]),
    [importBatches, setImportBatches] = useState<ImportBatch[]>([]),
    [periods, setPeriods] = useState<PlanningPeriod[]>([]),
    [competencyMatrix, setCompetencyMatrix] = useState<CompetencyMatrixRow[]>([]),
    [selectedPeriodId, setSelectedPeriodId] = useState(() => localStorage.getItem("dnc-period-id") ?? ""),
    [menuCollapsed, setMenuCollapsed] = useState(() => localStorage.getItem("dnc-menu-collapsed") === "true"),
    [profile, setProfile] = useState<Profile | null>(null),
    [loading, setLoading] = useState(true),
    [notice, setNotice] = useState(""),
    [accessBlocked, setAccessBlocked] = useState(false),
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
      { data: periodData, error: periodError },
      { data: matrixData, error: matrixError },
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
      supabase!.from("planning_periods").select("*").order("start_date", { ascending: false }),
      fetchCompetencyMatrix(),
    ]);
    const firstError = ne || ce || pe || oe || periodError || matrixError;
    setNotice(
      firstError
        ? `No fue posible cargar los datos: ${firstError.message}`
        : "",
    );
    setNeeds((n ?? []) as Need[]);
    setCatalogs(c?.length ? (c as Catalog[]) : fallback);
    setRole((p?.role as Role) || "user");
    setProfile((p as Profile) ?? null);
    setAccessBlocked(Boolean(p && (!p.active || p.deleted_at)));
    setOrgUnits((o ?? []) as OrgUnit[]);
    setCompetencyMatrix(matrixData ?? []);
    const loadedPeriods = (periodData ?? []) as PlanningPeriod[];
    setPeriods(loadedPeriods);
    setSelectedPeriodId((current) => {
      const selectable = p?.role === "admin" ? loadedPeriods : loadedPeriods.filter((period) => period.active);
      const selected = selectable.find((period) => period.id === current) ?? selectable.find((period) => new Date().toISOString().slice(0, 10) >= period.start_date && new Date().toISOString().slice(0, 10) <= period.end_date) ?? selectable[0];
      const next = selected?.id ?? "";
      if (next) localStorage.setItem("dnc-period-id", next);
      return next;
    });
    if (p?.role === "admin") {
      const [{ data: executed, error: executedError }, { data: allocations, error: allocationsError }, { data: batches, error: batchesError }] =
        await Promise.all([
          supabase!.from("training_records").select("*").order("start_date", { ascending: false }),
          supabase!.from("department_budgets").select("*").order("year", { ascending: false }).order("department_name"),
          supabase!.from("training_import_batches").select("*").order("uploaded_at", { ascending: false }),
        ]);
      if (executedError || allocationsError || batchesError) {
        setNotice(`No fue posible cargar la ejecución de capacitación: ${(executedError || allocationsError || batchesError)?.message}`);
      } else {
        setTrainingRecords((executed ?? []) as TrainingRecord[]);
        setBudgetAllocations((allocations ?? []) as BudgetAllocation[]);
        setImportBatches((batches ?? []) as ImportBatch[]);
      }
    } else {
      setTrainingRecords([]);
      setBudgetAllocations([]);
      setImportBatches([]);
    }
    setLoading(false);
  }
  if (!configured) return <Setup />;
  if (recovery && session)
    return <UpdatePassword onDone={() => setRecovery(false)} />;
  if (!session) return <Login />;
  if (loading) return <Loading />;
  if (accessBlocked) return <DisabledAccess email={session.user.email ?? ""} />;
  if (profile && !profile.onboarding_completed_at)
    return (
      <ProfileSetup
        profile={profile}
        catalogs={catalogs}
        orgUnits={orgUnits}
        onDone={load}
      />
    );
  const selectablePeriods = role === "admin" ? periods : periods.filter((period) => period.active);
  const activePeriod = selectablePeriods.find((period) => period.id === selectedPeriodId) ?? selectablePeriods[0];
  const periodNeeds = activePeriod ? needs.filter((need) => need.period_id === activePeriod.id) : [];
  const periodRecords = activePeriod ? trainingRecords.filter((record) => record.period_id === activePeriod.id) : [];
  const periodBatches = activePeriod ? importBatches.filter((batch) => batch.period_id === activePeriod.id) : [];
  const periodBudgets = activePeriod ? budgetAllocations.filter((allocation) => allocation.period_id === activePeriod.id) : [];
  const visible = periodNeeds.filter(
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
    budget = visible.reduce((s, n) => s + Number(n.estimated_cost), 0),
    periodTotalHours = periodNeeds.reduce((s, n) => s + Number(n.hours) * Number(n.participants), 0),
    periodBudget = periodNeeds.reduce((s, n) => s + Number(n.estimated_cost), 0);
  const options = (kind: string) => {
    if (kind === "area") return unique(orgUnits.map((o) => o.area_name));
    if (kind === "factor") {
      const matrixFactors = unique(competencyMatrix.filter((row) => row.active).map((row) => row.factor));
      return matrixFactors.length ? matrixFactors : catalogs.filter((c) => c.kind === kind && c.active).map((c) => c.name);
    }
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
      "planned_start_date",
      "planned_end_date",
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
    const periodLabel = (activePeriod?.name ?? "sin-periodo").replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ]+/g, "-").replace(/^-|-$/g, "");
    a.download = `reporte-dnc-${periodLabel}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }
  return (
    <div className={`shell ${menuCollapsed ? "collapsed" : ""}`}>
      <aside>
        <button
          className="menu-toggle"
          aria-label={menuCollapsed ? "Expandir menú" : "Contraer menú"}
          title={menuCollapsed ? "Expandir menú" : "Contraer menú"}
          onClick={() => setMenuCollapsed((current) => {
            localStorage.setItem("dnc-menu-collapsed", String(!current));
            return !current;
          })}
        >
          {menuCollapsed ? "›" : "‹"}
        </button>
        <button className="brand" onClick={() => setTab("dashboard")} aria-label="Ir al inicio">
          <img className="brand-full" src="/logo-atuntaqui-horizontal.png" alt="Cooperativa Atuntaqui" />
          <img className="brand-icon" src="/logo-atuntaqui-icon.png" alt="Cooperativa Atuntaqui" />
          <small>Gestión Integral de Capacitación</small>
        </button>
        <nav>
          {[
            ["dashboard", "Resumen"],
            ["new", "Nueva necesidad"],
            ["list", "Necesidades"],
            ["reports", "Reportes"],
            ...(role === "admin" ? [["execution", "Ejecución y KPIs"]] : []),
            ...(role === "admin" ? [["admin", "Administración"]] : []),
          ].map(([id, label]) => (
            <button
              className={tab === id ? "active" : ""}
              onClick={() => setTab(id)}
              key={id}
            >
              <NavIcon name={id} />
              <span className="nav-label">{label}</span>
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
          <button onClick={() => supabase!.auth.signOut()} title="Cerrar sesión">
            <span className="logout-full">Cerrar sesión</span><span className="logout-short">Salir</span>
          </button>
        </div>
      </aside>
      <main>
        <header>
          <div>
            <small>DESARROLLO ORGANIZACIONAL</small>
            <h1>{pageMeta[tab]?.title ?? "Gestión de capacitación"}</h1>
            <p className="page-description">{pageMeta[tab]?.description}</p>
          </div>
          <div className="header-controls"><label className="period-selector">Período<select value={activePeriod?.id ?? ""} onChange={(e) => { setSelectedPeriodId(e.target.value); localStorage.setItem("dnc-period-id", e.target.value); }} disabled={!selectablePeriods.length}>{selectablePeriods.map((period) => <option key={period.id} value={period.id}>{period.name}{role === "admin" && !period.active ? " · Inactivo" : ""} · {period.start_date} a {period.end_date}</option>)}</select></label><span className="secure">● Conexión segura</span></div>
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
          <Dashboard
            needs={periodNeeds}
            totalHours={periodTotalHours}
            budget={periodBudget}
            role={role}
            trainingRecords={periodRecords}
            budgetAllocations={periodBudgets}
            periodName={activePeriod?.name ?? "Sin período"}
          />
        ) : tab === "new" ? (
          activePeriod ? <NeedForm key={activePeriod.id}
            catalogs={catalogs}
            competencyMatrix={competencyMatrix}
            orgUnits={orgUnits}
            profile={profile}
            onDone={() => {
              void load();
              setTab("list");
            }}
            userId={session.user.id}
            periodId={activePeriod?.id ?? ""}
            period={activePeriod}
          /> : <div className="alert">No existe un período activo disponible para registrar necesidades de capacitación.</div>
        ) : tab === "list" ? (
          <List
            needs={visible}
            role={role}
            reload={load}
            catalogs={catalogs}
            competencyMatrix={competencyMatrix}
            orgUnits={orgUnits}
            profile={profile}
            userId={session.user.id}
            period={activePeriod}
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
        ) : tab === "execution" && role === "admin" ? (
          activePeriod ? <TrainingExecutionModule
              records={periodRecords}
              budgets={periodBudgets}
              plans={periodNeeds}
              batches={periodBatches}
              period={activePeriod}
              departments={unique(orgUnits.map((unit) => unit.department_name))}
              reload={load}
            /> : <div className="alert">Debe crear un período institucional en Administración antes de cargar registros.</div>
        ) : (
          <Admin catalogs={catalogs} competencyMatrix={competencyMatrix} orgUnits={orgUnits} needs={periodNeeds} periods={periods} period={activePeriod} currentUserId={session.user.id} reload={load} />
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
        <img className="login-logo" src="/logo-atuntaqui-horizontal.png" alt="Cooperativa Atuntaqui" />
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
function DisabledAccess({ email }: { email: string }) {
  return <div className="center"><div className="login wide"><img className="login-logo" src="/logo-atuntaqui-icon.png" alt="Cooperativa Atuntaqui" /><h1>Acceso inactivo</h1><p>El usuario {email} se encuentra inactivo o eliminado. Sus registros históricos se conservan, pero no puede ingresar al Sistema de Gestión Integral de Capacitación.</p><button className="primary" onClick={() => supabase!.auth.signOut()}>Cerrar sesión</button></div></div>;
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
        <img className="login-logo" src="/logo-atuntaqui-horizontal.png" alt="Cooperativa Atuntaqui" />
        <h1>{forgot ? "Recuperar contraseña" : "Sistema de Gestión Integral de Capacitación"}</h1>
        <p>
          {forgot
            ? "Ingrese su correo para recibir un enlace seguro."
            : "Detección de Necesidades de Capacitación (DNC)"}
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
  role,
  trainingRecords,
  budgetAllocations,
  periodName,
}: {
  needs: Need[];
  totalHours: number;
  budget: number;
  role: Role;
  trainingRecords: TrainingRecord[];
  budgetAllocations: BudgetAllocation[];
  periodName: string;
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
      {role === "admin" && (
        <BudgetSummary records={trainingRecords} budgets={budgetAllocations} plans={needs} periodName={periodName} />
      )}
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
    <CollapsibleTable>
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
            <th>Inicio planificado</th>
            <th>Fin planificado</th>
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
              <td>{n.planned_start_date ?? n.planned_date ?? "—"}</td>
              <td>{n.planned_end_date ?? n.planned_date ?? "—"}</td>
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
    </CollapsibleTable>
  );
}
function NeedForm({
  catalogs,
  competencyMatrix,
  orgUnits,
  profile,
  onDone,
  userId,
  periodId,
  period,
  initialNeed,
  onCancel,
}: {
  catalogs: Catalog[];
  competencyMatrix: CompetencyMatrixRow[];
  orgUnits: OrgUnit[];
  profile: Profile | null;
  onDone: () => void | Promise<void>;
  userId: string;
  periodId?: string;
  period?: PlanningPeriod;
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
        planned_start_date: initialNeed.planned_start_date ?? initialNeed.planned_date ?? "",
        planned_end_date: initialNeed.planned_end_date ?? initialNeed.planned_date ?? "",
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
  const normKey = (value: string) => value.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  const matrixForDepartment = competencyMatrix.filter((row) => row.active && normKey(row.department) === normKey(f.department));
  const factorOptions = unique(matrixForDepartment.map((row) => row.factor));
  const competencyOptions = unique(matrixForDepartment.filter((row) => normKey(row.factor) === normKey(f.factor)).map((row) => row.competency));
  if (f.factor && !factorOptions.some((value) => normKey(value) === normKey(f.factor))) factorOptions.push(f.factor);
  if (f.competency && !competencyOptions.some((value) => normKey(value) === normKey(f.competency))) competencyOptions.push(f.competency);
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
  function setStartDate(value: string) {
    const month = value ? Number(value.slice(5, 7)) : 0;
    setF((x) => ({
      ...x,
      planned_start_date: value,
      planned_end_date: x.planned_end_date && x.planned_end_date >= value ? x.planned_end_date : value,
      quarter: month ? `Q${Math.ceil(month / 3)}` : x.quarter,
    }));
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!f.planned_start_date || !f.planned_end_date) {
      setError("Las fechas planificadas de inicio y fin son obligatorias.");
      return;
    }
    if (f.planned_end_date < f.planned_start_date) {
      setError("La fecha planificada de fin no puede ser anterior a la fecha de inicio.");
      return;
    }
    if (period && (f.planned_start_date < period.start_date || f.planned_end_date > period.end_date)) {
      setError(`Las fechas planificadas deben estar dentro del período ${period.name}: ${period.start_date} a ${period.end_date}.`);
      return;
    }
    setSaving(true);
    const values = { ...f, planned_date: f.planned_start_date, planned_start_date: f.planned_start_date, planned_end_date: f.planned_end_date };
    const { error } = initialNeed
      ? await supabase!
          .from("training_needs")
          .update(values)
          .eq("id", initialNeed.id)
      : await supabase!.from("training_needs").insert({
          ...values,
          owner_id: userId,
          period_id: periodId || null,
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
          Vincule la brecha con una competencia, resultado esperado y evidencia.{period ? ` Período: ${period.name}.` : ""}
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
          values={factorOptions.length ? factorOptions : opts("factor")}
          onChange={(v) => setF((current) => ({ ...current, factor: v, competency: "" }))}
          required
        />
        <Select
          label="Competencia a desarrollar"
          value={f.competency}
          onChange={(v) => set("competency", v)}
          values={competencyOptions.length ? competencyOptions : opts("competency")}
          required
        />
        <Input
          label="Brecha identificada / Necesidad identificada"
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
              factor: "",
              competency: "",
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
            setF((x) => ({ ...x, area: v, department: "", factor: "", competency: "" }))
          }
          required
          disabled={structureLocked}
        />
        <Select
          label="Departamento"
          value={f.department}
          values={departments}
          onChange={(v) => setF((x) => ({ ...x, department: v, factor: "", competency: "" }))}
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
          label="Indicador"
          value={f.indicator}
          onChange={(v) => set("indicator", v)}
          required
        />
        <Input
          label="Meta esperada"
          value={f.goal}
          onChange={(v) => set("goal", v)}
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
          label="Fecha planificada de inicio"
          type="date"
          min={period?.start_date}
          max={period?.end_date}
          value={f.planned_start_date}
          onChange={setStartDate}
          required
        />
        <Input
          label="Fecha planificada de fin"
          type="date"
          min={f.planned_start_date || period?.start_date}
          max={period?.end_date}
          value={f.planned_end_date}
          onChange={(v) => set("planned_end_date", v)}
          required
        />
        <Select
          label="Trimestre"
          value={f.quarter}
          values={["Q1", "Q2", "Q3", "Q4"]}
          onChange={(v) => set("quarter", v)}
          disabled={Boolean(f.planned_start_date)}
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
  max,
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
  max?: string;
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
        max={max}
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
  competencyMatrix,
  orgUnits,
  profile,
  userId,
  period,
}: {
  needs: Need[];
  role: Role;
  reload: () => Promise<void>;
  catalogs: Catalog[];
  competencyMatrix: CompetencyMatrixRow[];
  orgUnits: OrgUnit[];
  profile: Profile | null;
  userId: string;
  period?: PlanningPeriod;
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
        competencyMatrix={competencyMatrix}
        orgUnits={orgUnits}
        profile={profile}
        userId={userId}
        initialNeed={editing}
        period={period}
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
function PeriodManager({ periods, reload }: { periods: PlanningPeriod[]; reload: () => Promise<void> }) {
  const currentYear = new Date().getFullYear();
  const [name, setName] = useState(String(currentYear + 1));
  const [startDate, setStartDate] = useState(`${currentYear + 1}-01-01`);
  const [endDate, setEndDate] = useState(`${currentYear + 1}-12-31`);
  const [drafts, setDrafts] = useState<Record<string, Pick<PlanningPeriod, "name" | "start_date" | "end_date" | "active">>>({});
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  async function createPeriod(e: FormEvent) {
    e.preventDefault();
    if (endDate < startDate) { setMessage("La fecha final no puede ser anterior a la fecha inicial."); return; }
    if (periods.some((period) => startDate <= period.end_date && endDate >= period.start_date)) { setMessage("El rango se superpone con un período existente. Ajuste las fechas antes de guardar."); return; }
    const { error } = await supabase!.from("planning_periods").insert({ name: name.trim(), start_date: startDate, end_date: endDate, active: true });
    setMessage(error?.message ?? "Período creado correctamente.");
    if (!error) await reload();
  }
  const draft = (period: PlanningPeriod) => drafts[period.id] ?? { name: period.name, start_date: period.start_date, end_date: period.end_date, active: period.active };
  function change(period: PlanningPeriod, values: Partial<ReturnType<typeof draft>>) {
    setDrafts((all) => ({ ...all, [period.id]: { ...draft(period), ...values } }));
  }
  async function saveAll() {
    const entries = Object.entries(drafts);
    if (!entries.length) return;
    const invalid = entries.find(([, value]) => !value.name.trim() || value.end_date < value.start_date);
    if (invalid) { setMessage("Revise nombres y rangos: ningún período puede terminar antes de iniciar."); return; }
    const effective = periods.map((period) => ({ id: period.id, ...draft(period) }));
    const overlap = effective.some((period, index) => effective.some((other, otherIndex) => index < otherIndex && period.start_date <= other.end_date && period.end_date >= other.start_date));
    if (overlap) { setMessage("Existen períodos con fechas superpuestas. Corrija los rangos antes de guardar."); return; }
    setSaving(true);
    const results = await Promise.all(entries.map(([id, value]) => supabase!.from("planning_periods").update({ ...value, name: value.name.trim() }).eq("id", id)));
    setSaving(false);
    const error = results.find((result) => result.error)?.error;
    setMessage(error?.message ?? `${entries.length} períodos fueron actualizados.`);
    if (!error) { setDrafts({}); await reload(); }
  }
  async function remove(period: PlanningPeriod) {
    if (!window.confirm(`¿Eliminar el período “${period.name}”? Solo será posible si no contiene registros vinculados.`)) return;
    const { error } = await supabase!.from("planning_periods").delete().eq("id", period.id);
    setMessage(error?.message ?? "Período eliminado.");
    if (!error) await reload();
  }
  return <div className="panel period-manager"><div className="panelhead"><div><h2>Períodos institucionales</h2><p>Un mismo período controla levantamiento, presupuesto, ejecución y reportes.</p></div><button className="primary" disabled={!Object.keys(drafts).length || saving} onClick={() => void saveAll()}>{saving ? "Guardando…" : `Guardar todos los cambios (${Object.keys(drafts).length})`}</button></div>
    <form className="inline period-create" onSubmit={createPeriod}><label>Nombre<input value={name} onChange={(e) => setName(e.target.value)} required /></label><label>Desde<input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required /></label><label>Hasta<input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required /></label><button className="primary">Crear período</button></form>
    {message && <div className="statusmsg">{message}</div>}
    <CollapsibleTable><table><thead><tr><th>Nombre</th><th>Desde</th><th>Hasta</th><th>Estado</th><th>Acción</th></tr></thead><tbody>{periods.map((period) => { const value = draft(period); return <tr key={period.id}><td><input value={value.name} onChange={(e) => change(period, { name: e.target.value })} /></td><td><input type="date" value={value.start_date} onChange={(e) => change(period, { start_date: e.target.value })} /></td><td><input type="date" value={value.end_date} onChange={(e) => change(period, { end_date: e.target.value })} /></td><td><button className={value.active ? "tag" : "tag off"} onClick={() => change(period, { active: !value.active })}>{value.active ? "Activo" : "Inactivo"}</button></td><td><button className="secondary danger" onClick={() => void remove(period)}>Eliminar</button></td></tr>; })}</tbody></table></CollapsibleTable>
  </div>;
}

function Admin({
  catalogs,
  competencyMatrix,
  orgUnits,
  needs,
  periods,
  period,
  currentUserId,
  reload,
}: {
  catalogs: Catalog[];
  competencyMatrix: CompetencyMatrixRow[];
  orgUnits: OrgUnit[];
  needs: Need[];
  periods: PlanningPeriod[];
  period?: PlanningPeriod;
  currentUserId: string;
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
    [userDrafts, setUserDrafts] = useState<Record<string, Partial<Profile>>>({}),
    [catalogDrafts, setCatalogDrafts] = useState<Record<string, { name: string; active: boolean }>>({}),
    [savingUsers, setSavingUsers] = useState(false),
    [savingCatalogs, setSavingCatalogs] = useState(false),
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
  const catalogDraft = (catalog: Catalog) => catalogDrafts[catalog.id] ?? { name: catalog.name, active: catalog.active };
  function changeCatalog(catalog: Catalog, changes: Partial<{ name: string; active: boolean }>) {
    setCatalogDrafts((all) => ({ ...all, [catalog.id]: { ...catalogDraft(catalog), ...changes } }));
  }
  async function saveCatalogChanges() {
    const entries = Object.entries(catalogDrafts);
    if (!entries.length) return;
    setSavingCatalogs(true);
    const results = await Promise.all(entries.map(([id, values]) =>
      supabase!.from("catalogs").update({ name: values.name.trim(), active: values.active }).eq("id", id),
    ));
    setSavingCatalogs(false);
    const error = results.find((result) => result.error)?.error;
    setMsg(error?.message ?? `${entries.length} elementos del catálogo fueron guardados.`);
    if (!error) {
      setCatalogDrafts({});
      await reload();
    }
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
  const userDraft = (user: Profile) => userDrafts[user.id] ?? {};
  function changeUser(user: Profile, changes: Partial<Profile>) {
    setUserDrafts((all) => ({ ...all, [user.id]: { ...userDraft(user), ...changes } }));
  }
  async function saveUserChanges() {
    const entries = Object.entries(userDrafts);
    if (!entries.length) return;
    setSavingUsers(true);
    const results = await Promise.all(entries.map(([id, changes]) =>
      supabase!.from("profiles").update({ ...changes, profile_updated_at: new Date().toISOString() }).eq("id", id),
    ));
    setSavingUsers(false);
    const error = results.find((result) => result.error)?.error;
    setMsg(error?.message ?? `${entries.length} usuarios fueron actualizados.`);
    if (!error) {
      setUserDrafts({});
      await loadUsers();
    }
  }
  async function removeUser(user: Profile) {
    if (user.id === currentUserId) { setMsg("No puede eliminar su propio acceso administrativo."); return; }
    if (!window.confirm(`¿Eliminar el acceso de ${user.full_name || user.email}? El perfil y todos sus registros históricos se conservarán.`)) return;
    const { error } = await supabase!.from("profiles").update({ active: false, deleted_at: new Date().toISOString(), deleted_by: currentUserId, profile_updated_at: new Date().toISOString() }).eq("id", user.id);
    setMsg(error?.message ?? "Acceso eliminado. El histórico del usuario se conserva.");
    if (!error) await loadUsers();
  }
  return (
    <>
      <PeriodManager periods={periods} reload={reload} />
      <CompetencyMatrixManager rows={competencyMatrix} reload={reload} />
      <CorrectionRequests needs={needs} users={users} />
      <AdminNeeds needs={needs} period={period} reload={reload} />
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
        <div className="panelhead"><div><h2>Usuarios y accesos</h2><p>Modifique varios usuarios y guarde toda la sección en una sola acción.</p></div><button className="primary" disabled={!Object.keys(userDrafts).length || savingUsers} onClick={() => void saveUserChanges()}>{savingUsers ? "Guardando…" : `Guardar todos los cambios (${Object.keys(userDrafts).length})`}</button></div>
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
        <CollapsibleTable className="users">
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
                      value={(userDraft(user).role as Role | undefined) ?? user.role}
                      onChange={(e) => changeUser(user, { role: e.target.value as Role })}
                    >
                      <option value="user">Usuario</option>
                      <option value="admin">Administrador</option>
                    </select>
                  </td>
                  <td>
                    <button disabled={Boolean(user.deleted_at)}
                      className={((userDraft(user).active as boolean | undefined) ?? user.active) ? "tag" : "tag off"}
                      onClick={() => changeUser(user, { active: !((userDraft(user).active as boolean | undefined) ?? user.active) })}
                    >
                      {user.deleted_at ? "Eliminado" : ((userDraft(user).active as boolean | undefined) ?? user.active) ? "Activo" : "Inactivo"}
                    </button>
                  </td>
                  <td>
                    {user.role === "admin" ? (
                      <span>Toda la organización</span>
                    ) : (
                      <select
                        value={((userDraft(user).can_view_entire_area as boolean | undefined) ?? user.can_view_entire_area) ? "area" : "department"}
                        disabled={!user.onboarding_completed_at}
                        title={!user.onboarding_completed_at ? "El usuario debe completar primero su perfil" : undefined}
                        onChange={(e) =>
                          changeUser(user, {
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
                    <button className="secondary" disabled={Boolean(user.deleted_at)} onClick={() => setEditingUser(user)}>
                      Editar perfil
                    </button>{" "}<button className="secondary danger" disabled={Boolean(user.deleted_at) || user.id === currentUserId} onClick={() => void removeUser(user)}>Eliminar acceso</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CollapsibleTable>
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
        <div className="panelhead"><div><h2>Elementos configurados</h2><p>Edite nombres o estados y guarde la sección completa.</p></div><button className="primary" disabled={!Object.keys(catalogDrafts).length || savingCatalogs} onClick={() => void saveCatalogChanges()}>{savingCatalogs ? "Guardando…" : `Guardar todos los cambios (${Object.keys(catalogDrafts).length})`}</button></div>
        {Object.entries(kinds).map(([k, label]) => (
          <div key={k}>
            <h3>{label}</h3>
            <div className="tags">
              {catalogs
                .filter((c) => c.kind === k)
                .map((c) => (
                  <span className="catalog-item" key={c.id}>
                    <input value={catalogDraft(c).name} onChange={(e) => changeCatalog(c, { name: e.target.value })} aria-label={`Nombre de ${c.name}`} />
                    <button onClick={() => changeCatalog(c, { active: !catalogDraft(c).active })} className={catalogDraft(c).active ? "tag" : "tag off"}>
                      {catalogDraft(c).active ? "Activo" : "Inactivo"}
                    </button>
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
        <CollapsibleTable>
          <table>
            <thead><tr><th>Grupo</th><th>Área</th><th>Departamento</th><th>Fecha de carga</th></tr></thead>
            <tbody>{orgUnits.map((o) => <tr key={o.id}><td>{o.group_name}</td><td>{o.area_name}</td><td>{o.department_name}</td><td>{new Date(o.created_at).toLocaleString("es-EC")}</td></tr>)}</tbody>
          </table>
        </CollapsibleTable>
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
      <CollapsibleTable className="correction-requests">
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
      </CollapsibleTable>
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

function AdminNeeds({ needs, period, reload }: { needs: Need[]; period?: PlanningPeriod; reload: () => Promise<void> }) {
  const [drafts, setDrafts] = useState<Record<string, { competency: string; estimated_cost: number; planned_start_date: string; planned_end_date: string; quarter: string }>>({}),
    [savingAll, setSavingAll] = useState(false),
    [message, setMessage] = useState("");
  const draft = (n: Need) => drafts[n.id] ?? {
    competency: n.competency,
    estimated_cost: Number(n.estimated_cost),
    planned_start_date: n.planned_start_date ?? n.planned_date ?? "",
    planned_end_date: n.planned_end_date ?? n.planned_date ?? "",
    quarter: n.quarter,
  };
  function change(n: Need, values: Partial<ReturnType<typeof draft>>) {
    setDrafts((all) => ({ ...all, [n.id]: { ...draft(n), ...values } }));
  }
  function changeDate(n: Need, value: string) {
    const month = value ? Number(value.slice(5, 7)) : 0;
    change(n, { planned_start_date: value, planned_end_date: draft(n).planned_end_date >= value ? draft(n).planned_end_date : value, quarter: month ? `Q${Math.ceil(month / 3)}` : draft(n).quarter });
  }
  async function saveAll() {
    const entries = Object.entries(drafts);
    if (!entries.length) return;
    if (entries.some(([, d]) => !d.planned_start_date || !d.planned_end_date || d.planned_end_date < d.planned_start_date || (period && (d.planned_start_date < period.start_date || d.planned_end_date > period.end_date)))) {
      setMessage(`Revise las fechas: inicio y fin deben ser válidos y estar dentro del período ${period?.name ?? "seleccionado"}.`);
      return;
    }
    setSavingAll(true);
    const results = await Promise.all(entries.map(([id, d]) =>
      supabase!.from("training_needs").update({ competency: d.competency.trim(), estimated_cost: d.estimated_cost, planned_date: d.planned_start_date, planned_start_date: d.planned_start_date, planned_end_date: d.planned_end_date, quarter: d.quarter }).eq("id", id),
    ));
    setSavingAll(false);
    const error = results.find((result) => result.error)?.error;
    setMessage(error?.message ?? `${entries.length} necesidades fueron guardadas correctamente.`);
    if (!error) {
      setDrafts({});
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
      <div className="panelhead"><div><h2>Temas y presupuesto</h2><p>Edite varios registros y guarde toda la sección. El trimestre se calcula automáticamente.</p></div><button className="primary" disabled={!Object.keys(drafts).length || savingAll} onClick={() => void saveAll()}>{savingAll ? "Guardando…" : `Guardar todos los cambios (${Object.keys(drafts).length})`}</button></div>
      {message && <div className="statusmsg">{message}</div>}
      <CollapsibleTable className="admin-needs"><table>
        <thead><tr><th>Tema / competencia</th><th>Área</th><th>Departamento</th><th>Fecha inicio</th><th>Fecha fin</th><th>Trimestre</th><th>Presupuesto USD</th><th>Acciones</th></tr></thead>
        <tbody>{needs.map((n) => {
          const d = draft(n);
          return <tr key={n.id}>
            <td><input value={d.competency} onChange={(e) => change(n, { competency: e.target.value })} /></td>
            <td>{n.area}</td>
            <td>{n.department}</td>
            <td><input type="date" min={period?.start_date} max={period?.end_date} value={d.planned_start_date} onChange={(e) => changeDate(n, e.target.value)} /></td>
            <td><input type="date" min={d.planned_start_date || period?.start_date} max={period?.end_date} value={d.planned_end_date} onChange={(e) => change(n, { planned_end_date: e.target.value })} /></td>
            <td>{d.quarter}</td>
            <td><input type="number" min="0" step="0.01" value={d.estimated_cost} onChange={(e) => change(n, { estimated_cost: Number(e.target.value) })} /></td>
            <td className="row-actions"><button className="secondary danger" onClick={() => remove(n)}>Eliminar</button></td>
          </tr>;
        })}</tbody>
      </table></CollapsibleTable>
    </div>
  );
}

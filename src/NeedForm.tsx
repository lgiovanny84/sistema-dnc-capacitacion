import { useState } from "react";
import type { FormEvent } from "react";
import { supabase } from "./supabase";
import { Input, Select } from "./FormFields";
import type { Need, Catalog, PlanningPeriod, Profile, OrgUnit } from "./needTypes";
import type { CompetencyMatrixRow } from "./competencyMatrix";
import { planningValues, validatePlanning } from "./needPlanning";

type Props = {
  catalogs: Catalog[]; competencyMatrix: CompetencyMatrixRow[]; orgUnits: OrgUnit[];
  profile: Profile | null; onDone: () => void | Promise<void>; userId: string;
  periodId?: string; period?: PlanningPeriod; initialNeed?: Need; onCancel?: () => void;
};
const norm = (value: string) => value.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
const unique = (values: string[]) => [...new Set(values)].filter(Boolean);

export function NeedForm({ catalogs, competencyMatrix, orgUnits, profile, onDone, userId, periodId, period, initialNeed, onCancel }: Props) {
  const selectedPeriodId = initialNeed?.period_id ?? periodId ?? period?.id;
  const initialForm = {
    type: initialNeed?.type ?? "Interna", factor: initialNeed?.factor ?? "", competency: initialNeed?.competency ?? "",
    gap: initialNeed?.gap ?? "", objective: initialNeed?.objective ?? "", position: initialNeed?.position ?? profile?.position ?? "",
    occupational_group: initialNeed?.occupational_group ?? profile?.occupational_group ?? "",
    area: initialNeed?.area ?? profile?.area ?? "", department: initialNeed?.department ?? profile?.department ?? "",
    participants: initialNeed?.participants ?? 1, goal: initialNeed?.goal ?? "", indicator: initialNeed?.indicator ?? "",
    evidence: initialNeed?.evidence ?? "", priority: initialNeed?.priority ?? "Media", priority_reason: initialNeed?.priority_reason ?? "",
    planned_start_date: initialNeed?.planned_start_date ?? initialNeed?.planned_date ?? "",
    planned_end_date: initialNeed?.planned_end_date ?? initialNeed?.planned_date ?? "",
    hours: initialNeed?.hours == null ? "" : String(initialNeed.hours),
    estimated_cost: initialNeed?.estimated_cost == null ? "" : String(initialNeed.estimated_cost),
    modality: initialNeed?.modality ?? "", provider: initialNeed?.provider ?? "", observations: initialNeed?.observations ?? "",
  };
  const [f, setF] = useState(initialForm), [saving, setSaving] = useState(false), [error, setError] = useState("");
  const [planningOpen, setPlanningOpen] = useState(false);
  const set = (key: keyof typeof f, value: string | number) => setF(current => ({ ...current, [key]: value }));
  const opts = (kind: string) => catalogs.filter(c => c.kind === kind && c.active).map(c => c.name);
  const departmentMatrix = competencyMatrix.filter(row => row.active && norm(row.department) === norm(f.department));
  const factors = unique(departmentMatrix.map(row => row.factor));
  const competencies = unique(departmentMatrix.filter(row => norm(row.factor) === norm(f.factor)).map(row => row.competency));
  if (f.factor && !factors.some(value => norm(value) === norm(f.factor))) factors.push(f.factor);
  if (f.competency && !competencies.some(value => norm(value) === norm(f.competency))) competencies.push(f.competency);
  const locked = profile?.role !== "admin";
  const justificationRequired = !initialNeed || Boolean(initialNeed.priority_reason) || initialNeed.priority !== f.priority;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setError("");
    if (![f.factor, f.competency, f.gap, f.objective, f.position, f.indicator, f.goal, f.evidence].every(value => value.trim()) || (justificationRequired && !f.priority_reason.trim())) {
      setError("Complete los campos esenciales con información concreta; no se admiten espacios vacíos."); return;
    }
    if (!Number.isInteger(f.participants) || f.participants < 1) { setError("Ingrese un número entero de participantes mayor que cero."); return; }
    if (!f.department || !f.area || !f.occupational_group || !selectedPeriodId) { setError("Revise el departamento asignado y el período seleccionado."); return; }
    const planningError = validatePlanning(f, period);
    if (planningError) { setPlanningOpen(true); setError(planningError); return; }
    setSaving(true);
    try {
      const values = { ...f, ...planningValues(f), gap: f.gap.trim(), objective: f.objective.trim(), position: f.position.trim(),
        indicator: f.indicator.trim(), goal: f.goal.trim(), evidence: f.evidence.trim(), priority_reason: f.priority_reason.trim() };
      const result = initialNeed
        ? await supabase!.from("training_needs").update(values).eq("id", initialNeed.id).select("id").maybeSingle()
        : await supabase!.from("training_needs").insert({ ...values, owner_id: userId, period_id: selectedPeriodId, status: "Pendiente" }).select("id").single();
      if (result.error) setError(result.error.message);
      else if (!result.data) setError("No se pudo guardar el registro. Revise sus permisos.");
      else await onDone();
    } catch { setError("No fue posible completar el guardado. Revise la conexión y vuelva a intentarlo."); }
    finally { setSaving(false); }
  }

  return <form className="panel form need-form" onSubmit={submit} onInvalidCapture={event => { if ((event.target as HTMLElement).closest(".need-planning")) setPlanningOpen(true); }}>
    <div className="need-intro"><span className="eyebrow">DETECCIÓN DE NECESIDADES DE CAPACITACIÓN (DNC)</span>
      <h2>{initialNeed ? "Modificar necesidad de capacitación" : "Nueva necesidad de capacitación"}</h2>
      <p>Describa el problema, a quién afecta y el resultado que espera lograr.</p></div>
    <dl className="need-context">
      <div><dt>Período</dt><dd>{period?.name ?? "Sin período"}</dd></div>
      <div><dt>Departamento</dt><dd>{f.department || "Sin asignar"}</dd></div>
      <div><dt>Área</dt><dd>{f.area || "Sin asignar"}</dd></div>
      <div><dt>Grupo ocupacional</dt><dd>{f.occupational_group || "Sin asignar"}</dd></div>
    </dl>
    {!locked && <details className="need-assignment"><summary>Cambiar asignación organizacional</summary><div className="fields">
      <Select label="Grupo ocupacional" value={f.occupational_group} values={unique(orgUnits.map(o => o.group_name))}
        onChange={value => setF(current => ({ ...current, occupational_group: value, area: "", department: "", factor: "", competency: "" }))} />
      <Select label="Área" value={f.area} values={unique(orgUnits.filter(o => o.group_name === f.occupational_group).map(o => o.area_name))}
        onChange={value => setF(current => ({ ...current, area: value, department: "", factor: "", competency: "" }))} />
      <Select label="Departamento" value={f.department} values={unique(orgUnits.filter(o => o.group_name === f.occupational_group && o.area_name === f.area).map(o => o.department_name))}
        onChange={value => setF(current => ({ ...current, department: value, factor: "", competency: "" }))} />
    </div></details>}
    <div className="need-essential">
      <section className="need-block"><h3><span>01</span> Factor y competencia</h3><p>Seleccione la competencia que necesita fortalecer en su departamento.</p><div className="fields">
        <Select label="Factor" value={f.factor} values={factors.length ? factors : opts("factor")} onChange={value => setF(current => ({ ...current, factor: value, competency: "" }))} required />
        <Select label="Competencia a desarrollar" value={f.competency} values={competencies.length ? competencies : departmentMatrix.length ? [] : opts("competency")} onChange={value => set("competency", value)} required />
      </div></section>
      <section className="need-block"><h3><span>02</span> Brecha identificada</h3><div className="fields"><label className="full">Brecha identificada / Necesidad identificada
        <textarea value={f.gap} onChange={e => set("gap", e.target.value)} rows={3} required placeholder="¿Qué ocurre actualmente, qué evidencia tiene y cómo afecta al trabajo?" />
        <small>Describa una situación concreta. Talento Humano revisará si la capacitación puede resolverla.</small></label></div></section>
      <section className="need-block"><h3><span>03</span> Beneficiarios</h3><div className="fields">
        <Input label="Cargo beneficiario" value={f.position} list={opts("position")} onChange={value => set("position", value)} required />
        <Input label="N.º de participantes" type="number" min="1" step="1" value={f.participants} onChange={value => set("participants", Number(value))} required />
      </div></section>
      <section className="need-block"><h3><span>04</span> Objetivo de aprendizaje</h3><div className="fields"><label className="full">¿Qué deberán saber hacer después?
        <textarea value={f.objective} onChange={e => set("objective", e.target.value)} rows={2} required placeholder="Ej.: preparar expedientes completos conforme al procedimiento." />
      </label></div></section>
      <div className="need-outcome-pair">
        <section className="need-block"><h3><span>05</span> Indicador</h3><div className="fields"><label className="full">Indicador
          <input value={f.indicator} onChange={e => set("indicator", e.target.value)} required placeholder="Ej.: porcentaje de expedientes devueltos." /><small>La medida que permitirá evaluar la mejora.</small>
        </label></div></section>
        <section className="need-block"><h3><span>06</span> Meta esperada</h3><div className="fields"><label className="full">Meta esperada
          <input value={f.goal} onChange={e => set("goal", e.target.value)} required placeholder="Ej.: reducir del 12 % al 5 % en tres meses." /><small>Incluya el resultado que busca alcanzar y su plazo.</small>
        </label></div></section>
      </div>
      <section className="need-block"><h3><span>07</span> Medio de verificación</h3><div className="fields"><label className="full">Medio de verificación
        <input value={f.evidence} onChange={e => set("evidence", e.target.value)} required placeholder="Ej.: reporte mensual de revisión de expedientes." /><small>Identifique el registro o evidencia que comprobará la meta.</small>
      </label></div></section>
      <section className="need-block"><h3><span>08</span> Prioridad justificada</h3><div className="fields">
        <Select label="Prioridad" value={f.priority} values={["Baja", "Media", "Alta", "Crítica"]} onChange={value => set("priority", value)} required />
        <label>Justificación de prioridad<textarea value={f.priority_reason} onChange={e => set("priority_reason", e.target.value)} rows={2} required={justificationRequired}
          placeholder="¿Qué consecuencia tendría no atender esta necesidad?" />{initialNeed && !initialNeed.priority_reason && <small>Registro anterior: puede completar esta justificación al actualizarlo.</small>}</label>
      </div></section>
    </div>
    <details className="need-planning" open={planningOpen} onToggle={event => setPlanningOpen(event.currentTarget.open)}>
      <summary><span><b>Planificación propuesta</b><small>Opcional en el levantamiento · para completar o validar con Talento Humano</small></span><span className="need-disclosure" aria-hidden="true">⌄</span></summary>
      <div className="need-planning-body"><p>Puede registrar la necesidad sin fechas, horas o costo. Los datos pendientes se mostrarán como «Por planificar» o «Por estimar».</p><div className="fields">
        <Select label="Tipo de capacitación" value={f.type} values={["Interna", "Externa"]} onChange={value => set("type", value)} />
        <Select label="Modalidad" value={f.modality} values={opts("modality")} onChange={value => set("modality", value)} />
        <Input label="Horas por participante" type="number" min="0.01" step="0.01" value={f.hours} onChange={value => set("hours", value)} placeholder="Por estimar" />
        <Input label="Costo estimado (USD)" type="number" min="0" step="0.01" value={f.estimated_cost} onChange={value => set("estimated_cost", value)} placeholder="Por estimar" />
        <Input label="Fecha planificada de inicio" type="date" min={period?.start_date} max={period?.end_date} value={f.planned_start_date} onChange={value => set("planned_start_date", value)} />
        <Input label="Fecha planificada de fin" type="date" min={f.planned_start_date || period?.start_date} max={period?.end_date} value={f.planned_end_date} onChange={value => set("planned_end_date", value)} />
        <Input label="Trimestre" value={f.planned_start_date ? `Trimestre ${Math.ceil(Number(f.planned_start_date.slice(5, 7)) / 3)}` : "Por planificar"} onChange={() => {}} disabled />
        <Input label="Proveedor sugerido" value={f.provider} onChange={value => set("provider", value)} />
        <label className="full">Observaciones<textarea value={f.observations} onChange={e => set("observations", e.target.value)} rows={2} /></label>
      </div></div>
    </details>
    {error && <div className="error" role="alert">{error}</div>}
    <div className="actions"><button type="button" className="secondary" disabled={saving} onClick={() => { if (initialNeed) onCancel?.(); else { setF(initialForm); setPlanningOpen(false); setError(""); } }}>{initialNeed ? "Cancelar" : "Limpiar"}</button>
      <button className="primary" disabled={saving}>{saving ? "Guardando…" : initialNeed ? "Guardar cambios" : "Registrar necesidad"}</button></div>
  </form>;
}

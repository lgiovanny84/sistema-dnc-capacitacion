import type { Need } from "./needTypes";

export type PlanningDraft = {
  planned_start_date: string;
  planned_end_date: string;
  hours: string;
  estimated_cost: string;
};

export function validatePlanning(draft: PlanningDraft, period?: { start_date: string; end_date: string }) {
  const { planned_start_date: start, planned_end_date: end } = draft;
  if (Boolean(start) !== Boolean(end)) return "Complete las dos fechas planificadas o deje ambas pendientes.";
  const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
  if (start && (!validDate(start) || !validDate(end) || end < start))
    return "Revise las fechas: el fin no puede ser anterior al inicio.";
  if (start && period && (start < period.start_date || end > period.end_date))
    return "Las fechas planificadas deben estar dentro del período seleccionado.";
  if (draft.hours.trim() && (!Number.isFinite(Number(draft.hours)) || Number(draft.hours) <= 0))
    return "Las horas por participante deben ser mayores que cero, o quedar por estimar.";
  if (draft.estimated_cost.trim() && (!Number.isFinite(Number(draft.estimated_cost)) || Number(draft.estimated_cost) < 0))
    return "El costo debe ser cero o mayor, o quedar por estimar.";
  return "";
}

export function planningValues(draft: PlanningDraft) {
  return {
    planned_date: draft.planned_start_date || null,
    planned_start_date: draft.planned_start_date || null,
    planned_end_date: draft.planned_end_date || null,
    quarter: draft.planned_start_date ? `Q${Math.ceil(Number(draft.planned_start_date.slice(5, 7)) / 3)}` : null,
    hours: draft.hours.trim() ? Number(draft.hours) : null,
    estimated_cost: draft.estimated_cost.trim() ? Number(draft.estimated_cost) : null,
  };
}

export const needReportColumns = [
  ["created_at", "Fecha y hora de registro"], ["updated_at", "Última actualización"],
  ["type", "Tipo de capacitación"], ["factor", "Factor"], ["competency", "Competencia a desarrollar"],
  ["gap", "Brecha identificada / Necesidad identificada"], ["objective", "Objetivo de aprendizaje"],
  ["position", "Cargo beneficiario"], ["occupational_group", "Grupo ocupacional"],
  ["area", "Área"], ["department", "Departamento"], ["participants", "N.º de participantes"],
  ["hours", "Horas por participante"], ["indicator", "Indicador"], ["goal", "Meta esperada"],
  ["evidence", "Medio de verificación"], ["priority", "Prioridad"], ["priority_reason", "Justificación de prioridad"],
  ["planned_start_date", "Fecha planificada de inicio"], ["planned_end_date", "Fecha planificada de fin"],
  ["quarter", "Trimestre"], ["modality", "Modalidad"], ["estimated_cost", "Costo estimado (USD)"],
  ["provider", "Proveedor sugerido"], ["observations", "Observaciones"], ["status", "Estado"],
] as const satisfies ReadonlyArray<readonly [keyof Need, string]>;

export function needReportValue(need: Need, key: keyof Need) {
  const value = need[key];
  if (value == null && (key === "hours" || key === "estimated_cost")) return "Por estimar";
  if (key === "quarter") return value ? `Trimestre ${String(value).replace("Q", "")}` : "Por planificar";
  if (key === "planned_start_date" || key === "planned_end_date") return value ?? need.planned_date ?? "Por planificar";
  if ((key === "created_at" || key === "updated_at") && value)
    return new Date(String(value)).toLocaleString("es-EC", { timeZone: "America/Guayaquil" });
  return value ?? "";
}

import type { Need } from "./needTypes";
export const reviewFields = [
  ["factor", "Factor", "Levantamiento"], ["competency", "Competencia", "Levantamiento"],
  ["gap", "Brecha identificada", "Levantamiento"], ["objective", "Objetivo", "Levantamiento"],
  ["position", "Cargo beneficiario", "Levantamiento"], ["area", "Área", "Levantamiento"],
  ["department", "Departamento", "Levantamiento"], ["occupational_group", "Grupo ocupacional", "Levantamiento"],
  ["participants", "Participantes", "Levantamiento"], ["evidence", "Medio de verificación", "Levantamiento"],
  ["priority_reason", "Justificación de prioridad", "Levantamiento"],
  ["indicator", "Indicador", "Planificación"], ["goal", "Meta esperada", "Planificación"],
  ["planned_start_date", "Fecha de inicio", "Planificación"], ["planned_end_date", "Fecha de fin", "Planificación"],
  ["hours", "Horas", "Planificación"], ["estimated_cost", "Costo estimado", "Planificación"],
  ["modality", "Modalidad", "Planificación"],
] as const satisfies ReadonlyArray<readonly [keyof Need, string, string]>;
export const normalizeGroup = (value: unknown) => String(value ?? "").trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").toUpperCase();
// These two spellings refer to the same group, confirmed by the administrator.
// Keep source records intact; this canonical name is for budget presentation.
function budgetGroupName(value: string) {
  const label = value.trim().replace(/\s+/g, " ") || "Sin grupo ocupacional";
  return /^ASAMBLEA DE REPRESENTANTES?$/.test(normalizeGroup(label)) ? "ASAMBLEA DE REPRESENTANTES" : label;
}
export function missingNeedFields(need: Need) {
  return reviewFields.filter(([key]) => {
    const value = key === "planned_start_date" || key === "planned_end_date" ? need[key] || need.planned_date : need[key];
    if (key === "estimated_cost") return value == null || value === "" || !Number.isFinite(Number(value)) || Number(value) < 0;
    if (key === "hours") return value == null || value === "" || !Number.isFinite(Number(value)) || Number(value) <= 0;
    if (key === "participants") return !Number.isInteger(Number(value)) || Number(value) < 1;
    return !String(value ?? "").trim();
  });
}
export function budgetByOccupationalGroup(needs: Need[], configuredGroups: string[] = []) {
  const grouped = new Map<string, { name: string; cents: number; activities: number; known: number; pending: number }>();
  const get = (name: string) => {
    const label = budgetGroupName(name);
    const key = normalizeGroup(label);
    if (!grouped.has(key)) grouped.set(key, { name: label, cents: 0, activities: 0, known: 0, pending: 0 });
    return grouped.get(key)!;
  };
  configuredGroups.filter(value => value.trim()).forEach(get);
  for (const need of needs) {
    const group = get(need.occupational_group || "");
    group.activities++;
    if (need.estimated_cost == null || !String(need.estimated_cost).trim() || !Number.isFinite(Number(need.estimated_cost)) || Number(need.estimated_cost) < 0) group.pending++;
    else { group.cents += Math.round(Number(need.estimated_cost) * 100); group.known++; }
  }
  return [...grouped.values()].sort((a, b) => b.cents - a.cents || a.name.localeCompare(b.name, "es")).map(group => ({ ...group, amount: group.cents / 100 }));
}

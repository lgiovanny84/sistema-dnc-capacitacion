import type { CompetencyMatrixRow } from "./competencyMatrix";
import type { Need } from "./needTypes";

export const normalizeMatrix = (value: unknown) => String(value ?? "").trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
export type MatrixValues = Pick<CompetencyMatrixRow, "area" | "department" | "group_name" | "factor" | "competency" | "description" | "active">;
export type MatrixChange = { action: "save"; value: MatrixValues } | { action: "delete" };
export const matrixKey = (row: Pick<MatrixValues, "department" | "factor" | "competency">) => JSON.stringify([row.department, row.factor, row.competency].map(normalizeMatrix));
export function matrixValues(row: MatrixValues): MatrixValues {
  return { area: row.area.trim(), department: row.department.trim(), group_name: row.group_name.trim(), factor: row.factor.trim(), competency: row.competency.trim(), description: row.description.trim(), active: row.active };
}
export function validateMatrix(rows: MatrixValues[]): string | null {
  const seen = new Set<string>();
  for (const row of rows) {
    if (![row.area, row.department, row.group_name, row.factor, row.competency].every(value => value.trim())) return "Complete área, departamento, grupo ocupacional, factor y competencia.";
    const key = matrixKey(row);
    if (seen.has(key)) return `Ya existe la competencia «${row.competency}» para ese departamento y factor. Edite la relación existente.`;
    seen.add(key);
  }
  return null;
}

// The matrix describes beneficiaries, not the user's authorization or profile.
// Resolve only an exact, unambiguous active organizational relationship.
export function competencyGroup(rows: CompetencyMatrixRow[], selection: Pick<Need, "area" | "department" | "factor" | "competency">): string | null {
  const fields = ["area", "department", "factor", "competency"] as const;
  if (fields.some(field => !normalizeMatrix(selection[field]))) return null;
  const groups = new Map<string, string>();
  for (const row of rows) {
    if (row.active && fields.every(field => normalizeMatrix(row[field]) === normalizeMatrix(selection[field])) && row.group_name.trim()) groups.set(normalizeMatrix(row.group_name), row.group_name.trim());
  }
  return groups.size === 1 ? [...groups.values()][0] : null;
}
export function needWithCompetencyGroup(need: Need, rows: CompetencyMatrixRow[]): Need {
  const group = competencyGroup(rows, need);
  return group && group !== need.occupational_group ? { ...need, occupational_group: group } : need;
}

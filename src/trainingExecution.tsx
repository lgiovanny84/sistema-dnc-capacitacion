import { FormEvent, useMemo, useState } from "react";
import type { CellValue, Workbook } from "exceljs";
import { supabase } from "./supabase";

export type TrainingRecord = {
  id: string;
  period_id: string | null;
  name: string;
  gender: string;
  position: string;
  requesting_area: string;
  office: string;
  topic: string;
  company: string;
  start_date: string | null;
  end_date: string | null;
  duration: number;
  location: string;
  cost: number;
  status: string;
  justification_criterion: string;
  modality: string;
  area: string;
  department: string;
  level: string;
  occupational_group: string;
  knowledge_area: string;
  source_filename: string;
  source_row_hash: string;
  uploaded_at: string;
  uploaded_by: string;
  import_batch_id: string | null;
};

export type ImportBatch = {
  id: string;
  period_id: string | null;
  period_name: string;
  period_start: string;
  period_end: string;
  source_filename: string;
  row_count: number;
  uploaded_at: string;
  uploaded_by: string;
};

export type BudgetAllocation = {
  id: string;
  period_id: string | null;
  year: number;
  department_name: string;
  requesting_area_name: string | null;
  allocated_budget: number;
  bank_hours: number;
  created_at: string;
  updated_at: string;
};

export type TrainingPlan = {
  id: string;
  period_id: string | null;
  department: string;
  estimated_cost: number;
  hours: number;
  participants: number;
  planned_date: string | null;
  created_at: string;
};

export const TRAINING_HEADERS = [
  "NOMBRE",
  "GENERO",
  "CARGO",
  "AREA REQUIRIENTE",
  "OFICINA",
  "TEMA",
  "EMPRESA",
  "FECHA INICIO",
  "FECHA FIN",
  "DURACION",
  "LUGAR",
  "COSTO",
  "ESTADO",
  "CRITERIO JUSTIFICACION",
  "MODALIDAD",
  "ÁREA",
  "DEPARTAMENTO",
  "NIVEL",
  "GRUPO OCUPACIONAL",
  "ÁREA DE CONOCIMIENTO",
] as const;

const fields: Record<(typeof TRAINING_HEADERS)[number], keyof TrainingRecord> = {
  NOMBRE: "name",
  GENERO: "gender",
  CARGO: "position",
  "AREA REQUIRIENTE": "requesting_area",
  OFICINA: "office",
  TEMA: "topic",
  EMPRESA: "company",
  "FECHA INICIO": "start_date",
  "FECHA FIN": "end_date",
  DURACION: "duration",
  LUGAR: "location",
  COSTO: "cost",
  ESTADO: "status",
  "CRITERIO JUSTIFICACION": "justification_criterion",
  MODALIDAD: "modality",
  "ÁREA": "area",
  DEPARTAMENTO: "department",
  NIVEL: "level",
  "GRUPO OCUPACIONAL": "occupational_group",
  "ÁREA DE CONOCIMIENTO": "knowledge_area",
};

const norm = (value: unknown) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");

const money = (value: number) =>
  Number(value || 0).toLocaleString("es-EC", {
    style: "currency",
    currency: "USD",
  });

function numberValue(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const clean = String(value ?? "")
    .replace(/[$\s]/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".");
  const parsed = Number(clean);
  return Number.isFinite(parsed) ? parsed : 0;
}

function dateValue(value: unknown) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime()))
    return value.toISOString().slice(0, 10);
  if (typeof value === "number") {
    const excelDate = new Date(Date.UTC(1899, 11, 30) + Math.round(value * 86400000));
    if (!Number.isNaN(excelDate.getTime())) return excelDate.toISOString().slice(0, 10);
  }
  const text = String(value).trim();
  const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/);
  if (iso) return validDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  const latin = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (latin) return validDate(Number(latin[3]), Number(latin[2]), Number(latin[1]));
  return null;
}

function validDate(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function excelValue(value: CellValue): unknown {
  if (value === null || value === undefined) return "";
  if (value instanceof Date || typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  if ("result" in value) return value.result ?? "";
  if ("richText" in value) return value.richText.map((part) => part.text).join("");
  if ("text" in value) return value.text;
  return String(value);
}

async function saveWorkbook(workbook: Workbook, filename: string) {
  const buffer = await workbook.xlsx.writeBuffer();
  const href = URL.createObjectURL(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const link = document.createElement("a");
  link.href = href;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(href);
}

function rowHash(values: unknown[]) {
  const source = values.map(norm).join("|");
  let hash = 2166136261;
  for (let i = 0; i < source.length; i += 1) {
    hash ^= source.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `tr-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function isCompleted(status: string) {
  return !["CANCELADO", "CANCELADA", "ANULADO", "ANULADA", "RECHAZADO", "RECHAZADA"].includes(norm(status));
}

function recordYear(record: TrainingRecord) {
  return Number(record.start_date?.slice(0, 4) || 0);
}

function usedForDepartment(records: TrainingRecord[], department: string) {
  return records.filter(
    (r) => norm(r.requesting_area) === norm(department) && isCompleted(r.status),
  );
}

export function BudgetSummary({ records, budgets, plans, periodName }: { records: TrainingRecord[]; budgets: BudgetAllocation[]; plans: TrainingPlan[]; periodName: string }) {
  const mappings = new Map(budgets.map((budget) => [norm(budget.department_name), budget]));
  const annual = [...plans.filter((plan) => plan.department.trim()).reduce((grouped, plan) => {
    const key = norm(plan.department);
    const current = grouped.get(key) ?? { id: key, department_name: plan.department.trim(), requesting_area_name: null as string | null, allocated_budget: 0, bank_hours: 0 };
    current.allocated_budget += Number(plan.estimated_cost);
    current.bank_hours += Number(plan.hours) * Number(plan.participants);
    grouped.set(key, current);
    return grouped;
  }, new Map<string, { id: string; department_name: string; requesting_area_name: string | null; allocated_budget: number; bank_hours: number }>()).values()].map((line) => ({ ...line, requesting_area_name: mappings.get(norm(line.department_name))?.requesting_area_name || null }));
  const assigned = annual.reduce((sum, b) => sum + Number(b.allocated_budget), 0);
  const bank = annual.reduce((sum, b) => sum + Number(b.bank_hours), 0);
  const relevantKeys = new Set(annual.map((b) => norm(b.requesting_area_name || b.department_name)));
  const usedRows = records.filter((r) => isCompleted(r.status) && relevantKeys.has(norm(r.requesting_area)));
  const used = usedRows.reduce((sum, r) => sum + Number(r.cost), 0);
  const fulfilled = usedRows.reduce((sum, r) => sum + Number(r.duration), 0);
  const unmatched = [...new Set(records.filter((r) => isCompleted(r.status) && !relevantKeys.has(norm(r.requesting_area))).map((r) => r.requesting_area).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es"));
  return (
    <>
      <section className="cards budget-cards">
        <Metric label="Valor presupuestado" value={money(assigned)} />
        <Metric label="Valor utilizado" value={money(used)} />
        <Metric label="Saldo disponible" value={money(assigned - used)} />
        <Metric label="Banco de horas" value={bank.toLocaleString("es-EC")} />
        <Metric label="Horas cumplidas" value={fulfilled.toLocaleString("es-EC")} />
        <Metric label="Cumplimiento de horas" value={bank ? `${Math.min(999, (fulfilled / bank) * 100).toFixed(1)}%` : "0%"} />
      </section>
      {annual.length > 0 && (
        <div className="panel budget-summary">
          <div className="panelhead"><div><h2>Ejecución presupuestaria y banco de horas · {periodName}</h2><p>Presupuesto y horas: Módulo 1. Gasto y duración: Excel ejecutado.</p></div><span>DEPARTAMENTO ↔ AREA REQUIRIENTE</span></div>
          <div className="table"><table>
            <thead><tr><th>Departamento</th><th>Área requiriente cruzada</th><th>Presupuestado</th><th>Gastado</th><th>Saldo</th><th>Horas presupuestadas</th><th>Horas cargadas</th><th>% presupuesto</th><th>% horas</th></tr></thead>
            <tbody>{annual.map((b) => {
              const crossName = b.requesting_area_name || b.department_name;
              const rows = usedForDepartment(records, crossName);
              const usedBudget = rows.reduce((s, r) => s + Number(r.cost), 0);
              const hours = rows.reduce((s, r) => s + Number(r.duration), 0);
              return <tr key={b.id}><td><b>{b.department_name}</b></td><td>{crossName}{norm(crossName) === norm(b.department_name) ? <small className="cross-mode">Automático</small> : <small className="cross-mode override">Recategorizado</small>}</td><td>{money(b.allocated_budget)}</td><td>{money(usedBudget)}</td><td>{money(Number(b.allocated_budget) - usedBudget)}</td><td>{Number(b.bank_hours).toLocaleString("es-EC")}</td><td>{hours.toLocaleString("es-EC")}</td><td>{b.allocated_budget ? `${((usedBudget / Number(b.allocated_budget)) * 100).toFixed(1)}%` : "0%"}</td><td>{b.bank_hours ? `${((hours / Number(b.bank_hours)) * 100).toFixed(1)}%` : "0%"}</td></tr>;
            })}</tbody>
          </table></div>
        </div>
      )}
      {unmatched.length > 0 && <div className="alert budget-warning"><div><b>Registros ejecutados sin departamento presupuestado</b><p>Estas AREA REQUIRIENTE del Excel no coinciden con un DEPARTAMENTO del Módulo 1: {unmatched.join(", ")}. Puede recategorizarlas en “Reglas de cruce”.</p></div></div>}
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="card"><small>{label}</small><strong>{value}</strong></div>;
}

export function TrainingExecutionModule({
  records,
  budgets,
  plans,
  batches,
  period,
  departments,
  reload,
}: {
  records: TrainingRecord[];
  budgets: BudgetAllocation[];
  plans: TrainingPlan[];
  batches: ImportBatch[];
  period: { id: string; name: string; start_date: string; end_date: string };
  departments: string[];
  reload: () => Promise<void>;
}) {
  const [section, setSection] = useState<"dashboard" | "import" | "budget" | "report">("dashboard");
  return (
    <>
      <div className="panel module-tabs">
        <div><h2>Capacitación ejecutada</h2><p>Base histórica, presupuesto, banco de horas y análisis estratégico.</p></div>
        <div className="actions">
          {(["dashboard", "import", "budget", "report"] as const).map((id) => <button key={id} className={section === id ? "primary" : "secondary"} onClick={() => setSection(id)}>{id === "dashboard" ? "Dashboard" : id === "import" ? "Cargar Excel" : id === "budget" ? "Presupuesto y horas" : "Reportes"}</button>)}
        </div>
      </div>
      {section === "dashboard" && <ExecutionDashboard records={records} budgets={budgets} plans={plans} periodName={period.name} />}
      {section === "import" && <ExcelImporter records={records} batches={batches} period={period} reload={reload} />}
      {section === "budget" && <BudgetManager records={records} budgets={budgets} plans={plans} departments={departments} period={period} reload={reload} />}
      {section === "report" && <ExecutionReport records={records} batches={batches} periodName={period.name} />}
    </>
  );
}

function ExcelImporter({ records, batches, period, reload }: { records: TrainingRecord[]; batches: ImportBatch[]; period: { id: string; name: string; start_date: string; end_date: string }; reload: () => Promise<void> }) {
  const [rows, setRows] = useState<Omit<TrainingRecord, "id" | "period_id" | "uploaded_at" | "uploaded_by" | "import_batch_id">[]>([]);
  const [filename, setFilename] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const known = useMemo(() => new Set(records.map((r) => r.source_row_hash)), [records]);

  async function readFile(file?: File) {
    if (!file) return;
    setMessage("");
    setRows([]);
    setFilename(file.name);
    try {
      const ExcelJS = (await import("exceljs")).default;
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(await file.arrayBuffer());
      const sheet = workbook.worksheets[0];
      if (!sheet || sheet.rowCount < 1) throw new Error("El archivo no contiene datos.");
      const actual: string[] = [];
      sheet.getRow(1).eachCell({ includeEmpty: true }, (cell, column) => { actual[column - 1] = norm(excelValue(cell.value)); });
      const positions = TRAINING_HEADERS.map((header) => actual.indexOf(norm(header)));
      const missing = TRAINING_HEADERS.filter((_, index) => positions[index] < 0);
      if (missing.length) throw new Error(`Faltan cabeceras obligatorias: ${missing.join(", ")}.`);
      const parsed = [] as Omit<TrainingRecord, "id" | "period_id" | "uploaded_at" | "uploaded_by" | "import_batch_id">[];
      const invalidDates: string[] = [];
      for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
        const row = sheet.getRow(rowNumber);
        const original = TRAINING_HEADERS.map((_, index) => excelValue(row.getCell(positions[index] + 1).value));
        if (!original.some((value) => String(value).trim())) continue;
        const base: Record<string, unknown> = {};
        TRAINING_HEADERS.forEach((header, index) => { base[fields[header]] = original[index]; });
        const startDate = dateValue(base.start_date);
        const endDate = dateValue(base.end_date);
        if ((String(base.start_date ?? "").trim() && !startDate) || (String(base.end_date ?? "").trim() && !endDate)) {
          invalidDates.push(`fila ${rowNumber}: formato de fecha no reconocido`);
        } else if (startDate && endDate && endDate < startDate) {
          invalidDates.push(`fila ${rowNumber}: FECHA FIN ${endDate} es anterior a FECHA INICIO ${startDate}`);
        }
        parsed.push({
          name: String(base.name ?? "").trim(), gender: String(base.gender ?? "").trim(), position: String(base.position ?? "").trim(), requesting_area: String(base.requesting_area ?? "").trim(), office: String(base.office ?? "").trim(), topic: String(base.topic ?? "").trim(), company: String(base.company ?? "").trim(),
          start_date: startDate, end_date: endDate, duration: numberValue(base.duration), location: String(base.location ?? "").trim(), cost: numberValue(base.cost), status: String(base.status ?? "").trim(), justification_criterion: String(base.justification_criterion ?? "").trim(), modality: String(base.modality ?? "").trim(), area: String(base.area ?? "").trim(), department: String(base.department ?? "").trim(), level: String(base.level ?? "").trim(), occupational_group: String(base.occupational_group ?? "").trim(), knowledge_area: String(base.knowledge_area ?? "").trim(), source_filename: file.name, source_row_hash: rowHash(original),
        });
      }
      if (invalidDates.length) {
        const detail = invalidDates.slice(0, 10).join("; ");
        throw new Error(`${invalidDates.length} filas contienen fechas inválidas: ${detail}${invalidDates.length > 10 ? "; …" : ""}. Corrija FECHA INICIO y FECHA FIN en el Excel.`);
      }
      const invalid = parsed.filter((row) => !row.name || !row.topic || !row.requesting_area || row.duration < 0 || row.cost < 0);
      if (invalid.length) throw new Error(`${invalid.length} filas no tienen NOMBRE, TEMA o AREA REQUIRIENTE, o contienen valores negativos.`);
      setRows(parsed);
      setMessage(`${parsed.length} filas válidas. ${parsed.filter((r) => known.has(r.source_row_hash)).length} ya existen y se omitirán.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No fue posible leer el archivo.");
    }
  }

  async function upload() {
    if (!rows.length) return;
    const outside = rows.filter((row) => row.start_date && (row.start_date < period.start_date || row.start_date > period.end_date));
    if (outside.length) {
      setMessage(`${outside.length} filas tienen FECHA INICIO fuera del período ${period.name} (${period.start_date} a ${period.end_date}). Corrija el archivo o seleccione otro período.`);
      return;
    }
    setBusy(true);
    const { data } = await supabase!.auth.getUser();
    const fresh = rows.filter((row) => !known.has(row.source_row_hash)).map((row) => ({ ...row, uploaded_by: data.user?.id }));
    if (!fresh.length) {
      setBusy(false);
      setMessage("Todas las filas ya existen; no se creó una base nueva.");
      return;
    }
    const { data: batch, error: batchError } = await supabase!
      .from("training_import_batches")
      .insert({ period_id: period.id, period_name: period.name, period_start: period.start_date, period_end: period.end_date, source_filename: filename, row_count: fresh.length, uploaded_by: data.user?.id })
      .select("id")
      .single();
    if (batchError || !batch) {
      setBusy(false);
      setMessage(batchError?.message ?? "No fue posible crear el período de carga.");
      return;
    }
    let errorMessage = "";
    for (let index = 0; index < fresh.length; index += 400) {
      const payload = fresh.slice(index, index + 400).map((row) => ({ ...row, period_id: period.id, import_batch_id: batch.id }));
      const { error } = await supabase!.from("training_records").upsert(payload, { onConflict: "period_id,source_row_hash", ignoreDuplicates: true });
      if (error) { errorMessage = error.message; break; }
    }
    setBusy(false);
    if (errorMessage) {
      await supabase!.from("training_import_batches").delete().eq("id", batch.id);
      setMessage(errorMessage);
    }
    else {
      setMessage(`Base del período “${period.name}” cargada: ${fresh.length} filas nuevas; ${rows.length - fresh.length} duplicadas omitidas.`);
      setRows([]);
      await reload();
    }
  }

  async function deleteBatch(batch: ImportBatch) {
    if (!window.confirm(`¿Eliminar la base “${batch.period_name}” (${batch.source_filename}) y todos sus ${batch.row_count} registros? La acción quedará auditada.`)) return;
    const { error } = await supabase!.from("training_import_batches").delete().eq("id", batch.id);
    setMessage(error?.message ?? "Base eliminada correctamente.");
    if (!error) await reload();
  }

  async function resetRecords() {
    const confirmation = window.prompt(`Esta acción eliminará TODAS las bases ejecutadas del período “${period.name}”. Escriba RESETEAR para confirmar. El levantamiento y sus presupuestos se conservarán.`);
    if (confirmation !== "RESETEAR") {
      setMessage("Reseteo cancelado.");
      return;
    }
    const { error } = await supabase!.from("training_import_batches").delete().eq("period_id", period.id);
    if (!error) {
      const { error: legacyError } = await supabase!.from("training_records").delete().eq("period_id", period.id).is("import_batch_id", null);
      setMessage(legacyError?.message ?? `Todas las bases ejecutadas del período “${period.name}” fueron eliminadas. El levantamiento permanece intacto.`);
      if (!legacyError) await reload();
    } else setMessage(error.message);
  }

  async function template() {
    const ExcelJS = (await import("exceljs")).default;
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("CAPACITACION");
    sheet.addRow([...TRAINING_HEADERS]);
    sheet.getRow(1).font = { bold: true };
    sheet.columns.forEach((column, index) => { column.width = Math.max(14, TRAINING_HEADERS[index].length + 2); });
    await saveWorkbook(workbook, "plantilla_capacitacion_ejecutada.xlsx");
  }

  return <div className="panel">
    <div className="panelhead"><div><h2>Carga masiva desde Excel</h2><p>Solo se procesa la primera hoja. Las 20 cabeceras son obligatorias; se omiten filas duplicadas.</p></div><button className="secondary" onClick={() => void template()}>Descargar plantilla</button></div>
    <div className="period-context"><b>Período seleccionado: {period.name}</b><span>{period.start_date} a {period.end_date}</span></div>
    <label className="upload-box"><b>Seleccione archivo Excel .xlsx</b><input type="file" accept=".xlsx" onChange={(e) => void readFile(e.target.files?.[0])} /><span>{filename || "Ningún archivo seleccionado"}</span></label>
    {message && <div className={rows.length ? "success" : "error"}>{message}</div>}
    {rows.length > 0 && <><div className="table preview"><table><thead><tr>{TRAINING_HEADERS.slice(0, 8).map((h) => <th key={h}>{h}</th>)}</tr></thead><tbody>{rows.slice(0, 8).map((row) => <tr key={row.source_row_hash}><td>{row.name}</td><td>{row.gender}</td><td>{row.position}</td><td>{row.requesting_area}</td><td>{row.office}</td><td>{row.topic}</td><td>{row.company}</td><td>{row.start_date || "—"}</td></tr>)}</tbody></table></div><div className="actions"><button className="primary" disabled={busy} onClick={() => void upload()}>{busy ? "Cargando…" : `Cargar ${rows.filter((r) => !known.has(r.source_row_hash)).length} filas nuevas`}</button></div></>}
    <div className="batch-manager"><div className="panelhead"><div><h3>Bases cargadas en {period.name}</h3><p>Eliminar una base borra únicamente los registros asociados a ese lote.</p></div><button className="secondary danger" disabled={!records.length} onClick={() => void resetRecords()}>Resetear bases del período</button></div><div className="table"><table><thead><tr><th>Período</th><th>Desde</th><th>Hasta</th><th>Archivo</th><th>Filas</th><th>Fecha de carga</th><th>Acción</th></tr></thead><tbody>{batches.map((batch) => <tr key={batch.id}><td><b>{batch.period_name}</b></td><td>{batch.period_start}</td><td>{batch.period_end}</td><td>{batch.source_filename}</td><td>{batch.row_count}</td><td>{new Date(batch.uploaded_at).toLocaleString("es-EC")}</td><td><button className="secondary danger" onClick={() => void deleteBatch(batch)}>Eliminar base</button></td></tr>)}{!batches.length && <tr><td colSpan={7}>No existen bases cargadas en este período.</td></tr>}</tbody></table></div></div>
  </div>;
}

function BudgetManager({ records, budgets, plans, departments, period, reload }: { records: TrainingRecord[]; budgets: BudgetAllocation[]; plans: TrainingPlan[]; departments: string[]; period: { id: string; name: string; start_date: string }; reload: () => Promise<void> }) {
  const year = Number(period.start_date.slice(0, 4));
  const [department, setDepartment] = useState("");
  const [crossOverride, setCrossOverride] = useState("");
  const [message, setMessage] = useState("");
  const [budgetDrafts, setBudgetDrafts] = useState<Record<string, { requesting_area_name: string }>>({});
  const [savingAll, setSavingAll] = useState(false);
  async function save(e: FormEvent) {
    e.preventDefault();
    const { error } = await supabase!.from("department_budgets").upsert({ period_id: period.id, year, department_name: department.trim(), requesting_area_name: crossOverride.trim() || null, allocated_budget: 0, bank_hours: 0, updated_at: new Date().toISOString() }, { onConflict: "period_id,department_name" });
    setMessage(error?.message ?? "Regla de cruce guardada.");
    if (!error) { setDepartment(""); setCrossOverride(""); await reload(); }
  }
  const budgetDraft = (budget: BudgetAllocation) => budgetDrafts[budget.id] ?? { requesting_area_name: budget.requesting_area_name || "" };
  function changeBudget(budget: BudgetAllocation, changes: Partial<ReturnType<typeof budgetDraft>>) {
    setBudgetDrafts((all) => ({ ...all, [budget.id]: { ...budgetDraft(budget), ...changes } }));
  }
  async function saveBudgetChanges() {
    const entries = Object.entries(budgetDrafts);
    if (!entries.length) return;
    setSavingAll(true);
    const results = await Promise.all(entries.map(([id, values]) => supabase!.from("department_budgets").update({ ...values, requesting_area_name: values.requesting_area_name.trim() || null, updated_at: new Date().toISOString() }).eq("id", id)));
    setSavingAll(false);
    const error = results.find((result) => result.error)?.error;
    setMessage(error?.message ?? `${entries.length} reglas de cruce fueron guardadas y recalculadas.`);
    if (!error) {
      setBudgetDrafts({});
      await reload();
    }
  }
  async function remove(id: string) {
    if (!window.confirm("¿Eliminar esta regla de recategorización? El cruce volverá a ser automático por departamento.")) return;
    const { error } = await supabase!.from("department_budgets").delete().eq("id", id);
    setMessage(error?.message ?? "Asignación eliminada.");
    if (!error) await reload();
  }
  const configured = budgets.filter((budget) => !budget.period_id || budget.period_id === period.id);
  const plannedDepartments = [...new Set(plans.map((plan) => plan.department).filter(Boolean))];
  const departmentOptions = [...new Set([...departments, ...plannedDepartments])].sort((a, b) => a.localeCompare(b, "es"));
  const requestingAreas = [...new Set(records.map((record) => record.requesting_area).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es"));
  return <>
    <div className="panel"><div className="panelhead"><div><h2>Reglas de cruce · {period.name}</h2><p>Los valores y horas presupuestadas se toman automáticamente del Módulo 1. Configure solo las excepciones de denominación.</p></div></div>
      <form className="inline budget-form mapping-form" onSubmit={save}><label>DEPARTAMENTO del Módulo 1<input list="budget-departments" value={department} onChange={(e) => setDepartment(e.target.value)} required /><datalist id="budget-departments">{departmentOptions.map((x) => <option key={x}>{x}</option>)}</datalist></label><label>AREA REQUIRIENTE alternativa del Excel<input list="requesting-areas" value={crossOverride} onChange={(e) => setCrossOverride(e.target.value)} placeholder="Vacío = cruce automático" /><datalist id="requesting-areas">{requestingAreas.map((x) => <option key={x}>{x}</option>)}</datalist></label><button className="primary">Guardar regla</button></form>{message && <div className="statusmsg">{message}</div>}
    </div>
    <BudgetSummary records={records} budgets={budgets} plans={plans} periodName={period.name} />
    <div className="panel"><div className="panelhead"><div><h2>Recategorizaciones configuradas</h2><p>Si elimina una regla, el sistema volverá a comparar los nombres automáticamente.</p></div><button className="primary" disabled={!Object.keys(budgetDrafts).length || savingAll} onClick={() => void saveBudgetChanges()}>{savingAll ? "Guardando…" : `Guardar todos los cambios (${Object.keys(budgetDrafts).length})`}</button></div><div className="table budget-editor"><table><thead><tr><th>Año</th><th>Departamento del sistema</th><th>AREA REQUIRIENTE alternativa</th><th>Acción</th></tr></thead><tbody>{configured.map((b) => { const draft = budgetDraft(b); return <tr key={b.id}><td>{b.year}</td><td>{b.department_name}</td><td><input list="requesting-areas" value={draft.requesting_area_name} onChange={(e) => changeBudget(b, { requesting_area_name: e.target.value })} placeholder="Automático por departamento" /></td><td><button className="secondary danger" onClick={() => void remove(b.id)}>Eliminar regla</button></td></tr>; })}{!configured.length && <tr><td colSpan={4}>No existen recategorizaciones. Todos los cruces son automáticos.</td></tr>}</tbody></table></div></div>
  </>;
}

function ExecutionDashboard({ records, budgets, plans, periodName }: { records: TrainingRecord[]; budgets: BudgetAllocation[]; plans: TrainingPlan[]; periodName: string }) {
  const annual = records;
  const completed = annual.filter((r) => isCompleted(r.status));
  const participants = new Set(completed.map((r) => norm(r.name)).filter(Boolean)).size;
  const events = new Set(completed.map((r) => `${norm(r.topic)}|${r.start_date}|${norm(r.company)}`)).size;
  const cost = completed.reduce((s, r) => s + Number(r.cost), 0);
  const hours = completed.reduce((s, r) => s + Number(r.duration), 0);
  return <>
    <div className="dashboard-toolbar"><b>Período analizado: {periodName}</b></div>
    <section className="cards strategic-cards"><Metric label="Participantes capacitados" value={participants.toLocaleString("es-EC")} /><Metric label="Eventos ejecutados" value={events.toLocaleString("es-EC")} /><Metric label="Inversión ejecutada" value={money(cost)} /><Metric label="Horas cumplidas" value={hours.toLocaleString("es-EC")} /><Metric label="Costo por participante" value={money(participants ? cost / participants : 0)} /><Metric label="Cobertura departamental" value={new Set(completed.map((r) => norm(r.requesting_area)).filter(Boolean)).size.toLocaleString("es-EC")} /></section>
    <BudgetSummary records={records} budgets={budgets} plans={plans} periodName={periodName} />
    <section className="grid2"><Distribution title="Estado" records={annual} field="status" /><Distribution title="Modalidad" records={annual} field="modality" /><Distribution title="Área de conocimiento" records={annual} field="knowledge_area" /><Distribution title="Área requiriente" records={annual} field="requesting_area" /></section>
  </>;
}

function Distribution({ title, records, field }: { title: string; records: TrainingRecord[]; field: keyof TrainingRecord }) {
  const groups = Object.entries(records.reduce((acc, row) => { const key = String(row[field] || "Sin definir"); acc[key] = (acc[key] || 0) + 1; return acc; }, {} as Record<string, number>)).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const max = Math.max(1, ...groups.map(([, count]) => count));
  return <div className="panel"><h2>{title}</h2><div className="bars">{groups.length ? groups.map(([label, count]) => <div key={label}><span title={label}>{label}</span><i><em style={{ width: `${(count / max) * 100}%` }} /></i><b>{count}</b></div>) : <p>Sin registros para el año seleccionado.</p>}</div></div>;
}

function ExecutionReport({ records, batches, periodName }: { records: TrainingRecord[]; batches: ImportBatch[]; periodName: string }) {
  const [filters, setFilters] = useState({ batch: "", year: "", from: "", to: "", gender: "", requesting_area: "", office: "", status: "", modality: "", department: "", occupational_group: "", knowledge_area: "" });
  const values = (field: keyof TrainingRecord) => [...new Set(records.map((r) => String(r[field] || "")).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es"));
  const filtered = records.filter((r) => (!filters.batch || r.import_batch_id === filters.batch) && (!filters.year || String(recordYear(r)) === filters.year) && (!filters.from || (r.start_date ?? "") >= filters.from) && (!filters.to || (r.start_date ?? "") <= filters.to) && (!filters.gender || r.gender === filters.gender) && (!filters.requesting_area || r.requesting_area === filters.requesting_area) && (!filters.office || r.office === filters.office) && (!filters.status || r.status === filters.status) && (!filters.modality || r.modality === filters.modality) && (!filters.department || r.department === filters.department) && (!filters.occupational_group || r.occupational_group === filters.occupational_group) && (!filters.knowledge_area || r.knowledge_area === filters.knowledge_area));
  const set = (field: keyof typeof filters, value: string) => setFilters((current) => ({ ...current, [field]: value }));
  async function exportExcel() {
    const data = filtered.map((r) => ({ NOMBRE: r.name, GENERO: r.gender, CARGO: r.position, "AREA REQUIRIENTE": r.requesting_area, OFICINA: r.office, TEMA: r.topic, EMPRESA: r.company, "FECHA INICIO": r.start_date, "FECHA FIN": r.end_date, DURACION: r.duration, LUGAR: r.location, COSTO: r.cost, ESTADO: r.status, "CRITERIO JUSTIFICACION": r.justification_criterion, MODALIDAD: r.modality, "ÁREA": r.area, DEPARTAMENTO: r.department, NIVEL: r.level, "GRUPO OCUPACIONAL": r.occupational_group, "ÁREA DE CONOCIMIENTO": r.knowledge_area }));
    const ExcelJS = (await import("exceljs")).default;
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("REPORTE");
    sheet.addRow([...TRAINING_HEADERS]);
    data.forEach((row) => sheet.addRow(TRAINING_HEADERS.map((header) => row[header])));
    sheet.getRow(1).font = { bold: true };
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    sheet.columns.forEach((column, index) => { column.width = Math.max(14, TRAINING_HEADERS[index].length + 2); });
    const periodLabel = periodName.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ]+/g, "-").replace(/^-|-$/g, "");
    await saveWorkbook(workbook, `reporte_capacitacion_${periodLabel}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }
  return <><div className="panel filters execution-filters"><label>Base / período<select value={filters.batch} onChange={(e) => set("batch", e.target.value)}><option value="">Todas</option>{batches.map((batch) => <option key={batch.id} value={batch.id}>{batch.period_name} — {batch.source_filename}</option>)}</select></label><label>Año<input type="number" min="2020" max="2100" value={filters.year} onChange={(e) => set("year", e.target.value)} /></label><label>Desde<input type="date" value={filters.from} onChange={(e) => set("from", e.target.value)} /></label><label>Hasta<input type="date" value={filters.to} onChange={(e) => set("to", e.target.value)} /></label>{(["gender", "requesting_area", "office", "status", "modality", "department", "occupational_group", "knowledge_area"] as const).map((field) => <label key={field}>{field === "requesting_area" ? "Área requiriente" : field === "occupational_group" ? "Grupo ocupacional" : field === "knowledge_area" ? "Área de conocimiento" : field.charAt(0).toUpperCase() + field.slice(1)}<select value={filters[field]} onChange={(e) => set(field, e.target.value)}><option value="">Todos</option>{values(field).map((value) => <option key={value}>{value}</option>)}</select></label>)}<button className="secondary" onClick={() => setFilters({ batch: "", year: "", from: "", to: "", gender: "", requesting_area: "", office: "", status: "", modality: "", department: "", occupational_group: "", knowledge_area: "" })}>Limpiar</button></div>
    <section className="cards"><Metric label="Registros filtrados" value={filtered.length.toLocaleString("es-EC")} /><Metric label="Personas únicas" value={new Set(filtered.map((r) => norm(r.name))).size.toLocaleString("es-EC")} /><Metric label="Costo" value={money(filtered.reduce((s, r) => s + Number(r.cost), 0))} /><Metric label="Duración" value={filtered.reduce((s, r) => s + Number(r.duration), 0).toLocaleString("es-EC")} /></section>
    <div className="panel"><div className="panelhead"><div><h2>Reporte detallado</h2><p>{filtered.length} registros con las 20 columnas de la base fuente.</p></div><div><button className="secondary" onClick={() => window.print()}>Imprimir / PDF</button> <button className="primary" onClick={() => void exportExcel()}>Exportar Excel</button></div></div><div className="table execution-table"><table><thead><tr>{TRAINING_HEADERS.map((h) => <th key={h}>{h}</th>)}</tr></thead><tbody>{filtered.map((r) => <tr key={r.id}><td>{r.name}</td><td>{r.gender}</td><td>{r.position}</td><td>{r.requesting_area}</td><td>{r.office}</td><td>{r.topic}</td><td>{r.company}</td><td>{r.start_date}</td><td>{r.end_date}</td><td>{r.duration}</td><td>{r.location}</td><td>{money(r.cost)}</td><td>{r.status}</td><td>{r.justification_criterion}</td><td>{r.modality}</td><td>{r.area}</td><td>{r.department}</td><td>{r.level}</td><td>{r.occupational_group}</td><td>{r.knowledge_area}</td></tr>)}</tbody></table></div></div></>;
}

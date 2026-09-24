import { FormEvent, useMemo, useState } from "react";
import { supabase } from "./supabase";

export type CompetencyMatrixRow = {
  id: string;
  area: string;
  department: string;
  group_name: string;
  factor: string;
  competency: string;
  description: string;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export const COMPETENCY_HEADERS = [
  "N°",
  "ÁREA",
  "DEPARTAMENTO",
  "GRUPO",
  "FACTOR",
  "COMPETENCIA A DESARROLLAR",
  "DESCRIPCIÓN / APLICACIÓN",
] as const;

const normalize = (value: unknown) => String(value ?? "").trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
const unique = (values: string[]) => [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, "es"));

export function CompetencyMatrixManager({ rows, reload }: { rows: CompetencyMatrixRow[]; reload: () => Promise<void> }) {
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [factorFilter, setFactorFilter] = useState("");
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, Pick<CompetencyMatrixRow, "area" | "department" | "group_name" | "factor" | "competency" | "description" | "active">>>({});
  const [newRow, setNewRow] = useState({ area: "", department: "", group_name: "COLABORADORES", factor: "", competency: "", description: "" });

  const departments = useMemo(() => unique(rows.map((row) => row.department)), [rows]);
  const factors = useMemo(() => unique(rows.map((row) => row.factor)), [rows]);
  const filtered = rows.filter((row) =>
    (!departmentFilter || row.department === departmentFilter) &&
    (!factorFilter || row.factor === factorFilter) &&
    (!search || [row.area, row.department, row.group_name, row.factor, row.competency, row.description].some((value) => normalize(value).includes(normalize(search)))),
  );
  const visible = filtered.slice(0, 250);
  const draft = (row: CompetencyMatrixRow) => drafts[row.id] ?? {
    area: row.area,
    department: row.department,
    group_name: row.group_name,
    factor: row.factor,
    competency: row.competency,
    description: row.description,
    active: row.active,
  };
  function change(row: CompetencyMatrixRow, values: Partial<ReturnType<typeof draft>>) {
    setDrafts((current) => ({ ...current, [row.id]: { ...draft(row), ...values } }));
  }
  async function saveAll() {
    const entries = Object.entries(drafts);
    if (!entries.length) return;
    if (entries.some(([, value]) => !value.area.trim() || !value.department.trim() || !value.group_name.trim() || !value.factor.trim() || !value.competency.trim())) {
      setMessage("Área, departamento, grupo, factor y competencia son obligatorios.");
      return;
    }
    setBusy(true);
    const results = await Promise.all(entries.map(([id, value]) => supabase!.from("competency_matrix").update({
      ...value,
      area: value.area.trim(),
      department: value.department.trim(),
      group_name: value.group_name.trim(),
      factor: value.factor.trim(),
      competency: value.competency.trim(),
      description: value.description.trim(),
      updated_at: new Date().toISOString(),
    }).eq("id", id)));
    setBusy(false);
    const error = results.find((result) => result.error)?.error;
    setMessage(error?.message ?? `${entries.length} relaciones fueron actualizadas.`);
    if (!error) { setDrafts({}); await reload(); }
  }
  async function addManual(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase!.from("competency_matrix").upsert({
      area: newRow.area.trim(),
      department: newRow.department.trim(),
      group_name: newRow.group_name.trim(),
      factor: newRow.factor.trim(),
      competency: newRow.competency.trim(),
      description: newRow.description.trim(),
      active: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: "department,factor,competency" });
    setBusy(false);
    setMessage(error?.message ?? "Relación guardada en la matriz.");
    if (!error) {
      setNewRow({ area: "", department: "", group_name: "COLABORADORES", factor: "", competency: "", description: "" });
      await reload();
    }
  }
  async function importExcel(file?: File) {
    if (!file) return;
    setBusy(true);
    setMessage("");
    try {
      const ExcelJS = (await import("exceljs")).default;
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(await file.arrayBuffer());
      const sheet = workbook.getWorksheet("Matriz por Departamento") ?? workbook.worksheets[0];
      if (!sheet) throw new Error("El archivo no contiene hojas.");
      const headers = (sheet.getRow(1).values as unknown[]).slice(1).map(normalize);
      const expected = COMPETENCY_HEADERS.map(normalize);
      if (expected.some((header, index) => headers[index] !== header)) throw new Error(`Las cabeceras deben ser: ${COMPETENCY_HEADERS.join(" | ")}.`);
      const parsed: Array<Omit<CompetencyMatrixRow, "id" | "created_at" | "updated_at">> = [];
      const seen = new Set<string>();
      sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const values = (row.values as unknown[]).slice(1);
        const item = {
          area: String(values[1] ?? "").trim(),
          department: String(values[2] ?? "").trim(),
          group_name: String(values[3] ?? "").trim(),
          factor: String(values[4] ?? "").trim(),
          competency: String(values[5] ?? "").trim(),
          description: String(values[6] ?? "").trim(),
          active: true,
        };
        if (!item.area && !item.department && !item.factor && !item.competency) return;
        if (!item.area || !item.department || !item.group_name || !item.factor || !item.competency) throw new Error(`Fila ${rowNumber}: faltan datos obligatorios.`);
        const key = [item.department, item.factor, item.competency].map(normalize).join("|");
        if (seen.has(key)) throw new Error(`Fila ${rowNumber}: relación duplicada en el archivo.`);
        seen.add(key);
        parsed.push(item);
      });
      if (!parsed.length) throw new Error("No se encontraron relaciones válidas.");
      for (let index = 0; index < parsed.length; index += 300) {
        const payload = parsed.slice(index, index + 300).map((item) => ({ ...item, updated_at: new Date().toISOString() }));
        const { error } = await supabase!.from("competency_matrix").upsert(payload, { onConflict: "department,factor,competency" });
        if (error) throw error;
      }
      setMessage(`${parsed.length} relaciones fueron cargadas o actualizadas. Las relaciones no incluidas conservaron su estado.`);
      await reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No fue posible procesar el archivo.");
    } finally {
      setBusy(false);
    }
  }
  async function downloadTemplate() {
    const ExcelJS = (await import("exceljs")).default;
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Matriz por Departamento");
    sheet.addRow([...COMPETENCY_HEADERS]);
    sheet.addRow([1, "ADMINISTRATIVO FINANCIERO", "ADMINISTRATIVO", "COLABORADORES", "COMPETENCIAS BLANDAS", "Liderazgo", "Aplicación de la competencia en el departamento."]);
    sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF123B67" } };
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    sheet.columns = [8, 28, 28, 22, 28, 42, 60].map((width) => ({ width }));
    const buffer = await workbook.xlsx.writeBuffer();
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    link.download = "plantilla_matriz_competencias.xlsx";
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return <section className="panel competency-manager">
    <div className="panelhead"><div><h2>Matriz de competencias</h2><p>Relación administrable entre área, departamento, grupo, factor y competencia.</p></div><div className="actions"><button className="secondary" onClick={() => void downloadTemplate()}>Descargar plantilla</button><label className="secondary file-button">Cargar Excel<input type="file" accept=".xlsx" disabled={busy} onChange={(event) => void importExcel(event.target.files?.[0])} /></label><button className="primary" disabled={!Object.keys(drafts).length || busy} onClick={() => void saveAll()}>{busy ? "Guardando…" : `Guardar todos los cambios (${Object.keys(drafts).length})`}</button></div></div>
    {message && <div className="statusmsg">{message}</div>}
    <form className="competency-create" onSubmit={addManual}>
      <label>Área<input value={newRow.area} onChange={(e) => setNewRow((row) => ({ ...row, area: e.target.value }))} required /></label>
      <label>Departamento<input value={newRow.department} onChange={(e) => setNewRow((row) => ({ ...row, department: e.target.value }))} required /></label>
      <label>Grupo<input value={newRow.group_name} onChange={(e) => setNewRow((row) => ({ ...row, group_name: e.target.value }))} required /></label>
      <label>Factor<input list="matrix-factors" value={newRow.factor} onChange={(e) => setNewRow((row) => ({ ...row, factor: e.target.value }))} required /><datalist id="matrix-factors">{factors.map((factor) => <option key={factor}>{factor}</option>)}</datalist></label>
      <label>Competencia<input value={newRow.competency} onChange={(e) => setNewRow((row) => ({ ...row, competency: e.target.value }))} required /></label>
      <label className="wide">Descripción<input value={newRow.description} onChange={(e) => setNewRow((row) => ({ ...row, description: e.target.value }))} /></label>
      <button className="primary" disabled={busy}>Agregar o actualizar</button>
    </form>
    <div className="filters matrix-filters"><label>Departamento<select value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)}><option value="">Todos</option>{departments.map((department) => <option key={department}>{department}</option>)}</select></label><label>Factor<select value={factorFilter} onChange={(e) => setFactorFilter(e.target.value)}><option value="">Todos</option>{factors.map((factor) => <option key={factor}>{factor}</option>)}</select></label><label>Buscar<input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Competencia o descripción" /></label></div>
    <p className="matrix-count">{filtered.length} relaciones encontradas{filtered.length > visible.length ? `; se muestran las primeras ${visible.length}` : ""}.</p>
    <div className="table matrix-table"><table><thead><tr><th>Área</th><th>Departamento</th><th>Grupo</th><th>Factor</th><th>Competencia</th><th>Descripción</th><th>Estado</th></tr></thead><tbody>{visible.map((row) => { const value = draft(row); return <tr key={row.id}><td><input value={value.area} onChange={(e) => change(row, { area: e.target.value })} /></td><td><input value={value.department} onChange={(e) => change(row, { department: e.target.value })} /></td><td><input value={value.group_name} onChange={(e) => change(row, { group_name: e.target.value })} /></td><td><input value={value.factor} onChange={(e) => change(row, { factor: e.target.value })} /></td><td><input value={value.competency} onChange={(e) => change(row, { competency: e.target.value })} /></td><td><input value={value.description} onChange={(e) => change(row, { description: e.target.value })} /></td><td><button className={value.active ? "tag" : "tag off"} onClick={() => change(row, { active: !value.active })}>{value.active ? "Activo" : "Inactivo"}</button></td></tr>; })}</tbody></table></div>
  </section>;
}

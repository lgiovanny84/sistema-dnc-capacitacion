import {usePendingChanges} from "./UnsavedChanges";
import { CompactSection } from "./CompactSection";
import { useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";
import { CollapsibleTable } from "./CollapsibleTable";
import { Modal } from "./Modal";
import { matrixKey, matrixValues, normalizeMatrix as normalize, validateMatrix } from "./competencyAssignment";
import type { MatrixChange, MatrixValues } from "./competencyAssignment";

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

const unique = (values: string[]) => [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, "es"));
const PAGE_SIZE = 20;
const emptyValues = (): MatrixValues => ({ area: "", department: "", group_name: "COLABORADORES", factor: "", competency: "", description: "", active: true });

export function CompetencyMatrixManager({ rows, reload, onPendingChange }: { rows: CompetencyMatrixRow[]; reload: () => Promise<void>; onPendingChange?: (count: number) => void }) {
  const [filters, setFilters] = useState({ area: "", department: "", factor: "", status: "", search: "" });
  const [page, setPage] = useState(1);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [changes, setChanges] = useState<Record<string, MatrixChange>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const [bulkEditing,setBulkEditing]=useState(false);
  const pending = Object.keys(changes).length;
  useEffect(() => { onPendingChange?.(pending); }, [pending, onPendingChange]);
  useEffect(() => {
    if (!editingId) return;
    editorRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    editorRef.current?.querySelector<HTMLInputElement>("input")?.focus({ preventScroll: true });
  }, [editingId]);
  const effective = rows.filter(row => changes[row.id]?.action !== "delete").map(row => ({ ...row, ...(changes[row.id]?.action === "save" ? (changes[row.id] as { action: "save"; value: MatrixValues }).value : {}) }));
  for (const [id, change] of Object.entries(changes)) {
    if (change.action === "save" && !rows.some(row => row.id === id)) effective.unshift({ id, ...change.value, created_at: "", updated_at: "" });
  }
  const filtered = effective.filter(row => (!filters.area || row.area === filters.area) && (!filters.department || row.department === filters.department) && (!filters.factor || row.factor === filters.factor) && (!filters.status || String(row.active) === filters.status) && (!filters.search.trim() || [row.area, row.department, row.group_name, row.factor, row.competency, row.description].some(value => normalize(value).includes(normalize(filters.search)))));
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const visible = filtered;
  const editing = effective.find(row => row.id === editingId);
  const removals = rows.filter(row => changes[row.id]?.action === "delete");
  function filter(key: keyof typeof filters, value: string) { setFilters(current => ({ ...current, [key]: value, ...(key === "area" ? { department: "" } : {}) })); setPage(1); }
  function edit(row: CompetencyMatrixRow) { setEditingId(row.id); }
  function change(row: CompetencyMatrixRow, values: Partial<MatrixValues>) { setChanges(current => ({ ...current, [row.id]: { action: "save", value: { ...matrixValues(row), ...values } } })); }
  function create() {
    const id = crypto.randomUUID();
    setChanges(current => ({ ...current, [id]: { action: "save", value: { ...emptyValues(), area: filters.area, department: filters.department, factor: filters.factor } } }));
    setEditingId(id);
    setMessage("Complete la nueva relación y use Guardar todos los cambios.");
  }
  function undo(id: string) { setChanges(current => { const next = { ...current }; delete next[id]; return next; }); if (editingId === id) setEditingId(null); }
  function remove(row: CompetencyMatrixRow) {
    if (!window.confirm(`¿Marcar «${row.competency || "Nueva relación"}» para eliminar? Se aplicará al guardar la sección. Los registros históricos se conservan.`)) return;
    if (rows.some(original => original.id === row.id)) setChanges(current => ({ ...current, [row.id]: { action: "delete" } }));
    else undo(row.id);
    if (editingId === row.id) setEditingId(null);
  }
  async function saveAll() {
    if (busy || !pending) return;
    const invalid = validateMatrix(effective);
    if (invalid) { setMessage(invalid); return; }
    setBusy(true);
    const entries = Object.entries(changes).sort(([, a], [, b]) => Number(b.action === "delete") - Number(a.action === "delete"));
    let saved = 0;
    const errors: string[] = [];
    for (const [id, entry] of entries) {
      try {
        const table = supabase!.from("competency_matrix");
        const result = entry.action === "delete"
          ? await table.delete().eq("id", id).select("id").maybeSingle()
          : rows.some(row => row.id === id)
            ? await table.update({ ...matrixValues(entry.value), updated_at: new Date().toISOString() }).eq("id", id).select("id").maybeSingle()
            : await table.insert({ id, ...matrixValues(entry.value) }).select("id").single();
        if (result.error) throw new Error(result.error.message);
        if (!result.data) throw new Error("No se confirmó la operación. Revise sus permisos o si el registro aún existe.");
        saved++;
        setChanges(current => { if (current[id] !== entry) return current; const next = { ...current }; delete next[id]; return next; });
      } catch (error) { errors.push(error instanceof Error ? error.message : "No fue posible completar la operación."); }
    }
    try {
      if (saved) await reload();
      setMessage(errors.length ? `${saved} cambios guardados. ${errors.length} pendientes: ${errors[0]}` : `${saved} cambios guardados correctamente.`);
      if (!errors.length) setEditingId(null);
    } catch { setMessage("Los cambios confirmados se guardaron, pero no se pudo actualizar la vista. Recargue antes de continuar."); }
    finally { setBusy(false); }
  }
  usePendingChanges(pending>0,saveAll,"Matriz de competencias",()=>{setChanges({});setEditingId(null);});
  async function importExcel(file?: File) {
    if (!file || busy || pending) return;
    setBusy(true); setMessage("");
    try {
      const ExcelJS = (await import("exceljs")).default;
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(await file.arrayBuffer());
      const sheet = workbook.getWorksheet("Matriz por Departamento") ?? workbook.worksheets[0];
      if (!sheet) throw new Error("El archivo no contiene hojas.");
      if (COMPETENCY_HEADERS.some((header, index) => normalize(sheet.getRow(1).getCell(index + 1).text) !== normalize(header))) throw new Error(`Las cabeceras deben ser: ${COMPETENCY_HEADERS.join(" | ")}.`);
      const parsed: MatrixValues[] = [];
      sheet.eachRow((row, index) => {
        if (index === 1) return;
        const item = { area: row.getCell(2).text.trim(), department: row.getCell(3).text.trim(), group_name: row.getCell(4).text.trim(), factor: row.getCell(5).text.trim(), competency: row.getCell(6).text.trim(), description: row.getCell(7).text.trim(), active: true };
        if (!item.area && !item.department && !item.factor && !item.competency) return;
        const invalid = validateMatrix([item]);
        if (invalid) throw new Error(`Fila ${index}: ${invalid}`);
        parsed.push(item);
      });
      if (!parsed.length) throw new Error("No se encontraron relaciones válidas.");
      const invalid = validateMatrix(parsed);
      if (invalid) throw new Error(invalid);
      const byKey = new Map(rows.map(row => [matrixKey(row), row]));
      const staged: Record<string, MatrixChange> = {};
      let added = 0;
      for (const item of parsed) {
        const existing = byKey.get(matrixKey(item));
        if (!existing) added++;
        staged[existing?.id ?? crypto.randomUUID()] = { action: "save", value: item };
      }
      setChanges(staged); setEditingId(null);
      setMessage(`Archivo revisado: ${added} relaciones nuevas y ${parsed.length - added} actualizaciones pendientes. Revise y guarde todos los cambios. Las demás relaciones se conservan.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "No fue posible procesar el archivo."); }
    finally { setBusy(false); }
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

  return <section className="panel competency-manager" aria-busy={busy}>
    <div className="panelhead"><div><span className="eyebrow">CONFIGURACIÓN DE CAPACITACIÓN</span><h2>Matriz de competencias</h2><p>Organice qué competencias corresponden a cada área, departamento y grupo ocupacional.</p></div><button className="primary" disabled={busy} onClick={create}>+ Nueva relación</button></div>
    <CompactSection title="Resumen de competencias"><div className="matrix-overview"><div><strong>{effective.length}</strong><span>Relaciones</span></div><div><strong>{effective.filter(row => row.active).length}</strong><span>Activas</span></div><div><strong>{unique(effective.map(row => row.department)).length}</strong><span>Departamentos</span></div><div><strong>{pending}</strong><span>Cambios pendientes</span></div></div></CompactSection>
    <details className="matrix-import"><summary>Carga masiva con Excel</summary><p>Descargue el formato, cargue su archivo y revise las relaciones antes del guardado general.</p><div className="actions"><button className="secondary" disabled={busy} onClick={() => void downloadTemplate().catch(() => setMessage("No se pudo descargar la plantilla. Intente nuevamente."))}>Descargar plantilla</button><label className={`secondary file-button ${busy || pending ? "disabled" : ""}`}>Cargar Excel<input type="file" accept=".xlsx" disabled={busy || Boolean(pending)} onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; void importExcel(file); }} /></label></div>{pending > 0 && <small>Guarde o descarte los cambios antes de cargar otro archivo.</small>}</details>
    <div className="matrix-savebar"><button type="button" className="secondary" disabled={busy} aria-pressed={bulkEditing} aria-label="Editar matriz de competencias" title="Editar matriz" onClick={()=>setBulkEditing(true)}>✎</button><div><b>{pending ? `${pending} cambios por guardar` : "Matriz actualizada"}</b><small>Las altas, modificaciones y eliminaciones se aplican en un solo guardado de la sección.</small></div><div className="actions"><button className="secondary" disabled={busy || !pending} onClick={() => { if (window.confirm("¿Descartar todos los cambios pendientes de la matriz?")) { setChanges({}); setEditingId(null); } }}>Descartar</button><button className="primary" disabled={busy || !pending} onClick={() => void saveAll()}>{busy ? "Procesando…" : "Guardar todos los cambios"}</button></div></div>
    {message && <div className="statusmsg" role="status">{message}</div>}
    {editing && <Modal title={rows.some(row => row.id === editing.id) ? "Modificar relación de competencia" : "Nueva relación de competencia"} busy={busy} onClose={() => setEditingId(null)}><div className="matrix-editor" ref={editorRef} role="region" aria-label="Editar relación de competencia"><div className="panelhead"><div><h3>{rows.some(row => row.id === editing.id) ? "Modificar relación" : "Crear relación"}</h3><p>El grupo indicado aquí aparecerá al consultar esta competencia en sus tarjetas y reportes.</p></div><button className="secondary" disabled={busy} onClick={() => setEditingId(null)}>Cerrar edición</button></div><fieldset disabled={busy}><legend>Asignación organizacional</legend><div className="fields">
      {([ ["area", "Área"], ["department", "Departamento"], ["group_name", "Grupo ocupacional"], ["factor", "Factor"] ] as const).map(([key, label]) => <label key={key}>{label}<input value={editing[key]} list={`matrix-options-${key}`} onChange={event => change(editing, { [key]: event.target.value })} required /><datalist id={`matrix-options-${key}`}>{unique(effective.filter(row => key !== "department" || normalize(row.area) === normalize(editing.area)).map(row => row[key])).map(value => <option key={value} value={value} />)}</datalist></label>)}
      <label className="full">Competencia a desarrollar<input value={editing.competency} onChange={event => change(editing, { competency: event.target.value })} required /></label><label className="full">Descripción / aplicación<textarea rows={3} value={editing.description} onChange={event => change(editing, { description: event.target.value })} /></label><label>Estado<select value={String(editing.active)} onChange={event => change(editing, { active: event.target.value === "true" })}><option value="true">Activo</option><option value="false">Inactivo</option></select></label></div></fieldset><p className="matrix-count">Puede continuar editando otras relaciones y guardar toda la sección al finalizar.</p><div className="actions"><button className="primary" disabled={busy} onClick={() => setEditingId(null)}>Volver a la matriz</button></div></div></Modal>}
    <CompactSection title="Filtros de competencias" summary={`${filtered.length} coincidencias`}><div className="filters matrix-filters"><label>Buscar<input value={filters.search} onChange={event => filter("search", event.target.value)} placeholder="Competencia, grupo o descripción" /></label><label>Área<select value={filters.area} onChange={event => filter("area", event.target.value)}><option value="">Todas las áreas</option>{unique(effective.map(row => row.area)).map(value => <option key={value}>{value}</option>)}</select></label><label>Departamento<select value={filters.department} onChange={event => filter("department", event.target.value)}><option value="">Todos los departamentos</option>{unique(effective.filter(row => !filters.area || row.area === filters.area).map(row => row.department)).map(value => <option key={value}>{value}</option>)}</select></label><label>Factor<select value={filters.factor} onChange={event => filter("factor", event.target.value)}><option value="">Todos los factores</option>{unique(effective.map(row => row.factor)).map(value => <option key={value}>{value}</option>)}</select></label><label>Estado<select value={filters.status} onChange={event => filter("status", event.target.value)}><option value="">Todos</option><option value="true">Activo</option><option value="false">Inactivo</option></select></label><button className="secondary" onClick={() => { setFilters({ area: "", department: "", factor: "", status: "", search: "" }); setPage(1); }}>Limpiar filtros</button></div></CompactSection>
    <p className="matrix-count">{filtered.length} relaciones encontradas</p>
    <CollapsibleTable key={JSON.stringify(filters)} className="matrix-table matrix-readable"><table><thead><tr><th>Competencia / factor</th><th>Área / departamento</th><th>Grupo ocupacional</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{visible.map(row => <tr key={row.id} onDoubleClick={e=>{if(!busy&&!bulkEditing&&!(e.target as HTMLElement).closest("input,select,textarea,button"))edit(row);}} className={changes[row.id] ? "matrix-changed" : ""}><td>{bulkEditing?<div className="fields">{(["competency","factor","area","department","group_name","description"] as const).map(key=><label key={key}>{({competency:"Competencia",factor:"Factor",area:"Área",department:"Departamento",group_name:"Grupo ocupacional",description:"Descripción"})[key]}<input disabled={busy} value={row[key]} onChange={e=>change(row,{[key]:e.target.value})}/></label>)}</div>:<b>{row.competency || "Nueva relación"}</b>}<small>{row.factor || "Factor pendiente"}</small>{changes[row.id] && <span className="matrix-pending">Sin guardar</span>}</td><td><b>{row.department || "Departamento pendiente"}</b><small>{row.area || "Área pendiente"}</small></td><td><span className="group-badge">{row.group_name || "Sin asignar"}</span></td><td><span className={row.active ? "tag" : "tag off"}>{row.active ? "Activo" : "Inactivo"}</span></td><td className="row-actions"><button className="secondary" disabled={busy} onClick={() => edit(row)}>Modificar</button><button className="secondary danger" disabled={busy} onClick={() => remove(row)}>Eliminar</button></td></tr>)}{!visible.length && <tr><td colSpan={5}><div className="matrix-empty"><b>No hay relaciones para esta selección.</b><p>Limpie los filtros o cree una nueva relación.</p></div></td></tr>}</tbody></table></CollapsibleTable>
    {removals.length > 0 && <details className="matrix-removals" open><summary>{removals.length} eliminaciones pendientes de guardar</summary>{removals.map(row => <div key={row.id}><span>{row.competency} · {row.department} · {row.group_name}</span><button className="secondary" disabled={busy} onClick={() => undo(row.id)}>Deshacer eliminación</button></div>)}</details>}
  </section>;
}

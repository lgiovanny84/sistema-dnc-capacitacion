import { useBudget } from "./BudgetModule";
import { calculateBudget } from "./budgetModel";
import { CompactSection } from "./CompactSection";
import { useState } from "react";
import type { Need, Catalog, PlanningPeriod, Profile, OrgUnit } from "./needTypes";
import type { CompetencyMatrixRow } from "./competencyMatrix";
import { NeedForm } from "./NeedForm";
import { Modal } from "./Modal";
import { CollapsibleTable } from "./CollapsibleTable";
import { buildInstitutionalWorkbook, buildNeedsWorkbook, downloadInstitutionalWorkbook, institutionalLogo, reportFilename } from "./institutionalExcel";
import { budgetByOccupationalGroup, missingNeedFields, normalizeGroup, reviewFields } from "./needReview";
const currency = (value: number) => value.toLocaleString("es-EC", { style: "currency", currency: "USD" });
export function GroupBudgetCards({ needs, groups, periodName }: { needs: Need[]; groups: string[]; periodName: string }) {
  const budget = useBudget();
  const assigned = budget ? calculateBudget(budget.payload).amounts : new Map<string,number>();
  const directGroups = budget?.payload.nodes.filter(n=>n.kind==='group') || [];
  const sourceNeeds = budget ? budget.payload.nodes.filter(n=>n.kind==='activity').map(n=>({...needs.find(v=>v.id===n.need_id), id:n.id, occupational_group:needs.find(v=>v.id===n.need_id)?.occupational_group || n.group, estimated_cost:(assigned.get(n.id)||0)/100})) as Need[] : needs;
  const sourceLabel = budget ? "Asignaciones directas por grupo ocupacional en Presupuestos, consolidadas entre fondos. Capacitación y logística adicional se muestran por separado." : "Costos estimados registrados en las necesidades del Módulo 1 (sin presupuesto independiente configurado).";
  const totals = directGroups.length ? budgetByOccupationalGroup(directGroups.map(n=>({id:n.id,occupational_group:n.group,estimated_cost:(assigned.get(n.id)||0)/100})) as Need[],groups).map(g=>({...g,activities:sourceNeeds.filter(n=>normalizeGroup(n.occupational_group)===normalizeGroup(g.name)).length})) : budgetByOccupationalGroup(sourceNeeds, groups);
  const [exporting, setExporting] = useState(false), [error, setError] = useState("");
  async function exportBudget() {
    setExporting(true); setError("");
    try {
      const book = await buildInstitutionalWorkbook({ title: "Presupuesto asignado por grupo ocupacional", sheetName: "Presupuesto por grupo", periodName, filters: "Todos los grupos del período", source: sourceLabel, summary: `${totals.length} grupos. ${sourceNeeds.length} actividades.`, note: "Los montos parciales incluyen únicamente los costos registrados. Las actividades pendientes de costo se identifican por separado.", logoBase64: await institutionalLogo(), columns: [{ key: "name", label: "Grupo ocupacional", width: 40 }, { key: "activities", label: "Actividades", type: "integer", total: true, width: 20 }, { key: "known", label: "Con costo registrado", type: "integer", total: true, width: 24 }, { key: "pending", label: "Por presupuestar", type: "integer", total: true, width: 24 }, { key: "budget", label: "Presupuesto asignado (USD)", type: "money", total: true, width: 28 }, { key: "status", label: "Estado del monto", width: 32 }], rows: totals.map(group => ({ ...group, budget: group.known ? group.amount : group.activities ? "Por estimar" : "Sin asignación registrada", status: !group.activities && !group.known ? "Sin asignación registrada" : !group.known ? "Por estimar" : group.pending ? "Monto parcial" : "Monto registrado" })) });
      await downloadInstitutionalWorkbook(book, reportFilename("presupuesto_grupos_ocupacionales", periodName));
    } catch { setError("No se pudo exportar el presupuesto. Intente nuevamente."); }
    finally { setExporting(false); }
  }
  return <CompactSection title="Presupuesto asignado por grupo ocupacional"><section className="panel group-budget-panel" aria-label="Presupuesto por grupo ocupacional"><div className="panelhead"><div><h2>Presupuesto asignado por grupo ocupacional</h2><p>Período {periodName} · {totals.length} grupos · {sourceNeeds.length} actividades</p></div><button className="secondary" disabled={exporting} onClick={() => void exportBudget()}>{exporting ? "Generando Excel…" : "Exportar presupuesto a Excel"}</button></div>
    {error && <div className="error" role="alert">{error}</div>}
    <p className="group-budget-source">Fuente: {sourceLabel}</p>
    <div className="group-budget-cards">{totals.map(group => <article className={`group-budget-card ${group.pending ? "has-pending" : ""} ${!group.known ? "is-unassigned" : ""}`} key={normalizeGroup(group.name)}>
      <h3>{group.name}</h3>
      <div className="group-budget-value"><small>Presupuesto asignado</small><strong className={group.known ? "" : "group-budget-empty"}>{!group.activities && !group.known ? "Sin asignación registrada" : !group.known ? "Por estimar" : currency(group.amount)}</strong></div>
      <div className="group-budget-footer"><span>{group.activities} {group.activities === 1 ? "actividad" : "actividades"}</span>{group.pending > 0 ? <span className="group-budget-status pending">{group.known ? "Monto parcial · " : ""}{group.pending} por presupuestar</span> : <span className="group-budget-status">{group.activities ? "Monto registrado" : "Sin actividades"}</span>}</div>
    </article>)}</div>
    {!totals.length && <p className="empty-state">No hay grupos o necesidades registrados para este período.</p>}
    <details className="group-budget-help"><summary>¿Cómo cambiar el grupo de una actividad?</summary><div><p>En <b>Administración → Competencias</b>, busque el tema y su departamento, seleccione <b>Modificar</b>, ajuste <b>Grupo ocupacional</b> y pulse <b>Guardar todos los cambios</b>. La relación activa determina el grupo mostrado en las tarjetas y los reportes de necesidades.</p><p>Si no existe una relación para esa área, departamento, factor y competencia, créela con <b>+ Nueva relación</b>, indique el grupo correcto y guarde la sección.</p><p>«Asamblea de representante» y «Asamblea de representantes» se consolidan en <b>ASAMBLEA DE REPRESENTANTES</b> para este resumen y su Excel. Los registros de origen se conservan.</p></div></details>
  </section></CompactSection>;
}
export function AdminOverview({ showGroups = true, needs, groups, catalogs, competencyMatrix, orgUnits, profile, userId, period, reload }: { showGroups?: boolean; needs: Need[]; groups: string[]; catalogs: Catalog[]; competencyMatrix: CompetencyMatrixRow[]; orgUnits: OrgUnit[]; profile: Profile | null; userId: string; period?: PlanningPeriod; reload: () => Promise<void> }) {
  const [stage, setStage] = useState("");
  const [field, setField] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Need | null>(null);
  const [dirty, setDirty] = useState(false), [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false), [exportError, setExportError] = useState("");
  const reviewed = needs.map(need => ({ need, missing: missingNeedFields(need) }));
  const pending = reviewed.filter(item => item.missing.length);
  const essential = pending.filter(item => item.missing.some(([, , section]) => section === "Levantamiento")).length;
  const planning = pending.filter(item => item.missing.some(([, , section]) => section === "Planificación")).length;
  const filtered = pending.filter(item => (!stage || item.missing.some(([, , section]) => section === stage)) && (!field || item.missing.some(([key]) => key === field)) && (!search.trim() || [item.need.competency, item.need.area, item.need.department, item.need.occupational_group].some(value => normalizeGroup(value).includes(normalizeGroup(search))))).sort((a, b) => Number(b.missing.some(([, , section]) => section === "Levantamiento")) - Number(a.missing.some(([, , section]) => section === "Levantamiento")) || b.missing.length - a.missing.length || a.need.competency.localeCompare(b.need.competency, "es"));
  const pages = Math.max(1, Math.ceil(filtered.length / 8)), currentPage = Math.min(page, pages);
  async function exportPending() {
    setExporting(true); setExportError("");
    try {
      const applied = ["Actividades con datos pendientes", stage && `Sección: ${stage}`, field && `Dato: ${reviewFields.find(([key]) => key === field)?.[1]}`, search && `Búsqueda: ${search}`].filter(Boolean).join(". ");
      const book = await buildNeedsWorkbook(filtered.map(item => item.need), period ?? { name: "Sin período" }, applied, await institutionalLogo());
      await downloadInstitutionalWorkbook(book, reportFilename("actividades_datos_pendientes", period?.name ?? "sin-periodo"));
    } catch { setExportError("No se pudo exportar las actividades pendientes. Intente nuevamente."); }
    finally { setExporting(false); }
  }
  function close() { if (!busy && (!dirty || window.confirm("Tiene cambios sin guardar. ¿Cerrar la ventana y descartarlos?"))) { setEditing(null); setDirty(false); } }
  return <>
    {showGroups && <GroupBudgetCards needs={needs} groups={groups} periodName={period?.name ?? "Sin período"} />}
    <CompactSection title="Actividades con datos pendientes"><section className="panel completion-panel" aria-label="Actividades con datos pendientes"><div className="panelhead"><div><h2>Actividades con datos pendientes</h2><p>Identifique qué falta y complete cada actividad desde esta pantalla.</p></div><span className={`completion-badge ${pending.length ? "planning" : "complete"}`}>{pending.length} por completar</span></div>
      <div className="completion-summary"><div><strong>{pending.length}</strong><span>Actividades por completar</span></div><div><strong>{essential}</strong><span>Con datos de levantamiento pendientes</span></div><div><strong>{planning}</strong><span>Con planificación pendiente</span></div></div>
      <p className="completion-note">Una actividad puede tener pendientes en ambas secciones. Los campos de planificación son opcionales durante el levantamiento.</p>
      <details className="completion-details"><summary>Revisar actividades ({pending.length})</summary><div className="filters completion-filters"><label>Buscar actividad<input value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder="Competencia, departamento o grupo" /></label><label>Sección pendiente<select value={stage} onChange={event => { setStage(event.target.value); setPage(1); }}><option value="">Todas</option><option>Levantamiento</option><option value="Planificación">Planificación propuesta</option></select></label><label>Dato pendiente<select value={field} onChange={event => { setField(event.target.value); setPage(1); }}><option value="">Todos</option>{reviewFields.map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></label><button className="secondary" onClick={() => { setSearch(""); setStage(""); setField(""); setPage(1); }}>Limpiar</button></div>
        <div className="actions"><button className="secondary" disabled={exporting} onClick={() => void exportPending()}>{exporting ? "Generando Excel…" : "Exportar pendientes a Excel"}</button></div>
        {exportError && <div className="error" role="alert">{exportError}</div>}
        <CollapsibleTable><table><thead><tr><th>Actividad / competencia</th><th>Departamento / grupo</th><th>Datos por completar</th><th>Acción</th></tr></thead><tbody>{filtered.slice((currentPage - 1) * 8, currentPage * 8).map(({ need, missing }) => <tr key={need.id}><td><b>{need.competency || "Competencia sin definir"}</b><small className="completion-context">{need.area || "Área sin definir"} · {need.status}</small></td><td>{need.department || "Departamento sin definir"}<small className="completion-context">{need.occupational_group || "Grupo sin definir"}</small></td><td><div className="completion-fields">{missing.map(([key, label, section]) => <span title={section} className={`completion-badge ${section === "Levantamiento" ? "essential" : "planning"}`} key={key}>{label}</span>)}</div></td><td><button className="primary" onClick={() => { setDirty(false); setEditing(need); }}>Completar datos</button></td></tr>)}{!filtered.length && <tr><td colSpan={4}>{pending.length ? "No hay actividades que coincidan con los filtros." : "Todas las actividades tienen completos los datos revisados."}</td></tr>}</tbody></table></CollapsibleTable>
        <div className="matrix-pagination"><span>{filtered.length} actividades · Página {currentPage} de {pages}</span><div className="actions"><button className="secondary" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>Anterior</button><button className="secondary" disabled={currentPage >= pages} onClick={() => setPage(currentPage + 1)}>Siguiente</button></div></div>
      </details>
    </section></CompactSection>
    {editing && <Modal title="Completar datos de la actividad" busy={busy} onClose={close}><NeedForm key={editing.id} catalogs={catalogs} competencyMatrix={competencyMatrix} orgUnits={orgUnits} profile={profile} userId={userId} initialNeed={editing} period={period} openPlanning onDirtyChange={setDirty} onSavingChange={setBusy} onCancel={close} onDone={async () => { await reload(); setEditing(null); setDirty(false); }} /></Modal>}
  </>;
}

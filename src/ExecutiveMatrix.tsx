import type { Need, OrgUnit, Profile, Role } from './needTypes';
import type { TrainingRecord, BudgetAllocation } from './trainingExecution';
import { useBudget } from './BudgetModule';
import { usd } from './budgetModel';
import { analyticsData, makeReport } from './reportAnalytics';
import { CollapsibleTable } from './CollapsibleTable';

type Visibility = Pick<Profile, 'area' | 'department' | 'can_view_entire_area'>;
export function executiveVisibleNeeds(needs: Need[], role: Role, visibility?: Visibility | null) {
  if (role === 'admin') return needs;
  if (!visibility) return [];
  return needs.filter(n => Boolean(visibility.can_view_entire_area && visibility.area && n.area === visibility.area)
    || Boolean(visibility.department && n.department === visibility.department));
}

export function ExecutiveMatrix({ needs, role, visibility, records, mappings, units, periodName }: {
  needs: Need[]; role: Role; visibility?: Visibility | null; records: TrainingRecord[];
  mappings: BudgetAllocation[]; units: OrgUnit[]; periodName: string;
}) {
  const state = useBudget();
  const selected = executiveVisibleNeeds(needs, role, visibility);
  // Users keep their existing consultative DNC access; financial data remains administrator-only.
  const data = role === 'admin' ? state?.payload || null : null;
  const model = analyticsData(selected, role === 'admin' ? records : [], data, mappings, units, { area: '', department: '', group: '', fund: '' });
  const rows = makeReport('topics', model, data);
  const scope = role === 'admin' ? 'Todas las áreas y departamentos autorizados'
    : visibility?.can_view_entire_area ? `Área: ${visibility.area || 'Sin configurar'}` : `Departamento: ${visibility?.department || 'Sin configurar'}`;
  const money = (value: unknown) => value == null ? 'Por definir' : usd(Math.round(Number(value) * 100));
  return <section className="panel executive-matrix">
    <div className="panelhead"><div><h2>Matriz consolidada</h2><p>{periodName} · {scope}</p></div><span>{rows.length} temas · {selected.length} necesidades</span></div>
    <p className="planning-note">Resumen por tema, grupo ocupacional, área y departamento. Las participaciones previstas no equivalen a personas únicas. {role === 'admin' ? 'El utilizado incluye gastos vinculados al tema; los gastos sin cruce se revisan en Reportes.' : 'Consulta del alcance autorizado, sin filtros ni edición. El costo estimado corresponde a lo solicitado en DNC.'}</p>
    <CollapsibleTable pageSize={10}><table><thead><tr><th>Tema / competencia</th><th>Grupo ocupacional</th><th>Área</th><th>Departamento</th><th>Participaciones previstas</th><th>Costo estimado DNC</th>{role === 'admin' && <><th>Presupuesto asignado</th><th>Utilizado vinculado</th><th>Saldo</th></>}</tr></thead><tbody>
      {rows.map((r, i) => {
        const activities = data ? model.activities.filter(a => a.name === r.topic && a.area === r.area && a.department === r.department && a.group === r.group) : [];
        const used = data ? activities.reduce((s, a) => s + (model.execution?.used.get(a.id) || 0), 0) / 100 : null;
        const balance = r.assigned == null || used == null ? null : Number(r.assigned) - used;
        return <tr key={JSON.stringify([r.topic, r.group, r.area, r.department, i])}><td>{r.topic || 'Tema sin definir'}</td><td>{r.group || 'Sin grupo'}</td><td>{r.area || 'Sin área'}</td><td>{r.department || 'Sin departamento'}</td><td className="numeric-cell">{Number(r.people).toLocaleString('es-EC')}</td><td className="numeric-cell">{money(r.estimated)}</td>{role === 'admin' && <><td className="numeric-cell">{money(r.assigned)}</td><td className="numeric-cell">{money(used)}</td><td className="numeric-cell">{money(balance)}</td></>}</tr>;
      })}
      {!rows.length && <tr><td colSpan={role === 'admin' ? 9 : 6}>No existen necesidades de capacitación en este período y alcance autorizado.</td></tr>}
    </tbody></table></CollapsibleTable>
  </section>;
}

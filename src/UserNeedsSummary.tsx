import { useState } from 'react';
import type { Need } from './needTypes';
import { CollapsibleTable } from './CollapsibleTable';
const dateLabel=(value:string|null|undefined)=>value?/^\d{4}-\d{2}-\d{2}$/.test(value)?value.split('-').reverse().join('/'):value:'Por planificar';
export function UserNeedsSummary({needs,userId,periodId,periodName}:{needs:Need[];userId:string;periodId:string;periodName:string}) {
  const [page,setPage]=useState(1);
  const own=userId&&periodId?needs.filter(n=>n.owner_id===userId&&n.period_id===periodId):[];
  const count=Math.max(1,Math.ceil(own.length/10)),current=Math.min(page,count);
  return <section className="panel user-requested-topics"><div className="panelhead"><div><h2>Mis temas solicitados</h2><p>{periodName} · {own.length} solicitudes registradas por usted</p></div></div><p className="planning-note">El presupuesto estimado corresponde al costo registrado en su DNC. Los montos pendientes se muestran como «Por estimar».</p>
    <CollapsibleTable defaultCollapsed={false}><table><thead><tr><th>Tema / competencia</th><th>Área</th><th>Departamento</th><th>Participantes</th><th>Fechas planificadas</th><th>Presupuesto estimado (USD)</th><th>Estado</th></tr></thead><tbody>{own.slice((current-1)*10,current*10).map(n=><tr key={n.id}><td>{n.competency||'Tema sin definir'}</td><td>{n.area||'Sin área'}</td><td>{n.department||'Sin departamento'}</td><td className="numeric-cell">{Number(n.participants||0).toLocaleString('es-EC')}</td><td>{dateLabel(n.planned_start_date||n.planned_date)}{n.planned_end_date&&<> al {dateLabel(n.planned_end_date)}</>}</td><td className="numeric-cell">{n.estimated_cost==null||!Number.isFinite(Number(n.estimated_cost))?'Por estimar':Number(n.estimated_cost).toLocaleString('es-EC',{style:'currency',currency:'USD'})}</td><td>{n.status||'Sin estado'}</td></tr>)}{!own.length&&<tr><td colSpan={7}>Todavía no ha registrado necesidades de capacitación en este período. Puede hacerlo desde «Nueva necesidad».</td></tr>}</tbody></table></CollapsibleTable>
    {own.length>10&&<div className="actions"><button type="button" className="secondary" disabled={current===1} onClick={()=>setPage(current-1)}>Anterior</button><span>Página {current} de {count}</span><button type="button" className="secondary" disabled={current===count} onClick={()=>setPage(current+1)}>Siguiente</button></div>}
  </section>;
}

import { needReportColumns, needReportValue } from './needPlanning';
import type { Need, OrgUnit } from './needTypes';
import type { BudgetData } from './budgetModel';
import type { TrainingRecord, BudgetAllocation } from './trainingExecution';
import { budgetExecution, budgetNorm, calculateBudget } from './budgetModel';
import { missingNeedFields } from './needReview';
export type ReportScope={area:string;department:string;group:string;fund:string};
export type AnalyticsRow=Record<string,string|number|null>;
export const reportTypes={complete:'DNC completo y ejecución presupuestaria',topics:'Temas de capacitación',distribution:'Distribución presupuestaria',execution:'Presupuestado vs. ejecutado',received:'Capacitaciones recibidas',hours:'Banco de horas',logistics:'Logística adicional',pending:'Datos pendientes'};
export type ReportKind=keyof typeof reportTypes;
export const scopeMatches=(s:ReportScope,v:{area?:string;department?:string;group?:string;fund?:string})=>(['area','department','group','fund'] as const).every(k=>!s[k]||budgetNorm(s[k])===budgetNorm(v[k]||''));
export const isExecuted=(r:TrainingRecord)=>!['CANCELADO','CANCELADA','ANULADO','ANULADA','RECHAZADO','RECHAZADA'].includes(budgetNorm(r.status));
export function analyticsData(needs:Need[],records:TrainingRecord[],data:BudgetData|null,mappings:BudgetAllocation[],units:OrgUnit[],scope:ReportScope){
 const calculation=data?calculateBudget(data):null;
 const amounts=calculation?.amounts||new Map<string,number>(),remaining=calculation?.remaining||new Map<string,number>();
 const execution=data?budgetExecution(data,records,mappings):null;
 const activities=data?.nodes.filter(n=>n.kind==='activity')||[];
 const classified=records.filter(isExecuted).map(r=>{
  const match=activities.find(n=>n.id===execution?.resolved.get(r.id));
  const departments=units.filter(u=>u.active&&budgetNorm(mappings.find(m=>budgetNorm(m.department_name)===budgetNorm(u.department_name))?.requesting_area_name||u.department_name)===budgetNorm(r.requesting_area));
  const areas=[...new Set(departments.map(u=>u.area_name))],deps=[...new Set(departments.map(u=>u.department_name))];
  return {record:r,area:match?.area||(areas.length===1?areas[0]:r.area)||'Sin área identificada',department:match?.department||(deps.length===1?deps[0]:r.department)||r.requesting_area,group:match?.group||r.occupational_group,fund:match?.fund||'',linked:!!match};
 }).filter(r=>scopeMatches(scope,r));
 const nodes=(data?.nodes||[]).filter(n=>scopeMatches(scope,n));
 const selected=needs.filter(n=>scopeMatches({...scope,fund:''},{area:n.area,department:n.department,group:n.occupational_group})&&(!scope.fund||activities.some(a=>a.fund===scope.fund&&a.area===n.area&&a.department===n.department&&a.group===n.occupational_group&&a.name===n.competency)));
 const areas=new Map<string,{area:string;planned:number;spent:number;unknown:number}>();
 const get=(area:string)=>{if(!areas.has(area))areas.set(area,{area,planned:0,spent:0,unknown:0});return areas.get(area)!;};
 if(data){
  // Select exactly one level. Never sum parent allocations and their descendants.
  const level=scope.department?'department':'area';
  for(const n of nodes.filter(n=>n.kind===level))get(n.area).planned+=amounts.get(n.id)||0;
 }else for(const n of selected){const row=get(n.area||'Sin área identificada');if(n.estimated_cost==null)row.unknown++;else row.planned+=Math.round(Number(n.estimated_cost)*100);}
 for(const r of classified)get(r.area).spent+=Math.round(Number(r.record.cost)*100);
 const areaRows=[...areas.values()].sort((a,b)=>a.area.localeCompare(b.area,'es')).map(v=>({...v,balance:v.unknown?null:v.planned-v.spent}));
 const distributionLevel=scope.department?'department':scope.area?'area':scope.group?'group':null;
 const distributionAssigned=data?(distributionLevel?nodes.filter(n=>n.kind===distributionLevel).reduce((s,n)=>s+(amounts.get(n.id)||0),0):data.funds.filter(f=>!scope.fund||f.name===scope.fund).reduce((s,f)=>s+f.cents,0)):null;
 const distributionPending=data?(distributionLevel?nodes.filter(n=>n.kind===distributionLevel).reduce((s,n)=>s+(remaining.get(n.id)||0),0):data.funds.filter(f=>!scope.fund||f.name===scope.fund).reduce((s,f)=>s+(remaining.get(f.name)||0),0)):null;
 return {amounts,remaining,distributionAssigned,distributionPending,activities,nodes,selected,classified,areaRows,unmatched:classified.filter(v=>!v.linked),execution};
}
const requesterLabel=(n:Need)=>`${n.requester?.username?.trim().toUpperCase()||"USUARIO NO DISPONIBLE"}-${n.department?.trim().toUpperCase()||"SIN DEPARTAMENTO"}`;
export function makeReport(kind:ReportKind,model:ReturnType<typeof analyticsData>,data:BudgetData|null){
 const {selected,nodes,amounts,remaining,classified,areaRows,activities}=model;
 let rows:AnalyticsRow[]=[];
 if(kind==='complete'){
  rows=[...selected].sort((a,b)=>(a.dnc_code||'').localeCompare(b.dnc_code||'','es',{numeric:true})).map(n=>{
   const linked=nodes.filter(v=>v.kind==='activity'&&v.need_id===n.id);
   const shared=nodes.filter(v=>v.kind==='activity'&&v.need_id!==n.id&&v.name===n.competency&&v.area===n.area&&v.department===n.department&&v.group===n.occupational_group);
   const assigned=linked.reduce((s,v)=>s+(amounts.get(v.id)||0),0);
   const spent=linked.reduce((s,v)=>s+(model.execution?.used.get(v.id)||0),0);
   const costs=Object.fromEntries((['meals','lodging','travel'] as const).map(key=>[key,!linked.length||linked.some(v=>v.costs?.[key]==null)?null:linked.reduce((s,v)=>s+(v.costs?.[key]||0),0)/100])) as Record<'meals'|'lodging'|'travel',number|null>;
   const logisticsTotal=Object.values(costs).some(v=>v==null)?null:Object.values(costs).reduce<number>((s,v)=>s+Number(v),0);
   return {dnc_id:n.dnc_code||"Por asignar",owner_id:requesterLabel(n),...Object.fromEntries(needReportColumns.map(([key])=>[key,key==='hours'||key==='participants'||key==='estimated_cost'?n[key]??null:needReportValue(n,key)])),fund:linked.map(v=>v.fund).filter((v,i,a)=>a.indexOf(v)===i).join(' · ')||'Sin asignación directa',assigned:!data?null:linked.length?assigned/100:shared.length?null:0,spent:!data?null:linked.length?spent/100:shared.length?null:0,balance:!data?null:linked.length?(assigned-spent)/100:shared.length?null:0,...costs,total:logisticsTotal,financial_reference:linked.length?'Asignación directa':shared.length?`Compartido; contabilizado en DNC ${[...new Set(shared.map(v=>selected.find(n=>n.id===v.need_id)?.dnc_code||'Código pendiente'))].join(', ')}`:'Sin asignación vinculada',pending_data:missingNeedFields(n).map(([,label])=>label).join('; ')||'Completo'};
  });
 }else if(kind==='topics'){
  const grouped=new Map<string,AnalyticsRow>();for(const n of selected){const key=JSON.stringify([n.area,n.department,n.occupational_group,n.competency]);const v=grouped.get(key)||{topic:n.competency,area:n.area,department:n.department,group:n.occupational_group,people:0,estimated:0,assigned:data?0:null,missing:0};v.people=Number(v.people)+Number(n.participants||0);if(n.estimated_cost==null)v.missing=Number(v.missing)+1;else v.estimated=Number(v.estimated)+Number(n.estimated_cost);grouped.set(key,v);}
  rows=[...grouped.values()].map(v=>({...v,estimated:Number(v.missing)?null:v.estimated,assigned:data?activities.filter(a=>nodes.some(n=>n.id===a.id)&&a.name===v.topic&&a.area===v.area&&a.department===v.department&&a.group===v.group).reduce((s,a)=>s+(amounts.get(a.id)||0),0)/100:null}));
 }else if(kind==='distribution')rows=nodes.map(n=>({fund:n.fund,level:({group:'Grupo',area:'Área',department:'Departamento',activity:'Tema'})[n.kind],group:n.group,area:n.area,department:n.department,topic:n.kind==='activity'?n.name:'',assigned:(amounts.get(n.id)||0)/100,undistributed:n.kind==='activity'?null:(remaining.get(n.id)||0)/100}));
 else if(kind==='execution')rows=areaRows.map(v=>({area:v.area,assigned:v.unknown?null:v.planned/100,spent:v.spent/100,balance:v.balance==null?null:v.balance/100,ratio:v.unknown||!v.planned?null:Math.round(v.spent/v.planned*10000)/100}));
 else if(kind==='received')rows=classified.map(({record:r,...v})=>({topic:r.topic,name:r.name,area:v.area,department:v.department,group:v.group,fund:v.fund||'Sin vincular',start:r.start_date,end:r.end_date,hours:Number(r.duration),provider:r.company,spent:Number(r.cost),status:r.status}));
 else if(kind==='hours'){
  const by=new Map<string,AnalyticsRow>();for(const n of selected){const k=JSON.stringify([n.area,n.department,n.occupational_group]);const v=by.get(k)||{area:n.area,department:n.department,group:n.occupational_group,planned:0,fulfilled:0,unknown:0};if(n.hours==null)v.unknown=Number(v.unknown)+1;else v.planned=Number(v.planned)+Number(n.hours)*Number(n.participants);by.set(k,v);}
  for(const r of classified){const k=JSON.stringify([r.area,r.department,r.group]);const v=by.get(k)||{area:r.area,department:r.department,group:r.group,planned:0,fulfilled:0,unknown:0};v.fulfilled=Number(v.fulfilled)+Number(r.record.duration);by.set(k,v);}
  rows=[...by.values()].map(v=>({...v,planned:Number(v.unknown)?null:v.planned,difference:Number(v.unknown)?null:Number(v.planned)-Number(v.fulfilled)}));
 }else if(kind==='logistics')rows=nodes.filter(n=>n.kind==='activity').map(n=>({fund:n.fund,group:n.group,area:n.area,department:n.department,topic:n.name,meals:n.costs?.meals==null?null:n.costs.meals/100,lodging:n.costs?.lodging==null?null:n.costs.lodging/100,travel:n.costs?.travel==null?null:n.costs.travel/100,total:['meals','lodging','travel'].some(k=>n.costs?.[k as 'meals']==null)?null:((n.costs?.meals||0)+(n.costs?.lodging||0)+(n.costs?.travel||0))/100}));
 else rows=selected.filter(n=>missingNeedFields(n).length).map(n=>({topic:n.competency,area:n.area,department:n.department,group:n.occupational_group,owner:requesterLabel(n),missing:missingNeedFields(n).map(([,label])=>label).join('; ')}));
 return rows;
}
export function monthlyTrend(entries:{date:string|null|undefined;value:number}[],start?:string,end?:string){
 const grouped=new Map<string,number>();let missing=0;for(const e of entries){if(!e.date||!/^\d{4}-\d{2}-\d{2}/.test(e.date)){missing++;continue;}const key=e.date.slice(0,7);grouped.set(key,(grouped.get(key)||0)+e.value);}
 if(!grouped.size)return {points:[],missing};
 if(start&&end){let date=new Date(start.slice(0,7)+'-01T00:00:00Z');const limit=new Date(end.slice(0,7)+'-01T00:00:00Z');for(let i=0;i<120&&date<=limit;i++){const key=date.toISOString().slice(0,7);if(!grouped.has(key))grouped.set(key,0);date.setUTCMonth(date.getUTCMonth()+1);}}
 return {points:[...grouped].sort(([a],[b])=>a.localeCompare(b)).map(([label,value])=>({label,value})),missing};
}

export function reportReconciliation(model:ReturnType<typeof analyticsData>,data:BudgetData|null){
 const allocated=data?model.nodes.filter(n=>n.kind==='activity').reduce((s,n)=>s+(model.amounts.get(n.id)||0),0):null;
 const complete=makeReport('complete',model,data);
 const directAssigned=data?complete.reduce((s,r)=>s+Math.round(Number(r.assigned||0)*100),0):null;
 const directUsed=data?complete.reduce((s,r)=>s+Math.round(Number(r.spent||0)*100),0):null;
 const cost=model.selected.some(n=>n.estimated_cost==null)?null:model.selected.reduce((s,n)=>s+Math.round(Number(n.estimated_cost||0)*100),0);
 return [
  {concept:'Costo estimado de las DNC',value:cost==null?null:cost/100,unit:'USD'},
  {concept:'Presupuesto de capacitación del alcance',value:model.distributionAssigned==null?null:model.distributionAssigned/100,unit:'USD'},
  {concept:'Asignado a temas (sin sumar niveles)',value:allocated==null?null:allocated/100,unit:'USD'},
  {concept:'Asignado a DNC representadas',value:directAssigned==null?null:directAssigned/100,unit:'USD'},
  {concept:'Utilizado vinculado a DNC',value:directUsed==null?null:directUsed/100,unit:'USD'},
  {concept:'Saldo de DNC vinculadas',value:directAssigned==null||directUsed==null?null:(directAssigned-directUsed)/100,unit:'USD'},
  {concept:'Pendiente de distribuir hasta temas',value:model.distributionAssigned==null||allocated==null?null:(model.distributionAssigned-allocated)/100,unit:'USD'},
  {concept:'Gasto ejecutado sin vincular a actividad/fondo',value:model.unmatched.reduce((s,r)=>s+Math.round(Number(r.record.cost)*100),0)/100,unit:'USD'},
  {concept:'Horas-persona planificadas DNC',value:model.selected.some(n=>n.hours==null)?null:model.selected.reduce((s,n)=>s+Number(n.hours)*Number(n.participants),0),unit:'Horas-persona'},
  {concept:'Horas-persona ejecutadas del alcance',value:model.classified.reduce((s,r)=>s+Number(r.record.duration),0),unit:'Horas-persona'}
 ];
}

export function pendingTopicAllocation(model:ReturnType<typeof analyticsData>) {
 return model.distributionAssigned==null?null:model.distributionAssigned-model.nodes.filter(n=>n.kind==='activity').reduce((s,n)=>s+(model.amounts.get(n.id)||0),0);
}

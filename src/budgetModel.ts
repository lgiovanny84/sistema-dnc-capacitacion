import type { TrainingRecord, BudgetAllocation } from './trainingExecution';
export const fundTypes = ['Institucional', 'Broker', 'Otros'] as const;
export type FundType = typeof fundTypes[number];
export const costLabels = { training:'Capacitación', lodging:'Hospedajes', meals:'Alimentación', travel:'Movilización' };
export type BudgetNode = { id: string; parent: string; fund: FundType; kind: 'area' | 'department' | 'activity'; name: string; area: string; department: string; group: string; need_id: string | null; mode: 'percent' | 'amount'; value: number; people: number; gap: number; criticality: number; risk: number; impact: number; method_base_percent?:number; costs?:Partial<Record<keyof typeof costLabels,number|null>> };
export type BudgetData = { funds: { name: FundType; cents: number }[]; nodes: BudgetNode[]; links: { record_id: string; node_id: string }[] };
export type BudgetState = { period_id: string; revision: number; payload: BudgetData; updated_at?: string };
export const emptyBudget = (): BudgetData => ({ funds: fundTypes.map(name => ({ name, cents: 0 })), nodes: [], links: [] });
export const budgetNorm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toUpperCase();
export const usd = (cents: number) => (cents / 100).toLocaleString('es-EC', { style: 'currency', currency: 'USD' });
export function calculateBudget(data: BudgetData) {
  const amounts = new Map<string, number>(), remaining = new Map<string, number>(), errors: string[] = [];
  const ids = new Set(data.nodes.map(n => n.id));
  if (ids.size !== data.nodes.length) errors.push('Existen identificadores repetidos.');
  const visit = (parent: string, fund: FundType, amount: number, depth: number) => {
    if (depth > 3) { errors.push('La jerarquía admite área, departamento y actividad.'); return; }
    amounts.set(parent, amount);
    const children = data.nodes.filter(n => n.parent === parent && n.fund === fund);
    if (children.filter(n => n.mode === 'percent').reduce((s,n) => s+n.value,0) > 10000) errors.push(`${data.nodes.find(n=>n.id===parent)?.name||parent}: los porcentajes superan el 100 %.`);
    let distributed = 0;
    for (const n of children) {
      const p = data.nodes.find(v => v.id === parent);
      if (!(n.kind === 'area' && !p || n.kind === 'department' && p?.kind === 'area' || n.kind === 'activity' && p?.kind === 'department')) errors.push(`${n.name}: jerarquía no válida.`);
      if (!n.name.trim() || !Number.isSafeInteger(n.value) || n.value < 0 || n.value > (n.mode === 'percent' ? 10000 : 1e12)) errors.push(`${n.name || 'Nueva asignación'}: revise nombre y valor.`);
      const value = n.mode === 'percent' && Number.isSafeInteger(amount) && Number.isSafeInteger(n.value) ? Number(BigInt(amount) * BigInt(n.value) / 10000n) : n.mode === 'amount' ? n.value : 0;
      distributed += value; visit(n.id, fund, value, depth + 1);
      const costs=Object.values(n.costs||{}).filter((v):v is number=>v!=null);
      if(costs.some(v=>!Number.isSafeInteger(v)||v<0)||costs.reduce((s,v)=>s+v,0)>value) errors.push(`${n.name}: el desglose de inversión supera la asignación o contiene valores no válidos.`);
    }
    remaining.set(parent, amount - distributed);
    if (distributed > amount) errors.push(`${data.nodes.find(n => n.id === parent)?.name || parent}: la distribución supera el monto disponible.`);
  };
  for (const name of fundTypes) {
    const funds = data.funds.filter(f => f.name === name);
    if (funds.length !== 1 || !Number.isSafeInteger(funds[0]?.cents) || funds[0]?.cents < 0 || funds[0]?.cents > 1e12) errors.push(`Revise el fondo ${name}.`);
    visit(name, name, funds[0]?.cents || 0, 0);
  }
  if (data.funds.length !== 3) errors.push('Deben existir los tres fondos independientes.');
  for (const n of data.nodes) if (!amounts.has(n.id)) errors.push(`${n.name}: relación huérfana o circular.`);
  return { amounts, remaining, errors };
}
// Allocate only the selected pool; remainders reconcile exactly without inventing funds.
function apportion(total: number, weights: number[]) {
  const sum = weights.reduce((s,v)=>s+v,0);
  if (!sum) return weights.map(()=>0);
  const raw = weights.map(w=>total*w/sum), result = raw.map(Math.floor);
  const order = raw.map((v,i)=>({i,r:v-result[i]})).sort((a,b)=>b.r-a.r || a.i-b.i);
  for(let i=0,left=total-result.reduce((s,v)=>s+v,0);i<left;i++) result[order[i].i]++;
  return result;
}
export function distributeMethod(nodes: BudgetNode[], cents: number, basePercent: number) {
  if (!Number.isFinite(basePercent) || basePercent < 0 || basePercent > 100) throw new Error('El porcentaje base debe estar entre 0 y 100.');
  if (nodes.some(n=>!Number.isInteger(n.people) || n.people<0 || [n.gap,n.criticality,n.risk,n.impact].some(v=>!Number.isFinite(v)||v<0||v>1))) throw new Error('Personas: entero no negativo. Factores: entre 0 y 1.');
  const base = Math.floor(cents*basePercent/100), variable=cents-base;
  const a=apportion(base,nodes.map(n=>n.people)), b=apportion(variable,nodes.map(n=>.4*n.gap+.3*n.criticality+.2*n.risk+.1*n.impact));
  return nodes.map((n,i)=>({...n,mode:'amount' as const,value:a[i]+b[i],method_base_percent:basePercent}));
}
export function budgetExecution(data: BudgetData, records: TrainingRecord[], mappings: BudgetAllocation[]) {
  const used = new Map<string,number>(), unmatched: TrainingRecord[] = [];
  const resolved = new Map<string,string>();
  const activities = data.nodes.filter(n=>n.kind==='activity');
  for(const record of records) {
    if (['CANCELADO','CANCELADA','ANULADO','ANULADA','RECHAZADO','RECHAZADA'].includes(budgetNorm(record.status))) continue;
    const explicit = data.links.find(l=>l.record_id===record.id);
    const matches = activities.filter(n => {
      const alternatives=mappings.filter(m=>budgetNorm(m.department_name)===budgetNorm(n.department));
      const cross=alternatives[0]?.requesting_area_name || n.department;
      return budgetNorm(cross)===budgetNorm(record.requesting_area) && budgetNorm(n.name)===budgetNorm(record.topic);
    });
    let node = explicit ? activities.find(n=>n.id===explicit.node_id) : matches.length===1 ? matches[0] : undefined;
    if(!node) {unmatched.push(record); continue;}
    resolved.set(record.id,node.id);
    const cents=Math.round(Number(record.cost)*100);
    used.set(node.fund,(used.get(node.fund)||0)+cents);
    const seen=new Set<string>();
    while(node && !seen.has(node.id)) {seen.add(node.id);used.set(node.id,(used.get(node.id)||0)+cents);node=data.nodes.find(n=>n.id===node!.parent);}
  }
  return {used,unmatched,resolved};
}

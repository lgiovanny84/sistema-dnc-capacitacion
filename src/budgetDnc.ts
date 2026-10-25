import type { Need } from './needTypes';
import { calculateBudget, type BudgetData, type BudgetNode, usd } from './budgetModel';

// DNC is a proposal. Saved assignments and independent funds are separate decisions.
export function dncBudget(node: BudgetNode, needs: Need[]) {
  const scoped = needs.filter(n => n.occupational_group === node.group
    && (node.kind === 'group' || n.area === node.area)
    && (['group', 'area'].includes(node.kind) || n.department === node.department));
  const topic = scoped.find(n => n.id === node.need_id)?.competency || node.name;
  const selected = node.kind === 'activity' ? scoped.filter(n => n.competency === topic) : scoped;
  let knownCents = 0, missing = 0;
  for (const need of selected) {
    const value = need.estimated_cost == null ? null : Number(need.estimated_cost);
    if (value == null || !Number.isFinite(value) || value < 0) missing++;
    else knownCents += Math.round(value * 100);
  }
  return { count: selected.length, missing, knownCents,
    cents: selected.length && !missing && Number.isSafeInteger(knownCents) ? knownCents : null };
}

export function applyDncBudgets(data: BudgetData, ids: string[], needs: Need[]) {
  const selected = new Set(ids);
  if (!selected.size) throw new Error('Seleccione elementos con necesidades DNC.');
  if(data.nodes.filter(n=>selected.has(n.id)).length!==selected.size)throw new Error('La selección presupuestaria ya no está disponible.');
  const nodes = data.nodes.map(node => {
    if (!selected.has(node.id)) return node;
    const proposal = dncBudget(node, needs);
    if (proposal.cents == null) throw new Error(`${node.name}: complete el presupuesto de todas sus DNC antes de aplicarlo.`);
    return { ...node, mode: 'amount' as const, value: proposal.cents };
  });
  const result = { ...data, nodes }, check = calculateBudget(result);
  if (check.errors.length) throw new Error(`No se aplicó el presupuesto DNC. ${check.errors.join(' ')}`);
  return result;
}

export function dncBudgetLabel(node: BudgetNode, needs: Need[]) {
  const proposal = dncBudget(node, needs);
  return !proposal.count ? 'Sin DNC' : proposal.cents == null ? 'Por estimar' : usd(proposal.cents);
}

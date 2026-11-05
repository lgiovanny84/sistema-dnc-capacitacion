import type { Need, OrgUnit } from './needTypes';
import type { BudgetNode } from './budgetModel';
// Callers supply only the selected period and the user's authorized DNC rows.
const norm=(v:string|undefined)=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().replace(/\s+/g,' ').toUpperCase();
export function hasDnc(needs:Need[],scope:{group?:string;area?:string;department?:string}) {
 return needs.some(n=>(!scope.group||norm(n.occupational_group)===norm(scope.group))&&(!scope.area||norm(n.area)===norm(scope.area))&&(!scope.department||norm(n.department)===norm(scope.department)));
}
export function dncUnits(units:OrgUnit[],needs:Need[]) {
 return units.filter(u=>u.active&&hasDnc(needs,{group:u.group_name,area:u.area_name,department:u.department_name}));
}
export function nodeHasDnc(node:BudgetNode,needs:Need[]) {
 return hasDnc(needs,{group:node.group,area:node.kind==='group'?'':node.area,department:node.kind==='department'||node.kind==='activity'?node.department:''})&&(node.kind!=='activity'||needs.some(n=>norm(n.occupational_group)===norm(node.group)&&norm(n.area)===norm(node.area)&&norm(n.department)===norm(node.department)&&(n.id===node.need_id||n.competency===node.name)));
}

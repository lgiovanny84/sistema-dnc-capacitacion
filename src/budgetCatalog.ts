import type { Need, OrgUnit } from './needTypes';
import type { CompetencyMatrixRow } from './competencyMatrix';
import type { BudgetData, BudgetNode, FundType } from './budgetModel';
// One catalog source for each level. Existing allocations and execution links remain intact.
export function catalogChildren(data:BudgetData,parent:string,fund:FundType,units:OrgUnit[],needs:Need[],matrix:CompetencyMatrixRow[],uuid:()=>string=()=>crypto.randomUUID()) {
  const owner=data.nodes.find(n=>n.id===parent);
  const kind=owner?.kind==='group'?'area':owner?.kind==='area'?'department':owner?.kind==='department'?'activity':'group';
  const scope=units.filter(u=>u.active&&(!owner||u.group_name===owner.group)&&(kind!=='department'||u.area_name===owner?.name));
  const eligibleNeeds=needs.filter(n=>n.occupational_group===owner?.group&&n.area===owner?.area&&n.department===owner?.name);
  const names=kind==='group'?scope.map(u=>u.group_name):kind==='area'?scope.map(u=>u.area_name):kind==='department'?scope.map(u=>u.department_name):[...eligibleNeeds.map(n=>n.competency),...matrix.filter(m=>m.active&&m.group_name===owner?.group&&m.area===owner?.area&&m.department===owner?.name).map(m=>m.competency)];
  const existing=data.nodes.filter(n=>n.parent===parent);
  const added=[...new Set(names)].filter(name=>!existing.some(n=>n.name===name)).sort((a,b)=>a.localeCompare(b,'es')).map(name=>{
    const linked=kind==='activity'?eligibleNeeds.filter(n=>n.competency===name):[];
    return {id:uuid(),parent,fund,kind,name,area:kind==='area'?name:owner?.area||'',department:kind==='department'?name:kind==='activity'?owner?.name||'':'',group:kind==='group'?name:owner?.group||'',need_id:linked.length===1?linked[0].id:null,mode:'percent',value:0,people:0,gap:0,criticality:0,risk:0,impact:0} as BudgetNode;
  });
  return {...data,nodes:[...data.nodes,...added]};
}

import assert from 'node:assert/strict';
import {test} from 'node:test';
import {build} from 'esbuild';
async function load(file){const result=await build({entryPoints:[new URL('../src/'+file,import.meta.url).pathname],bundle:true,write:false,platform:'node',format:'esm'});return import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));}
const {catalogChildren}=await load('budgetCatalog.ts');
const {emptyBudget,calculateBudget,distributeEqually,trainingDistributed,logisticsTotals}=await load('budgetModel.ts');
const units=[{group_name:'Colaboradores',area_name:'Negocios',department_name:'Marketing',active:true},{group_name:'Colaboradores',area_name:'Negocios',department_name:'Marketing',active:true},{group_name:'Consejo',area_name:'Consejo',department_name:'Consejo',active:true},{group_name:'Inactivo',area_name:'Otra',department_name:'Otra',active:false}];
let i=0;const uuid=()=>String(++i);
function descend(d,parent,needs=[],matrix=[]){return catalogChildren(d,parent,'Institucional',units,needs,uuid);}
test('loads every configured group once and drills only into its own areas and departments',()=>{
 let d=descend(emptyBudget(),'Institucional');assert.deepEqual(d.nodes.map(n=>n.name),['Colaboradores','Consejo']);
 const group=d.nodes.find(n=>n.name==='Colaboradores');d=descend(d,group.id);const area=d.nodes.find(n=>n.kind==='area');assert.equal(area.name,'Negocios');assert.equal(area.group,'Colaboradores');
 d=descend(d,area.id);const dept=d.nodes.find(n=>n.kind==='department');assert.equal(dept.name,'Marketing');assert.equal(d.nodes.filter(n=>n.kind==='department').length,1);
 const need={id:'need',competency:'Ventas',occupational_group:'Colaboradores',area:'Negocios',department:'Marketing'};
 d=descend(d,dept.id,[need],[{active:true,competency:'Ventas',group_name:'Colaboradores',area:'Negocios',department:'Marketing'},{active:true,competency:'Ajeno',group_name:'Consejo',area:'Negocios',department:'Marketing'}]);
 assert.deepEqual(d.nodes.filter(n=>n.kind==='activity').map(n=>n.name),['Ventas']);assert.equal(d.nodes.find(n=>n.kind==='activity').need_id,'need');assert.equal(descend(d,dept.id,[need]).nodes.length,d.nodes.length);
});
test('bulk shares reconcile cents; logistics is additional and waits until training is distributed',()=>{
 let d=emptyBudget();d.funds[0].cents=101;d=descend(d,'Institucional');const allocated=distributeEqually(d.nodes,101);d.nodes=allocated;assert.equal(allocated.reduce((s,n)=>s+n.value,0),101);assert.equal(trainingDistributed(d),false);
 const group=d.nodes[0];d=descend(d,group.id);d.nodes=d.nodes.map(n=>n.kind==='area'?{...n,mode:'percent',value:10000}:n);const area=d.nodes.find(n=>n.kind==='area');d=descend(d,area.id);d.nodes=d.nodes.map(n=>n.kind==='department'?{...n,mode:'percent',value:10000}:n);const dept=d.nodes.find(n=>n.kind==='department');
 const activity={...dept,id:'topic',parent:dept.id,kind:'activity',name:'Ventas',mode:'percent',value:10000,costs:{meals:10000,lodging:20000,travel:30000}};d.nodes.push(activity);
 const calc=calculateBudget(d);assert.equal(calc.errors.length,0);assert.equal(calc.amounts.get(activity.id),51);assert.equal(logisticsTotals(d)[0].meals,10000);assert.equal(calc.amounts.get('Institucional'),101);
});

test('a department with no DNC selections has no topics; duplicates share a valid selected DNC link',()=>{let d=descend(emptyBudget(),'Institucional');const g=d.nodes[0];d=descend(d,g.id);const a=d.nodes.find(n=>n.kind==='area');d=descend(d,a.id);const dep=d.nodes.find(n=>n.kind==='department');assert.equal(descend(d,dep.id).nodes.filter(n=>n.kind==='activity').length,0);const n={id:'b',competency:'Seleccionado',occupational_group:'Colaboradores',area:'Negocios',department:'Marketing'};d=descend(d,dep.id,[n,{...n,id:'a'},{...n,id:'other',department:'Otro'}]);const topics=d.nodes.filter(n=>n.kind==='activity');assert.equal(topics.length,1);assert.equal(topics[0].need_id,'a');});

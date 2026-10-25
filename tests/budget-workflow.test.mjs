import assert from 'node:assert/strict';
import {test} from 'node:test';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import vm from 'node:vm';
const require=createRequire(import.meta.url);
const result=await build({entryPoints:[new URL('../src/BudgetModule.tsx',import.meta.url).pathname],bundle:true,write:false,platform:'node',format:'cjs',jsx:'automatic',external:['react','react/jsx-runtime','react-dom','exceljs'],plugins:[{name:'mock-db',setup(b){b.onResolve({filter:/^\.\/supabase$/},()=>({path:'supabase',namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:'export const supabase=globalThis.__db;',loader:'js'}));}}]});
const walk=n=>!n||typeof n!=='object'?[]:[n,...[n.props?.children].flat(Infinity).flatMap(walk)];
test('administrator drills group → area → department → topic, distributes in bulk and then budgets logistics separately',async()=>{
 const states=[];let index=0,id=0,saved;
 const react={...require('react'),useEffect(){},useState(initial){const i=index++;if(!(i in states))states[i]=typeof initial==='function'?initial():initial;return[states[i],v=>states[i]=typeof v==='function'?v(states[i]):v];}};
 const ctx={module:{exports:{}},exports:{},crypto:{randomUUID:()=>String(++id)},__db:{async rpc(name,args){saved=args.p_payload;return{data:{revision:1,payload:saved},error:null}}},require(n){return n==='react'?react:require(n)}};
 vm.runInNewContext(result.outputFiles[0].text,ctx);
 const props={state:null,error:'',period:{id:'period',name:'2027'},units:[{group_name:'Colaboradores',area_name:'Negocios',department_name:'Marketing',active:true}],needs:[{id:'dnc',competency:'Ventas',occupational_group:'Colaboradores',area:'Negocios',department:'Marketing'}],matrix:[{group_name:'Colaboradores',area:'Negocios',department:'Marketing',competency:'Ventas',active:true}],records:[],mappings:[],onSaved(){},onPendingChange(){}};
 let tree;function render(){index=0;tree=ctx.module.exports.BudgetModule(props);return tree;}
 function button(label){const n=walk(tree).find(n=>n.type==='button'&&n.props.children===label);assert.ok(n,label);return n;}
 function input(label,value){const n=walk(tree).find(n=>n.type==='input'&&n.props['aria-label']===label);assert.ok(n,label);n.props.onChange({target:{value}});render();}
 render();assert.equal(button('Generar presupuesto adicional de logística').props.disabled,true);input('Presupuesto Institucional','100');
 for(const label of ['Colaboradores','Negocios','Marketing']){button('Distribuir a todos por igual').props.onClick();render();const row=walk(tree).find(n=>n.type==='button'&&Array.isArray(n.props.children)&&n.props.children[0]===label);assert.ok(row,label);row.props.onClick();render();}
 input('Presupuesto Broker','250');assert.equal(button('Generar presupuesto adicional de logística').props.disabled,false);button('Distribuir a todos por igual').props.onClick();render();assert.equal(button('Generar presupuesto adicional de logística').props.disabled,false);
 button('Generar presupuesto adicional de logística').props.onClick();render();input('Alimentación','200');input('Valor Ventas','50');assert.ok(walk(tree).find(n=>n.type==='input'&&n.props['aria-label']==='Alimentación'));input('Hospedajes','40');input('Movilización','30');await button('Guardar todos los cambios').props.onClick();
 assert.equal(saved.funds[0].cents,10000);assert.deepEqual(Array.from(saved.nodes,n=>n.kind),['group','area','department','activity']);assert.equal(saved.nodes[3].value,5000);assert.equal(saved.nodes[3].costs.meals,20000);assert.equal(saved.logistics_generated,true);
});

test('logistics follows department navigation and fund, scopes totals, and preserves amounts when changing departments',async()=>{
 const states=[];let index=0,saved,newId=0;
 const react={...require('react'),useEffect(){},useState(initial){const i=index++;if(!(i in states))states[i]=typeof initial==='function'?initial():initial;return[states[i],v=>states[i]=typeof v==='function'?v(states[i]):v];}};
 const ctx={module:{exports:{}},exports:{},crypto:{randomUUID:()=>`new-${++newId}`} ,__db:{async rpc(name,args){saved=args.p_payload;return{data:{revision:2,payload:saved},error:null}}},require(n){return n==='react'?react:require(n)}};
 vm.runInNewContext(result.outputFiles[0].text,ctx);
 const node=(id,parent,kind,name,department='',value=10000,fund='Institucional')=>({id,parent,kind,name,department,area:kind==='group'?'':'Negocios',group:'Colaboradores',fund,mode:'percent',value,need_id:kind==='activity'?id:null,people:1,gap:0,criticality:0,risk:0,impact:0});
 const nodes=[node('g','Institucional','group','Colaboradores'),node('a','g','area','Negocios'),node('dm','a','department','Marketing','Marketing',5000),{...node('m1','dm','activity','Ventas','Marketing',5000),costs:{meals:10000,lodging:2000,travel:3000}},{...node('m2','dm','activity','Servicio','Marketing',5000),costs:{meals:5000,lodging:0,travel:0}},node('dh','a','department','Talento Humano','Talento Humano',5000),{...node('h','dh','activity','Selección','Talento Humano'),costs:{meals:70000,lodging:0,travel:0}},node('bg','Broker','group','Colaboradores','',10000,'Broker'),node('ba','bg','area','Negocios','',10000,'Broker'),node('bd','ba','department','Marketing','Marketing',10000,'Broker'),{...node('bt','bd','activity','Ventas','Marketing',10000,'Broker'),need_id:'m1',costs:{meals:80000,lodging:0,travel:0}}];
 const props={state:{revision:1,payload:{funds:[{name:'Institucional',cents:1000000},{name:'Broker',cents:200000},{name:'Otros',cents:0}],nodes,links:[],logistics_generated:true}},error:'',period:{id:'period',name:'2027'},units:['Marketing','Talento Humano'].map(department_name=>({group_name:'Colaboradores',area_name:'Negocios',department_name,active:true})),needs:nodes.filter(n=>n.kind==='activity'&&n.fund==='Institucional').map(n=>({id:n.id,competency:n.name,occupational_group:n.group,area:n.area,department:n.department})),records:[],mappings:[],onSaved(){},onPendingChange(){}};
 let tree;const render=()=>{index=0;tree=ctx.module.exports.BudgetModule(props);};
 const field=label=>walk(tree).find(n=>n.props?.['aria-label']===label);
 const choose=(label,value)=>{assert.ok(field(label),label);field(label).props.onChange({target:{value}});render();};
 const text=n=>typeof n==='string'||typeof n==='number'?String(n):!n||typeof n!=='object'?'':[n.props?.children].flat(Infinity).map(text).join('');
 const total=()=>walk(tree).filter(n=>n.type==='p').map(text).find(s=>s.includes('Total de logística del departamento'));
 render();assert.equal(field('Tema para logística'),undefined);assert.equal(field('Alimentación'),undefined);
 assert.deepEqual(Array.from(walk(field('Departamento para logística')).filter(n=>n.type==='option'&&n.props.value).map(n=>n.props.value)),['dm','dh']);
 choose('Departamento para logística','dm');assert.equal(field('Alimentación').props.value,100);assert.deepEqual(Array.from(walk(field('Tema para logística')).filter(n=>n.type==='option').map(n=>n.props.value)),['m1','m2']);assert.match(total(),/150,00/);assert.doesNotMatch(total(),/700,00|800,00/);
 choose('Alimentación','111');choose('Tema para logística','m2');assert.equal(field('Alimentación').props.value,50);
 choose('Departamento para logística','dh');assert.equal(field('Alimentación').props.value,700);assert.equal(field('Tema para logística').props.value,'h');
 choose('Departamento para logística','dm');assert.equal(field('Alimentación').props.value,111);
 const drill=label=>{const button=walk(tree).find(n=>n.type==='button'&&Array.isArray(n.props.children)&&n.props.children[0]===label);assert.ok(button,label);button.props.onClick();render();};
 drill('Colaboradores');drill('Negocios');drill('Talento Humano');assert.equal(field('Departamento para logística').props.value,'dh');assert.equal(field('Alimentación').props.value,700);
 walk(tree).find(n=>n.type==='button'&&n.props.children==='Negocios').props.onClick();render();assert.equal(field('Tema para logística'),undefined);
 choose('Fondo','Broker');assert.equal(field('Alimentación'),undefined);choose('Departamento para logística','bd');assert.equal(field('Alimentación').props.value,800);assert.match(total(),/Broker/);
 walk(tree).find(n=>n.type==='button'&&n.props.children==='Guardar todos los cambios').props.onClick();await Promise.resolve();assert.equal(saved.nodes.find(n=>n.id==='m1').costs.meals,11100);assert.equal(saved.nodes.find(n=>n.id==='h').costs.meals,70000);assert.equal(saved.nodes.find(n=>n.id==='bt').costs.meals,80000);
 for(let i=0;i<5;i++)await Promise.resolve();props.period.closed=true;render();assert.equal(field('Alimentación').props.disabled,true);assert.equal(walk(tree).find(n=>n.type==='button'&&n.props.children==='Guardar todos los cambios').props.disabled,true);choose('Alimentación','999');assert.equal(field('Alimentación').props.value,800);
});

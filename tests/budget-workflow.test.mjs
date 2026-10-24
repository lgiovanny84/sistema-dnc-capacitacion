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
 button('Distribuir a todos por igual').props.onClick();render();assert.equal(button('Generar presupuesto adicional de logística').props.disabled,false);
 button('Generar presupuesto adicional de logística').props.onClick();render();input('Alimentación','200');input('Hospedajes','40');input('Movilización','30');await button('Guardar todos los cambios').props.onClick();
 assert.equal(saved.funds[0].cents,10000);assert.deepEqual(Array.from(saved.nodes,n=>n.kind),['group','area','department','activity']);assert.equal(saved.nodes[3].value,10000);assert.equal(saved.nodes[3].costs.meals,20000);assert.equal(saved.logistics_generated,true);
});

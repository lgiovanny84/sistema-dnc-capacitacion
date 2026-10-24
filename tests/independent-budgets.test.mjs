import assert from 'node:assert/strict';
import {test, before, after} from 'node:test';
import {readFileSync} from 'node:fs';
import {build} from 'esbuild';
import {PGlite} from '@electric-sql/pglite';
const bundle=await build({entryPoints:[new URL('../src/budgetModel.ts',import.meta.url).pathname],bundle:true,write:false,platform:'node',format:'esm'});
const {emptyBudget,calculateBudget,distributeMethod,budgetExecution}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const period='11111111-1111-4111-8111-111111111111',admin='22222222-2222-4222-8222-222222222222',other='33333333-3333-4333-8333-333333333333',dep='44444444-4444-4444-8444-444444444444',groupId='99999999-9999-4999-8999-999999999999',areaId='88888888-8888-4888-8888-888888888888',activity='55555555-5555-4555-8555-555555555555',record='66666666-6666-4666-8666-666666666666';
const node=(id,parent,kind='department',value=1500)=>({id,parent,kind,value,fund:'Institucional',name:kind==='department'?'Marketing':'Ventas',area:'Negocios',department:'Marketing',group:'Colaboradores',need_id:null,mode:'percent',people:1,gap:1,criticality:0,risk:0,impact:0});
function fixture(){const d=emptyBudget();d.funds[0].cents=4000000;d.funds[1].cents=200000;d.nodes=[node(dep,areaId),node(activity,dep,'activity',10000),{...node(areaId,groupId,'area',10000),name:'Negocios',area:'Negocios',department:''},{...node(groupId,'Institucional','group',10000),name:'Colaboradores',group:'Colaboradores',area:'',department:''}];return d;}
test('cascade keeps independent funds, fixed children, and rejects over-allocation',()=>{
 const d=fixture();let c=calculateBudget(d);assert.equal(c.amounts.get(dep),600000);assert.equal(c.amounts.get(activity),600000);assert.equal(c.remaining.get('Broker'),200000);
 d.funds[0].cents=2000000;c=calculateBudget(d);assert.equal(c.amounts.get(activity),300000);
 d.nodes[1].mode='amount';d.nodes[1].value=400000;assert.match(calculateBudget(d).errors.join(' '),/supera/);
});
test('method reconciles cents, handles zero drivers and rejects invalid scores',()=>{
 const ns=[node(dep,'Institucional'),node(activity,'Institucional')];const r=distributeMethod(ns,101,50);assert.equal(r.reduce((s,n)=>s+n.value,0),101);
 const noScores=ns.map(n=>({...n,gap:0}));assert.equal(distributeMethod(noScores,100,50).reduce((s,n)=>s+n.value,0),50);
 assert.throws(()=>distributeMethod([{...ns[0],gap:2}],100,50),/factores/i);
});
test('ambiguous cross-fund expense is pending until explicit categorization; amount counted once',()=>{
 const d=fixture();d.nodes.push({...d.nodes[0],id:'b-dep',fund:'Broker',parent:'Broker'},{...d.nodes[1],id:'b-activity',fund:'Broker',parent:'b-dep'});
 const r={id:record,requesting_area:'MÁRKETING',topic:'Ventas',status:'Ejecutada',cost:80};
 assert.equal(budgetExecution(d,[r],[]).unmatched.length,1);d.links=[{record_id:record,node_id:activity}];
 const result=budgetExecution(d,[r],[]);assert.equal(result.used.get('Institucional'),8000);assert.equal(result.used.get('Broker'),undefined);assert.equal(result.unmatched.length,0);
});
const db=new PGlite();
before(async()=>{
 await db.exec(`create role anon;create role authenticated;create schema auth;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('app.uid',true),'')::uuid$$;
 create table profiles(id uuid primary key,role text,active boolean,deleted_at timestamptz,must_change_password boolean);
 create table planning_periods(id uuid primary key);
 create table training_needs(id uuid primary key,period_id uuid,area text,department text);
 create table organizational_structure(group_name text,area_name text,department_name text,active boolean);insert into organizational_structure values('Colaboradores','Negocios','Marketing',true),('Colaboradores','Negocios','Otro',true);
 create table training_records(id uuid primary key,period_id uuid);
 insert into profiles values('${admin}','admin',true,null,false),('${other}','user',true,null,false);
 insert into planning_periods values('${period}');insert into training_records values('${record}','${period}');`);
 await db.exec(readFileSync(new URL('../supabase/migrations/20261023_independent_budgets.sql',import.meta.url),'utf8'));
 await db.exec(readFileSync(new URL('../supabase/migrations/20261024_budget_organizational_hierarchy.sql',import.meta.url),'utf8'));
 await db.exec(readFileSync(new URL('../supabase/migrations/20261024_budget_groups_and_logistics.sql',import.meta.url),'utf8'));
});
after(()=>db.close());
async function caller(id){await db.exec('reset role');await db.query("select set_config('app.uid',$1,false)",[id]);await db.exec('set role authenticated');}
async function save(rev,payload){return db.query('select public.save_training_budget($1,$2,$3) as saved',[period,rev,JSON.stringify(payload)]);}
test('database atomically saves independent funds, audits revisions and prevents stale overwrite',async()=>{
 await caller(admin);const result=await save(0,fixture());assert.equal(result.rows[0].saved.revision,1);
 assert.equal((await db.query('select * from training_budget_revisions')).rows.length,1);
 await assert.rejects(save(0,fixture()),/cambió/);
 let d=fixture();d.nodes[1].value=10001;await assert.rejects(save(1,d),/rango/);
 d.nodes[1].mode='amount';d.nodes[1].value=700000;await assert.rejects(save(1,d),/supera/);
 d=fixture();d.nodes.push({...node('77777777-7777-4777-8777-777777777777',areaId),name:'Otro',department:'Otro',value:9000});await assert.rejects(save(1,d),/supera/);
 d=fixture();d.nodes[0].parent='Institucional';await assert.rejects(save(1,d),/Primero/);
 d=fixture();d.nodes[0].name='Inventado';d.nodes[0].department='Inventado';await assert.rejects(save(1,d),/pertenece/);
 d=fixture();d.nodes[1].costs={training:600001};await assert.rejects(save(1,d),/capacitación/);
 await db.exec('begin');
 d=fixture();d.funds[1].cents=0;d.nodes[0].value=10000;d.logistics_generated=true;d.nodes[1].costs={meals:8000000,lodging:50000,travel:40000};
 await save(1,d);assert.equal((await db.query('select revision from training_budget_plans')).rows[0].revision,2);
 d.nodes[0].value=5000;await assert.rejects(save(2,d),/Complete la distribución/);
 await db.exec('rollback');
 assert.equal((await db.query('select revision from training_budget_plans')).rows[0].revision,1);
});
test('database rejects cross-fund parents, cycles, invalid links and doubled expenses',async()=>{
 await caller(admin);let d=fixture();d.nodes[1].fund='Broker';await assert.rejects(save(1,d),/fondo/);
 d=fixture();d.nodes[0].parent=activity;await assert.rejects(save(1,d),/Jerarquía/);
 d=fixture();d.links=[{record_id:record,node_id:activity},{record_id:record,node_id:activity}];await assert.rejects(save(1,d),/dos veces/);
 d=fixture();d.links=[{record_id:period,node_id:activity}];await assert.rejects(save(1,d),/Vinculación/);
});
test('upgrading an area-first budget preserves funds, every existing allocation and its history',async()=>{
 await caller(admin);await db.exec('reset role;begin');const legacy=fixture();legacy.nodes=legacy.nodes.filter(n=>n.kind!=='group');legacy.nodes.find(n=>n.kind==='area').parent='Institucional';legacy.nodes.find(n=>n.kind==='area').value=2000;
 await db.query('update training_budget_plans set payload=$1 where period_id=$2',[JSON.stringify(legacy),period]);
 await db.exec(readFileSync(new URL('../supabase/migrations/20261024_preserve_existing_budget_groups.sql',import.meta.url),'utf8'));
 const row=(await db.query('select * from training_budget_plans')).rows[0];assert.equal(row.revision,2);assert.deepEqual(row.payload.funds,legacy.funds);
 const calc=calculateBudget(row.payload);assert.equal(calc.amounts.get(areaId),800000);assert.equal(calc.amounts.get(dep),120000);assert.equal(calc.amounts.get(activity),120000);assert.equal(row.payload.nodes.find(n=>n.kind==='group').value,800000);
 assert.equal((await db.query('select * from training_budget_revisions where revision=1')).rows.length,1);await db.exec('rollback');
});
test('ordinary and inactive admins cannot read/write; direct table writes are forbidden',async()=>{
 await caller(other);assert.equal((await db.query('select * from training_budget_plans')).rows.length,0);await assert.rejects(save(1,fixture()),/administrador/);
 await caller(admin);await assert.rejects(db.query("update training_budget_plans set payload='{}'"),/permission denied/);
 await db.exec(`reset role;update profiles set active=false where id='${admin}'`);await caller(admin);await assert.rejects(save(1,fixture()),/administrador/);assert.equal((await db.query('select * from training_budget_plans')).rows.length,0);
});

import assert from 'node:assert/strict';
import {test} from 'node:test';
import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
test('DNC budget signals enforce active profile and scope, compare the full topic without duplicate edited rows, and reveal no amounts',async()=>{
 const db=new PGlite();try{
 const own='11111111-1111-4111-8111-111111111111',admin='22222222-2222-4222-8222-222222222222',period='33333333-3333-4333-8333-333333333333',id='44444444-4444-4444-8444-444444444444',second='55555555-5555-4555-8555-555555555555';
 await db.exec(`create role anon;create role authenticated;create schema auth;create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('app.uid',true),'')::uuid$$;create table profiles(id uuid,role text,active boolean,deleted_at timestamptz,occupational_group text,area text,department text);insert into profiles values('${own}','user',true,null,'G','A','D'),('${admin}','admin',true,null,'X','X','X');create table planning_periods(id uuid,active boolean,closed boolean);insert into planning_periods values('${period}',true,false);create table training_needs(id uuid,period_id uuid,occupational_group text,area text,department text,competency text,estimated_cost numeric);insert into training_needs values('${id}','${period}','G','A','D','T',100),('${second}','${period}','G','A','D','T',50);create table training_budget_plans(period_id uuid,payload jsonb);`);
 const node=(id,parent,kind,value)=>({id,parent,kind,mode:kind==='activity'?'amount':'percent',value,fund:'Institucional',group:'G',area:'A',department:'D',name:'T',need_id:kind==='activity'?'44444444-4444-4444-8444-444444444444':null});
 const data={funds:[{name:'Institucional',cents:100000},{name:'Broker',cents:0},{name:'Otros',cents:0}],nodes:[node('g','Institucional','group',10000),node('a','g','area',10000),node('d','a','department',5000),node('t','d','activity',15000)]};
 await db.query('insert into training_budget_plans values($1,$2)',[period,JSON.stringify(data)]);
 await db.exec(readFileSync(new URL('../supabase/migrations/20261025192223_dnc_budget_signals.sql',import.meta.url),'utf8'));
 await db.query("select set_config('app.uid',$1,false)",[own]);await db.exec('set role authenticated');
 const call=async(cost=100,needId=id,group='G')=>(await db.query('select public.dnc_budget_signals($1,$2,$3,$4,$5,$6,$7) as s',[period,group,'A','D','T',cost,needId])).rows[0].s;
 const result=await call();assert.equal(result.department_distributed,true);assert.equal(result.topic_linked,true);assert.equal(result.estimate_differs,false);assert.ok(Object.values(result).every(v=>typeof v==='boolean'));await assert.rejects(db.query('select * from training_budget_plans'),/permission denied/);
 assert.equal((await call(101)).estimate_differs,true);assert.equal((await call(100,null)).estimate_differs,true);assert.equal((await call(null)).estimate_unknown,true);await assert.rejects(call(100,id,'Other'),/otro grupo/);
 await db.exec(`reset role;update planning_periods set closed=true;set role authenticated;`);assert.equal((await call()).read_only,true);
 await db.exec(`reset role;update profiles set active=false where id='${own}';set role authenticated;`);await assert.rejects(call(),/no autorizado/);
 await db.exec(`reset role;update profiles set active=true,deleted_at=now() where id='${own}';set role authenticated;`);await assert.rejects(call(),/no autorizado/);
 await db.exec('reset role;set role anon');await assert.rejects(call(),/permission denied/);
 }finally{await db.close();}
});

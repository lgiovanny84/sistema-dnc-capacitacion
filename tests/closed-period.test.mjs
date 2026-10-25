import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
test('closed and inactive periods reject all writes, including moving records out, while preserving consultation and reopening',async()=>{
 const db=new PGlite();try{
 const open='11111111-1111-4111-8111-111111111111',closed='22222222-2222-4222-8222-222222222222';
 await db.exec(`create role anon;create role authenticated;create schema auth;create function auth.uid() returns uuid language sql stable as $$select '${open}'::uuid$$;create table planning_periods(id uuid primary key,active boolean);insert into planning_periods values('${open}',true),('${closed}',false);`);
 const tables=['training_needs','training_records','training_import_batches','department_budgets','training_budget_plans','training_budget_revisions'];
 for(const tab of tables)await db.exec(`create table ${tab}(id int primary key,period_id uuid);insert into ${tab} values(1,'${open}'),(2,'${closed}');grant select,insert,update,delete on ${tab} to authenticated;`);
 await db.exec('create table correction_requests(id int primary key,need_id int);grant select,insert,update,delete on correction_requests to authenticated;');
 await db.exec(readFileSync(new URL('../supabase/migrations/20261025174749_closed_period_readonly.sql',import.meta.url),'utf8'));
 await db.exec('set role authenticated');
 for(const tab of tables){await assert.rejects(db.exec(`insert into ${tab} values(3,'${closed}')`),/solo consulta/);await assert.rejects(db.exec(`update ${tab} set period_id='${open}' where id=2`),/solo consulta/);await assert.rejects(db.exec(`delete from ${tab} where id=2`),/solo consulta/);assert.equal((await db.query(`select count(*) from ${tab}`)).rows[0].count,2);await db.exec(`insert into ${tab} values(3,'${open}');delete from ${tab} where id=3;`);}
 await assert.rejects(db.exec('insert into correction_requests values(1,2)'),/solo consulta/);
 await db.exec('reset role');await db.exec(`update planning_periods set active=true where id='${closed}';set role authenticated;`);await assert.rejects(db.exec(`insert into training_needs values(3,'${closed}')`),/solo consulta/);
 await db.exec(`reset role;update planning_periods set closed=false where id='${closed}';set role authenticated;insert into training_needs values(3,'${closed}');`);assert.equal((await db.query('select count(*) from training_needs')).rows[0].count,3);
 }finally{await db.close();}
});

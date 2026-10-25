import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
test('DNC codes are backfilled, immutable, unique, and generated in the planned period rather than the current year',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create table planning_periods(id int primary key,start_date date);insert into planning_periods values(1,'2027-01-01');create table training_needs(id int primary key,period_id int references planning_periods,created_at timestamptz default now(),competency text);insert into training_needs(id,period_id) values(1,1);create function validate_training_need() returns trigger language plpgsql as $$begin return new;end $$;create trigger validate_training_need_before_write before insert or update on training_needs for each row execute function validate_training_need();grant select on planning_periods to authenticated;grant select,insert,update on training_needs to authenticated;`);
 await db.exec(readFileSync(new URL('../supabase/migrations/20261025171349_institutional_dnc_identifiers.sql',import.meta.url),'utf8'));
 assert.equal((await db.query('select dnc_code from training_needs')).rows[0].dnc_code,'ATU-DO-001-2027');
 await db.exec("set role authenticated;insert into training_needs(id,period_id,dnc_code) values(2,1,'FORGED');update training_needs set dnc_code='FORGED',competency='Liderazgo' where id=1;");
 const rows=(await db.query('select * from training_needs order by id')).rows;
 assert.equal(rows[0].dnc_code,'ATU-DO-001-2027');assert.equal(rows[1].dnc_code,'ATU-DO-002-2027');assert.equal(rows[0].competency,'Liderazgo');
 await db.exec('reset role;alter sequence training_needs_report_number_seq restart with 1001;set role authenticated;insert into training_needs(id,period_id) values(3,1);');
 assert.equal((await db.query('select dnc_code from training_needs where id=3')).rows[0].dnc_code,'ATU-DO-1001-2027');
 }finally{await db.close();}
});

test('period codes restart at 001, preserve original codes and UUIDs, and allocate subsequent numbers atomically',async()=>{
 const db=new PGlite();try{
 const p1='11111111-1111-4111-8111-111111111111',p2='22222222-2222-4222-8222-222222222222';
 await db.exec(`create role anon;create role authenticated;create schema auth;create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('app.uid',true),'')::uuid$$;create table profiles(id uuid,active boolean,deleted_at timestamptz);insert into profiles values('${p1}',true,null);select set_config('app.uid','${p1}',false);create table planning_periods(id uuid primary key,start_date date);insert into planning_periods values('${p1}','2026-01-01'),('${p2}','2027-01-01');create table training_needs(id int primary key,period_id uuid references planning_periods,created_at timestamptz default now(),competency text);insert into training_needs(id,period_id) values(1,'${p1}'),(2,'${p2}'),(3,'${p2}');create function validate_training_need() returns trigger language plpgsql as $$begin return new;end $$;create trigger validate_training_need_before_write before insert or update on training_needs for each row execute function validate_training_need();grant select on planning_periods to authenticated;grant select,insert,update,delete on training_needs to authenticated;`);
 await db.exec(readFileSync(new URL('../supabase/migrations/20261025171349_institutional_dnc_identifiers.sql',import.meta.url),'utf8'));
 const previous=(await db.query('select id,dnc_code from training_needs order by id')).rows;
 await db.exec(readFileSync(new URL('../supabase/migrations/20261025173746_period_dnc_codes.sql',import.meta.url),'utf8'));
 const rows=(await db.query('select * from training_needs order by id')).rows;
 assert.deepEqual(rows.map(r=>r.dnc_code),['ATU-DO-001-2026','ATU-DO-001-2027','ATU-DO-002-2027']);assert.deepEqual(rows.map(r=>r.previous_dnc_code),previous.map(r=>r.dnc_code));
 await db.exec(`set role authenticated;insert into training_needs(id,period_id) values(4,'${p2}'),(5,'${p1}');update training_needs set dnc_code='FORGED',period_number=99,previous_dnc_code='FORGED' where id=2;`);
 assert.equal((await db.query('select dnc_code from training_needs where id=4')).rows[0].dnc_code,'ATU-DO-003-2027');assert.equal((await db.query('select dnc_code from training_needs where id=5')).rows[0].dnc_code,'ATU-DO-002-2026');assert.equal((await db.query('select dnc_code from training_needs where id=2')).rows[0].dnc_code,'ATU-DO-001-2027');
 await assert.rejects(db.exec('select * from training_dnc_counters'),/permission denied/);
 await db.exec(`delete from training_needs where id=4;insert into training_needs(id,period_id) values(6,'${p2}');`);assert.equal((await db.query('select dnc_code from training_needs where id=6')).rows[0].dnc_code,'ATU-DO-004-2027');
 await db.exec("select set_config('app.uid','',false)");await assert.rejects(db.exec(`insert into training_needs(id,period_id) values(7,'${p2}')`),/usuario activo/);
 }finally{await db.close();}
});

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

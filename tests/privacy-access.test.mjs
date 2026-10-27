import assert from 'node:assert/strict';
import {test} from 'node:test';
import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
test('privacy gate blocks inactive/pending identities, isolates same-named departments by area and keeps legitimate provisioning and first login',async()=>{
 const db=new PGlite();try{
 const id=i=>`00000000-0000-4000-8000-${String(i).padStart(12,'0')}`,admin=id(1),user=id(2),pending=id(3),inactive=id(4),period=id(5),hidden=id(6);
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;grant usage on schema auth to authenticated;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('app.uid',true),'')::uuid$$;
 create table public.profiles(id uuid primary key,email text,full_name text,username text unique,role text default 'user',active boolean default true,deleted_at timestamptz,must_change_password boolean default false,area text,department text,occupational_group text,can_view_entire_area boolean default false,position text,onboarding_completed_at timestamptz,profile_updated_at timestamptz);
 create function public.is_admin() returns boolean language sql stable security definer as $$select exists(select 1 from public.profiles where id=auth.uid() and role='admin')$$;
 alter table profiles enable row level security;grant select,update on profiles to authenticated;
 create policy profile_self_read on profiles for select using(id=auth.uid() or is_admin());create policy profile_admin_update on profiles for update using(is_admin()) with check(is_admin());
 create table planning_periods(id uuid primary key,active boolean,closed boolean);insert into planning_periods values('${period}',true,false),('${hidden}',false,true);
 create table training_needs(id uuid primary key,period_id uuid,area text,department text,occupational_group text,competency text,estimated_cost numeric);
 create table organizational_structure(id int,group_name text,area_name text,department_name text,active boolean);
 create table training_budget_plans(id int,period_id uuid,payload jsonb);
 `);
 const tables=['training_needs','catalogs','competency_matrix','planning_periods','organizational_structure','correction_requests','training_records','department_budgets','training_import_batches','audit_log','training_budget_plans','training_budget_revisions','organization_structure_changes'];
 for(const t of tables){if(!['training_needs','planning_periods','organizational_structure','training_budget_plans'].includes(t))await db.exec(`create table ${t}(id int);insert into ${t} values(1);`);await db.exec(`alter table ${t} enable row level security;grant select,insert,update,delete on ${t} to authenticated;create policy existing_access on ${t} for all to authenticated using(true) with check(true);`);}
 await db.exec(`drop policy existing_access on planning_periods;create policy planning_periods_read on planning_periods for select to authenticated using(true);drop policy existing_access on training_needs;create policy need_read on training_needs for select to authenticated using(true);`);
 for(const [i,role,active,setup,area,dept] of [[1,'admin',true,false,'A','D'],[2,'user',true,false,'A','D'],[3,'admin',true,true,'A','D'],[4,'user',false,false,'A','D']])await db.query('insert into profiles(id,username,role,active,must_change_password,area,department,occupational_group) values($1,$2,$3,$4,$5,$6,$7,$8)',[id(i),'user'+i,role,active,setup,area,dept,'G']);
 await db.exec(`insert into training_needs values('${id(10)}','${period}','A','D','G','T',1),('${id(11)}','${period}','B','D','G','T',1),('${id(12)}','${hidden}','A','D','G','T',1);insert into organizational_structure values(1,'G','A','D',true);create table auth.users(id uuid,email text,raw_user_meta_data jsonb);`);
 await db.exec(readFileSync(new URL('../supabase/migrations/20261027145044_privacy_access_hardening.sql',import.meta.url),'utf8'));
 await db.exec('create trigger create_profile after insert on auth.users for each row execute function public.new_user_profile();');
 const caller=async who=>{await db.exec('reset role');await db.query("select set_config('app.uid',$1,false)",[who]);await db.exec('set role authenticated');};
 await caller(user);assert.equal((await db.query('select * from training_needs')).rows.length,1);assert.equal((await db.query('select * from planning_periods')).rows.length,1);assert.equal((await db.query("select can_view_training_need('B','D') b")).rows[0].b,false);
 await db.exec('reset role');await db.query('update profiles set can_view_entire_area=true where id=$1',[user]);await caller(user);assert.equal((await db.query("select can_view_training_need('A','Other') b")).rows[0].b,true);assert.equal((await db.query("select can_view_training_need('B','D') b")).rows[0].b,false);
 for(const who of [pending,inactive]){await caller(who);for(const t of tables)assert.equal((await db.query(`select * from ${t}`)).rows.length,0,t);assert.equal((await db.query('select * from profiles')).rows.length,1);await assert.rejects(db.query("select complete_own_profile('P','G','A','D')"),/inactivo|pendiente/);await assert.rejects(db.query("select dnc_budget_signals($1,'G','A','D','T',1,null)",[period]),/inactivo|pendiente/);}
 await caller(admin);assert.equal((await db.query('select * from training_needs')).rows.length,3);
 await db.exec('reset role');await db.query('insert into auth.users values($1,$2,$3)',[id(20),'synthetic@example.invalid',{role:'admin',active:true,full_name:'Synthetic'}]);
 const created=(await db.query('select role,active,must_change_password from profiles where id=$1',[id(20)])).rows[0];assert.deepEqual(created,{role:'user',active:false,must_change_password:true});
 await caller(admin);await db.query('update profiles set active=true where id=$1',[id(20)]);assert.equal((await db.query('select active from profiles where id=$1',[id(20)])).rows[0].active,true);
 await db.exec('reset role;set role anon');await assert.rejects(db.query('select public.is_admin()'),/permission denied/);await assert.rejects(db.query('select public.new_user_profile()'),/permission denied/);
 await caller(user);await assert.rejects(db.query('select public.new_user_profile()'),/permission denied/);
 }finally{await db.close();}
});

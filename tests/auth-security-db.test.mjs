import assert from 'node:assert/strict';
import {test, before, after} from 'node:test';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const db = new PGlite();
const tables = ['training_needs','catalogs','competency_matrix','planning_periods','organizational_structure','correction_requests','training_records','department_budgets','training_import_batches','audit_log'];
const ids = {pending:'11111111-1111-4111-8111-111111111111',ready:'22222222-2222-4222-8222-222222222222',admin:'33333333-3333-4333-8333-333333333333',pendingAdmin:'44444444-4444-4444-8444-444444444444',inactive:'55555555-5555-4555-8555-555555555555',deleted:'66666666-6666-4666-8666-666666666666'};
async function caller(id) {
 await db.exec('reset role');
 await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:ids[id]})]);
 await db.exec("set role authenticated; select set_config('app.department','TALENTO HUMANO',false)");
}
before(async()=>{
 await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
 create schema auth; grant usage on schema auth to authenticated;
 create function auth.uid() returns uuid language sql stable as $$select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;
 create table public.profiles(id uuid primary key, role text, active boolean default true, deleted_at timestamptz, must_change_password boolean default false, profile_updated_at timestamptz);
 create function public.is_admin() returns boolean language sql stable security definer as $$select exists(select 1 from public.profiles where id=auth.uid() and role='admin')$$;
 alter table public.profiles enable row level security;
 create policy self_read on public.profiles for select to authenticated using(id=auth.uid() or public.is_admin());
 grant select on public.profiles to authenticated;
 `);
 for (const [name,id] of Object.entries(ids)) await db.query('insert into profiles(id,role,active,deleted_at,must_change_password) values($1,$2,$3,$4,$5)',[id,name.toLowerCase().includes('admin')?'admin':'user',name!=='inactive',name==='deleted'?'2026-01-01':null,name.startsWith('pending')]);
 for (const table of tables) await db.exec(`create table public.${table}(id int,department text); insert into public.${table} values(1,'TALENTO HUMANO'),(2,'CRÉDITO'); alter table public.${table} enable row level security; create policy existing_scope on public.${table} for all to authenticated using(department=current_setting('app.department',true) or public.is_admin()) with check(department=current_setting('app.department',true) or public.is_admin()); grant select,insert,update,delete on public.${table} to authenticated;`);
 await db.exec(readFileSync(new URL('../supabase/migrations/20261023_auth_security.sql',import.meta.url),'utf8'));
});
after(async()=>db.close());
test('pending credentials cannot read or insert business data through the API role, including pending admins',async()=>{
 for (const name of ['pending','pendingAdmin','inactive','deleted']) {
  await caller(name);
  for (const table of tables) {
   assert.equal((await db.query(`select * from public.${table}`)).rows.length,0,`${name}: ${table}`);
   await assert.rejects(db.query(`insert into public.${table} values(3,'TALENTO HUMANO')`),/row-level security/);
  }
 }
});
test('completed credentials retain department scope and administrator scope; pending users can still read their own profile',async()=>{
 await caller('ready'); assert.equal((await db.query('select * from training_needs')).rows.length,1);
 await caller('admin'); assert.equal((await db.query('select * from training_needs')).rows.length,2);
 await caller('pendingAdmin'); assert.equal((await db.query('select * from profiles')).rows.length,1);
});
test('only the backend can complete first login, and completion clears expiry and permits scoped business access',async()=>{
 await caller('pending'); await assert.rejects(db.query('select public.finish_first_login_for_user($1)',[ids.pending]),/permission denied/);
 await db.exec('reset role; set role service_role');
 await db.query('select public.finish_first_login_for_user($1)',[ids.pending]);
 await caller('pending'); assert.equal((await db.query('select * from training_needs')).rows.length,1);
 const {rows}=await db.query('select must_change_password,temporary_password_expires_at from profiles where id=$1',[ids.pending]);
 assert.equal(rows[0].must_change_password,false); assert.equal(rows[0].temporary_password_expires_at,null);
});
test('rate limits are shared, service-only, bounded and resistant to changing the origin header',async()=>{
 await caller('ready'); await assert.rejects(db.query('select public.consume_login_attempt($1,$2)',['a'.repeat(64),'b'.repeat(64)]),/permission denied/);
 await db.exec('reset role; set role service_role');
 for(let i=0;i<10;i++) assert.equal((await db.query('select public.consume_login_attempt($1,$2) as value',['a'.repeat(64),'b'.repeat(64)])).rows[0].value.allowed,true);
 const blocked=(await db.query('select public.consume_login_attempt($1,$2) as value',['a'.repeat(64),'c'.repeat(64)])).rows[0].value;
 assert.equal(blocked.allowed,false); assert.ok(blocked.retry_after>0&&blocked.retry_after<=600);
 await assert.rejects(db.query('select * from private.login_attempt_buckets'),/permission denied/);
 await db.exec("reset role; update private.login_attempt_buckets set reset_at=now()-interval '1 second' where bucket <> 'global'; set role service_role");
 assert.equal((await db.query('select public.consume_login_attempt($1,$2) as value',['a'.repeat(64),'b'.repeat(64)])).rows[0].value.allowed,true);
});

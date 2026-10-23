create extension if not exists pgcrypto;
create extension if not exists btree_gist;
create type public.app_role as enum ('admin','user');
create table public.profiles(id uuid primary key references auth.users(id) on delete cascade,email text not null,full_name text,role public.app_role not null default 'user',active boolean not null default true,created_at timestamptz not null default now(),position text,occupational_group text,area text,department text,onboarding_completed_at timestamptz,profile_updated_at timestamptz not null default now(),can_view_entire_area boolean not null default false,deleted_at timestamptz,deleted_by uuid references public.profiles(id));
create table public.catalogs(id uuid primary key default gen_random_uuid(),kind text not null check(kind in ('factor','competency','position','occupational_group','area','department','modality')),name text not null,active boolean not null default true,created_by uuid references public.profiles(id),created_at timestamptz not null default now(),unique(kind,name));
create table public.competency_matrix(id uuid primary key default gen_random_uuid(),area text not null check(nullif(btrim(area),'') is not null),department text not null check(nullif(btrim(department),'') is not null),group_name text not null check(nullif(btrim(group_name),'') is not null),factor text not null check(nullif(btrim(factor),'') is not null),competency text not null check(nullif(btrim(competency),'') is not null),description text not null default '',active boolean not null default true,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),created_by uuid references public.profiles(id) default auth.uid(),unique(department,factor,competency));
create table public.planning_periods(id uuid primary key default gen_random_uuid(),name text not null check(nullif(btrim(name),'') is not null),start_date date not null,end_date date not null,active boolean not null default true,created_at timestamptz not null default now(),created_by uuid references public.profiles(id) default auth.uid(),constraint planning_period_dates check(end_date>=start_date),constraint planning_periods_no_overlap exclude using gist (daterange(start_date,end_date,'[]') with &&),unique(name,start_date,end_date));
create table public.training_needs(id uuid primary key default gen_random_uuid(),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),owner_id uuid not null references public.profiles(id),period_id uuid not null references public.planning_periods(id),status text not null default 'Pendiente' check(status in ('Pendiente','Aprobada','Observada','Planificada','Ejecutada','Cerrada')),type text not null check(type in ('Interna','Externa')),factor text not null,competency text not null,gap text not null,objective text not null,position text not null default '',occupational_group text not null,area text not null,department text not null,participants integer not null check(participants>0),hours numeric(8,2) check(hours>0),goal text not null,indicator text not null,evidence text not null,priority text not null check(priority in ('Baja','Media','Alta','Crítica')),priority_reason text not null default '',planned_date date,planned_start_date date,planned_end_date date,quarter text check(quarter in ('Q1','Q2','Q3','Q4')),modality text not null,estimated_cost numeric(12,2) check(estimated_cost>=0),provider text not null default '',observations text not null default '',constraint training_need_planned_dates check((planned_start_date is null and planned_end_date is null) or (planned_start_date is not null and planned_end_date is not null and planned_end_date>=planned_start_date)));
create table public.organizational_structure(id uuid primary key default gen_random_uuid(),group_name text not null,area_name text not null,department_name text not null,active boolean not null default true,created_at timestamptz not null default now(),created_by uuid references public.profiles(id),unique(group_name,area_name,department_name));
create table public.correction_requests(id uuid primary key default gen_random_uuid(),need_id uuid not null references public.training_needs(id) on delete cascade,requester_id uuid not null references public.profiles(id) on delete cascade,requested_field text not null check(char_length(btrim(requested_field)) between 2 and 80),explanation text not null check(char_length(btrim(explanation)) between 10 and 300),status text not null default 'Pendiente' check(status in ('Pendiente','Atendida','Rechazada')),created_at timestamptz not null default now(),resolved_at timestamptz,resolved_by uuid references public.profiles(id));
create table public.training_import_batches(id uuid primary key default gen_random_uuid(),period_id uuid not null references public.planning_periods(id),period_name text not null check(nullif(btrim(period_name),'') is not null),period_start date not null,period_end date not null,source_filename text not null,row_count integer not null default 0 check(row_count>=0),uploaded_at timestamptz not null default now(),uploaded_by uuid not null references public.profiles(id),constraint training_import_period_valid check(period_end>=period_start));
create table public.training_records(id uuid primary key default gen_random_uuid(),period_id uuid not null references public.planning_periods(id),name text not null,gender text not null default '',position text not null default '',requesting_area text not null,office text not null default '',topic text not null,company text not null default '',start_date date,end_date date,duration numeric(10,2) not null default 0 check(duration>=0),location text not null default '',cost numeric(14,2) not null default 0 check(cost>=0),status text not null default '',justification_criterion text not null default '',modality text not null default '',area text not null default '',department text not null default '',level text not null default '',occupational_group text not null default '',knowledge_area text not null default '',source_filename text not null default '',source_row_hash text not null,uploaded_at timestamptz not null default now(),uploaded_by uuid not null references public.profiles(id),import_batch_id uuid references public.training_import_batches(id) on delete cascade,constraint training_record_dates check(start_date is null or end_date is null or end_date>=start_date),unique(period_id,source_row_hash));
create table public.department_budgets(id uuid primary key default gen_random_uuid(),period_id uuid not null references public.planning_periods(id),year integer not null check(year between 2020 and 2100),department_name text not null check(nullif(btrim(department_name),'') is not null),requesting_area_name text,allocated_budget numeric(14,2) not null default 0 check(allocated_budget>=0),bank_hours numeric(12,2) not null default 0 check(bank_hours>=0),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),created_by uuid references public.profiles(id) default auth.uid(),unique(period_id,department_name));
create table public.audit_log(id bigint generated always as identity primary key,table_name text not null,record_id uuid,action text not null,user_id uuid,occurred_at timestamptz not null default now(),old_data jsonb,new_data jsonb);
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from public.profiles where id=auth.uid() and role='admin' and active and deleted_at is null)$$;
create or replace function public.can_view_training_need(p_area text,p_department text) returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from public.profiles p where p.id=auth.uid() and p.active and p.deleted_at is null and (p.role='admin' or (p.can_view_entire_area and p.area=p_area) or p.department=p_department))$$;
create or replace function public.can_use_training_structure(p_group text,p_area text,p_department text) returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from public.profiles p where p.id=auth.uid() and p.active and p.deleted_at is null and (p.role='admin' or (p.occupational_group=p_group and p.area=p_area and p.department=p_department)))$$;
create or replace function public.enforce_training_need_period() returns trigger language plpgsql security definer set search_path=public as $$declare selected_period public.planning_periods%rowtype;begin select * into selected_period from public.planning_periods where id=new.period_id;if not found then raise exception 'El período seleccionado no existe.';end if;if new.planned_start_date is not null and (new.planned_start_date<selected_period.start_date or new.planned_start_date>selected_period.end_date) then raise exception 'La fecha de inicio debe estar dentro del período %.',selected_period.name;end if;if new.planned_end_date is not null and (new.planned_end_date<selected_period.start_date or new.planned_end_date>selected_period.end_date) then raise exception 'La fecha de fin debe estar dentro del período %.',selected_period.name;end if;if new.planned_start_date is not null then new.planned_date:=new.planned_start_date;new.quarter:='Q'||ceil(extract(month from new.planned_start_date)/3.0)::int;end if;return new;end$$;
create or replace function public.new_user_profile() returns trigger language plpgsql security definer set search_path=public as $$begin insert into public.profiles(id,email,full_name) values(new.id,new.email,coalesce(new.raw_user_meta_data->>'full_name',''));return new;end$$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.new_user_profile();
create or replace function public.track_changes() returns trigger language plpgsql security definer set search_path=public as $$begin insert into public.audit_log(table_name,record_id,action,user_id,old_data,new_data) values(TG_TABLE_NAME,coalesce(new.id,old.id),TG_OP,auth.uid(),case when TG_OP in('UPDATE','DELETE') then to_jsonb(old) end,case when TG_OP in('INSERT','UPDATE') then to_jsonb(new) end);return coalesce(new,old);end$$;
create trigger audit_needs after insert or update or delete on public.training_needs for each row execute function public.track_changes();
create trigger audit_catalogs after insert or update or delete on public.catalogs for each row execute function public.track_changes();
create trigger audit_correction_requests after insert or update or delete on public.correction_requests for each row execute function public.track_changes();
create trigger audit_training_records after insert or update or delete on public.training_records for each row execute function public.track_changes();
create trigger audit_department_budgets after insert or update or delete on public.department_budgets for each row execute function public.track_changes();
create trigger audit_training_import_batches after insert or update or delete on public.training_import_batches for each row execute function public.track_changes();
create trigger audit_planning_periods after insert or update or delete on public.planning_periods for each row execute function public.track_changes();
create trigger audit_competency_matrix after insert or update or delete on public.competency_matrix for each row execute function public.track_changes();
create trigger enforce_training_need_period_trigger before insert or update of period_id,planned_start_date,planned_end_date on public.training_needs for each row execute function public.enforce_training_need_period();
alter table public.profiles enable row level security;alter table public.catalogs enable row level security;alter table public.competency_matrix enable row level security;alter table public.planning_periods enable row level security;alter table public.training_needs enable row level security;alter table public.audit_log enable row level security;alter table public.organizational_structure enable row level security;alter table public.correction_requests enable row level security;alter table public.training_records enable row level security;alter table public.department_budgets enable row level security;alter table public.training_import_batches enable row level security;
create policy profile_self_read on public.profiles for select using(id=auth.uid() or public.is_admin());
create policy profile_admin_update on public.profiles for update using(public.is_admin()) with check(public.is_admin());
create policy catalog_authenticated_read on public.catalogs for select to authenticated using(true);
create policy catalog_admin_write on public.catalogs for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy competency_matrix_read on public.competency_matrix for select to authenticated using(exists(select 1 from public.profiles p where p.id=auth.uid() and p.active and p.deleted_at is null) and (active or public.is_admin()));
create policy competency_matrix_admin_write on public.competency_matrix for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy planning_periods_read on public.planning_periods for select to authenticated using(true);
create policy planning_periods_admin_write on public.planning_periods for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy need_read on public.training_needs for select to authenticated using(public.can_view_training_need(area,department));
create policy need_insert on public.training_needs for insert to authenticated with check(owner_id=auth.uid() and public.can_use_training_structure(occupational_group,area,department));
create policy need_admin_update on public.training_needs for update to authenticated using(public.is_admin()) with check(public.is_admin());
create policy need_admin_delete on public.training_needs for delete to authenticated using(public.is_admin());
create policy organizational_structure_read on public.organizational_structure for select to authenticated using(true);
create policy organizational_structure_admin_write on public.organizational_structure for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy audit_admin_read on public.audit_log for select to authenticated using(public.is_admin());
create policy correction_request_read on public.correction_requests for select to authenticated using(requester_id=auth.uid() or public.is_admin());
create policy correction_request_insert on public.correction_requests for insert to authenticated with check(requester_id=auth.uid() and exists(select 1 from public.training_needs n where n.id=need_id and n.owner_id=auth.uid()));
create policy correction_request_admin_update on public.correction_requests for update to authenticated using(public.is_admin()) with check(public.is_admin());
create policy correction_request_admin_delete on public.correction_requests for delete to authenticated using(public.is_admin());
create policy training_records_admin_all on public.training_records for all to authenticated using(public.is_admin()) with check(public.is_admin() and uploaded_by=auth.uid());
create policy department_budgets_admin_all on public.department_budgets for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy training_import_batches_admin_all on public.training_import_batches for all to authenticated using(public.is_admin()) with check(public.is_admin() and uploaded_by=auth.uid());
grant usage on schema public to authenticated;
grant select on public.profiles, public.catalogs, public.training_needs, public.audit_log, public.organizational_structure, public.correction_requests to authenticated;
grant insert, update on public.training_needs to authenticated;
grant insert, update on public.catalogs to authenticated;
grant update on public.profiles to authenticated;
grant delete on public.training_needs, public.catalogs to authenticated;
grant insert, update, delete on public.organizational_structure to authenticated;
grant insert, update, delete on public.correction_requests to authenticated;
grant select, insert, update, delete on public.training_records, public.department_budgets to authenticated;
grant select, insert, update, delete on public.training_import_batches to authenticated;
grant select, insert, update, delete on public.planning_periods to authenticated;
grant select, insert, update, delete on public.competency_matrix to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on function public.can_view_training_need(text,text), public.can_use_training_structure(text,text,text) to authenticated;
insert into public.catalogs(kind,name) values('factor','Cumplimiento normativo'),('factor','Competencias técnicas'),('factor','Competencias blandas'),('factor','Buenas prácticas y pasantías'),('occupational_group','Directivo'),('occupational_group','Jefatura'),('occupational_group','Operativo'),('modality','Presencial'),('modality','Virtual'),('modality','Híbrida') on conflict do nothing;
insert into public.planning_periods(name,start_date,end_date) values(extract(year from current_date)::integer::text,date_trunc('year',current_date)::date,(date_trunc('year',current_date)+interval '1 year - 1 day')::date) on conflict do nothing;
-- update public.profiles set role='admin' where email='correo@institucion.com';

-- Authentication hardening (also applied to existing installations by migration).
alter table public.profiles add column if not exists must_change_password boolean not null default false;
-- Enforce first-login security on the server and database, with shared login limits.
begin;
alter table public.profiles add column if not exists temporary_password_expires_at timestamptz;
-- Existing pending credentials receive the same transition window as new ones.
update public.profiles set temporary_password_expires_at = now() + interval '24 hours'
where must_change_password and temporary_password_expires_at is null;

create or replace function public.has_completed_password_setup()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles p where p.id = auth.uid()
    and p.active and p.deleted_at is null and not p.must_change_password)
$$;
revoke all on function public.has_completed_password_setup() from public, anon;
grant execute on function public.has_completed_password_setup() to authenticated;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles p where p.id = auth.uid()
    and p.role = 'admin' and p.active and p.deleted_at is null and not p.must_change_password)
$$;

-- Restrictive policies intersect with all existing permissive policies;
-- department/area/owner scopes continue to apply. Self-profile reads remain
-- available for the first-login/recovery flow, but business data is blocked.
do $$
declare relation text;
begin
  foreach relation in array array['training_needs','catalogs','competency_matrix',
    'planning_periods','organizational_structure','correction_requests',
    'training_records','department_budgets','training_import_batches','audit_log'] loop
    execute format('drop policy if exists password_setup_required on public.%I', relation);
    execute format('create policy password_setup_required on public.%I as restrictive for all to authenticated using ((select public.has_completed_password_setup())) with check ((select public.has_completed_password_setup()))', relation);
  end loop;
end $$;

create or replace function public.finish_first_login_for_user(p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles set must_change_password = false,
    temporary_password_expires_at = null, profile_updated_at = now()
  where id = p_user_id and active and deleted_at is null;
  if not found then raise exception 'Acceso inactivo o no disponible'; end if;
end $$;
revoke all on function public.finish_first_login_for_user(uuid) from public, anon, authenticated;
grant execute on function public.finish_first_login_for_user(uuid) to service_role;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table if not exists private.login_attempt_buckets (
  bucket text primary key,
  attempts integer not null check(attempts > 0),
  reset_at timestamptz not null
);
create index if not exists login_attempt_buckets_reset_idx on private.login_attempt_buckets(reset_at);
alter table private.login_attempt_buckets enable row level security;
revoke all on private.login_attempt_buckets from public, anon, authenticated;

create or replace function public.consume_login_attempt(p_account_hash text, p_origin_hash text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  attempted_at timestamptz := clock_timestamp();
  counter integer; deadline timestamptz; entry record;
  permitted boolean := true; retry_seconds integer := 0;
begin
  if p_account_hash !~ '^[0-9a-f]{64}$' or p_origin_hash !~ '^[0-9a-f]{64}$'
    or p_account_hash is null or p_origin_hash is null then
    raise exception 'Invalid login bucket';
  end if;
  -- Bounded cleanup; no usernames, passwords or raw IP addresses are stored.
  delete from private.login_attempt_buckets where bucket in (
    select bucket from private.login_attempt_buckets
    where reset_at < attempted_at - interval '1 day' order by reset_at limit 500
  );
  -- Deterministic lock order and atomic UPSERT protect concurrent invocations.
  for entry in select * from (values
    (0, 'global', 3000), (1, 'account:' || p_account_hash, 10), (2, 'origin:' || p_origin_hash, 300)
  ) as limits(priority, bucket, max_attempts) order by priority loop
    insert into private.login_attempt_buckets as existing(bucket, attempts, reset_at)
    values(entry.bucket, 1, attempted_at + interval '10 minutes')
    on conflict (bucket) do update set
      attempts = case when existing.reset_at <= attempted_at then 1 else least(existing.attempts + 1, entry.max_attempts + 1) end,
      reset_at = case when existing.reset_at <= attempted_at then attempted_at + interval '10 minutes' else existing.reset_at end
    returning attempts, reset_at into counter, deadline;
    if counter > entry.max_attempts then
      permitted := false;
      retry_seconds := greatest(retry_seconds, ceil(extract(epoch from deadline - attempted_at))::integer);
    end if;
    -- Once the global budget is exhausted do not create attacker-selected buckets.
    if entry.bucket = 'global' and not permitted then exit; end if;
  end loop;
  return jsonb_build_object('allowed', permitted, 'retry_after', greatest(1, retry_seconds));
end $$;
revoke all on function public.consume_login_attempt(text,text) from public, anon, authenticated;
grant execute on function public.consume_login_attempt(text,text) to service_role;
notify pgrst, 'reload schema';
commit;

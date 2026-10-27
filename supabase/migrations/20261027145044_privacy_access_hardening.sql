-- Database-side access enforcement; does not change credentials, records or budgets.
create or replace function public.has_completed_password_setup() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles p where p.id=auth.uid() and p.active and p.deleted_at is null and not p.must_change_password)
$$;
revoke all on function public.has_completed_password_setup() from public,anon;
grant execute on function public.has_completed_password_setup() to authenticated;
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin' and p.active and p.deleted_at is null and not p.must_change_password)
$$;
revoke all on function public.is_admin() from public,anon;
grant execute on function public.is_admin() to authenticated;
create or replace function public.can_view_training_need(p_area text,p_department text) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles p where p.id=auth.uid() and p.active and p.deleted_at is null and not p.must_change_password
 and (p.role='admin' or (p.area=p_area and (p.can_view_entire_area or p.department=p_department))))
$$;
create or replace function public.can_use_training_structure(p_group text,p_area text,p_department text) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles p where p.id=auth.uid() and p.active and p.deleted_at is null and not p.must_change_password
 and (p.role='admin' or (p.occupational_group=p_group and p.area=p_area and p.department=p_department)))
$$;
revoke all on function public.can_view_training_need(text,text),public.can_use_training_structure(text,text,text) from public,anon;
grant execute on function public.can_view_training_need(text,text),public.can_use_training_structure(text,text,text) to authenticated;
-- Existing permissive scope policies remain in force and are intersected with this gate.
do $$ declare t text; begin
 foreach t in array array['training_needs','catalogs','competency_matrix','planning_periods','organizational_structure','correction_requests','training_records','department_budgets','training_import_batches','audit_log','training_budget_plans','training_budget_revisions','organization_structure_changes'] loop
  execute format('drop policy if exists completed_access_required on public.%I',t);
  execute format('create policy completed_access_required on public.%I as restrictive for all to authenticated using ((select public.has_completed_password_setup())) with check ((select public.has_completed_password_setup()))',t);
 end loop;
end $$;
-- Self-profile access remains available to complete first login and display inactive access.
alter policy profile_self_read on public.profiles to authenticated;
alter policy profile_admin_update on public.profiles to authenticated;
alter policy planning_periods_read on public.planning_periods using (active or public.is_admin());
alter policy need_read on public.training_needs using (public.can_view_training_need(area,department) and (public.is_admin() or exists(select 1 from public.planning_periods p where p.id=period_id and p.active)));
-- New identities remain inactive until the administrator provisions their profile.
-- Public signup or editable metadata cannot create an authorized institutional account.
create or replace function public.new_user_profile() returns trigger
language plpgsql security definer set search_path='' as $$
declare base text;candidate text;suffix integer:=1;
begin
 base:=left(coalesce(nullif(regexp_replace(lower(split_part(new.email,'@',1)),'[^a-z0-9._-]','','g'),''),'usuario'),25);
 if length(base)<3 then base:='usuario-'||base;end if;
 candidate:=base;
 while exists(select 1 from public.profiles where username=candidate) loop suffix:=suffix+1;candidate:=base||'-'||suffix::text;end loop;
 insert into public.profiles(id,email,full_name,username,role,active,must_change_password)
 values(new.id,new.email,left(coalesce(new.raw_user_meta_data->>'full_name',''),250),candidate,'user',false,true);
 return new;
end $$;
-- Trigger functions are invoked by their tables, never directly as client RPCs.
do $$ declare f record; begin
 for f in select p.oid::regprocedure signature from pg_proc p where p.pronamespace='public'::regnamespace and p.prorettype in ('trigger'::regtype,'event_trigger'::regtype) loop
  execute format('revoke all on function %s from public,anon,authenticated',f.signature);
 end loop;
end $$;
-- Harden trusted helpers without changing their first-login semantics.
create or replace function public.complete_own_profile(p_position text,p_group text,p_area text,p_department text) returns public.profiles
language plpgsql security definer set search_path='' as $$
declare result public.profiles;
begin
 if not public.has_completed_password_setup() then raise exception 'Acceso inactivo o primer ingreso pendiente.'; end if;
 if nullif(btrim(p_position),'') is null or length(p_position)>250 then raise exception 'El cargo es obligatorio y debe tener hasta 250 caracteres.'; end if;
 if not exists(select 1 from public.organizational_structure where active and group_name=p_group and area_name=p_area and department_name=p_department) then raise exception 'El departamento seleccionado no es válido'; end if;
 update public.profiles set position=btrim(p_position),occupational_group=p_group,area=p_area,department=p_department,onboarding_completed_at=now(),profile_updated_at=now()
 where id=auth.uid() and active and deleted_at is null and (onboarding_completed_at is null or role='admin') returning * into result;
 if result.id is null then raise exception 'El perfil ya fue completado o no está activo'; end if;
 return result;
end $$;
revoke all on function public.complete_own_profile(text,text,text,text) from public,anon;
grant execute on function public.complete_own_profile(text,text,text,text) to authenticated;

-- A scoped, read-only signal API. Users receive booleans, never financial payloads or amounts.
create or replace function public.dnc_budget_signals(p_period uuid,p_group text,p_area text,p_department text,p_competency text,p_estimated_cost numeric default null,p_need_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare caller public.profiles; selected_period public.planning_periods; existing_need public.training_needs; data jsonb;
  structure_changed boolean:=false; original_linked boolean:=false; group_total numeric:=0; area_total numeric:=0;
  department_total numeric:=0; topic_total numeric:=0; topic_linked boolean:=false;
  requested numeric; missing integer;
begin
 if not public.has_completed_password_setup() then raise exception 'Acceso inactivo o primer ingreso pendiente.'; end if;
 select * into caller from public.profiles where id=auth.uid() and active and deleted_at is null;
 if not found then raise exception 'Usuario no autorizado.'; end if;
 if nullif(btrim(p_group),'') is null or nullif(btrim(p_area),'') is null or nullif(btrim(p_department),'') is null then raise exception 'Seleccione grupo, área y departamento.'; end if;
 if caller.role::text<>'admin' and (caller.occupational_group is distinct from p_group or caller.area is distinct from p_area or caller.department is distinct from p_department) then raise exception 'No puede consultar otro grupo, área o departamento.'; end if;
 select * into selected_period from public.planning_periods where id=p_period;
 if not found or (caller.role::text<>'admin' and not selected_period.active) then raise exception 'Período no autorizado.'; end if;
 if p_need_id is not null then
  select * into existing_need from public.training_needs where id=p_need_id and period_id=p_period;
  if not found then raise exception 'La DNC no pertenece al período seleccionado.'; end if;
  structure_changed:=existing_need.occupational_group is distinct from p_group or existing_need.area is distinct from p_area or existing_need.department is distinct from p_department;
  if structure_changed and caller.role::text<>'admin' then raise exception 'La DNC no pertenece a la estructura seleccionada.'; end if;
 end if;
 if length(coalesce(p_competency,''))>500 or (p_estimated_cost is not null and (p_estimated_cost<0 or p_estimated_cost::text in ('NaN','Infinity','-Infinity'))) then raise exception 'Propuesta no válida.'; end if;
 select payload into data from public.training_budget_plans where period_id=p_period;
 if data is not null then
  original_linked:=structure_changed and exists(select 1 from jsonb_array_elements(data->'nodes') n where n->>'kind'='activity' and n->>'need_id'=p_need_id::text);
  with recursive allocations(id,fund,node,depth,cents,path) as (
   select f->>'name',f->>'name',null::jsonb,0,(f->>'cents')::numeric,array[f->>'name']
   from jsonb_array_elements(data->'funds') f
   union all
   select n->>'id',a.fund,n,a.depth+1,
    case when n->>'mode'='amount' then (n->>'value')::numeric else floor(a.cents*(n->>'value')::numeric/10000) end,
    a.path||(n->>'id')
   from allocations a cross join jsonb_array_elements(data->'nodes') n
   where a.depth<4 and n->>'parent'=a.id and n->>'fund'=a.fund and not n->>'id'=any(a.path)
  ), scoped as (
   select * from allocations where node->>'group'=p_group and node->>'area'=p_area and node->>'department'=p_department
  ), topics as (
   select * from scoped where node->>'kind'='activity' and (node->>'name'=p_competency or (p_need_id is not null and node->>'need_id'=p_need_id::text))
  )
  select coalesce((select sum(cents) from allocations where node->>'kind'='group' and node->>'group'=p_group),0),
   coalesce((select sum(cents) from allocations where node->>'kind'='area' and node->>'group'=p_group and node->>'area'=p_area),0),
   coalesce((select sum(cents) from scoped where node->>'kind'='department'),0),
   coalesce((select sum(cents) from topics),0),exists(select 1 from topics)
  into group_total,area_total,department_total,topic_total,topic_linked;
 end if;
 -- Compare the proposal for the shared topic once, replacing the edited DNC estimate.
 select coalesce(sum(round(estimated_cost*100)),0),count(*) filter(where estimated_cost is null)
 into requested,missing from public.training_needs where period_id=p_period and occupational_group=p_group and area=p_area and department=p_department
  and competency=p_competency and (p_need_id is null or id<>p_need_id);
 requested:=requested+coalesce(round(p_estimated_cost*100),0);
 return jsonb_build_object('has_plan',data is not null,'group_distributed',group_total>0,'area_distributed',area_total>0,'structure_changed_with_budget',original_linked,'department_distributed',department_total>0,'topic_linked',topic_linked,
  'estimate_unknown',missing>0 or p_estimated_cost is null,'estimate_differs',topic_linked and missing=0 and p_estimated_cost is not null and requested<>topic_total,
  'read_only',selected_period.closed or not selected_period.active);
end $$;
revoke all on function public.dnc_budget_signals(uuid,text,text,text,text,numeric,uuid) from public,anon;
grant execute on function public.dnc_budget_signals(uuid,text,text,text,text,numeric,uuid) to authenticated;

notify pgrst, 'reload schema';

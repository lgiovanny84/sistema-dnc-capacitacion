-- Atomic organizational edits; historical closed periods and budget revisions are retained.
create table public.organization_structure_changes (
 id uuid primary key default gen_random_uuid(), changed_at timestamptz not null default now(),
 changed_by uuid references public.profiles(id), before_value jsonb, after_value jsonb not null
);
alter table public.organization_structure_changes enable row level security;
create policy organization_changes_admin_read on public.organization_structure_changes for select to authenticated using (public.is_admin());
grant select on public.organization_structure_changes to authenticated;

create or replace function public.save_organization_structure(p_changes jsonb) returns void
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare c jsonb; old public.organizational_structure; dest public.organizational_structure;
 g text; a text; d text; enabled boolean; m record; b record; n jsonb; t jsonb; payload jsonb;
 amounts jsonb; nodes jsonb; source_node jsonb; target_node jsonb; destination text; changed boolean;
begin
 if auth.uid() is null or not public.is_admin() or exists(select 1 from public.profiles where id=auth.uid() and must_change_password) then
  raise exception 'Solo un administrador activo puede actualizar la estructura.';
 end if;
 if jsonb_typeof(p_changes) is distinct from 'array' or jsonb_array_length(p_changes)>500 then raise exception 'Cambios no válidos.'; end if;
 perform pg_advisory_xact_lock(hashtextextended('organization_structure',0));
 -- Coordinate with period closure and serialize financial edits before reading snapshots.
 perform 1 from public.planning_periods order by id for update;
 perform 1 from public.training_budget_plans order by period_id for update;
 for c in select * from jsonb_array_elements(p_changes) loop
  g:=btrim(c->>'group_name');a:=btrim(c->>'area_name');d:=btrim(c->>'department_name');
  if coalesce(g,'')='' or coalesce(a,'')='' or coalesce(d,'')='' or greatest(length(g),length(a),length(d))>250 or jsonb_typeof(c->'active') is distinct from 'boolean' then raise exception 'Complete grupo, área, departamento y estado.'; end if;
  enabled:=(c->>'active')::boolean;old:=null;dest:=null;
  if nullif(c->>'id','') is not null then
   select * into old from public.organizational_structure where id=(c->>'id')::uuid for update;
   if old.id is null or (to_jsonb(old)-'created_at'-'created_by') is distinct from (c->'original') then raise exception 'La estructura cambió. Recargue antes de guardar.'; end if;
  end if;
  select * into dest from public.organizational_structure where group_name=g and area_name=a and department_name=d and (old.id is null or id<>old.id) for update;
  if old.id is null then
   if dest.id is not null then raise exception 'La relación organizacional ya existe.'; end if;
   insert into public.organizational_structure(group_name,area_name,department_name,active,created_by) values(g,a,d,enabled,auth.uid()) returning * into dest;
  else
   if not enabled and exists(select 1 from public.training_needs q join public.planning_periods p on p.id=q.period_id where p.active and not p.closed and q.occupational_group=old.group_name and q.area=old.area_name and q.department=old.department_name
     union all select 1 from public.profiles where active and deleted_at is null and occupational_group=old.group_name and area=old.area_name and department=old.department_name
     union all select 1 from public.training_budget_plans b join public.planning_periods p on p.id=b.period_id cross join lateral jsonb_array_elements(b.payload->'nodes') n where p.active and not p.closed and n->>'group'=old.group_name and n->>'area'=old.area_name and n->>'department'=old.department_name) then
    raise exception 'La relación está en uso. Reasigne sus usuarios, DNC y presupuesto antes de inactivarla.';
   end if;
   if dest.id is not null and not enabled then raise exception 'No se puede fusionar con una relación inactiva.'; end if;
   if (g,a,d) is distinct from (old.group_name,old.area_name,old.department_name) then
    if not enabled then raise exception 'Guarde el cambio de nombre antes de inactivar.'; end if;
    if (g,a) is distinct from (old.group_name,old.area_name) and exists(select 1 from public.training_budget_plans b join public.planning_periods p on p.id=b.period_id cross join lateral jsonb_array_elements(b.payload->'nodes') n where p.active and not p.closed and n->>'group'=old.group_name and n->>'area'=old.area_name and n->>'department'=old.department_name) then
     raise exception 'El departamento tiene presupuesto. Reasigne su distribución antes de cambiar el grupo o área.';
    end if;
   end if;
   if dest.id is null then
    update public.organizational_structure set group_name=g,area_name=a,department_name=d,active=enabled where id=old.id returning * into dest;
   else
    update public.organizational_structure set active=true where id=dest.id returning * into dest;
    update public.organizational_structure set active=false where id=old.id;
   end if;
   if (g,a,d) is distinct from (old.group_name,old.area_name,old.department_name) then
    update public.profiles set occupational_group=g,area=a,department=d,profile_updated_at=now() where occupational_group=old.group_name and area=old.area_name and department=old.department_name;
    for m in select * from public.competency_matrix where group_name=old.group_name and area=old.area_name and department=old.department_name loop
     if exists(select 1 from public.competency_matrix x where x.department=d and x.factor=m.factor and x.competency=m.competency and x.id<>m.id) then
      -- Keep the duplicate source as historical evidence instead of deleting it.
      update public.competency_matrix set active=false where id=m.id;
     else
      update public.competency_matrix set group_name=g,area=a,department=d where id=m.id;
     end if;
    end loop;
    update public.training_needs q set occupational_group=g,area=a,department=d where q.occupational_group=old.group_name and q.area=old.area_name and q.department=old.department_name and exists(select 1 from public.planning_periods p where p.id=q.period_id and p.active and not p.closed);
    update public.training_records q set occupational_group=g,area=a,department=d,requesting_area=case when requesting_area=old.department_name then d else requesting_area end where q.occupational_group=old.group_name and q.area=old.area_name and q.department=old.department_name and exists(select 1 from public.planning_periods p where p.id=q.period_id and p.active and not p.closed);
    -- Department budget mappings have no area/group: reject ambiguous cross-area renames.
    if old.department_name<>d and exists(select 1 from public.department_budgets q join public.planning_periods p on p.id=q.period_id where p.active and not p.closed and q.department_name=old.department_name) then
     if exists(select 1 from public.organizational_structure where active and department_name=old.department_name and id<>old.id) then raise exception 'Revise primero los cruces presupuestarios del departamento compartido.'; end if;
     if exists(select 1 from public.department_budgets q join public.department_budgets x on x.period_id=q.period_id and x.year=q.year and x.department_name=d join public.planning_periods p on p.id=q.period_id where p.active and not p.closed and q.department_name=old.department_name) then raise exception 'Existen presupuestos de cruce en ambos departamentos; concílielos antes de fusionar.'; end if;
     update public.department_budgets q set department_name=d,requesting_area_name=coalesce(nullif(requesting_area_name,''),old.department_name) where q.department_name=old.department_name and exists(select 1 from public.planning_periods p where p.id=q.period_id and p.active and not p.closed);
    end if;
    for b in select b.* from public.training_budget_plans b join public.planning_periods p on p.id=b.period_id where p.active and not p.closed loop
     payload:=b.payload;changed:=false;
     -- Exact amounts before merging preserve each topic's allocation, including rounding.
     with recursive money(id,cents) as (
      select f->>'name',(f->>'cents')::numeric from jsonb_array_elements(payload->'funds') f
      union all select n->>'id',case when n->>'mode'='percent' then floor(m.cents*(n->>'value')::numeric/10000) else (n->>'value')::numeric end from money m cross join lateral jsonb_array_elements(payload->'nodes') n where n->>'parent'=m.id
     ) select jsonb_object_agg(id,cents) into amounts from money;
     for source_node in select n from jsonb_array_elements(payload->'nodes') n where n->>'kind'='department' and n->>'group'=old.group_name and n->>'area'=old.area_name and n->>'department'=old.department_name loop
      select n into target_node from jsonb_array_elements(payload->'nodes') n where n->>'kind'='department' and n->>'parent'=source_node->>'parent' and n->>'name'=d and n->>'id'<>source_node->>'id';
      destination:=coalesce(target_node->>'id',source_node->>'id');nodes:='[]';
      for n in select * from jsonb_array_elements(payload->'nodes') loop
       if target_node is not null and n->>'id'=source_node->>'id' then continue; end if;
       if n->>'id'=destination then
        n:=n||jsonb_build_object('name',d,'department',d,'mode','amount','value',coalesce((amounts->>(source_node->>'id'))::numeric,0)+case when target_node is not null then coalesce((amounts->>destination)::numeric,0) else 0 end);
       elsif n->>'parent'=source_node->>'id' or (target_node is not null and n->>'parent'=destination) then
        n:=n||jsonb_build_object('parent',destination,'department',d,'mode','amount','value',(amounts->>(n->>'id'))::numeric);
       end if;
       nodes:=nodes||jsonb_build_array(n);
      end loop;
      payload:=payload||jsonb_build_object('nodes',nodes);changed:=true;
     end loop;
     if changed then perform public.save_training_budget(b.period_id,b.revision,payload); end if;
    end loop;
   end if;
  end if;
  insert into public.organization_structure_changes(changed_by,before_value,after_value) values(auth.uid(),case when old.id is null then null else to_jsonb(old) end,to_jsonb(dest));
 end loop;
end $$;
revoke all on function public.save_organization_structure(jsonb) from public,anon;
grant execute on function public.save_organization_structure(jsonb) to authenticated;

-- Requested TI structure. No changes to closed-period records or financial totals.
do $$
declare admin_id uuid; source public.organizational_structure; entry jsonb;
begin
 select id into admin_id from public.profiles where role='admin' and active and deleted_at is null and not must_change_password order by created_at limit 1;
 if admin_id is null then raise exception 'Se requiere un administrador activo para registrar la actualización.'; end if;
 perform set_config('request.jwt.claim.sub',admin_id::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',admin_id,'role','authenticated')::text,true);
 for source in select * from public.organizational_structure where active and group_name='COLABORADORES' and area_name='TECNOLOGÍA DE LA INFORMACIÓN' and department_name in ('INFRAESTRUCTURA','SISTEMA Y BASE DE DATOS') order by department_name loop
  entry:=jsonb_build_object('id',source.id,'original',to_jsonb(source)-'created_at'-'created_by','group_name',source.group_name,'area_name',source.area_name,'department_name','SISTEMAS E INFRAESTRUCTURA','active',true);
  perform public.save_organization_structure(jsonb_build_array(entry));
 end loop;
 if not exists(select 1 from public.organizational_structure where group_name='COLABORADORES' and area_name='TECNOLOGÍA DE LA INFORMACIÓN' and department_name='SEGURIDAD INFORMÁTICA') then
  perform public.save_organization_structure(jsonb_build_array(jsonb_build_object('group_name','COLABORADORES','area_name','TECNOLOGÍA DE LA INFORMACIÓN','department_name','SEGURIDAD INFORMÁTICA','active',true)));
 end if;
end $$;

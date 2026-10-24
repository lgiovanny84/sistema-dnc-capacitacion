-- Topics originate only from DNC selections in the same period and department. Existing amounts remain unchanged.
create or replace function public.save_training_budget(p_period uuid, p_revision integer, p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  current_row public.training_budget_plans;
  f jsonb; n jsonb; parent_node jsonb; l jsonb;
  values_by_id jsonb := '{}'::jsonb;
  total numeric; amount numeric; assigned numeric; percentages numeric;
  level_no integer; node_count integer; valid_count integer;
begin
  if not public.can_manage_training_budget() then raise exception 'Solo un administrador activo puede gestionar presupuestos.'; end if;
  -- Locks creation and later writes for the same period, including concurrent first saves.
  perform 1 from public.planning_periods where id=p_period for update;
  if not found then raise exception 'Período inexistente.'; end if;
  select * into current_row from public.training_budget_plans where period_id=p_period for update;
  if p_revision is null or p_revision <> coalesce(current_row.revision,0) then raise exception 'El presupuesto cambió. Recargue antes de guardar.'; end if;
  if jsonb_typeof(p_payload) is distinct from 'object' or jsonb_typeof(p_payload->'funds') is distinct from 'array' or jsonb_typeof(p_payload->'nodes') is distinct from 'array' or jsonb_typeof(p_payload->'links') is distinct from 'array' then raise exception 'Estructura de presupuesto no válida.'; end if;
  if octet_length(p_payload::text)>10000000 or jsonb_array_length(p_payload->'nodes')>10000 then raise exception 'El presupuesto supera el tamaño permitido.'; end if;
  if jsonb_array_length(p_payload->'funds')<>3 or (select count(distinct x->>'name') from jsonb_array_elements(p_payload->'funds') x where x->>'name' in ('Institucional','Broker','Otros'))<>3 then raise exception 'Se requieren los tres fondos independientes.'; end if;
  for f in select * from jsonb_array_elements(p_payload->'funds') loop
    if coalesce(f->>'cents','') !~ '^\d+$' or (f->>'cents')::numeric > 1000000000000 then raise exception 'Monto del fondo no válido.'; end if;
    values_by_id := values_by_id || jsonb_build_object(f->>'name',(f->>'cents')::numeric);
  end loop;
  node_count := jsonb_array_length(p_payload->'nodes');
  if (select count(distinct x->>'id') from jsonb_array_elements(p_payload->'nodes') x)<>node_count then raise exception 'Identificadores duplicados.'; end if;
  for n in select * from jsonb_array_elements(p_payload->'nodes') loop
    if coalesce(n->>'id','') !~ '^[0-9a-f-]{36}$' or coalesce(n->>'name','') !~ '\S' or length(n->>'name')>500 or coalesce(n->>'fund','') not in ('Institucional','Broker','Otros') or coalesce(n->>'kind','') not in ('group','area','department','activity') or coalesce(n->>'mode','') not in ('percent','amount') or coalesce(n->>'value','') !~ '^\d+$' then raise exception 'Asignación no válida.'; end if;
    if (n->>'value')::numeric > (case when n->>'mode'='percent' then 10000 else 1000000000000 end) then raise exception 'Porcentaje o monto fuera de rango.'; end if;
    if coalesce(n->>'people','') !~ '^\d+$' or (n->>'people')::numeric>10000000 then raise exception 'Número de personas no válido.'; end if;
    if (n->>'kind'<>'group' and nullif(btrim(n->>'area'),'') is null) or (n->>'kind'='department' and n->>'department' is distinct from n->>'name') or (n->>'kind'='area' and n->>'area' is distinct from n->>'name') then raise exception 'Área o departamento no válido.'; end if;
    if exists(select 1 from unnest(array['gap','criticality','risk','impact']) k where coalesce(n->>k,'') !~ '^(0(\.\d+)?|1(\.0+)?)$') then raise exception 'Los factores deben estar entre 0 y 1.'; end if;
    parent_node := null;
    select x into parent_node from jsonb_array_elements(p_payload->'nodes') x where x->>'id'=n->>'parent';
    if parent_node is null then
      if (n->>'parent') is distinct from (n->>'fund') or n->>'kind'<>'group' then raise exception 'Primero distribuya por grupo ocupacional, luego área y departamento.'; end if;
    elsif parent_node->>'fund' is distinct from n->>'fund' or not ((parent_node->>'kind'='group' and n->>'kind'='area') or (parent_node->>'kind'='area' and n->>'kind'='department') or (parent_node->>'kind'='department' and n->>'kind'='activity')) then raise exception 'Jerarquía o fondo no válido.';
    end if;
    if n->>'kind'='group' and (n->>'group' is distinct from n->>'name' or not exists(select 1 from public.organizational_structure where active and group_name=n->>'name')) then raise exception 'Grupo ocupacional fuera de la estructura institucional.'; end if;
    if parent_node is not null and n->>'group' is distinct from parent_node->>'group' then raise exception 'El elemento debe conservar el grupo ocupacional del padre.'; end if;
    if n->>'kind'='area' and not exists(select 1 from public.organizational_structure where active and group_name=n->>'group' and area_name=n->>'name') then raise exception 'Área fuera de la estructura institucional vigente.'; end if;
    if n->>'kind' in ('department','activity') and not exists(select 1 from public.organizational_structure where active and group_name=n->>'group' and area_name=n->>'area' and department_name=n->>'department') then raise exception 'El departamento no pertenece al área institucional seleccionada.'; end if;
    if exists(select 1 from jsonb_array_elements(p_payload->'nodes') x where x->>'parent'=n->>'parent' and lower(btrim(x->>'name'))=lower(btrim(n->>'name')) and x->>'id'<>n->>'id') then raise exception 'La asignación ya existe en este nivel.'; end if;
    if n->>'kind'='department' and parent_node is not null and n->>'area' is distinct from parent_node->>'name' then raise exception 'El departamento debe conservar el área del padre.'; end if;
    if n->>'kind'='activity' and (n->>'department' is distinct from parent_node->>'name' or n->>'area' is distinct from parent_node->>'area') then raise exception 'La actividad debe conservar el departamento y área del padre.'; end if;
    if n->>'kind'='activity' and (nullif(n->>'need_id','') is null or not exists(select 1 from public.training_needs t where t.id=(n->>'need_id')::uuid and t.period_id=p_period and t.department=n->>'department' and t.area=n->>'area' and t.competency=n->>'name')) then raise exception 'Los temas presupuestados deben estar seleccionados en la DNC del mismo departamento y período.'; end if;
    if nullif(n->>'need_id','') is not null then
      if n->>'kind'<>'activity' or not exists(select 1 from public.training_needs where id=(n->>'need_id')::uuid and period_id=p_period and department=n->>'department' and area=n->>'area') then raise exception 'Necesidad de otro período o departamento.'; end if;
    end if;
  end loop;
  -- Traverse only three permitted levels; unreachable nodes/cycles are rejected below.
  for level_no in 1..4 loop
    for n in select * from jsonb_array_elements(p_payload->'nodes') loop
      if values_by_id ? (n->>'parent') and not values_by_id ? (n->>'id') then
        total := (values_by_id->>(n->>'parent'))::numeric;
        amount := case when n->>'mode'='percent' then floor(total*(n->>'value')::numeric/10000) else (n->>'value')::numeric end;
        values_by_id := values_by_id || jsonb_build_object(n->>'id',amount);
      end if;
    end loop;
  end loop;
  select count(*) into valid_count from jsonb_array_elements(p_payload->'nodes') x where values_by_id ? (x->>'id');
  if valid_count<>node_count then raise exception 'Existen nodos huérfanos o circulares.'; end if;
  for n in select * from jsonb_array_elements(p_payload->'nodes') loop
    if n ? 'costs' then
      if jsonb_typeof(n->'costs') is distinct from 'object' then raise exception 'Desglose de inversión no válido.'; end if;
      if exists(select 1 from jsonb_each(n->'costs') e where e.key not in ('training','lodging','meals','travel') or (e.value<>'null'::jsonb and e.value::text !~ '^\d+$')) then raise exception 'Concepto o monto de inversión no válido.'; end if;
      assigned := coalesce((n->'costs'->>'training')::numeric,0);
      if assigned>(values_by_id->>(n->>'id'))::numeric then raise exception 'El costo de capacitación supera la asignación.'; end if;
    end if;
    if n ? 'method_base_percent' and ((n->>'method_base_percent')::numeric not between 0 and 100) then raise exception 'Porcentaje base no válido.'; end if;
  end loop;
  for f in select jsonb_build_object('id',key,'value',value) from jsonb_each(values_by_id) loop
    select coalesce(sum((values_by_id->>(x->>'id'))::numeric),0), coalesce(sum(case when x->>'mode'='percent' then (x->>'value')::numeric else 0 end),0)
      into assigned, percentages from jsonb_array_elements(p_payload->'nodes') x where x->>'parent'=f->>'id';
    if percentages>10000 or assigned>(f->>'value')::numeric then raise exception 'La distribución supera el presupuesto o el 100 %% del padre %.', f->>'id'; end if;
  end loop;
  if p_payload->>'logistics_generated'='true' then
    if not exists(select 1 from jsonb_array_elements(p_payload->'nodes') x where x->>'kind'='activity') then raise exception 'Complete la distribución hasta los temas antes de generar logística.'; end if;
    for f in select jsonb_build_object('id',key,'value',value) from jsonb_each(values_by_id) where key in ('Institucional','Broker','Otros') or exists(select 1 from jsonb_array_elements(p_payload->'nodes') x where x->>'id'=key and x->>'kind'<>'activity') loop
      select coalesce(sum((values_by_id->>(x->>'id'))::numeric),0) into assigned from jsonb_array_elements(p_payload->'nodes') x where x->>'parent'=f->>'id';
      if assigned<>(f->>'value')::numeric then raise exception 'Complete la distribución de capacitación antes de generar logística.'; end if;
    end loop;
  end if;
  if (select count(distinct x->>'record_id') from jsonb_array_elements(p_payload->'links') x)<>jsonb_array_length(p_payload->'links') then raise exception 'Un gasto no puede vincularse dos veces.'; end if;
  for l in select * from jsonb_array_elements(p_payload->'links') loop
    if not exists(select 1 from public.training_records where id=(l->>'record_id')::uuid and period_id=p_period) or not exists(select 1 from jsonb_array_elements(p_payload->'nodes') x where x->>'id'=l->>'node_id' and x->>'kind'='activity') then raise exception 'Vinculación de gasto no válida.'; end if;
  end loop;
  insert into public.training_budget_plans(period_id,revision,payload,updated_by) values(p_period,1,p_payload,auth.uid())
  on conflict(period_id) do update set revision=training_budget_plans.revision+1,payload=excluded.payload,updated_by=auth.uid(),updated_at=now() returning * into current_row;
  insert into public.training_budget_revisions(period_id,revision,payload,changed_by) values(p_period,current_row.revision,p_payload,auth.uid());
  return to_jsonb(current_row);
end;
$$;
revoke all on function public.save_training_budget(uuid,integer,jsonb) from public, anon;
grant execute on function public.save_training_budget(uuid,integer,jsonb) to authenticated;

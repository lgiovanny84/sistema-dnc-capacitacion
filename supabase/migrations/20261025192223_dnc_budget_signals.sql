-- A scoped, read-only signal API. Users receive booleans, never financial payloads or amounts.
create function public.dnc_budget_signals(p_period uuid,p_group text,p_area text,p_department text,p_competency text,p_estimated_cost numeric default null,p_need_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare caller public.profiles; selected_period public.planning_periods; existing_need public.training_needs; data jsonb;
  structure_changed boolean:=false; original_linked boolean:=false; group_total numeric:=0; area_total numeric:=0;
  department_total numeric:=0; topic_total numeric:=0; topic_linked boolean:=false;
  requested numeric; missing integer;
begin
 if auth.uid() is null then raise exception 'Debe iniciar sesión.'; end if;
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

-- Preserve allocations saved with the previous area-first screen during rollout.
-- Original payload remains in training_budget_revisions. Never infer an ambiguous group.
do $$
declare b record; n jsonb; area_node jsonb; f jsonb; g record; nodes jsonb; roots jsonb; group_name text; group_id uuid; cents numeric; total numeric; group_count integer; next_payload jsonb;
begin
 for b in select * from public.training_budget_plans where exists(select 1 from jsonb_array_elements(payload->'nodes') root where root->>'kind'='area' and root->>'parent'=root->>'fund') for update loop
  if exists(select 1 from jsonb_array_elements(b.payload->'nodes') root where root->>'kind'='group') then raise exception 'Presupuesto mixto: requiere revisión antes de conversión.'; end if;
  nodes:='[]'::jsonb;roots:='[]'::jsonb;
  for n in select * from jsonb_array_elements(b.payload->'nodes') loop
   select count(distinct o.group_name),min(o.group_name) into group_count,group_name from public.organizational_structure o where o.active and o.area_name=n->>'area';
   if group_count<>1 or (nullif(n->>'group','') is not null and n->>'group'<>group_name) then raise exception 'No se puede inferir de forma única el grupo de %.',n->>'name'; end if;
   if n->>'kind'='area' then
    select x into f from jsonb_array_elements(b.payload->'funds') x where x->>'name'=n->>'fund';
    cents:=case when n->>'mode'='percent' then floor((f->>'cents')::numeric*(n->>'value')::numeric/10000) else (n->>'value')::numeric end;
    n:=n||jsonb_build_object('mode','amount','value',cents);
   end if;
   nodes:=nodes||jsonb_build_array(n||jsonb_build_object('group',group_name));
  end loop;
  for g in select distinct x->>'fund' as fund,x->>'group' as occupational_group from jsonb_array_elements(nodes) x where x->>'kind'='area' loop
   group_id:=gen_random_uuid();select coalesce(sum((x->>'value')::numeric),0) into total from jsonb_array_elements(nodes) x where x->>'kind'='area' and x->>'fund'=g.fund and x->>'group'=g.occupational_group;
   roots:=roots||jsonb_build_array(jsonb_build_object('id',group_id,'parent',g.fund,'fund',g.fund,'kind','group','name',g.occupational_group,'group',g.occupational_group,'area','','department','','need_id',null,'mode','amount','value',total,'people',0,'gap',0,'criticality',0,'risk',0,'impact',0));
   select jsonb_agg(case when x->>'kind'='area' and x->>'fund'=g.fund and x->>'group'=g.occupational_group then x||jsonb_build_object('parent',group_id) else x end) into nodes from jsonb_array_elements(nodes) x;
  end loop;
  next_payload:=b.payload||jsonb_build_object('nodes',roots||nodes,'logistics_generated',false);
  update public.training_budget_plans set payload=next_payload,revision=b.revision+1,updated_at=now() where period_id=b.period_id;
  insert into public.training_budget_revisions(period_id,revision,payload,changed_by) values(b.period_id,b.revision+1,next_payload,b.updated_by);
 end loop;
end $$;

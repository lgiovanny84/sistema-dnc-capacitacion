-- Visibility (active) and administrative closure are independent.
alter table public.planning_periods add column closed boolean not null default false;
update public.planning_periods set closed=true where not active;
create function public.enforce_open_training_period() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare periods uuid[]; pid uuid; is_active boolean; is_closed boolean;
begin
 if auth.uid() is null then raise exception 'Debe iniciar sesión para modificar información.'; end if;
 if tg_table_name='correction_requests' then
  if tg_op='INSERT' then select array_agg(period_id) into periods from public.training_needs where id=new.need_id;
  elsif tg_op='DELETE' then select array_agg(period_id) into periods from public.training_needs where id=old.need_id;
  else select array_agg(period_id) into periods from public.training_needs where id in(old.need_id,new.need_id); end if;
 else
  if tg_op='INSERT' then periods:=array[new.period_id];
  elsif tg_op='DELETE' then periods:=array[old.period_id];
  else periods:=array[old.period_id,new.period_id]; end if;
 end if;
 for pid in select distinct p from unnest(periods) p order by p loop
  -- Shares the lock with writes; closing a period must wait for in-flight data changes.
  select active,closed into is_active,is_closed from public.planning_periods where id=pid for share;
  if not found or not is_active or is_closed then raise exception 'Período cerrado o inactivo: solo consulta.'; end if;
 end loop;
 if tg_op='DELETE' then return old; end if;
 return new;
end $$;
revoke all on function public.enforce_open_training_period() from public,anon,authenticated;
do $$ declare tab text; begin
 foreach tab in array array['training_needs','training_records','training_import_batches','department_budgets','training_budget_plans','training_budget_revisions','correction_requests'] loop
  execute format('create trigger enforce_open_period before insert or update or delete on public.%I for each row execute function public.enforce_open_training_period()',tab);
 end loop;
end $$;

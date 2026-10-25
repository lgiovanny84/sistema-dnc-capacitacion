-- Explicitly authorized cleanup of the 2026 demo data. Keep periods, users and audit history.
-- Run once before installing the closed-period write guard.
begin;
do $$
declare target uuid; tab text; before_hashes jsonb:='{}'; digest text;
begin
 select id into target from public.planning_periods where name='2026' and start_date=date '2026-01-01' and end_date=date '2026-12-31';
 if target is null then raise exception 'No se identificó el período demo 2026.'; end if;
 foreach tab in array array['training_budget_revisions','training_budget_plans','training_records','training_import_batches','training_needs','department_budgets','training_dnc_counters'] loop
  execute format('select md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text,''[]'')) from public.%I t where period_id<>$1',tab) into digest using target;
  before_hashes:=before_hashes||jsonb_build_object(tab,digest);
 end loop;
 delete from public.training_budget_revisions where period_id=target;
 delete from public.training_budget_plans where period_id=target;
 delete from public.training_records where period_id=target;
 delete from public.training_import_batches where period_id=target;
 delete from public.training_needs where period_id=target;
 delete from public.department_budgets where period_id=target;
 delete from public.training_dnc_counters where period_id=target;
 foreach tab in array array['training_budget_revisions','training_budget_plans','training_records','training_import_batches','training_needs','department_budgets','training_dnc_counters'] loop
  execute format('select md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text,''[]'')) from public.%I t where period_id<>$1',tab) into digest using target;
  if digest is distinct from before_hashes->>tab then raise exception 'Cambió información de otro período en %.',tab; end if;
 end loop;
end $$;
commit;

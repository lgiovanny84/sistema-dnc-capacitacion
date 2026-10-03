-- Allow diagnosis before scheduling or quoting, without inventing zero costs or hours.
begin;
alter table public.training_needs add column if not exists priority_reason text not null default '';
alter table public.training_needs alter column hours drop not null;
alter table public.training_needs alter column estimated_cost drop not null;
alter table public.training_needs alter column estimated_cost drop default;
alter table public.training_needs alter column quarter drop not null;
alter table public.training_needs drop constraint if exists internal_date_required;
-- Keep training_need_planned_dates, positive hours, nonnegative cost and period checks.
notify pgrst, 'reload schema';
commit;

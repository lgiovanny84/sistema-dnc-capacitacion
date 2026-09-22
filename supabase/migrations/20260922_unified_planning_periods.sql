-- Período institucional único para levantamiento, planificación, ejecución y reportes.
create extension if not exists btree_gist;
create table if not exists public.planning_periods (
  id uuid primary key default gen_random_uuid(),
  name text not null check (nullif(btrim(name), '') is not null),
  start_date date not null,
  end_date date not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) default auth.uid(),
  constraint planning_period_dates check (end_date >= start_date),
  unique (name, start_date, end_date)
);

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'planning_periods_no_overlap') then
    alter table public.planning_periods add constraint planning_periods_no_overlap exclude using gist (daterange(start_date, end_date, '[]') with &&);
  end if;
end $$;

alter table public.training_needs add column if not exists period_id uuid references public.planning_periods(id);
alter table public.training_import_batches add column if not exists period_id uuid references public.planning_periods(id);
alter table public.training_records add column if not exists period_id uuid references public.planning_periods(id);
alter table public.department_budgets add column if not exists period_id uuid references public.planning_periods(id);

with years as (
  select extract(year from coalesce(planned_date, created_at::date))::integer as year from public.training_needs
  union select extract(year from period_start)::integer from public.training_import_batches
  union select extract(year from start_date)::integer from public.training_records where start_date is not null
  union select year from public.department_budgets
  union select extract(year from current_date)::integer
)
insert into public.planning_periods (name, start_date, end_date)
select year::text, make_date(year, 1, 1), make_date(year, 12, 31)
from years where year between 2020 and 2100
on conflict (name, start_date, end_date) do nothing;

update public.training_needs n
set period_id = p.id
from public.planning_periods p
where n.period_id is null
  and coalesce(n.planned_date, n.created_at::date) between p.start_date and p.end_date;

update public.training_import_batches b
set period_id = p.id
from public.planning_periods p
where b.period_id is null and b.period_start between p.start_date and p.end_date;

update public.training_records r
set period_id = b.period_id
from public.training_import_batches b
where r.period_id is null and r.import_batch_id = b.id and b.period_id is not null;

update public.training_records r
set period_id = p.id
from public.planning_periods p
where r.period_id is null and coalesce(r.start_date, r.uploaded_at::date) between p.start_date and p.end_date;

update public.department_budgets b
set period_id = p.id
from public.planning_periods p
where b.period_id is null and b.year = extract(year from p.start_date)::integer;

alter table public.training_needs alter column period_id set not null;
alter table public.training_import_batches alter column period_id set not null;
alter table public.training_records alter column period_id set not null;
alter table public.department_budgets alter column period_id set not null;

alter table public.department_budgets drop constraint if exists department_budgets_year_department_name_key;
create unique index if not exists department_budgets_period_department_uidx on public.department_budgets(period_id, department_name);
alter table public.training_records drop constraint if exists training_records_source_row_hash_key;
create unique index if not exists training_records_period_hash_uidx on public.training_records(period_id, source_row_hash);

create index if not exists training_needs_period_idx on public.training_needs(period_id);
create index if not exists training_import_batches_period_idx on public.training_import_batches(period_id);
create index if not exists training_records_period_idx on public.training_records(period_id);
create index if not exists department_budgets_period_idx on public.department_budgets(period_id);

alter table public.planning_periods enable row level security;
drop policy if exists planning_periods_read on public.planning_periods;
create policy planning_periods_read on public.planning_periods for select to authenticated using (true);
drop policy if exists planning_periods_admin_write on public.planning_periods;
create policy planning_periods_admin_write on public.planning_periods for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select, insert, update, delete on public.planning_periods to authenticated;

drop trigger if exists audit_planning_periods on public.planning_periods;
create trigger audit_planning_periods after insert or update or delete on public.planning_periods
for each row execute function public.track_changes();

-- Base ejecutada, presupuesto departamental y banco de horas.
-- El acceso nominal queda reservado al administrador por contener datos personales.

create table if not exists public.training_records (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  gender text not null default '',
  position text not null default '',
  requesting_area text not null,
  office text not null default '',
  topic text not null,
  company text not null default '',
  start_date date,
  end_date date,
  duration numeric(10,2) not null default 0 check (duration >= 0),
  location text not null default '',
  cost numeric(14,2) not null default 0 check (cost >= 0),
  status text not null default '',
  justification_criterion text not null default '',
  modality text not null default '',
  area text not null default '',
  department text not null default '',
  level text not null default '',
  occupational_group text not null default '',
  knowledge_area text not null default '',
  source_filename text not null default '',
  source_row_hash text not null unique,
  uploaded_at timestamptz not null default now(),
  uploaded_by uuid not null references public.profiles(id),
  constraint training_record_dates check (
    start_date is null or end_date is null or end_date >= start_date
  )
);

create table if not exists public.department_budgets (
  id uuid primary key default gen_random_uuid(),
  year integer not null check (year between 2020 and 2100),
  department_name text not null check (nullif(btrim(department_name), '') is not null),
  allocated_budget numeric(14,2) not null default 0 check (allocated_budget >= 0),
  bank_hours numeric(12,2) not null default 0 check (bank_hours >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) default auth.uid(),
  unique (year, department_name)
);

create index if not exists training_records_start_date_idx on public.training_records(start_date);
create index if not exists training_records_requesting_area_idx on public.training_records(requesting_area);
create index if not exists training_records_status_idx on public.training_records(status);
create index if not exists training_records_department_idx on public.training_records(department);

alter table public.training_records enable row level security;
alter table public.department_budgets enable row level security;

drop policy if exists training_records_admin_all on public.training_records;
create policy training_records_admin_all on public.training_records
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin() and uploaded_by = auth.uid());

drop policy if exists department_budgets_admin_all on public.department_budgets;
create policy department_budgets_admin_all on public.department_budgets
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select, insert, update, delete on public.training_records to authenticated;
grant select, insert, update, delete on public.department_budgets to authenticated;

drop trigger if exists audit_training_records on public.training_records;
create trigger audit_training_records
after insert or update or delete on public.training_records
for each row execute function public.track_changes();

drop trigger if exists audit_department_budgets on public.department_budgets;
create trigger audit_department_budgets
after insert or update or delete on public.department_budgets
for each row execute function public.track_changes();

-- Reactiva y conserva como administrador la cuenta institucional principal.
update public.profiles
set role = 'admin', active = true, profile_updated_at = now()
where lower(email) = 'lgiovanny84@gmail.com';


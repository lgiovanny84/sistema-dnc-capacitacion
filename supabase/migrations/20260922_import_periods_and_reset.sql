-- Control de cargas por periodo y eliminación auditada por lote.
create table if not exists public.training_import_batches (
  id uuid primary key default gen_random_uuid(),
  period_name text not null check (nullif(btrim(period_name), '') is not null),
  period_start date not null,
  period_end date not null,
  source_filename text not null,
  row_count integer not null default 0 check (row_count >= 0),
  uploaded_at timestamptz not null default now(),
  uploaded_by uuid not null references public.profiles(id),
  constraint training_import_period_valid check (period_end >= period_start)
);

alter table public.training_records
  add column if not exists import_batch_id uuid
  references public.training_import_batches(id) on delete cascade;

create index if not exists training_records_import_batch_idx
  on public.training_records(import_batch_id);

alter table public.training_import_batches enable row level security;

drop policy if exists training_import_batches_admin_all on public.training_import_batches;
create policy training_import_batches_admin_all on public.training_import_batches
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin() and uploaded_by = auth.uid());

grant select, insert, update, delete on public.training_import_batches to authenticated;

drop trigger if exists audit_training_import_batches on public.training_import_batches;
create trigger audit_training_import_batches
after insert or update or delete on public.training_import_batches
for each row execute function public.track_changes();


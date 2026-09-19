-- Solicitudes de corrección: el usuario solicita y el administrador modifica.
create table if not exists public.correction_requests (
  id uuid primary key default gen_random_uuid(),
  need_id uuid not null references public.training_needs(id) on delete cascade,
  requester_id uuid not null references public.profiles(id) on delete cascade,
  requested_field text not null check (char_length(btrim(requested_field)) between 2 and 80),
  explanation text not null check (char_length(btrim(explanation)) between 10 and 300),
  status text not null default 'Pendiente'
    check (status in ('Pendiente','Atendida','Rechazada')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id)
);

create unique index if not exists correction_request_pending_unique
  on public.correction_requests (need_id, requester_id, requested_field)
  where status = 'Pendiente';

alter table public.correction_requests enable row level security;

drop policy if exists correction_request_read on public.correction_requests;
create policy correction_request_read on public.correction_requests
  for select to authenticated
  using (requester_id = auth.uid() or public.is_admin());

drop policy if exists correction_request_insert on public.correction_requests;
create policy correction_request_insert on public.correction_requests
  for insert to authenticated
  with check (
    requester_id = auth.uid()
    and exists (
      select 1 from public.training_needs n
      where n.id = need_id and n.owner_id = auth.uid()
    )
  );

drop policy if exists correction_request_admin_update on public.correction_requests;
create policy correction_request_admin_update on public.correction_requests
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists correction_request_admin_delete on public.correction_requests;
create policy correction_request_admin_delete on public.correction_requests
  for delete to authenticated using (public.is_admin());

grant select, insert, update, delete on public.correction_requests to authenticated;

drop policy if exists need_owner_update on public.training_needs;
drop policy if exists need_admin_update on public.training_needs;
create policy need_admin_update on public.training_needs
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop trigger if exists audit_correction_requests on public.correction_requests;
create trigger audit_correction_requests
after insert or update or delete on public.correction_requests
for each row execute function public.track_changes();

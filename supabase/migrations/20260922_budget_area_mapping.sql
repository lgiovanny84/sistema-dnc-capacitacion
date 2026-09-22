-- Correspondencia explícita entre presupuesto departamental y AREA REQUIRIENTE.
alter table public.department_budgets
  add column if not exists requesting_area_name text;

update public.department_budgets
set requesting_area_name = department_name
where nullif(btrim(requesting_area_name), '') is null;


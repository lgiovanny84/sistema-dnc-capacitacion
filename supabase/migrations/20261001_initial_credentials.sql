-- Las cuentas creadas por el administrador cambian su clave temporal al ingresar.
alter table public.profiles
  add column if not exists must_change_password boolean not null default false;

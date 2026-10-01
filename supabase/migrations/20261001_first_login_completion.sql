-- El cambio de contraseña se valida en la función Edge antes de invocar esta rutina.
create or replace function public.finish_first_login()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Sesión no válida';
  end if;

  update public.profiles
     set must_change_password = false,
         profile_updated_at = now()
   where id = auth.uid()
     and active = true
     and deleted_at is null;

  if not found then
    raise exception 'Acceso inactivo o no disponible';
  end if;
end;
$$;

revoke all on function public.finish_first_login() from public;
grant execute on function public.finish_first_login() to authenticated;

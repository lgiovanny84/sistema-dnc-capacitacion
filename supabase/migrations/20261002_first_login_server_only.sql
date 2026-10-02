-- Only the backend can clear the temporary-password requirement, after
-- admin-users has successfully updated the authenticated user's password.
begin;

create or replace function public.finish_first_login_for_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
     set must_change_password = false,
         profile_updated_at = now()
   where id = p_user_id
     and active = true
     and deleted_at is null;

  if not found then
    raise exception 'Acceso inactivo o no disponible';
  end if;
end;
$$;

revoke all on function public.finish_first_login_for_user(uuid) from public, anon, authenticated;
grant execute on function public.finish_first_login_for_user(uuid) to service_role;
revoke all on function public.finish_first_login() from public, anon, authenticated;

commit;

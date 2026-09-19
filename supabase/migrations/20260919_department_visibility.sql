-- Alcance de lectura por departamento y permiso excepcional de área.
alter table public.profiles
  add column if not exists can_view_entire_area boolean not null default false;

create or replace function public.complete_own_profile(
  p_position text,
  p_group text,
  p_area text,
  p_department text
) returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.profiles;
begin
  if auth.uid() is null then
    raise exception 'Sesión no válida';
  end if;
  if nullif(btrim(p_position), '') is null then
    raise exception 'El cargo es obligatorio';
  end if;
  if not exists (
    select 1 from public.organizational_structure
    where active
      and group_name = p_group
      and area_name = p_area
      and department_name = p_department
  ) then
    raise exception 'El departamento seleccionado no es válido';
  end if;

  update public.profiles
  set position = btrim(p_position),
      occupational_group = p_group,
      area = p_area,
      department = p_department,
      onboarding_completed_at = now(),
      profile_updated_at = now()
  where id = auth.uid()
    and active
    and (onboarding_completed_at is null or role = 'admin')
  returning * into result;

  if result.id is null then
    raise exception 'El perfil ya fue completado o no está activo';
  end if;
  return result;
end;
$$;

revoke all on function public.complete_own_profile(text,text,text,text) from public;
grant execute on function public.complete_own_profile(text,text,text,text) to authenticated;

create or replace function public.can_view_training_need(
  p_area text,
  p_department text
) returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.active
      and (
        p.role = 'admin'
        or (p.can_view_entire_area and p.area = p_area)
        or p.department = p_department
      )
  );
$$;

create or replace function public.can_use_training_structure(
  p_group text,
  p_area text,
  p_department text
) returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.active
      and (
        p.role = 'admin'
        or (
          p.occupational_group = p_group
          and p.area = p_area
          and p.department = p_department
        )
      )
  );
$$;

revoke all on function public.can_view_training_need(text,text) from public;
revoke all on function public.can_use_training_structure(text,text,text) from public;
grant execute on function public.can_view_training_need(text,text) to authenticated;
grant execute on function public.can_use_training_structure(text,text,text) to authenticated;

drop policy if exists need_read on public.training_needs;
create policy need_read on public.training_needs
  for select to authenticated
  using (public.can_view_training_need(area, department));

drop policy if exists need_insert on public.training_needs;
create policy need_insert on public.training_needs
  for insert to authenticated
  with check (
    owner_id = auth.uid()
    and public.can_use_training_structure(occupational_group, area, department)
  );

drop policy if exists need_owner_update on public.training_needs;
create policy need_owner_update on public.training_needs
  for update to authenticated
  using (owner_id = auth.uid() or public.is_admin())
  with check (
    public.is_admin()
    or (
      owner_id = auth.uid()
      and public.can_use_training_structure(occupational_group, area, department)
    )
  );

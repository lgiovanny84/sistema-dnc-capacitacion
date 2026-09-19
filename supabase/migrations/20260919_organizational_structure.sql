-- Estructura organizacional dependiente, perfil inicial y trazabilidad.
alter table public.profiles
  add column if not exists position text,
  add column if not exists occupational_group text,
  add column if not exists area text,
  add column if not exists department text,
  add column if not exists onboarding_completed_at timestamptz,
  add column if not exists profile_updated_at timestamptz not null default now();

alter table public.training_needs add column if not exists position text not null default '';

alter table public.catalogs drop constraint if exists catalogs_kind_check;
alter table public.catalogs
  add constraint catalogs_kind_check
  check (kind in ('factor','competency','position','occupational_group','area','department','modality'));

create table if not exists public.organizational_structure (
  id uuid primary key default gen_random_uuid(),
  group_name text not null,
  area_name text not null,
  department_name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id),
  unique (group_name, area_name, department_name)
);

alter table public.organizational_structure enable row level security;

drop policy if exists organizational_structure_read on public.organizational_structure;
create policy organizational_structure_read on public.organizational_structure
  for select to authenticated using (true);

drop policy if exists organizational_structure_admin_write on public.organizational_structure;
create policy organizational_structure_admin_write on public.organizational_structure
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

grant select, insert, update, delete on public.organizational_structure to authenticated;

drop policy if exists need_admin_delete on public.training_needs;
create policy need_admin_delete on public.training_needs
  for delete to authenticated using (public.is_admin());

grant delete on public.training_needs, public.catalogs to authenticated;

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
    raise exception 'La combinación de grupo, área y departamento no es válida';
  end if;

  update public.profiles
  set position = btrim(p_position),
      occupational_group = p_group,
      area = p_area,
      department = p_department,
      onboarding_completed_at = coalesce(onboarding_completed_at, now()),
      profile_updated_at = now()
  where id = auth.uid() and active
  returning * into result;

  if result.id is null then
    raise exception 'Perfil no encontrado o inactivo';
  end if;
  return result;
end;
$$;

revoke all on function public.complete_own_profile(text,text,text,text) from public;
grant execute on function public.complete_own_profile(text,text,text,text) to authenticated;

create or replace function public.validate_training_need()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.organizational_structure
    where active
      and group_name = new.occupational_group
      and area_name = new.area
      and department_name = new.department
  ) then
    raise exception 'La combinación de grupo, área y departamento no es válida';
  end if;
  if new.planned_date is not null then
    new.quarter := 'Q' || ceil(extract(month from new.planned_date) / 3.0)::int;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists validate_training_need_before_write on public.training_needs;
create trigger validate_training_need_before_write
before insert or update on public.training_needs
for each row execute function public.validate_training_need();

drop trigger if exists audit_profiles on public.profiles;
create trigger audit_profiles after update on public.profiles
for each row execute function public.track_changes();

drop trigger if exists audit_organizational_structure on public.organizational_structure;
create trigger audit_organizational_structure
after insert or update or delete on public.organizational_structure
for each row execute function public.track_changes();

insert into public.organizational_structure (group_name, area_name, department_name) values
('COLABORADORES','ADMINISTRATIVO FINANCIERO','ADMINISTRATIVO'),
('ASAMBLEA DE REPRESENTANTES','ASAMBLEA DE REPRESENTANTES','ASAMBLEA DE REPRESENTANTES'),
('COLABORADORES','ATENCIÓN AL CLIENTE','ATENCIÓN AL CLIENTE'),
('COLABORADORES','AUDITORÍA INTERNA','AUDITORÍA INTERNA'),
('COLABORADORES','NEGOCIOS','CALL CENTER'),
('COLABORADORES','NEGOCIOS','CAPTACIONES'),
('COLABORADORES','NEGOCIOS','COBRANZAS'),
('COMISIÓN ESPECIAL DE EDUCACIÓN','COMISIÓN ESPECIAL DE EDUCACIÓN','COMISIÓN ESPECIAL DE EDUCACIÓN'),
('COMISIÓN ESPECIAL DE RESOLUCIÓN DE CONFLICTOS','COMISIÓN ESPECIAL DE RESOLUCIÓN DE CONFLICTOS','COMISIÓN ESPECIAL DE RESOLUCIÓN DE CONFLICTOS'),
('CONSEJO DE ADMINISTRACIÓN','CONSEJO DE ADMINISTRACIÓN','CONSEJO DE ADMINISTRACIÓN'),
('CONSEJO DE VIGILANCIA','CONSEJO DE VIGILANCIA','CONSEJO DE VIGILANCIA'),
('COLABORADORES','ADMINISTRATIVO FINANCIERO','CONTABILIDAD'),
('COLABORADORES','CUMPLIMIENTO','CUMPLIMIENTO'),
('COLABORADORES','TECNOLOGÍA DE LA INFORMACIÓN','DESARROLLO DE SOFTWARE'),
('COLABORADORES','OPERACIONES','FÁBRICA DE CRÉDITO'),
('COLABORADORES','ADMINISTRATIVO FINANCIERO','FINANCIERO'),
('COLABORADORES','OPERACIONES','FRONT OPERATIVO'),
('GERENCIA','GERENCIA','GERENCIA'),
('COLABORADORES','TECNOLOGÍA DE LA INFORMACIÓN','INFRAESTRUCTURA'),
('COLABORADORES','INSTITUCIONAL','INSTITUCIONAL'),
('COLABORADORES','JURÍDICO','JURÍDICO'),
('COLABORADORES','NEGOCIOS','MARKETING'),
('COLABORADORES','NEGOCIOS','NEGOCIOS'),
('COLABORADORES','OPERACIONES','OPERACIONES'),
('PASANTE UNIVERSITARIO','PASANTE UNIVERSITARIO','PASANTE UNIVERSITARIO'),
('COLABORADORES','OPERACIONES','PLANIFICACIÓN PROCESOS E INNOVACIÓN'),
('COLABORADORES','OPERACIONES','PLANIFICACIÓN Y PROCESOS'),
('COLABORADORES','OPERACIONES','PROCESOS'),
('ASAMBLEA DE REPRESENTANTES','ASAMBLEA DE REPRESENTANTES','REPRESENTANTE ASAMBLEA'),
('COLABORADORES','NEGOCIOS','RESPONSABILIDAD SOCIAL'),
('COLABORADORES','RIESGOS','RIESGOS'),
('COLABORADORES','SECRETARIA DE GERENCIA','SECRETARIA DE GERENCIA'),
('COLABORADORES','SEGURIDAD ORGANIZACIONAL','SEGURIDAD DE LA INFORMACIÓN'),
('COLABORADORES','SEGURIDAD ORGANIZACIONAL','SEGURIDAD FÍSICA'),
('COLABORADORES','SEGURIDAD ORGANIZACIONAL','SEGURIDAD INFORMATICA'),
('COLABORADORES','SEGURIDAD ORGANIZACIONAL','SEGURIDAD ORGANIZACIONAL'),
('COLABORADORES','ADMINISTRATIVO FINANCIERO','SEGURIDAD Y SALUD OCUPACIONAL'),
('SERVICIOS PROFESIONALES','SERVICIOS PROFESIONALES','SERVICIOS PROFESIONALES'),
('COLABORADORES','TECNOLOGÍA DE LA INFORMACIÓN','SISTEMA Y BASE DE DATOS'),
('COLABORADORES','NEGOCIOS','SUCURSALES Y AGENCIAS (NEGOCIOS)'),
('COLABORADORES','OPERACIONES','SUCURSALES Y AGENCIAS (OPERACIONES)'),
('COLABORADORES','ADMINISTRATIVO FINANCIERO','TALENTO HUMANO'),
('COLABORADORES','TECNOLOGÍA DE LA INFORMACIÓN','TECNOLOGÍA DE LA INFORMACIÓN'),
('COLABORADORES','ADMINISTRATIVO FINANCIERO','TESORERÍA')
on conflict (group_name, area_name, department_name) do update set active = true;

alter default privileges in schema public grant select on tables to authenticated;

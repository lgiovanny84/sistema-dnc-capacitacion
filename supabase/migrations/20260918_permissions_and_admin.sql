-- Corrige privilegios de API y establece el primer administrador.
grant usage on schema public to authenticated;
grant select on public.profiles, public.catalogs, public.training_needs, public.audit_log to authenticated;
grant insert, update on public.training_needs to authenticated;
grant insert, update on public.catalogs to authenticated;
grant update on public.profiles to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- La autorización efectiva continúa controlada por las políticas RLS.
update public.profiles
set role = 'admin', active = true
where lower(email) = 'lgiovanny84@gmail.com';

alter default privileges in schema public grant select on tables to authenticated;


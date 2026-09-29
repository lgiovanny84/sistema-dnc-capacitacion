-- Usuario único para ingreso; el correo permanece como canal de recuperación.
alter table public.profiles add column if not exists username text;

with numbered as (
  select id,
         case when length(clean_local) < 3 then 'usuario-' || clean_local else left(clean_local, 25) end as base,
         row_number() over (
           partition by case when length(clean_local) < 3 then 'usuario-' || clean_local else left(clean_local, 25) end
           order by created_at, id
         ) as sequence
  from (select *, coalesce(nullif(regexp_replace(lower(split_part(email, '@', 1)), '[^a-z0-9._-]', '', 'g'), ''), 'usuario') as clean_local from public.profiles) existing
  where username is null
)
update public.profiles p
set username = numbered.base || case when numbered.sequence = 1 then '' else '-' || numbered.sequence::text end
from numbered where p.id = numbered.id;

alter table public.profiles alter column username set not null;
alter table public.profiles add constraint profiles_username_format
  check (username ~ '^[a-z0-9._-]{3,32}$');
create unique index if not exists profiles_username_unique on public.profiles (username);

create or replace function public.new_user_profile() returns trigger
language plpgsql security definer set search_path=public as $$
declare
  base text;
  candidate text;
  suffix integer := 1;
begin
  base := left(coalesce(nullif(regexp_replace(lower(split_part(new.email, '@', 1)), '[^a-z0-9._-]', '', 'g'), ''), 'usuario'), 25);
  if length(base) < 3 then base := 'usuario-' || base; end if;
  candidate := base;
  while exists (select 1 from public.profiles where username = candidate) loop
    suffix := suffix + 1;
    candidate := base || '-' || suffix::text;
  end loop;
  insert into public.profiles(id,email,full_name,username)
  values(new.id,new.email,coalesce(new.raw_user_meta_data->>'full_name',''),candidate);
  return new;
end$$;

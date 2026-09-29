-- Usuario único para ingreso; el correo permanece como canal de recuperación.
alter table public.profiles add column if not exists username text;

create unique index if not exists profiles_username_unique on public.profiles (username);

do $$
declare
  account record;
  base text;
  candidate text;
  suffix integer;
begin
  for account in select id, email from public.profiles where username is null order by created_at, id loop
    base := left(coalesce(nullif(regexp_replace(lower(split_part(account.email, '@', 1)), '[^a-z0-9._-]', '', 'g'), ''), 'usuario'), 25);
    if length(base) < 3 then base := 'usuario-' || base; end if;
    candidate := base;
    suffix := 1;
    while exists (select 1 from public.profiles where username = candidate) loop
      suffix := suffix + 1;
      candidate := base || '-' || suffix::text;
    end loop;
    update public.profiles set username = candidate where id = account.id;
  end loop;
end$$;

alter table public.profiles alter column username set not null;
alter table public.profiles add constraint profiles_username_format
  check (username ~ '^[a-z0-9._-]{3,32}$');

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

-- Enforce first-login security on the server and database, with shared login limits.
begin;
alter table public.profiles add column if not exists temporary_password_expires_at timestamptz;
-- Existing pending credentials receive the same transition window as new ones.
update public.profiles set temporary_password_expires_at = now() + interval '24 hours'
where must_change_password and temporary_password_expires_at is null;

create or replace function public.has_completed_password_setup()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles p where p.id = auth.uid()
    and p.active and p.deleted_at is null and not p.must_change_password)
$$;
revoke all on function public.has_completed_password_setup() from public, anon;
grant execute on function public.has_completed_password_setup() to authenticated;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles p where p.id = auth.uid()
    and p.role = 'admin' and p.active and p.deleted_at is null and not p.must_change_password)
$$;

-- Restrictive policies intersect with all existing permissive policies;
-- department/area/owner scopes continue to apply. Self-profile reads remain
-- available for the first-login/recovery flow, but business data is blocked.
do $$
declare relation text;
begin
  foreach relation in array array['training_needs','catalogs','competency_matrix',
    'planning_periods','organizational_structure','correction_requests',
    'training_records','department_budgets','training_import_batches','audit_log'] loop
    execute format('drop policy if exists password_setup_required on public.%I', relation);
    execute format('create policy password_setup_required on public.%I as restrictive for all to authenticated using ((select public.has_completed_password_setup())) with check ((select public.has_completed_password_setup()))', relation);
  end loop;
end $$;

create or replace function public.finish_first_login_for_user(p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles set must_change_password = false,
    temporary_password_expires_at = null, profile_updated_at = now()
  where id = p_user_id and active and deleted_at is null;
  if not found then raise exception 'Acceso inactivo o no disponible'; end if;
end $$;
revoke all on function public.finish_first_login_for_user(uuid) from public, anon, authenticated;
grant execute on function public.finish_first_login_for_user(uuid) to service_role;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table if not exists private.login_attempt_buckets (
  bucket text primary key,
  attempts integer not null check(attempts > 0),
  reset_at timestamptz not null
);
create index if not exists login_attempt_buckets_reset_idx on private.login_attempt_buckets(reset_at);
alter table private.login_attempt_buckets enable row level security;
revoke all on private.login_attempt_buckets from public, anon, authenticated;

create or replace function public.consume_login_attempt(p_account_hash text, p_origin_hash text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  attempted_at timestamptz := clock_timestamp();
  counter integer; deadline timestamptz; entry record;
  permitted boolean := true; retry_seconds integer := 0;
begin
  if p_account_hash !~ '^[0-9a-f]{64}$' or p_origin_hash !~ '^[0-9a-f]{64}$'
    or p_account_hash is null or p_origin_hash is null then
    raise exception 'Invalid login bucket';
  end if;
  -- Bounded cleanup; no usernames, passwords or raw IP addresses are stored.
  delete from private.login_attempt_buckets where bucket in (
    select bucket from private.login_attempt_buckets
    where reset_at < attempted_at - interval '1 day' order by reset_at limit 500
  );
  -- Deterministic lock order and atomic UPSERT protect concurrent invocations.
  for entry in select * from (values
    (0, 'global', 3000), (1, 'account:' || p_account_hash, 10), (2, 'origin:' || p_origin_hash, 300)
  ) as limits(priority, bucket, max_attempts) order by priority loop
    insert into private.login_attempt_buckets as existing(bucket, attempts, reset_at)
    values(entry.bucket, 1, attempted_at + interval '10 minutes')
    on conflict (bucket) do update set
      attempts = case when existing.reset_at <= attempted_at then 1 else least(existing.attempts + 1, entry.max_attempts + 1) end,
      reset_at = case when existing.reset_at <= attempted_at then attempted_at + interval '10 minutes' else existing.reset_at end
    returning attempts, reset_at into counter, deadline;
    if counter > entry.max_attempts then
      permitted := false;
      retry_seconds := greatest(retry_seconds, ceil(extract(epoch from deadline - attempted_at))::integer);
    end if;
    -- Once the global budget is exhausted do not create attacker-selected buckets.
    if entry.bucket = 'global' and not permitted then exit; end if;
  end loop;
  return jsonb_build_object('allowed', permitted, 'retry_after', greatest(1, retry_seconds));
end $$;
revoke all on function public.consume_login_attempt(text,text) from public, anon, authenticated;
grant execute on function public.consume_login_attempt(text,text) to service_role;
notify pgrst, 'reload schema';
commit;

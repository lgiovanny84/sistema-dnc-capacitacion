-- Each planning period owns its own sequence. UUIDs and financial links are unchanged.
lock table public.training_needs in share row exclusive mode;
alter table public.training_needs add column period_number bigint;
alter table public.training_needs add column previous_dnc_code text;
create table public.training_dnc_counters(
  period_id uuid primary key references public.planning_periods(id) on delete cascade,
  last_number bigint not null check(last_number>=0)
);
alter table public.training_dnc_counters enable row level security;
revoke all on public.training_dnc_counters from public,anon,authenticated;

-- Preserve the old code and metadata. Keep audit history, without revalidating old structures.
alter table public.training_needs disable trigger validate_training_need_before_write;
alter table public.training_needs disable trigger training_needs_display_code;
alter table public.training_needs drop constraint training_needs_dnc_code_key;
with numbered as (
  select n.id,row_number() over(partition by n.period_id order by n.created_at,n.id) as seq,
    extract(year from p.start_date)::integer::text as year
  from public.training_needs n join public.planning_periods p on p.id=n.period_id
)
update public.training_needs n set previous_dnc_code=n.dnc_code,period_number=v.seq,
  dnc_code='ATU-DO-'||lpad(v.seq::text,greatest(3,length(v.seq::text)),'0')||'-'||v.year
from numbered v where v.id=n.id;
alter table public.training_needs enable trigger validate_training_need_before_write;
alter table public.training_needs enable trigger training_needs_display_code;
alter table public.training_needs alter column period_number set not null;
alter table public.training_needs add constraint training_needs_period_number_key unique(period_id,period_number);
alter table public.training_needs add constraint training_needs_period_code_key unique(period_id,dnc_code);
insert into public.training_dnc_counters(period_id,last_number)
select period_id,max(period_number) from public.training_needs group by period_id;

-- An atomic upsert serializes only the counter of the selected period.
-- Definer access is limited to the private counter; direct calls are revoked.
create or replace function public.assign_dnc_display_code() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare period_year text;
begin
  if tg_op='UPDATE' then
    new.report_number:=old.report_number;
    if new.period_id is not distinct from old.period_id then
      new.period_number:=old.period_number;
      new.dnc_code:=old.dnc_code;
      new.previous_dnc_code:=old.previous_dnc_code;
      return new;
    end if;
    new.previous_dnc_code:=old.dnc_code;
  else
    new.previous_dnc_code:=null;
  end if;
  if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid() and active and deleted_at is null) then
    raise exception 'Solo un usuario activo puede registrar una DNC.';
  end if;
  select extract(year from start_date)::integer::text into period_year from public.planning_periods where id=new.period_id;
  if period_year is null then raise exception 'Período inexistente.'; end if;
  insert into public.training_dnc_counters(period_id,last_number) values(new.period_id,1)
  on conflict(period_id) do update set last_number=public.training_dnc_counters.last_number+1
  returning last_number into new.period_number;
  new.dnc_code:='ATU-DO-'||lpad(new.period_number::text,greatest(3,length(new.period_number::text)),'0')||'-'||period_year;
  return new;
end $$;
revoke all on function public.assign_dnc_display_code() from public,anon,authenticated;

-- Stable display identifiers; UUIDs remain the internal relational keys.
alter table public.training_needs add column report_number bigint generated always as identity;
alter table public.training_needs add column dnc_code text;

-- Backfill display metadata without revalidating historical organizations or changing updated_at.
alter table public.training_needs disable trigger validate_training_need_before_write;
-- Global sequence: existing and future numbers are never reused, including across periods.
update public.training_needs n set dnc_code = 'ATU-DO-'
  || lpad(n.report_number::text,greatest(3,length(n.report_number::text)),'0') || '-'
  || coalesce((select extract(year from p.start_date)::integer::text from public.planning_periods p where p.id=n.period_id),extract(year from n.created_at)::integer::text);
alter table public.training_needs enable trigger validate_training_need_before_write;
alter table public.training_needs alter column dnc_code set not null;
alter table public.training_needs add constraint training_needs_dnc_code_key unique(dnc_code);

create function public.assign_dnc_display_code() returns trigger
language plpgsql security invoker set search_path=public,pg_temp as $$
declare period_year text;
begin
  if tg_op='UPDATE' then
    new.report_number:=old.report_number;
    new.dnc_code:=old.dnc_code;
  else
    select extract(year from start_date)::integer::text into period_year from public.planning_periods where id=new.period_id;
    new.dnc_code:='ATU-DO-' || lpad(new.report_number::text,greatest(3,length(new.report_number::text)),'0') || '-'
      || coalesce(period_year,extract(year from coalesce(new.created_at,now()))::integer::text);
  end if;
  return new;
end $$;
revoke all on function public.assign_dnc_display_code() from public,anon,authenticated;
create trigger training_needs_display_code before insert or update on public.training_needs
for each row execute function public.assign_dnc_display_code();

-- username-login reads the account profile with the server-side service role.
-- BYPASSRLS does not replace the table SELECT privilege.
-- Grant only the read access required for username lookup; no anonymous access.
begin;
grant select on table public.profiles to service_role;
commit;

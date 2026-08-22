-- This function exists only as a table trigger. Supabase default privileges
-- grant exposed API roles EXECUTE unless they are revoked explicitly.
revoke all on function public.audit_borehole_command() from anon;
revoke all on function public.audit_borehole_command() from authenticated;

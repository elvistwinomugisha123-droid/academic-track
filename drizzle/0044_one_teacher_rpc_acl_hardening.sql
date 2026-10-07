-- Harden the controlled-pilot bootstrap RPC ACL.
-- The RPC requires an authenticated operator with the server-managed
-- ate_pilot_operator app-metadata claim; anonymous callers must not be able
-- to invoke this SECURITY DEFINER function through PostgREST.
revoke execute on function public.apply_one_teacher_controlled_pilot(jsonb, boolean) from anon;
revoke execute on function public.apply_one_teacher_controlled_pilot(jsonb, boolean) from public;
grant execute on function public.apply_one_teacher_controlled_pilot(jsonb, boolean) to authenticated;
grant execute on function public.apply_one_teacher_controlled_pilot(jsonb, boolean) to service_role;

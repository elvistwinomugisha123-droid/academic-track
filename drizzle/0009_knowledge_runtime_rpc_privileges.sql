-- Step 6 post-apply hardening: keep central Academic Knowledge runtime
-- governance RPCs server-only. PostgreSQL grants EXECUTE on new functions to
-- PUBLIC by default, so revoke explicitly from browser-facing roles after the
-- functions exist and retain service-role access for trusted server workflows.

revoke all on function public.record_knowledge_runtime_decision(text, text, text, uuid, text, text) from public;
revoke all on function public.activate_knowledge_profile_pilot(uuid, uuid, text) from public;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function public.record_knowledge_runtime_decision(text, text, text, uuid, text, text) from anon;
    revoke all on function public.activate_knowledge_profile_pilot(uuid, uuid, text) from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on function public.record_knowledge_runtime_decision(text, text, text, uuid, text, text) from authenticated;
    revoke all on function public.activate_knowledge_profile_pilot(uuid, uuid, text) from authenticated;
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.record_knowledge_runtime_decision(text, text, text, uuid, text, text) to service_role;
    grant execute on function public.activate_knowledge_profile_pilot(uuid, uuid, text) to service_role;
  end if;
end
$$;

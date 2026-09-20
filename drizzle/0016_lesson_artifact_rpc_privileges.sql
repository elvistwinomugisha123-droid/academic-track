-- Step 8 follow-up: Supabase may retain explicit EXECUTE grants for exposed roles.
-- Keep lesson-artifact RPCs callable only by authenticated users; both SECURITY
-- DEFINER functions perform auth.uid()-bound authorization internally.

revoke execute on function public.create_lesson_artifact(uuid, text, jsonb, uuid, uuid, uuid, uuid, text, jsonb, text) from anon;
revoke execute on function public.create_lesson_artifact_version(uuid, jsonb, integer, text) from anon;

grant execute on function public.create_lesson_artifact(uuid, text, jsonb, uuid, uuid, uuid, uuid, text, jsonb, text) to authenticated;
grant execute on function public.create_lesson_artifact_version(uuid, jsonb, integer, text) to authenticated;

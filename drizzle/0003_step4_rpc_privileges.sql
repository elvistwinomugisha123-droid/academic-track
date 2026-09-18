-- Step 4 follow-up: Supabase may retain explicit EXECUTE grants for exposed roles.
-- Keep these public RPCs callable only by authenticated users; each mutating
-- SECURITY DEFINER function performs its own auth.uid()-bound authorization.

revoke execute on function public.confirm_teaching_section_assignment(uuid, text, text) from anon;
revoke execute on function public.verify_timetable_version(uuid) from anon;
revoke execute on function public.activate_timetable_version(uuid) from anon;
revoke execute on function public.find_programme_event_overlaps(uuid) from anon;

grant execute on function public.confirm_teaching_section_assignment(uuid, text, text) to authenticated;
grant execute on function public.verify_timetable_version(uuid) to authenticated;
grant execute on function public.activate_timetable_version(uuid) to authenticated;
grant execute on function public.find_programme_event_overlaps(uuid) to authenticated;

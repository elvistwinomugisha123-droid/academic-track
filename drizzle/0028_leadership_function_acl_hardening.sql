-- Step 10 follow-up: explicit role ACL hardening for SECURITY DEFINER RPCs.
-- Supabase projects may carry explicit anon/authenticated default privileges;
-- revoking PUBLIC alone does not remove those role-specific grants.

revoke all on function public.submit_assessment_for_review(uuid, integer) from public, anon, authenticated;
revoke all on function public.review_assessment_workspace(uuid, text, text) from public, anon, authenticated;
revoke all on function public.get_assessment_review_workspace(uuid) from public, anon, authenticated;
revoke all on function public.get_leadership_overview(text) from public, anon, authenticated;

grant execute on function public.submit_assessment_for_review(uuid, integer) to authenticated;
grant execute on function public.review_assessment_workspace(uuid, text, text) to authenticated;
grant execute on function public.get_assessment_review_workspace(uuid) to authenticated;
grant execute on function public.get_leadership_overview(text) to authenticated;

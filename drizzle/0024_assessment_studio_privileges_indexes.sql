-- Step 9 TEST hardening after live Supabase advisor review.
-- Assessment RPCs are authenticated teacher commands; anon must never execute them.

revoke execute on function public.create_assessment_workspace(uuid, uuid, uuid, uuid, text, text, integer, integer, uuid[], jsonb, jsonb, date) from anon;
revoke execute on function public.create_assessment_version(uuid, jsonb, integer, text) from anon;
revoke execute on function public.confirm_assessment_partial_scope(uuid, uuid, text, uuid, text) from anon;
revoke execute on function public.finalize_assessment_workspace(uuid, integer) from anon;
revoke execute on function public.accept_assessment_ai_version(uuid, uuid, integer, text) from anon;

grant execute on function public.create_assessment_workspace(uuid, uuid, uuid, uuid, text, text, integer, integer, uuid[], jsonb, jsonb, date) to authenticated;
grant execute on function public.create_assessment_version(uuid, jsonb, integer, text) to authenticated;
grant execute on function public.confirm_assessment_partial_scope(uuid, uuid, text, uuid, text) to authenticated;
grant execute on function public.finalize_assessment_workspace(uuid, integer) to authenticated;
grant execute on function public.accept_assessment_ai_version(uuid, uuid, integer, text) to authenticated;

-- Cover Step 9 foreign keys used by deletion checks and workspace/evidence joins.
create index if not exists assessment_ai_runs_workspace_fk_idx
  on public.assessment_ai_generation_runs(assessment_workspace_id, school_id);

create index if not exists assessment_scope_workspace_fk_idx
  on public.assessment_scope_items(assessment_workspace_id, school_id);
create index if not exists assessment_scope_canonical_fk_idx
  on public.assessment_scope_items(canonical_id);
create index if not exists assessment_scope_classroom_evidence_fk_idx
  on public.assessment_scope_items(classroom_evidence_id, school_id)
  where classroom_evidence_id is not null;
create index if not exists assessment_scope_confirmer_fk_idx
  on public.assessment_scope_items(confirmed_by_membership_id, school_id)
  where confirmed_by_membership_id is not null;
create index if not exists assessment_scope_position_event_fk_idx
  on public.assessment_scope_items(curriculum_position_event_id, school_id)
  where curriculum_position_event_id is not null;
create index if not exists assessment_scope_section_fk_idx
  on public.assessment_scope_items(section_id, school_id)
  where section_id is not null;

create index if not exists assessment_versions_workspace_fk_idx
  on public.assessment_versions(assessment_workspace_id, school_id);
create index if not exists assessment_versions_creator_fk_idx
  on public.assessment_versions(created_by_membership_id, school_id);

create index if not exists assessment_workspace_sections_workspace_fk_idx
  on public.assessment_workspace_sections(assessment_workspace_id, school_id);
create index if not exists assessment_workspace_sections_section_fk_idx
  on public.assessment_workspace_sections(teaching_section_id, school_id);

create index if not exists assessment_workspaces_period_fk_idx
  on public.assessment_workspaces(academic_period_id, school_id);
create index if not exists assessment_workspaces_profile_fk_idx
  on public.assessment_workspaces(assessment_profile_id);
create index if not exists assessment_workspaces_creator_fk_idx
  on public.assessment_workspaces(created_by_membership_id, school_id);
create index if not exists assessment_workspaces_current_version_fk_idx
  on public.assessment_workspaces(current_version_id, school_id)
  where current_version_id is not null;
create index if not exists assessment_workspaces_subject_profile_fk_idx
  on public.assessment_workspaces(curriculum_subject_profile_id);
create index if not exists assessment_workspaces_school_subject_fk_idx
  on public.assessment_workspaces(school_subject_id, school_id);

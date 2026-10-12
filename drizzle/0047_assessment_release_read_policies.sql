-- Expose only the bound active assessment guidance to authenticated school members.
-- Writes remain privileged migration/release operations. No cross-school listing.
grant select on public.knowledge_assessment_releases, public.knowledge_assessment_profiles to authenticated;

create policy assessment_profile_bound_read on public.knowledge_assessment_profiles
for select to authenticated using (
  status='ACTIVE' and exists (
    select 1 from public.knowledge_assessment_profile_bindings binding
    where binding.assessment_profile_id=knowledge_assessment_profiles.id and binding.status='ACTIVE'
      and binding.effective_from<=current_date and (binding.effective_to is null or binding.effective_to>=current_date)
      and private.is_active_school_member(binding.school_id)
  )
);

create policy assessment_release_bound_read on public.knowledge_assessment_releases
for select to authenticated using (
  status='ACTIVE' and exists (
    select 1 from public.knowledge_assessment_profiles profile
    join public.knowledge_assessment_profile_bindings binding on binding.assessment_profile_id=profile.id
    where profile.assessment_release_id=knowledge_assessment_releases.id and profile.status='ACTIVE' and binding.status='ACTIVE'
      and binding.effective_from<=current_date and (binding.effective_to is null or binding.effective_to>=current_date)
      and private.is_active_school_member(binding.school_id)
  )
);

create index knowledge_assessment_release_subject_idx on public.knowledge_assessment_releases(subject_profile_id,status,effective_from);
create index knowledge_assessment_release_source_idx on public.knowledge_assessment_releases(source_id,source_rights_decision_id);
create index knowledge_assessment_profile_release_idx on public.knowledge_assessment_profiles(assessment_release_id,status);

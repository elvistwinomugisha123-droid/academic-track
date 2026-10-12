-- Align Assessment Studio with checksum-bound controlled-pilot curriculum and rights decisions.
-- This migration grants no assessment profile, source clearance, or effective date.
create or replace function private.resolve_assessment_profile_context(
  target_school_id uuid,
  target_period_id uuid,
  target_assessment_date date,
  target_school_subject_id uuid,
  target_subject_profile_id uuid,
  target_profile_id uuid,
  target_purpose text,
  target_section_ids uuid[]
) returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  period_record record;
  profile_record record;
  subject_profile_record record;
  school_subject_record record;
  subject_binding_record record;
  assessment_date date;
  section_bindings_ok boolean;
  rights_count integer := 0;
  rights_state text := 'UNKNOWN';
  external_ai_allowed boolean := false;
  formal_artifact_allowed boolean := false;
  export_allowed boolean := false;
  production_use_status text := 'PERMISSION_PENDING';
  has_restricted boolean := false;
  all_permitted boolean := false;
  all_cleared boolean := false;
begin
  select period.* into period_record from academic_periods period where period.id = target_period_id and period.school_id = target_school_id;
  if not found then return jsonb_build_object('applicable', false, 'reason', 'The academic period is not part of the authenticated school.'); end if;
  if target_assessment_date is null or target_assessment_date < period_record.starts_on or target_assessment_date > period_record.ends_on then
    return jsonb_build_object('applicable', false, 'reason', 'The assessment date must fall inside the selected academic period.');
  end if;
  assessment_date := target_assessment_date;

  select ap.id, ap.display_title, ap.purpose, ap.regime, ap.release_id, ap.subject_profile_id,
         ap.status, ap.allows_broader_scope, ap.allows_partial_scope, ap.requires_review,
         ap.applicable_source_roles,
         release.version_label, release.authority, release.status as release_status,
         release.effective_from, release.effective_to
    into profile_record
    from knowledge_assessment_profiles ap
    join knowledge_curriculum_releases release on release.id = ap.release_id
   where ap.id = target_profile_id
     and ap.purpose = target_purpose
     and (ap.subject_profile_id is null or ap.subject_profile_id = target_subject_profile_id);
  if not found then return jsonb_build_object('applicable', false, 'reason', 'The assessment profile is not applicable to the requested purpose or subject profile.'); end if;

  select subject_profile.* into subject_profile_record from knowledge_subject_profiles subject_profile where subject_profile.id = target_subject_profile_id;
  if not found then return jsonb_build_object('applicable', false, 'reason', 'The governed subject profile could not be resolved.'); end if;
  select school_subject.* into school_subject_record from school_subjects school_subject where school_subject.id = target_school_subject_id and school_subject.school_id = target_school_id;
  if not found or school_subject_record.curriculum_subject_id is distinct from subject_profile_record.governed_subject_id or subject_profile_record.release_id is distinct from profile_record.release_id then
    return jsonb_build_object('applicable', false, 'reason', 'The school subject, governed subject profile, and assessment release do not match.');
  end if;

  select binding.* into subject_binding_record
    from school_subject_curriculum_bindings binding
   where binding.school_id = target_school_id and binding.school_subject_id = target_school_subject_id and binding.subject_profile_id = target_subject_profile_id and binding.status = 'ACTIVE'
     and binding.effective_from <= assessment_date and (binding.effective_to is null or binding.effective_to >= assessment_date)
   order by binding.effective_from desc limit 1;

  select not exists (
    select 1 from unnest(coalesce(target_section_ids, array[]::uuid[])) requested(section_id)
    where not exists (
      select 1 from teaching_section_curriculum_bindings binding
      where binding.school_id = target_school_id and binding.teaching_section_id = requested.section_id and binding.subject_profile_id = target_subject_profile_id and binding.status = 'ACTIVE'
        and binding.effective_from <= assessment_date and (binding.effective_to is null or binding.effective_to >= assessment_date)
    )
  ) into section_bindings_ok;

  select count(*)::integer,
         coalesce(bool_and(source_rights.rights_status in ('CLEARED','OPERATOR_AUTHORIZED_FOR_PILOT') and source_rights.production_use_status = 'PERMITTED'), false),
         coalesce(bool_and(source_rights.rights_status = 'CLEARED' and source_rights.production_use_status = 'PERMITTED'), false),
         coalesce(bool_or(source_rights.rights_status = 'RESTRICTED' or source_rights.production_use_status = 'BLOCKED'), false),
         coalesce(bool_and(source_rights.external_ai_allowed), false),
         coalesce(bool_and(source_rights.formal_artifact_allowed), false),
         coalesce(bool_and(source_rights.export_allowed), false)
    into rights_count, all_permitted, all_cleared, has_restricted, external_ai_allowed, formal_artifact_allowed, export_allowed
    from (
      select
        case when decision.decision_id is null or (decision.review_expires_at is not null and decision.review_expires_at < assessment_date) then 'REVIEW_REQUIRED' else coalesce(decision.rights_status, source.rights_status) end as rights_status,
        case when decision.decision_id is null or (decision.review_expires_at is not null and decision.review_expires_at < assessment_date) then 'PERMISSION_PENDING' else coalesce(decision.production_use_status, source.production_use_status) end as production_use_status,
        case when decision.decision_id is null or (decision.review_expires_at is not null and decision.review_expires_at < assessment_date) then false else coalesce(decision.external_ai_allowed, source.external_ai_allowed) end as external_ai_allowed,
        case when decision.decision_id is null or (decision.review_expires_at is not null and decision.review_expires_at < assessment_date) then false else coalesce(decision.formal_artifact_allowed, source.formal_artifact_allowed) end as formal_artifact_allowed,
        case when decision.decision_id is null or (decision.review_expires_at is not null and decision.review_expires_at < assessment_date) then false else coalesce(decision.export_allowed, source.export_allowed) end as export_allowed
      from knowledge_release_sources release_source
      join knowledge_sources source on source.source_id = release_source.source_id
      left join lateral (
        select rights_decision.* from knowledge_rights_decisions rights_decision
        where rights_decision.source_id = source.source_id and rights_decision.source_checksum_sha256 = source.checksum_sha256
        order by rights_decision.decided_at desc, rights_decision.decision_id desc limit 1
      ) decision on true
      where release_source.release_id = profile_record.release_id and release_source.status = 'APPROVED' and release_source.source_role = any(profile_record.applicable_source_roles)
        and (release_source.subject_profile_id is null or release_source.subject_profile_id = target_subject_profile_id)
    ) source_rights;
  if rights_count = 0 then rights_state := 'UNKNOWN'; production_use_status := 'PERMISSION_PENDING';
  elsif has_restricted then rights_state := 'RESTRICTED'; production_use_status := 'BLOCKED';
  elsif all_permitted then rights_state := case when all_cleared then 'CLEARED' else 'OPERATOR_AUTHORIZED_FOR_PILOT' end; production_use_status := 'PERMITTED';
  else rights_state := 'REVIEW_REQUIRED'; production_use_status := 'PERMISSION_PENDING'; end if;

  if profile_record.status <> 'ACTIVE' then return jsonb_build_object('applicable', false, 'reason', 'The assessment profile is not ACTIVE.'); end if;
  if profile_record.release_status <> 'ACTIVE' or profile_record.effective_from is null or profile_record.effective_from > assessment_date or (profile_record.effective_to is not null and profile_record.effective_to < assessment_date) then return jsonb_build_object('applicable', false, 'reason', 'The assessment release has no approved effective start date or is not active for this academic period.'); end if;
  if subject_profile_record.status <> 'ACTIVE' or subject_profile_record.runtime_status <> 'PILOT_ACTIVE' then return jsonb_build_object('applicable', false, 'reason', 'The governed subject profile is not active for this controlled runtime environment.'); end if;
  if subject_binding_record.id is null or not section_bindings_ok then return jsonb_build_object('applicable', false, 'reason', 'The school-subject or Teaching Section curriculum binding is not active and date-applicable.'); end if;

  return jsonb_build_object('applicable', true, 'assessmentDate', assessment_date, 'profileId', profile_record.id, 'profileTitle', profile_record.display_title, 'purpose', profile_record.purpose, 'regime', profile_record.regime, 'releaseId', profile_record.release_id, 'releaseVersion', profile_record.version_label, 'releaseAuthority', profile_record.authority, 'releaseStatus', profile_record.release_status, 'releaseEffectiveFrom', profile_record.effective_from, 'releaseEffectiveTo', profile_record.effective_to, 'subjectProfileId', target_subject_profile_id, 'subjectProfileStatus', subject_profile_record.status, 'subjectProfileRuntimeStatus', subject_profile_record.runtime_status, 'rightsState', rights_state, 'productionUseStatus', production_use_status, 'externalAiAllowed', external_ai_allowed and all_permitted, 'formalArtifactAllowed', formal_artifact_allowed and all_permitted, 'exportAllowed', export_allowed and all_permitted, 'allowsBroaderScope', profile_record.allows_broader_scope, 'allowsPartialScope', profile_record.allows_partial_scope, 'requiresReview', profile_record.requires_review, 'sourceCount', rights_count);
end;
$$;


create or replace function private.assessment_canonical_is_governed(target_subject_profile_id uuid, target_canonical_id text, target_on date)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.knowledge_profile_records pr
    join public.knowledge_subject_profiles subject_profile on subject_profile.id=pr.subject_profile_id
    join public.knowledge_curriculum_releases release on release.id=subject_profile.release_id
    join public.knowledge_records record on record.canonical_id=pr.canonical_id
    join public.knowledge_source_spans span on span.span_id=record.span_id and span.source_id=record.source_id
    join public.knowledge_sources source on source.source_id=record.source_id
    join public.knowledge_release_sources rs on rs.release_id=pr.release_id and rs.source_id=record.source_id
      and rs.status='APPROVED' and (rs.subject_profile_id is null or rs.subject_profile_id=pr.subject_profile_id)
    join lateral (
      select decision.* from public.knowledge_rights_decisions decision
      where decision.source_id=source.source_id and decision.source_checksum_sha256=source.checksum_sha256
      order by decision.decided_at desc, decision.decision_id desc limit 1
    ) rights on true
    where pr.subject_profile_id=target_subject_profile_id and pr.canonical_id=target_canonical_id
      and pr.status='APPROVED' and pr.runtime_status='PILOT_ACTIVE'
      and (pr.effective_from is null or pr.effective_from<=target_on)
      and (pr.effective_to is null or pr.effective_to>=target_on)
      and subject_profile.status='ACTIVE' and subject_profile.runtime_status='PILOT_ACTIVE'
      and release.status='ACTIVE' and release.effective_from is not null and release.effective_from<=target_on
      and (release.effective_to is null or release.effective_to>=target_on)
      and rights.rights_status in ('CLEARED','OPERATOR_AUTHORIZED_FOR_PILOT')
      and rights.production_use_status='PERMITTED' and rights.formal_artifact_allowed
      and (rights.review_expires_at is null or rights.review_expires_at>=target_on)
      and (
        (record.verification_status='VERIFIED' and span.verification_status='VERIFIED'
          and exists (select 1 from public.knowledge_verification_decisions d
            where d.entity_type='RECORD' and d.entity_id=record.canonical_id and d.resulting_status='VERIFIED')
          and exists (select 1 from public.knowledge_verification_decisions d
            where d.entity_type='SPAN' and d.entity_id=span.span_id and d.resulting_status='VERIFIED'))
        or exists (
          select 1 from public.knowledge_pilot_curriculum_record_memberships membership
          join public.knowledge_pilot_curriculum_decisions pilot on pilot.decision_id=membership.decision_id
            and pilot.release_id=membership.release_id and pilot.manifest_checksum_sha256=release.manifest_checksum_sha256
          join public.knowledge_record_identity_mappings identity_map
            on identity_map.canonical_id=membership.canonical_id and identity_map.source_id=membership.source_id
            and identity_map.source_checksum_sha256=membership.source_checksum_sha256
            and identity_map.candidate_id=membership.candidate_id and identity_map.candidate_content_sha256=membership.candidate_content_sha256
          where membership.release_id=pr.release_id and membership.subject_profile_id=pr.subject_profile_id
            and membership.canonical_id=record.canonical_id and membership.source_id=record.source_id
            and membership.source_checksum_sha256=source.checksum_sha256
        )
      )
  )
$$;

revoke all on function private.resolve_assessment_profile_context(uuid,uuid,date,uuid,uuid,uuid,text,uuid[]) from public;
revoke all on function private.assessment_canonical_is_governed(uuid,text,date) from public;

-- Academic reviewers still require a current scoped rights decision.
create or replace function public.review_assessment_workspace(p_workspace_id uuid, p_decision text, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  workspace record;
  actor record;
  subject_department_id uuid;
  submitted_version uuid;
  section_ids uuid[];
  profile_context jsonb;
  reviewed_at timestamptz := now();
  clean_reason text := nullif(trim(p_reason), '');
begin
  select m.id, m.school_id, m.user_id into actor
    from public.memberships m
   where m.user_id = auth.uid() and m.status = 'ACTIVE'
   limit 1;
  select w.* into workspace
    from public.assessment_workspaces w
   where w.id = p_workspace_id and w.school_id = actor.school_id
   for update;
  if not found or workspace.status <> 'IN_REVIEW' then raise exception 'only an assessment under review can be reviewed'; end if;
  select subject.department_id into subject_department_id
    from public.school_subjects subject
   where subject.id = workspace.school_subject_id and subject.school_id = actor.school_id;
  if not (private.has_school_role(actor.school_id, 'DOS') or private.has_department_role(actor.school_id, subject_department_id, 'HOD')) then
    raise exception 'the active reviewer is not authorised for this assessment subject';
  end if;
  if p_decision not in ('APPROVE', 'RETURN') then raise exception 'review decision must be APPROVE or RETURN'; end if;
  if p_decision = 'RETURN' and clean_reason is null then raise exception 'a return reason is required'; end if;
  submitted_version := coalesce(workspace.submitted_version_id, workspace.current_version_id);
  if not exists (
    select 1 from public.assessment_versions version
     where version.id = submitted_version
       and version.assessment_workspace_id = p_workspace_id
       and version.school_id = actor.school_id
  ) then raise exception 'the submitted assessment version was not found'; end if;

  if p_decision = 'APPROVE' then
    if workspace.current_version_id is distinct from submitted_version then
      raise exception 'the submitted assessment version is no longer current; return it for teacher revision';
    end if;
    select array_agg(section.teaching_section_id order by section.teaching_section_id)
      into section_ids
      from public.assessment_workspace_sections section
     where section.assessment_workspace_id = p_workspace_id
       and section.school_id = actor.school_id;
    profile_context := private.resolve_assessment_profile_context(
      actor.school_id, workspace.academic_period_id, workspace.assessment_date,
      workspace.school_subject_id, workspace.curriculum_subject_profile_id,
      workspace.assessment_profile_id, workspace.purpose, section_ids
    );
    if coalesce((profile_context->>'applicable')::boolean, false) is not true then
      raise exception 'approval blocked: the governed assessment profile is no longer applicable; return the assessment for revision';
    end if;
    if coalesce(profile_context->>'rightsState', 'UNKNOWN') not in ('CLEARED','OPERATOR_AUTHORIZED_FOR_PILOT')
       or coalesce(profile_context->>'productionUseStatus', 'PERMISSION_PENDING') <> 'PERMITTED'
       or coalesce((profile_context->>'formalArtifactAllowed')::boolean, false) is not true
       or coalesce((profile_context->>'exportAllowed')::boolean, false) is not true then
      raise exception 'approval blocked: current curriculum rights or institutional rules no longer permit this assessment to become final';
    end if;
    perform private.validate_assessment_ready(p_workspace_id, submitted_version, null);
  end if;

  perform set_config('ate.assessment_review_transition', 'true', true);
  if p_decision = 'APPROVE' then
    perform set_config('ate.assessment_finalisation', 'true', true);
    update public.assessment_workspaces
       set status = 'FINAL', finalised_by_membership_id = actor.id, finalised_at = reviewed_at,
           scope_snapshot = (select jsonb_agg(to_jsonb(item)) from public.assessment_scope_items item where item.assessment_workspace_id = p_workspace_id),
           updated_at = reviewed_at
     where id = p_workspace_id;
    insert into public.assessment_review_events(school_id, assessment_workspace_id, assessment_version_id, event_type, actor_membership_id, reason, created_at)
      values(actor.school_id, p_workspace_id, submitted_version, 'APPROVED', actor.id, clean_reason, reviewed_at);
  else
    update public.assessment_workspaces set status = 'DRAFT', updated_at = reviewed_at where id = p_workspace_id;
    insert into public.assessment_review_events(school_id, assessment_workspace_id, assessment_version_id, event_type, actor_membership_id, reason, created_at)
      values(actor.school_id, p_workspace_id, submitted_version, 'RETURNED', actor.id, clean_reason, reviewed_at);
  end if;
  insert into public.audit_events(school_id, actor_user_id, action, resource_type, resource_id, metadata, after_state)
    values(actor.school_id, actor.user_id,
      case when p_decision = 'APPROVE' then 'APPROVE_ASSESSMENT_REVIEW' else 'RETURN_ASSESSMENT_REVIEW' end,
      'ASSESSMENT_WORKSPACE', p_workspace_id,
      jsonb_build_object('version_id', submitted_version, 'decision', p_decision, 'reason', clean_reason),
      jsonb_build_object('status', case when p_decision = 'APPROVE' then 'FINAL' else 'DRAFT' end, 'reviewed_at', reviewed_at));
  return jsonb_build_object('workspaceId', p_workspace_id, 'decision', p_decision, 'status', case when p_decision = 'APPROVE' then 'FINAL' else 'DRAFT' end, 'reviewedAt', reviewed_at);
end;
$$;


revoke all on function public.review_assessment_workspace(uuid,text,text) from public, anon, authenticated;
grant execute on function public.review_assessment_workspace(uuid,text,text) to authenticated;

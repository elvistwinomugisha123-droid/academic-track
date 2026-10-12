-- Bankai operational assessment release, independent of the NCDC syllabus release.
-- The date below is Bankai's controlled-pilot start (12 October 2026), not an
-- NCDC publication or syllabus-effective date. Only S3 Chemistry in the DEMO
-- school is bound. The 89 imported assessment candidates remain untouched.

create table public.knowledge_assessment_releases (
  id uuid primary key,
  release_key text not null unique,
  subject_profile_id uuid not null references public.knowledge_subject_profiles(id),
  source_id text not null references public.knowledge_sources(source_id),
  source_checksum_sha256 text not null check (source_checksum_sha256 ~* '^[0-9a-f]{64}$'),
  source_rights_decision_id uuid not null references public.knowledge_rights_decisions(decision_id),
  authority text not null,
  display_name text not null,
  version_label text not null,
  effective_from date not null,
  effective_to date,
  status text not null default 'DRAFT' check (status in ('DRAFT','REVIEW','ACTIVE','SUPERSEDED','RETIRED')),
  decision_reference text not null,
  created_at timestamptz not null default now(),
  activated_at timestamptz,
  unique (id, subject_profile_id),
  check (effective_to is null or effective_to >= effective_from)
);

alter table public.knowledge_assessment_profiles
  add column assessment_release_id uuid;
alter table public.knowledge_assessment_profiles
  add constraint knowledge_assessment_profiles_assessment_release_fk
  foreign key (assessment_release_id, subject_profile_id)
  references public.knowledge_assessment_releases(id, subject_profile_id);

create table public.knowledge_assessment_profile_bindings (
  id uuid primary key,
  school_id uuid not null references public.schools(id),
  teaching_section_id uuid not null,
  assessment_profile_id uuid not null references public.knowledge_assessment_profiles(id),
  status text not null check (status in ('ACTIVE','RETIRED')),
  effective_from date not null,
  effective_to date,
  created_at timestamptz not null default now(),
  unique (assessment_profile_id, teaching_section_id),
  foreign key (teaching_section_id, school_id) references public.teaching_sections(id, school_id),
  check (effective_to is null or effective_to >= effective_from)
);

create index knowledge_assessment_bindings_lookup_idx on public.knowledge_assessment_profile_bindings
  (school_id, teaching_section_id, assessment_profile_id, status, effective_from);

alter table public.knowledge_assessment_releases enable row level security;
alter table public.knowledge_assessment_profile_bindings enable row level security;
revoke all on public.knowledge_assessment_releases, public.knowledge_assessment_profile_bindings from public, anon, authenticated;
grant select on public.knowledge_assessment_profile_bindings to authenticated;
create policy assessment_profile_binding_school_read on public.knowledge_assessment_profile_bindings
  for select to authenticated using (private.is_active_school_member(school_id));

-- Existing active syllabus membership remains immutable. A profile associated
-- with its own assessment release is instead governed by that release.
drop trigger knowledge_assessment_profiles_active_guard on public.knowledge_assessment_profiles;
create or replace function private.guard_independent_assessment_profile()
returns trigger language plpgsql set search_path = public, pg_temp as $$
declare old_release_status text; new_release_status text;
begin
  if tg_op = 'DELETE' then
    raise exception 'assessment profiles are immutable; retire the assessment release';
  end if;
  if new.assessment_release_id is null then
    if exists (select 1 from public.knowledge_curriculum_releases r where r.id=new.release_id and r.status='ACTIVE') then raise exception 'active legacy assessment membership is immutable'; end if;
    return new;
  end if;
  select status into new_release_status from public.knowledge_assessment_releases where id = new.assessment_release_id and subject_profile_id = new.subject_profile_id;
  if new_release_status is null then raise exception 'assessment release and curriculum subject profile do not match'; end if;
  if tg_op = 'INSERT' then
    if new_release_status <> 'DRAFT' or new.status <> 'DRAFT' then raise exception 'create assessment profiles in a draft assessment release'; end if;
    return new;
  end if;
  select status into old_release_status from public.knowledge_assessment_releases where id = old.assessment_release_id;
  if old.status = 'DRAFT' and new.status = 'ACTIVE' and old_release_status = 'REVIEW' and current_setting('ate.knowledge_governance_command', true) = 'ACTIVATE_RELEASE'
     and (to_jsonb(new) - 'status' - 'updated_at') = (to_jsonb(old) - 'status' - 'updated_at') then return new; end if;
  if old_release_status in ('ACTIVE','SUPERSEDED') or new_release_status in ('ACTIVE','SUPERSEDED') then
    raise exception 'active assessment profile meaning is immutable; create a new assessment release';
  end if;
  if old.assessment_release_id is distinct from new.assessment_release_id or old.subject_profile_id is distinct from new.subject_profile_id or old.release_id is distinct from new.release_id then
    raise exception 'assessment profile release and subject identity are immutable';
  end if;
  return new;
end;
$$;
create trigger knowledge_assessment_profiles_active_guard
before insert or update or delete on public.knowledge_assessment_profiles
for each row execute function private.guard_independent_assessment_profile();

create or replace function private.guard_assessment_release_lifecycle()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if tg_op = 'INSERT' then
    if new.status <> 'DRAFT' then raise exception 'assessment releases begin as DRAFT'; end if;
    return new;
  end if;
  if old.status = 'DRAFT' and new.status = 'REVIEW' and (to_jsonb(new) - 'status') = (to_jsonb(old) - 'status') then return new; end if;
  if old.status = 'REVIEW' and new.status = 'ACTIVE' and current_setting('ate.knowledge_governance_command', true) = 'ACTIVATE_RELEASE'
    and (to_jsonb(new) - 'status' - 'activated_at') = (to_jsonb(old) - 'status' - 'activated_at') then return new; end if;
  raise exception 'assessment release is immutable after review; publish a new release';
end;
$$;
create trigger knowledge_assessment_release_lifecycle_guard
before insert or update on public.knowledge_assessment_releases
for each row execute function private.guard_assessment_release_lifecycle();

-- The assessment release is a Bankai rule and does not republish the syllabus.
do $$
declare
  pilot_subject_profile_id uuid;
  curriculum_release_id uuid;
  pilot_school_id uuid;
  pilot_source_decision_id uuid;
  new_assessment_release_id uuid;
  new_assessment_profile_id uuid;
  matching_sections integer;
begin
  select p.id,p.release_id into strict pilot_subject_profile_id,curriculum_release_id
    from public.knowledge_subject_profiles p
   where p.profile_key='ncdc-lower-secondary-chemistry-2019-176ad60b42'
     and p.status='ACTIVE' and p.runtime_status='PILOT_ACTIVE';
  select s.id into strict pilot_school_id from public.schools s where s.slug='mount-of-olives-kakiri-demo';
  select d.decision_id into strict pilot_source_decision_id
    from public.knowledge_rights_decisions d
    join public.knowledge_sources s on s.source_id=d.source_id and s.checksum_sha256=d.source_checksum_sha256
    join public.knowledge_release_sources rs on rs.source_id=s.source_id and rs.release_id=curriculum_release_id
      and rs.subject_profile_id=pilot_subject_profile_id and rs.status='APPROVED' and rs.source_role='SUBJECT_SYLLABUS'
   where s.source_id='ncdc-lower-secondary-chemistry-2019-176ad60b42'
     and s.checksum_sha256='176ad60b4227e83068a7f3fcb51832c609fee1b067778bdc333a039a051a73bd'
     and d.rights_status='OPERATOR_AUTHORIZED_FOR_PILOT' and d.production_use_status='PERMITTED'
     and d.external_ai_allowed and d.formal_artifact_allowed and d.export_allowed
     and (d.review_expires_at is null or d.review_expires_at>=date '2026-10-12')
     and (select latest.decision_id from public.knowledge_rights_decisions latest
       where latest.source_id=s.source_id and latest.source_checksum_sha256=s.checksum_sha256
       order by latest.decided_at desc,latest.decision_id desc limit 1)=d.decision_id;
  select count(*) into matching_sections
    from public.teaching_sections ts
    join public.school_subjects sub on sub.id=ts.school_subject_id and sub.school_id=pilot_school_id and sub.code='LOWER_CHEMISTRY'
    join public.class_levels cl on cl.id=ts.class_level_id and cl.school_id=pilot_school_id and cl.name='S3'
    join public.streams st on st.id=ts.stream_id and st.school_id=pilot_school_id and st.name in ('East','West')
    join public.academic_periods period on period.id=ts.academic_period_id and period.school_id=pilot_school_id and period.academic_year=2026
      and period.starts_on<=date '2026-10-12' and period.ends_on>=date '2026-10-12'
    join public.memberships teacher on teacher.id=ts.teacher_membership_id and teacher.school_id=pilot_school_id and teacher.display_name='ATE Demo Teacher'
   where ts.school_id=pilot_school_id and ts.assignment_state='CONFIRMED' and ts.operational_status='ACTIVE';
  if matching_sections<>2 or pilot_source_decision_id is null then
    raise exception 'exact Chemistry syllabus rights or the two named S3 demo Teaching Sections changed';
  end if;
  insert into public.knowledge_assessment_releases
    (id,release_key,subject_profile_id,source_id,source_checksum_sha256,source_rights_decision_id,
     authority,display_name,version_label,effective_from,status,decision_reference)
    values
    (gen_random_uuid(),'BANKAI-LSC-S3-CHEM-CLASS-TEST-2026-10-12',pilot_subject_profile_id,
     'ncdc-lower-secondary-chemistry-2019-176ad60b42',
     '176ad60b4227e83068a7f3fcb51832c609fee1b067778bdc333a039a051a73bd',pilot_source_decision_id,
     'Bankai controlled pilot','S3 Chemistry internal class test','Bankai 2026.10.12',date '2026-10-12','DRAFT',
     'Founder operational authorization in ATE implementation request, 12 October 2026. Teacher controls blueprint; NCDC 2019 Chemistry syllabus supplies subject scope, not Bankai item-distribution rules.')
    returning id into new_assessment_release_id;
  insert into public.knowledge_assessment_profiles
    (id,release_id,subject_profile_id,assessment_release_id,assessment_key,display_title,purpose,regime,
     composition_mode,applicable_source_roles,status,allows_broader_scope,allows_partial_scope,requires_review)
    values
    (gen_random_uuid(),curriculum_release_id,pilot_subject_profile_id,new_assessment_release_id,
     'bankai-s3-chem-internal-class-test-2026-10-12','S3 Chemistry · Internal class test','CLASS_TEST',
     'BANKAI_LOWER_SECONDARY_INTERNAL_CLASS_TEST','SOURCE_PRECEDENCE',array['SUBJECT_SYLLABUS']::text[],
     'DRAFT',false,false,false)
    returning id into new_assessment_profile_id;
  insert into public.knowledge_assessment_profile_bindings
    (id,school_id,teaching_section_id,assessment_profile_id,status,effective_from)
    select gen_random_uuid(),pilot_school_id,ts.id,new_assessment_profile_id,'ACTIVE',date '2026-10-12'
      from public.teaching_sections ts
      join public.school_subjects sub on sub.id=ts.school_subject_id and sub.school_id=pilot_school_id and sub.code='LOWER_CHEMISTRY'
      join public.class_levels cl on cl.id=ts.class_level_id and cl.school_id=pilot_school_id and cl.name='S3'
      join public.streams st on st.id=ts.stream_id and st.school_id=pilot_school_id and st.name in ('East','West')
      join public.memberships teacher on teacher.id=ts.teacher_membership_id and teacher.school_id=pilot_school_id and teacher.display_name='ATE Demo Teacher'
     where ts.school_id=pilot_school_id and ts.assignment_state='CONFIRMED' and ts.operational_status='ACTIVE';
  update public.knowledge_assessment_releases set status='REVIEW' where id=new_assessment_release_id;
  perform set_config('ate.knowledge_governance_command','ACTIVATE_RELEASE',true);
  update public.knowledge_assessment_profiles set status='ACTIVE' where id=new_assessment_profile_id;
  update public.knowledge_assessment_releases set status='ACTIVE',activated_at=now() where id=new_assessment_release_id;
end $$;

-- Resolver: assessment release dates are independent of syllabus release dates.
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
  assessment_bindings_ok boolean;
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

  select ap.id, ap.display_title, ap.purpose, ap.regime, ap.assessment_release_id as release_id, ap.subject_profile_id,
         ap.release_id as curriculum_release_id, release.subject_profile_id as release_subject_profile_id, release.source_id as assessment_source_id, release.source_checksum_sha256 as assessment_source_checksum,
         ap.status, ap.allows_broader_scope, ap.allows_partial_scope, ap.requires_review,
         ap.applicable_source_roles,
         release.version_label, release.authority, release.status as release_status,
         release.effective_from, release.effective_to
    into profile_record
    from knowledge_assessment_profiles ap
    join knowledge_assessment_releases release on release.id = ap.assessment_release_id
   where ap.id = target_profile_id
     and ap.purpose = target_purpose
     and (ap.subject_profile_id is null or ap.subject_profile_id = target_subject_profile_id);
  if not found then return jsonb_build_object('applicable', false, 'reason', 'The assessment profile is not applicable to the requested purpose or subject profile.'); end if;

  select subject_profile.* into subject_profile_record from knowledge_subject_profiles subject_profile where subject_profile.id = target_subject_profile_id;
  if not found then return jsonb_build_object('applicable', false, 'reason', 'The governed subject profile could not be resolved.'); end if;
  select school_subject.* into school_subject_record from school_subjects school_subject where school_subject.id = target_school_subject_id and school_subject.school_id = target_school_id;
  if not found or school_subject_record.curriculum_subject_id is distinct from subject_profile_record.governed_subject_id or subject_profile_record.release_id is distinct from profile_record.curriculum_release_id or profile_record.release_subject_profile_id is distinct from target_subject_profile_id then
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

  select not exists (
    select 1 from unnest(coalesce(target_section_ids, array[]::uuid[])) requested(section_id)
    where not exists (
      select 1 from knowledge_assessment_profile_bindings binding
      where binding.school_id = target_school_id and binding.teaching_section_id = requested.section_id
        and binding.assessment_profile_id = target_profile_id and binding.status = 'ACTIVE'
        and binding.effective_from <= assessment_date and (binding.effective_to is null or binding.effective_to >= assessment_date)
    )
  ) into assessment_bindings_ok;

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
      where release_source.release_id = profile_record.curriculum_release_id and release_source.status = 'APPROVED' and release_source.source_role = any(profile_record.applicable_source_roles)
        and (release_source.subject_profile_id is null or release_source.subject_profile_id = target_subject_profile_id)
        and source.source_id = profile_record.assessment_source_id and source.checksum_sha256 = profile_record.assessment_source_checksum
    ) source_rights;
  if rights_count = 0 then rights_state := 'UNKNOWN'; production_use_status := 'PERMISSION_PENDING';
  elsif has_restricted then rights_state := 'RESTRICTED'; production_use_status := 'BLOCKED';
  elsif all_permitted then rights_state := case when all_cleared then 'CLEARED' else 'OPERATOR_AUTHORIZED_FOR_PILOT' end; production_use_status := 'PERMITTED';
  else rights_state := 'REVIEW_REQUIRED'; production_use_status := 'PERMISSION_PENDING'; end if;

  if profile_record.status <> 'ACTIVE' then return jsonb_build_object('applicable', false, 'reason', 'The assessment profile is not ACTIVE.'); end if;
  if profile_record.release_status <> 'ACTIVE' or profile_record.effective_from is null or profile_record.effective_from > assessment_date or (profile_record.effective_to is not null and profile_record.effective_to < assessment_date) then return jsonb_build_object('applicable', false, 'reason', 'The assessment release has no approved effective start date or is not active for this academic period.'); end if;
  if subject_profile_record.status <> 'ACTIVE' or subject_profile_record.runtime_status <> 'PILOT_ACTIVE' then return jsonb_build_object('applicable', false, 'reason', 'The governed subject profile is not active for this controlled runtime environment.'); end if;
  if not assessment_bindings_ok then return jsonb_build_object('applicable', false, 'reason', 'This assessment profile is not bound to every selected Teaching Section for the assessment date.'); end if;
  if subject_binding_record.id is null or not section_bindings_ok then return jsonb_build_object('applicable', false, 'reason', 'The school-subject or Teaching Section curriculum binding is not active and date-applicable.'); end if;

  return jsonb_build_object('applicable', true, 'assessmentDate', assessment_date, 'profileId', profile_record.id, 'profileTitle', profile_record.display_title, 'purpose', profile_record.purpose, 'regime', profile_record.regime, 'releaseId', profile_record.release_id, 'releaseVersion', profile_record.version_label, 'releaseAuthority', profile_record.authority, 'curriculumReleaseId', profile_record.curriculum_release_id, 'releaseStatus', profile_record.release_status, 'releaseEffectiveFrom', profile_record.effective_from, 'releaseEffectiveTo', profile_record.effective_to, 'subjectProfileId', target_subject_profile_id, 'subjectProfileStatus', subject_profile_record.status, 'subjectProfileRuntimeStatus', subject_profile_record.runtime_status, 'rightsState', rights_state, 'productionUseStatus', production_use_status, 'externalAiAllowed', external_ai_allowed and all_permitted, 'formalArtifactAllowed', formal_artifact_allowed and all_permitted, 'exportAllowed', export_allowed and all_permitted, 'allowsBroaderScope', profile_record.allows_broader_scope, 'allowsPartialScope', profile_record.allows_partial_scope, 'requiresReview', profile_record.requires_review, 'sourceCount', rights_count);
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
      and release.status='ACTIVE' and release.activated_at is not null
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


revoke all on function private.resolve_assessment_profile_context(uuid,uuid,date,uuid,uuid,uuid,text,uuid[]) from public, anon, authenticated;
revoke all on function private.assessment_canonical_is_governed(uuid,text,date) from public, anon, authenticated;

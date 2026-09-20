-- Step 8: one school-scoped, immutable artifact system for lesson plans and
-- selectively-created Teaching Pack children. Versions are appended through
-- security-definer RPCs so the current pointer and version number change in
-- one database transaction.

create table public.lesson_artifacts (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id),
  scheduled_lesson_id uuid not null,
  teaching_section_id uuid not null,
  artifact_type text not null check (artifact_type in ('FORMAL_LESSON_PLAN', 'BOARD_NOTES', 'LEARNER_NOTES', 'LESSON_SUMMARY', 'ACTIVITY_SHEET', 'HOMEWORK')),
  status text not null default 'DRAFT' check (status in ('DRAFT', 'ACTIVE', 'ARCHIVED')),
  parent_artifact_id uuid,
  parent_version_id uuid,
  current_version_id uuid,
  curriculum_profile_id uuid,
  curriculum_position_event_id uuid,
  curriculum_canonical_id text,
  rights_state text not null default 'UNKNOWN' check (rights_state in ('CLEARED', 'REVIEW_REQUIRED', 'RESTRICTED', 'UNKNOWN')),
  provenance jsonb not null default '[]'::jsonb check (jsonb_typeof(provenance) = 'array'),
  created_by_membership_id uuid not null references public.memberships(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, school_id),
  foreign key (scheduled_lesson_id, school_id) references public.scheduled_lessons(id, school_id),
  foreign key (teaching_section_id, school_id) references public.teaching_sections(id, school_id),
  foreign key (parent_artifact_id, school_id) references public.lesson_artifacts(id, school_id),
  foreign key (curriculum_profile_id) references public.knowledge_subject_profiles(id),
  foreign key (curriculum_position_event_id, school_id) references public.teaching_section_curriculum_position_events(id, school_id)
);

create table public.lesson_artifact_versions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id),
  artifact_id uuid not null,
  version_number integer not null check (version_number > 0),
  content_json jsonb not null,
  rendered_text text,
  change_source text not null check (change_source in ('TEACHER', 'SYSTEM', 'AI')),
  change_summary text,
  created_by_membership_id uuid not null references public.memberships(id),
  created_at timestamptz not null default now(),
  unique (id, school_id),
  unique (artifact_id, version_number),
  foreign key (artifact_id, school_id) references public.lesson_artifacts(id, school_id)
);

alter table public.lesson_artifacts
  add constraint lesson_artifacts_current_version_fk
  foreign key (current_version_id) references public.lesson_artifact_versions(id);

create index lesson_artifacts_lesson_idx on public.lesson_artifacts (school_id, scheduled_lesson_id, artifact_type);
create index lesson_artifacts_section_idx on public.lesson_artifacts (school_id, teaching_section_id, updated_at desc);
create index lesson_artifact_versions_artifact_idx on public.lesson_artifact_versions (school_id, artifact_id, version_number desc);
create unique index lesson_artifacts_identity_idx on public.lesson_artifacts (school_id, scheduled_lesson_id, artifact_type, coalesce(parent_artifact_id, '00000000-0000-0000-0000-000000000000'::uuid));

create or replace function private.can_read_lesson_artifact(target_school_id uuid, target_section_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_active_school_member(target_school_id) and exists (
    select 1
    from public.teaching_sections section
    join public.school_subjects subject on subject.id = section.school_subject_id and subject.school_id = section.school_id
    where section.id = target_section_id and section.school_id = target_school_id
      and (
        private.is_membership_owner(target_school_id, section.teacher_membership_id)
        or private.has_school_role(target_school_id, 'DOS')
        or private.has_school_role(target_school_id, 'SCHOOL_ADMIN')
        or private.has_school_role(target_school_id, 'PRINCIPAL')
        or private.has_department_role(target_school_id, subject.department_id, 'HOD')
      )
  )
$$;

create or replace function private.can_manage_lesson_artifact(target_school_id uuid, target_section_id uuid, target_lesson_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_active_school_member(target_school_id) and exists (
    select 1
    from public.scheduled_lessons lesson
    join public.teaching_sections section on section.id = lesson.teaching_section_id and section.school_id = lesson.school_id
    join public.memberships membership on membership.id = section.teacher_membership_id and membership.school_id = section.school_id
    join public.role_grants grant_row on grant_row.membership_id = membership.id and grant_row.school_id = membership.school_id
    where lesson.id = target_lesson_id and lesson.school_id = target_school_id
      and lesson.teaching_section_id = target_section_id
      and section.assignment_state = 'CONFIRMED' and section.operational_status = 'ACTIVE'
      and membership.user_id = (select auth.uid()) and membership.status = 'ACTIVE'
      and grant_row.role = 'TEACHER' and grant_row.status = 'ACTIVE'
  )
$$;

alter table public.lesson_artifacts enable row level security;
alter table public.lesson_artifact_versions enable row level security;
revoke all on public.lesson_artifacts, public.lesson_artifact_versions from anon, authenticated;
grant select on public.lesson_artifacts, public.lesson_artifact_versions to authenticated;

create policy lesson_artifacts_read on public.lesson_artifacts
for select to authenticated using (private.can_read_lesson_artifact(school_id, teaching_section_id));

create policy lesson_artifact_versions_read on public.lesson_artifact_versions
for select to authenticated using (
  exists (
    select 1 from public.lesson_artifacts artifact
    where artifact.id = lesson_artifact_versions.artifact_id
      and artifact.school_id = lesson_artifact_versions.school_id
      and private.can_read_lesson_artifact(artifact.school_id, artifact.teaching_section_id)
  )
);

create or replace function public.create_lesson_artifact(
  p_scheduled_lesson_id uuid,
  p_artifact_type text,
  p_content_json jsonb,
  p_parent_artifact_id uuid default null,
  p_parent_version_id uuid default null,
  p_curriculum_profile_id uuid default null,
  p_curriculum_position_event_id uuid default null,
  p_curriculum_canonical_id text default null,
  p_provenance jsonb default '[]'::jsonb,
  p_rights_state text default 'UNKNOWN'
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  lesson_record record;
  membership_id uuid;
  artifact_id uuid;
  version_id uuid;
begin
  if p_artifact_type not in ('FORMAL_LESSON_PLAN', 'BOARD_NOTES', 'LEARNER_NOTES', 'LESSON_SUMMARY', 'ACTIVITY_SHEET', 'HOMEWORK') then raise exception 'unsupported lesson artifact type'; end if;
  if p_rights_state not in ('CLEARED', 'REVIEW_REQUIRED', 'RESTRICTED', 'UNKNOWN') then raise exception 'unsupported rights state'; end if;
  select lesson.school_id, lesson.teaching_section_id, section.teacher_membership_id
    into lesson_record
    from public.scheduled_lessons lesson
    join public.teaching_sections section on section.id = lesson.teaching_section_id and section.school_id = lesson.school_id
   where lesson.id = p_scheduled_lesson_id;
  if not found or not private.can_manage_lesson_artifact(lesson_record.school_id, lesson_record.teaching_section_id, p_scheduled_lesson_id) then raise exception 'only the assigned teacher may create this lesson artifact'; end if;
  if p_artifact_type = 'FORMAL_LESSON_PLAN' and (p_parent_artifact_id is not null or p_parent_version_id is not null) then raise exception 'formal lesson plans cannot have a parent artifact'; end if;
  if p_artifact_type <> 'FORMAL_LESSON_PLAN' and (p_parent_artifact_id is null or p_parent_version_id is null) then raise exception 'Teaching Pack artifacts require a Formal Lesson Plan version'; end if;
  if p_parent_artifact_id is not null then
    if not exists (select 1 from public.lesson_artifacts parent where parent.id = p_parent_artifact_id and parent.school_id = lesson_record.school_id and parent.artifact_type = 'FORMAL_LESSON_PLAN' and parent.current_version_id = p_parent_version_id) then raise exception 'parent lesson plan version is not current or is not in this school'; end if;
  end if;
  select id into membership_id from public.memberships where id = lesson_record.teacher_membership_id and school_id = lesson_record.school_id;
  insert into public.lesson_artifacts (school_id, scheduled_lesson_id, teaching_section_id, artifact_type, parent_artifact_id, parent_version_id, curriculum_profile_id, curriculum_position_event_id, curriculum_canonical_id, rights_state, provenance, created_by_membership_id)
  values (lesson_record.school_id, p_scheduled_lesson_id, lesson_record.teaching_section_id, p_artifact_type, p_parent_artifact_id, p_parent_version_id, p_curriculum_profile_id, p_curriculum_position_event_id, p_curriculum_canonical_id, p_rights_state, p_provenance, membership_id)
  returning id into artifact_id;
  insert into public.lesson_artifact_versions (school_id, artifact_id, version_number, content_json, change_source, change_summary, created_by_membership_id)
  values (lesson_record.school_id, artifact_id, 1, p_content_json, 'TEACHER', 'Initial teacher-authored version', membership_id)
  returning id into version_id;
  update public.lesson_artifacts set current_version_id = version_id, updated_at = now() where id = artifact_id;
  insert into public.audit_events (school_id, actor_user_id, action, resource_type, resource_id, metadata, after_state)
  values (lesson_record.school_id, (select auth.uid()), 'CREATE', 'LESSON_ARTIFACT', artifact_id, jsonb_build_object('artifact_type', p_artifact_type, 'version_number', 1), jsonb_build_object('version_id', version_id, 'rights_state', p_rights_state));
  return jsonb_build_object('artifactId', artifact_id, 'versionId', version_id, 'versionNumber', 1);
end
$$;

create or replace function public.create_lesson_artifact_version(
  p_artifact_id uuid,
  p_content_json jsonb,
  p_expected_version integer default null,
  p_change_source text default 'TEACHER',
  p_change_summary text default null
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  artifact_record record;
  membership_id uuid;
  next_version integer;
  version_id uuid;
begin
  if p_change_source not in ('TEACHER', 'SYSTEM', 'AI') then raise exception 'unsupported change source'; end if;
  select artifact.id, artifact.school_id, artifact.teaching_section_id, artifact.scheduled_lesson_id, artifact.current_version_id, section.teacher_membership_id
    into artifact_record
    from public.lesson_artifacts artifact
    join public.teaching_sections section on section.id = artifact.teaching_section_id and section.school_id = artifact.school_id
   where artifact.id = p_artifact_id
   for update;
  if not found or not private.can_manage_lesson_artifact(artifact_record.school_id, artifact_record.teaching_section_id, artifact_record.scheduled_lesson_id) then raise exception 'only the assigned teacher may save this lesson artifact'; end if;
  select membership.id into membership_id from public.memberships membership where membership.id = artifact_record.teacher_membership_id and membership.school_id = artifact_record.school_id;
  select coalesce(version_number, 0) + 1 into next_version from public.lesson_artifact_versions where id = artifact_record.current_version_id;
  if p_expected_version is not null and p_expected_version <> next_version - 1 then raise exception 'artifact changed in another session; reopen before saving'; end if;
  insert into public.lesson_artifact_versions (school_id, artifact_id, version_number, content_json, change_source, change_summary, created_by_membership_id)
  values (artifact_record.school_id, p_artifact_id, next_version, p_content_json, p_change_source, p_change_summary, membership_id)
  returning id into version_id;
  update public.lesson_artifacts set current_version_id = version_id, updated_at = now() where id = p_artifact_id;
  insert into public.audit_events (school_id, actor_user_id, action, resource_type, resource_id, metadata)
  values (artifact_record.school_id, (select auth.uid()), 'CREATE_VERSION', 'LESSON_ARTIFACT', p_artifact_id, jsonb_build_object('version_id', version_id, 'version_number', next_version, 'change_source', p_change_source));
  return jsonb_build_object('artifactId', p_artifact_id, 'versionId', version_id, 'versionNumber', next_version);
end
$$;

revoke all on function private.can_read_lesson_artifact(uuid, uuid) from public;
revoke all on function private.can_manage_lesson_artifact(uuid, uuid, uuid) from public;
revoke all on function public.create_lesson_artifact(uuid, text, jsonb, uuid, uuid, uuid, uuid, text, jsonb, text) from public;
revoke all on function public.create_lesson_artifact_version(uuid, jsonb, integer, text, text) from public;
grant execute on function private.can_read_lesson_artifact(uuid, uuid) to authenticated;
grant execute on function private.can_manage_lesson_artifact(uuid, uuid, uuid) to authenticated;
grant execute on function public.create_lesson_artifact(uuid, text, jsonb, uuid, uuid, uuid, uuid, text, jsonb, text) to authenticated;
grant execute on function public.create_lesson_artifact_version(uuid, jsonb, integer, text, text) to authenticated;

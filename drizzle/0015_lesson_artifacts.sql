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
  content_json jsonb not null
    check (jsonb_typeof(content_json) = 'object')
    check (content_json ? 'title' and jsonb_typeof(content_json->'title') = 'string' and nullif(trim(content_json->>'title'), '') is not null),
  rendered_text text,
  change_source text not null check (change_source in ('TEACHER', 'SYSTEM', 'AI')),
  change_summary text,
  created_by_membership_id uuid not null references public.memberships(id),
  created_at timestamptz not null default now(),
  unique (id, school_id),
  unique (id, school_id, artifact_id),
  unique (artifact_id, version_number),
  foreign key (artifact_id, school_id) references public.lesson_artifacts(id, school_id)
);

alter table public.lesson_artifacts
  add constraint lesson_artifacts_current_version_fk
  foreign key (current_version_id, school_id, id) references public.lesson_artifact_versions(id, school_id, artifact_id),
  add constraint lesson_artifacts_parent_version_fk
  foreign key (parent_version_id, school_id, parent_artifact_id) references public.lesson_artifact_versions(id, school_id, artifact_id);

create index lesson_artifacts_lesson_idx on public.lesson_artifacts (school_id, scheduled_lesson_id, artifact_type);
create index lesson_artifacts_section_idx on public.lesson_artifacts (school_id, teaching_section_id, updated_at desc);
create index lesson_artifact_versions_artifact_idx on public.lesson_artifact_versions (school_id, artifact_id, version_number desc);
create unique index lesson_artifacts_identity_idx on public.lesson_artifacts (school_id, scheduled_lesson_id, artifact_type, coalesce(parent_artifact_id, '00000000-0000-0000-0000-000000000000'::uuid));

create or replace function private.validate_lesson_artifact_lineage()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  parent_record record;
begin
  if tg_op = 'UPDATE' then
    if new.school_id is distinct from old.school_id
       or new.scheduled_lesson_id is distinct from old.scheduled_lesson_id
       or new.teaching_section_id is distinct from old.teaching_section_id
       or new.artifact_type is distinct from old.artifact_type
       or new.parent_artifact_id is distinct from old.parent_artifact_id
       or new.parent_version_id is distinct from old.parent_version_id
    then
      raise exception 'lesson artifact lineage is immutable after creation';
    end if;
    return new;
  end if;

  if new.artifact_type = 'FORMAL_LESSON_PLAN' and (new.parent_artifact_id is not null or new.parent_version_id is not null) then
    raise exception 'formal lesson plans cannot have a parent artifact';
  end if;
  if new.artifact_type <> 'FORMAL_LESSON_PLAN' and (new.parent_artifact_id is null or new.parent_version_id is null) then
    raise exception 'Teaching Pack artifacts require a Formal Lesson Plan version';
  end if;
  if new.parent_artifact_id is not null then
    select parent.scheduled_lesson_id, parent.teaching_section_id, parent.artifact_type, parent.current_version_id
      into parent_record
      from public.lesson_artifacts parent
     where parent.id = new.parent_artifact_id
       and parent.school_id = new.school_id;
    if not found
       or parent_record.scheduled_lesson_id <> new.scheduled_lesson_id
       or parent_record.teaching_section_id <> new.teaching_section_id
       or parent_record.artifact_type <> 'FORMAL_LESSON_PLAN'
       or parent_record.current_version_id is distinct from new.parent_version_id
    then
      raise exception 'lesson artifact parent must be the current Formal Lesson Plan for the same lesson and Teaching Section';
    end if;
  end if;
  return new;
end;
$$;

create trigger lesson_artifact_lineage_validate
before insert or update on public.lesson_artifacts
for each row execute function private.validate_lesson_artifact_lineage();

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

create or replace function private.can_read_lesson_artifact(target_school_id uuid, target_section_id uuid, target_lesson_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.can_manage_lesson_artifact(target_school_id, target_section_id, target_lesson_id)
$$;

alter table public.lesson_artifacts enable row level security;
alter table public.lesson_artifact_versions enable row level security;
revoke all on public.lesson_artifacts, public.lesson_artifact_versions from anon, authenticated;
grant select on public.lesson_artifacts, public.lesson_artifact_versions to authenticated;

create policy lesson_artifacts_read on public.lesson_artifacts
for select to authenticated using (private.can_read_lesson_artifact(school_id, teaching_section_id, scheduled_lesson_id));

create policy lesson_artifact_versions_read on public.lesson_artifact_versions
for select to authenticated using (
  exists (
    select 1 from public.lesson_artifacts artifact
    where artifact.id = lesson_artifact_versions.artifact_id
      and artifact.school_id = lesson_artifact_versions.school_id
      and private.can_read_lesson_artifact(artifact.school_id, artifact.teaching_section_id, artifact.scheduled_lesson_id)
  )
);

create or replace function private.validate_lesson_artifact_content()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  artifact_type text;
begin
  select artifact.artifact_type
    into artifact_type
    from public.lesson_artifacts artifact
   where artifact.id = new.artifact_id
     and artifact.school_id = new.school_id;

  if artifact_type is null then
    raise exception 'lesson artifact does not belong to this school';
  end if;

  if artifact_type = 'FORMAL_LESSON_PLAN'
     and not (new.content_json ?& array[
       'curriculumAnchor', 'learningIntention', 'expectedOutcome', 'priorLearning',
       'continuityContext', 'lessonFocus', 'intendedCoverage', 'durationMinutes',
       'resources', 'teachingSequence', 'differentiation', 'conclusionFollowUp', 'teacherNotes'
     ]::text[])
  then
    raise exception 'formal lesson plan payload is missing required fields';
  end if;

  if artifact_type = 'FORMAL_LESSON_PLAN'
     and (jsonb_typeof(new.content_json->'durationMinutes') <> 'number'
       or jsonb_typeof(new.content_json->'resources') <> 'array'
       or jsonb_typeof(new.content_json->'teachingSequence') <> 'array')
  then
    raise exception 'formal lesson plan payload has invalid field types';
  end if;

  return new;
end;
$$;

create trigger lesson_artifact_version_content_validate
before insert on public.lesson_artifact_versions
for each row execute function private.validate_lesson_artifact_content();

create or replace function public.create_lesson_artifact(
  p_scheduled_lesson_id uuid,
  p_artifact_type text,
  p_content_json jsonb,
  p_parent_artifact_id uuid default null,
  p_parent_version_id uuid default null,
  p_curriculum_profile_id uuid default null,
  p_curriculum_position_event_id uuid default null,
  p_curriculum_canonical_id text default null,
  p_provenance jsonb default null,
  p_rights_state text default null
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  lesson_record record;
  governed_position record;
  governed_profile_id uuid;
  governed_event_id uuid;
  governed_canonical_id text;
  governed_rights_state text := 'UNKNOWN';
  governed_provenance jsonb;
  membership_id uuid;
  artifact_id uuid;
  version_id uuid;
begin
  if p_artifact_type not in ('FORMAL_LESSON_PLAN', 'BOARD_NOTES', 'LEARNER_NOTES', 'LESSON_SUMMARY', 'ACTIVITY_SHEET', 'HOMEWORK') then raise exception 'unsupported lesson artifact type'; end if;
  if p_rights_state is not null and p_rights_state not in ('CLEARED', 'REVIEW_REQUIRED', 'RESTRICTED', 'UNKNOWN') then raise exception 'unsupported rights state'; end if;
  select lesson.school_id, lesson.teaching_section_id, lesson.scheduled_date, section.teacher_membership_id
    into lesson_record
    from public.scheduled_lessons lesson
    join public.teaching_sections section on section.id = lesson.teaching_section_id and section.school_id = lesson.school_id
   where lesson.id = p_scheduled_lesson_id;
  if not found or not private.can_manage_lesson_artifact(lesson_record.school_id, lesson_record.teaching_section_id, p_scheduled_lesson_id) then raise exception 'only the assigned teacher may create this lesson artifact'; end if;

  select binding.subject_profile_id
    into governed_profile_id
    from public.teaching_section_curriculum_bindings binding
   where binding.school_id = lesson_record.school_id
     and binding.teaching_section_id = lesson_record.teaching_section_id
     and binding.status = 'ACTIVE'
     and binding.effective_from <= lesson_record.scheduled_date
     and (binding.effective_to is null or binding.effective_to >= lesson_record.scheduled_date)
   order by binding.effective_from desc, binding.id desc
   limit 1;

  select event.id as event_id, event.subject_profile_id, event.canonical_id,
         case
           when source.rights_status = 'CLEARED'
             and source.production_use_status = 'PERMITTED'
             and source.formal_artifact_allowed then 'CLEARED'
           when source.rights_status = 'RESTRICTED' then 'RESTRICTED'
           when source.rights_status = 'REVIEW_REQUIRED'
             or source.rights_status = 'CLEARED' then 'REVIEW_REQUIRED'
           else 'UNKNOWN'
         end as rights_state,
         jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
           'category', 'CURRICULUM_ANCHOR',
           'label', case
             when source.formal_artifact_allowed
               and source.rights_status = 'CLEARED'
               and source.production_use_status = 'PERMITTED'
             then coalesce(nullif(event_record.normalized->>'title', ''), nullif(event_record.normalized->>'name', ''), 'Current confirmed curriculum position')
             else 'Current confirmed curriculum position'
           end,
           'sourceId', event_record.source_id,
           'sourceTitle', source.title,
           'sourceLocation', span.locator,
           'sourcePageStart', span.page_start,
           'sourcePageEnd', span.page_end,
           'rightsState', case
             when source.rights_status = 'CLEARED'
               and source.production_use_status = 'PERMITTED'
               and source.formal_artifact_allowed then 'CLEARED'
             when source.rights_status = 'RESTRICTED' then 'RESTRICTED'
             when source.rights_status = 'REVIEW_REQUIRED'
               or source.rights_status = 'CLEARED' then 'REVIEW_REQUIRED'
             else 'UNKNOWN'
           end
         ))) as provenance
    into governed_position
    from public.teaching_section_curriculum_position_events event
    join public.knowledge_profile_records profile_record
      on profile_record.subject_profile_id = event.subject_profile_id
     and profile_record.canonical_id = event.canonical_id
     and profile_record.status = 'APPROVED'
     and profile_record.runtime_status = 'PILOT_ACTIVE'
     and (profile_record.effective_from is null or profile_record.effective_from <= lesson_record.scheduled_date)
     and (profile_record.effective_to is null or profile_record.effective_to >= lesson_record.scheduled_date)
    join public.knowledge_records event_record on event_record.canonical_id = event.canonical_id
    join public.knowledge_sources source on source.source_id = event_record.source_id
    join public.knowledge_source_spans span on span.source_id = event_record.source_id and span.span_id = event_record.span_id
   where event.school_id = lesson_record.school_id
     and event.teaching_section_id = lesson_record.teaching_section_id
     and event.subject_profile_id = governed_profile_id
     and event.confirmed_at::date <= lesson_record.scheduled_date
     and not exists (
       select 1
         from public.teaching_section_curriculum_position_events successor
        where successor.school_id = event.school_id
          and successor.teaching_section_id = event.teaching_section_id
          and successor.supersedes_event_id = event.id
          and successor.confirmed_at::date <= lesson_record.scheduled_date
     )
   order by event.confirmed_at desc, event.id desc
   limit 1;

  governed_event_id := governed_position.event_id;
  governed_canonical_id := governed_position.canonical_id;
  if governed_position.event_id is not null then
    governed_rights_state := governed_position.rights_state;
    governed_provenance := governed_position.provenance;
  else
    governed_provenance := jsonb_build_array(jsonb_build_object('category', 'TEACHER', 'label', 'Teacher-authored planning context'));
  end if;

  if p_curriculum_profile_id is not null and p_curriculum_profile_id is distinct from governed_profile_id then raise exception 'curriculum profile does not match the active Teaching Section binding'; end if;
  if p_curriculum_position_event_id is not null and p_curriculum_position_event_id is distinct from governed_event_id then raise exception 'curriculum position event is not the governed position for this lesson'; end if;
  if p_curriculum_canonical_id is not null and p_curriculum_canonical_id is distinct from governed_canonical_id then raise exception 'curriculum canonical ID does not match the governed position event'; end if;
  if p_rights_state is not null and p_rights_state is distinct from governed_rights_state then raise exception 'rights state is governed by the curriculum source'; end if;
  if p_provenance is not null and p_provenance is distinct from governed_provenance then raise exception 'provenance is governed by the curriculum source'; end if;

  if p_artifact_type = 'FORMAL_LESSON_PLAN' and (p_parent_artifact_id is not null or p_parent_version_id is not null) then raise exception 'formal lesson plans cannot have a parent artifact'; end if;
  if p_artifact_type <> 'FORMAL_LESSON_PLAN' and (p_parent_artifact_id is null or p_parent_version_id is null) then raise exception 'Teaching Pack artifacts require a Formal Lesson Plan version'; end if;
  if p_parent_artifact_id is not null then
    if not exists (select 1 from public.lesson_artifacts parent where parent.id = p_parent_artifact_id and parent.school_id = lesson_record.school_id and parent.scheduled_lesson_id = p_scheduled_lesson_id and parent.teaching_section_id = lesson_record.teaching_section_id and parent.artifact_type = 'FORMAL_LESSON_PLAN' and parent.current_version_id = p_parent_version_id) then raise exception 'parent lesson plan version is not current for this lesson and Teaching Section'; end if;
  end if;
  select id into membership_id from public.memberships where id = lesson_record.teacher_membership_id and school_id = lesson_record.school_id;
  insert into public.lesson_artifacts (school_id, scheduled_lesson_id, teaching_section_id, artifact_type, parent_artifact_id, parent_version_id, curriculum_profile_id, curriculum_position_event_id, curriculum_canonical_id, rights_state, provenance, created_by_membership_id)
  values (lesson_record.school_id, p_scheduled_lesson_id, lesson_record.teaching_section_id, p_artifact_type, p_parent_artifact_id, p_parent_version_id, governed_profile_id, governed_event_id, governed_canonical_id, governed_rights_state, governed_provenance, membership_id)
  returning id into artifact_id;
  insert into public.lesson_artifact_versions (school_id, artifact_id, version_number, content_json, change_source, change_summary, created_by_membership_id)
  values (lesson_record.school_id, artifact_id, 1, p_content_json, 'TEACHER', 'Initial teacher-authored version', membership_id)
  returning id into version_id;
  update public.lesson_artifacts set current_version_id = version_id, updated_at = now() where id = artifact_id;
  insert into public.audit_events (school_id, actor_user_id, action, resource_type, resource_id, metadata, after_state)
  values (lesson_record.school_id, (select auth.uid()), 'CREATE', 'LESSON_ARTIFACT', artifact_id, jsonb_build_object('artifact_type', p_artifact_type, 'version_number', 1), jsonb_build_object('version_id', version_id, 'rights_state', governed_rights_state));
  return jsonb_build_object('artifactId', artifact_id, 'versionId', version_id, 'versionNumber', 1);
end
$$;

create or replace function public.create_lesson_artifact_version(
  p_artifact_id uuid,
  p_content_json jsonb,
  p_expected_version integer default null,
  p_change_summary text default null
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  artifact_record record;
  membership_id uuid;
  next_version integer;
  version_id uuid;
begin
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
  values (artifact_record.school_id, p_artifact_id, next_version, p_content_json, 'TEACHER', p_change_summary, membership_id)
  returning id into version_id;
  update public.lesson_artifacts set current_version_id = version_id, updated_at = now() where id = p_artifact_id;
  insert into public.audit_events (school_id, actor_user_id, action, resource_type, resource_id, metadata)
  values (artifact_record.school_id, (select auth.uid()), 'CREATE_VERSION', 'LESSON_ARTIFACT', p_artifact_id, jsonb_build_object('version_id', version_id, 'version_number', next_version, 'change_source', 'TEACHER'));
  return jsonb_build_object('artifactId', p_artifact_id, 'versionId', version_id, 'versionNumber', next_version);
end
$$;

revoke all on function private.can_read_lesson_artifact(uuid, uuid, uuid) from public;
revoke all on function private.can_manage_lesson_artifact(uuid, uuid, uuid) from public;
revoke all on function public.create_lesson_artifact(uuid, text, jsonb, uuid, uuid, uuid, uuid, text, jsonb, text) from public;
revoke all on function public.create_lesson_artifact_version(uuid, jsonb, integer, text) from public;
grant execute on function private.can_read_lesson_artifact(uuid, uuid, uuid) to authenticated;
grant execute on function private.can_manage_lesson_artifact(uuid, uuid, uuid) to authenticated;
grant execute on function public.create_lesson_artifact(uuid, text, jsonb, uuid, uuid, uuid, uuid, text, jsonb, text) to authenticated;
grant execute on function public.create_lesson_artifact_version(uuid, jsonb, integer, text) to authenticated;

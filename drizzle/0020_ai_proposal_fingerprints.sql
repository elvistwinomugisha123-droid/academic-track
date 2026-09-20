-- Step 8 closure: bind accepted AI content to the immutable generated proposal.
-- This migration is forward-only because 0017-0019 are already applied to TEST.

create extension if not exists pgcrypto;

alter table public.ai_generation_runs
  add column if not exists output_fingerprint text,
  add constraint ai_generation_runs_output_fingerprint_check
    check (output_fingerprint is null or output_fingerprint ~ '^[0-9a-f]{64}$');

create or replace function private.canonical_jsonb(value jsonb)
returns text
language sql
immutable
strict
set search_path = ''
as $$
  select case jsonb_typeof(value)
    when 'object' then coalesce(
      '{' || (select string_agg(to_jsonb(entry_key)::text || ':' || private.canonical_jsonb(entry_value), ',' order by entry_key)
              from jsonb_each(value) as entries(entry_key, entry_value)) || '}', '{}')
    when 'array' then coalesce(
      '[' || (select string_agg(private.canonical_jsonb(entry_value), ',' order by entry_order)
              from jsonb_array_elements(value) with ordinality as entries(entry_value, entry_order)) || ']', '[]')
    else value::text
  end
$$;

drop function if exists public.accept_ai_lesson_artifact_version(uuid,uuid,uuid,text,uuid,uuid,jsonb,integer,text,uuid,uuid);

create function public.accept_ai_lesson_artifact_version(
  p_generation_run_id uuid,
  p_scheduled_lesson_id uuid,
  p_artifact_id uuid,
  p_artifact_type text,
  p_parent_artifact_id uuid,
  p_parent_version_id uuid,
  p_content_json jsonb,
  p_output_fingerprint text,
  p_expected_version integer,
  p_change_summary text,
  p_actor_user_id uuid,
  p_actor_membership_id uuid
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor record;
  lesson_record record;
  run_record record;
  artifact_record record;
  governed_position record;
  governed_profile_id uuid;
  governed_event_id uuid;
  governed_canonical_id text;
  governed_rights_state text := 'UNKNOWN';
  governed_provenance jsonb;
  version_id uuid;
  accepted_artifact_id uuid := p_artifact_id;
  next_version integer;
begin
  if jsonb_typeof(p_content_json) <> 'object' then raise exception 'AI artifact content must be a JSON object'; end if;
  if p_output_fingerprint is null or p_output_fingerprint <> encode(digest(private.canonical_jsonb(p_content_json), 'sha256'), 'hex') then raise exception 'AI proposal output fingerprint does not match supplied content'; end if;

  select m.id, m.school_id, m.user_id into actor
    from public.memberships m
   where m.id = p_actor_membership_id and m.user_id = p_actor_user_id and m.status = 'ACTIVE'
     and exists (select 1 from public.role_grants rg where rg.membership_id=m.id and rg.school_id=m.school_id and rg.role='TEACHER' and rg.status='ACTIVE');
  if not found then raise exception 'AI acceptance requires an active assigned teacher'; end if;

  select r.* into run_record from public.ai_generation_runs r
   where r.id = p_generation_run_id and r.school_id = actor.school_id and r.created_by_user_id = p_actor_user_id
     and r.created_by_membership_id = p_actor_membership_id and r.scheduled_lesson_id = p_scheduled_lesson_id
     and r.artifact_type = p_artifact_type and r.status = 'SUCCEEDED' and r.validation_status = 'PASSED'
   for update;
  if not found then raise exception 'AI proposal is unavailable or has already been accepted'; end if;
  if run_record.output_fingerprint is null or p_output_fingerprint <> run_record.output_fingerprint then raise exception 'AI proposal output fingerprint does not match the generated proposal'; end if;
  if run_record.artifact_id is distinct from p_artifact_id then raise exception 'AI proposal does not belong to this artifact'; end if;

  select lesson.school_id, lesson.teaching_section_id, lesson.scheduled_date, section.teacher_membership_id into lesson_record
    from public.scheduled_lessons lesson join public.teaching_sections section on section.id=lesson.teaching_section_id and section.school_id=lesson.school_id
   where lesson.id=p_scheduled_lesson_id and lesson.school_id=actor.school_id;
  if not found or lesson_record.teacher_membership_id <> p_actor_membership_id then raise exception 'AI acceptance is limited to the assigned teacher'; end if;

  if p_artifact_id is null then
    if p_artifact_type = 'FORMAL_LESSON_PLAN' and (p_parent_artifact_id is not null or p_parent_version_id is not null) then raise exception 'Formal Lesson Plans cannot have a parent artifact'; end if;
    if p_artifact_type <> 'FORMAL_LESSON_PLAN' and (p_parent_artifact_id is null or p_parent_version_id is null) then raise exception 'New Teaching Pack artifacts require a Formal Lesson Plan version'; end if;
    select binding.subject_profile_id into governed_profile_id from public.teaching_section_curriculum_bindings binding
     where binding.school_id=actor.school_id and binding.teaching_section_id=lesson_record.teaching_section_id and binding.status='ACTIVE'
       and binding.effective_from <= lesson_record.scheduled_date and (binding.effective_to is null or binding.effective_to >= lesson_record.scheduled_date)
     order by binding.effective_from desc, binding.id desc limit 1;
    select event.id as event_id, event.subject_profile_id, event.canonical_id,
      case when source.rights_status='CLEARED' and source.production_use_status='PERMITTED' and source.formal_artifact_allowed then 'CLEARED'
           when source.rights_status='RESTRICTED' then 'RESTRICTED'
           when source.rights_status='REVIEW_REQUIRED' or source.rights_status='CLEARED' then 'REVIEW_REQUIRED' else 'UNKNOWN' end as rights_state,
      jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
        'category','CURRICULUM_ANCHOR',
        'label',case when source.formal_artifact_allowed and source.rights_status='CLEARED' and source.production_use_status='PERMITTED' then coalesce(nullif(event_record.normalized->>'title',''),nullif(event_record.normalized->>'name',''),'Current confirmed curriculum position') else 'Current confirmed curriculum position' end,
        'sourceId',event_record.source_id,'sourceTitle',source.title,'sourceLocation',span.locator,'sourcePageStart',span.page_start,'sourcePageEnd',span.page_end,
        'rightsState',case when source.rights_status='CLEARED' and source.production_use_status='PERMITTED' and source.formal_artifact_allowed then 'CLEARED' when source.rights_status='RESTRICTED' then 'RESTRICTED' when source.rights_status='REVIEW_REQUIRED' or source.rights_status='CLEARED' then 'REVIEW_REQUIRED' else 'UNKNOWN' end
      ))) as provenance into governed_position
      from public.teaching_section_curriculum_position_events event
      join public.knowledge_profile_records profile_record on profile_record.subject_profile_id=event.subject_profile_id and profile_record.canonical_id=event.canonical_id and profile_record.status='APPROVED' and profile_record.runtime_status='PILOT_ACTIVE' and (profile_record.effective_from is null or profile_record.effective_from <= lesson_record.scheduled_date) and (profile_record.effective_to is null or profile_record.effective_to >= lesson_record.scheduled_date)
      join public.knowledge_records event_record on event_record.canonical_id=event.canonical_id
      join public.knowledge_sources source on source.source_id=event_record.source_id
      join public.knowledge_source_spans span on span.source_id=event_record.source_id and span.span_id=event_record.span_id
     where event.school_id=actor.school_id and event.teaching_section_id=lesson_record.teaching_section_id and event.subject_profile_id=governed_profile_id and event.confirmed_at::date <= lesson_record.scheduled_date
       and not exists (select 1 from public.teaching_section_curriculum_position_events successor where successor.school_id=event.school_id and successor.teaching_section_id=event.teaching_section_id and successor.supersedes_event_id=event.id and successor.confirmed_at::date <= lesson_record.scheduled_date)
     order by event.confirmed_at desc,event.id desc limit 1;
    governed_event_id := governed_position.event_id; governed_canonical_id := governed_position.canonical_id;
    if governed_position.event_id is not null then governed_rights_state := governed_position.rights_state; governed_provenance := governed_position.provenance;
    else governed_provenance := jsonb_build_array(jsonb_build_object('category','TEACHER','label','Teacher-authored planning context')); end if;
    if p_artifact_type <> 'FORMAL_LESSON_PLAN' and not exists (select 1 from public.lesson_artifacts parent where parent.id=p_parent_artifact_id and parent.school_id=actor.school_id and parent.scheduled_lesson_id=p_scheduled_lesson_id and parent.teaching_section_id=lesson_record.teaching_section_id and parent.artifact_type='FORMAL_LESSON_PLAN' and parent.current_version_id=p_parent_version_id) then raise exception 'AI Teaching Pack parent must be the current Formal Lesson Plan for this lesson'; end if;
    insert into public.lesson_artifacts (school_id, scheduled_lesson_id, teaching_section_id, artifact_type, parent_artifact_id, parent_version_id, curriculum_profile_id, curriculum_position_event_id, curriculum_canonical_id, rights_state, provenance, created_by_membership_id)
    values (actor.school_id,p_scheduled_lesson_id,lesson_record.teaching_section_id,p_artifact_type,p_parent_artifact_id,p_parent_version_id,governed_profile_id,governed_event_id,governed_canonical_id,governed_rights_state,governed_provenance,p_actor_membership_id)
    returning id into accepted_artifact_id;
  else
    select artifact.* into artifact_record from public.lesson_artifacts artifact where artifact.id=p_artifact_id and artifact.school_id=actor.school_id for update;
    if not found or artifact_record.scheduled_lesson_id <> p_scheduled_lesson_id or artifact_record.teaching_section_id <> lesson_record.teaching_section_id or artifact_record.artifact_type <> p_artifact_type then raise exception 'AI artifact context no longer matches this lesson'; end if;
    if p_artifact_type <> 'FORMAL_LESSON_PLAN' and (p_parent_artifact_id is distinct from artifact_record.parent_artifact_id or p_parent_version_id is distinct from artifact_record.parent_version_id) then raise exception 'AI child lineage is immutable'; end if;
    select coalesce(version_number,0)+1 into next_version from public.lesson_artifact_versions where id=artifact_record.current_version_id;
    if p_expected_version is not null and p_expected_version <> next_version-1 then raise exception 'artifact changed while the AI proposal was open'; end if;
  end if;
  if p_artifact_id is null then next_version := 1; else next_version := coalesce(next_version,1); end if;
  insert into public.lesson_artifact_versions (school_id,artifact_id,version_number,content_json,change_source,change_summary,created_by_membership_id)
  values (actor.school_id,accepted_artifact_id,next_version,p_content_json,'AI',coalesce(p_change_summary,'Teacher accepted ATE proposal'),p_actor_membership_id)
  returning id into version_id;
  update public.lesson_artifacts set current_version_id=version_id, updated_at=now() where id=accepted_artifact_id and school_id=actor.school_id;
  update public.ai_generation_runs run set status='ACCEPTED', artifact_id=accepted_artifact_id where run.id=p_generation_run_id;
  insert into public.audit_events (school_id,actor_user_id,action,resource_type,resource_id,metadata,after_state)
  values (actor.school_id,p_actor_user_id,'CREATE_VERSION','LESSON_ARTIFACT',accepted_artifact_id,jsonb_build_object('version_id',version_id,'version_number',next_version,'change_source','AI','generation_run_id',p_generation_run_id),jsonb_build_object('accepted_by_membership_id',p_actor_membership_id));
  return jsonb_build_object('artifactId',accepted_artifact_id,'versionId',version_id,'versionNumber',next_version);
end
$$;

revoke all on function public.accept_ai_lesson_artifact_version(uuid,uuid,uuid,text,uuid,uuid,jsonb,text,integer,text,uuid,uuid) from public, anon, authenticated;
grant execute on function public.accept_ai_lesson_artifact_version(uuid,uuid,uuid,text,uuid,uuid,jsonb,text,integer,text,uuid,uuid) to service_role;

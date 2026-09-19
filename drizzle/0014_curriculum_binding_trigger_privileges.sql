-- Step 7 integration hardening: trusted trigger invariant checks may read the
-- central curriculum governance tables without exposing those tables to school
-- users. The outer INSERT remains subject to its normal RLS policies.

create or replace function private.validate_school_curriculum_binding()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  school_subject_record record;
  profile record;
  section_record record;
  bound_profile uuid;
begin
  if tg_table_name = 'school_subject_curriculum_bindings' then
    select ss.school_id, ss.id, ss.curriculum_subject_id, ss.curriculum_education_level
      into school_subject_record
      from public.school_subjects ss
     where ss.id = new.school_subject_id
       and ss.school_id = new.school_id;
    if not found then raise exception 'school subject does not belong to school'; end if;
  else
    select ts.school_subject_id
      into section_record
      from public.teaching_sections ts
     where ts.id = new.teaching_section_id
       and ts.school_id = new.school_id;
    if not found then raise exception 'teaching section does not belong to school'; end if;

    select ss.school_id, ss.id, ss.curriculum_subject_id, ss.curriculum_education_level
      into school_subject_record
      from public.school_subjects ss
     where ss.id = section_record.school_subject_id
       and ss.school_id = new.school_id;
    if not found then raise exception 'teaching section subject does not belong to school'; end if;
  end if;

  select p.id, p.governed_subject_id, p.education_level, p.runtime_status, p.status
    into profile
    from public.knowledge_subject_profiles p
   where p.id = new.subject_profile_id;
  if not found or profile.status <> 'ACTIVE' or profile.runtime_status <> 'PILOT_ACTIVE' then
    raise exception 'binding requires a PILOT_ACTIVE subject profile';
  end if;

  if new.status = 'ACTIVE' then
    if school_subject_record.curriculum_subject_id is null
       or school_subject_record.curriculum_subject_id <> profile.governed_subject_id then
      raise exception 'school subject curriculum identity does not match the selected subject profile';
    end if;
    if school_subject_record.curriculum_education_level is null
       or (school_subject_record.curriculum_education_level <> 'cross-level'
           and profile.education_level <> school_subject_record.curriculum_education_level
           and profile.education_level <> 'cross-level') then
      raise exception 'school subject education level does not match the selected subject profile';
    end if;
  end if;

  if not private.user_has_school_role(new.school_id, new.bound_by, 'DOS')
     and not private.user_has_school_role(new.school_id, new.bound_by, 'SCHOOL_ADMIN') then
    raise exception 'curriculum binding actor must be an active DOS or SCHOOL_ADMIN';
  end if;

  if tg_table_name = 'school_subject_curriculum_bindings' then
    return new;
  end if;

  select b.subject_profile_id
    into bound_profile
    from public.school_subject_curriculum_bindings b
   where b.school_id = new.school_id
     and b.school_subject_id = school_subject_record.id
     and b.status = 'ACTIVE'
     and b.effective_from <= new.effective_from
     and (b.effective_to is null or b.effective_to >= new.effective_from)
   order by b.effective_from desc
   limit 1;
  if bound_profile is null or bound_profile <> new.subject_profile_id then
    raise exception 'teaching section profile must match its school subject binding';
  end if;
  return new;
end;
$$;

create or replace function private.validate_curriculum_position_event()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  section_profile uuid;
  record_profile uuid;
  current_teacher uuid;
begin
  select b.subject_profile_id
    into section_profile
    from public.teaching_section_curriculum_bindings b
   where b.school_id = new.school_id
     and b.teaching_section_id = new.teaching_section_id
     and b.status = 'ACTIVE'
     and b.effective_from <= new.confirmed_at::date
     and (b.effective_to is null or b.effective_to >= new.confirmed_at::date)
   order by b.effective_from desc
   limit 1;
  if section_profile is null or section_profile <> new.subject_profile_id then
    raise exception 'position profile does not match the active teaching-section binding';
  end if;

  select pr.subject_profile_id
    into record_profile
    from public.knowledge_profile_records pr
   where pr.canonical_id = new.canonical_id
     and pr.subject_profile_id = new.subject_profile_id
     and pr.status = 'APPROVED'
     and pr.runtime_status = 'PILOT_ACTIVE';
  if record_profile is null then
    raise exception 'position record is not an active member of the selected subject profile';
  end if;

  select m.user_id
    into current_teacher
    from public.teaching_sections ts
    join public.memberships m
      on m.id = ts.teacher_membership_id
     and m.school_id = ts.school_id
     and m.status = 'ACTIVE'
   where ts.id = new.teaching_section_id
     and ts.school_id = new.school_id;
  if new.confirmed_by is distinct from current_teacher
     and not private.user_has_school_role(new.school_id, new.confirmed_by, 'DOS')
     and not private.user_has_school_role(new.school_id, new.confirmed_by, 'SCHOOL_ADMIN') then
    raise exception 'only the assigned teacher or an authorised school academic role may confirm a curriculum position';
  end if;
  return new;
end;
$$;

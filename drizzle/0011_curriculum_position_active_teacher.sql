-- Step 6 authorization hardening: an assigned teacher must have an ACTIVE
-- school membership before they may confirm a curriculum position. DOS and
-- SCHOOL_ADMIN remain explicit override actors.

create or replace function private.validate_curriculum_position_event()
returns trigger language plpgsql set search_path = public, pg_temp as $$
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
  if current_teacher is null then
    raise exception 'teaching section has no active assigned teacher';
  end if;
  if current_teacher <> new.confirmed_by
     and not private.user_has_school_role(new.school_id, new.confirmed_by, 'DOS')
     and not private.user_has_school_role(new.school_id, new.confirmed_by, 'SCHOOL_ADMIN') then
    raise exception 'only the assigned teacher or an authorised school academic role may confirm a curriculum position';
  end if;
  return new;
end;
$$;

-- Harden the final internal knowledge table that retained direct Data API
-- privileges. Runtime decisions are written through service-only governance
-- RPCs; browser roles do not need table access.

revoke all on table public.knowledge_runtime_decisions from public, anon, authenticated;

-- Avoid per-row auth.uid() re-evaluation in the only policy flagged by the
-- current RLS performance advisor. The surrounding school membership and role
-- predicates remain unchanged.

drop policy if exists teaching_section_curriculum_position_events_insert
  on public.teaching_section_curriculum_position_events;

create policy teaching_section_curriculum_position_events_insert
  on public.teaching_section_curriculum_position_events
  for insert
  to authenticated
  with check (
    private.is_active_school_member(school_id)
    and (
      confirmed_by = (select auth.uid())
      or private.has_school_role(school_id, 'DOS')
      or private.has_school_role(school_id, 'SCHOOL_ADMIN')
    )
  );

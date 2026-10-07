-- A source's publication year does not establish a calendar effective date.
-- The release window may therefore be unknown for a controlled pilot. Runtime
-- retrieval still needs an explicit operational effectiveOn date from the caller.
alter table public.knowledge_curriculum_releases
  alter column effective_from drop not null;

-- Cover the new AI generation run foreign keys without exposing the audit table.
create index ai_generation_runs_membership_fk_idx on public.ai_generation_runs (created_by_membership_id, school_id);
create index ai_generation_runs_artifact_fk_idx on public.ai_generation_runs (artifact_id, school_id);

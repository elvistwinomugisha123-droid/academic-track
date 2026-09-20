-- Supabase installs pgcrypto in the extensions schema. Keep the security-definer
-- acceptance function explicit about the trusted schemas it may resolve.
alter function public.accept_ai_lesson_artifact_version(uuid,uuid,uuid,text,uuid,uuid,jsonb,text,integer,text,uuid,uuid)
  set search_path = 'pg_catalog, public, extensions';

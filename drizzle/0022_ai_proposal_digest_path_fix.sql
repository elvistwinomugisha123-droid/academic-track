-- Keep the trusted schemas as a real search_path list, not one quoted schema name.
alter function public.accept_ai_lesson_artifact_version(uuid,uuid,uuid,text,uuid,uuid,jsonb,text,integer,text,uuid,uuid)
  set search_path to pg_catalog, public, extensions;

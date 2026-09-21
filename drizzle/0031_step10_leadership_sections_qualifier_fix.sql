-- Forward repair for the applied Step 10 leadership projection.
-- 0030 corrected the department summary. This migration aliases the
-- positioned relation in the nested sections projection so its lesson-state
-- correlation is valid on PostgreSQL.
do $do$
declare
  function_definition text;
  section_start integer;
  section_end integer;
  sections_fragment text;
begin
  select pg_get_functiondef(proc.oid)
    into function_definition
    from pg_proc proc
    join pg_namespace namespace on namespace.oid = proc.pronamespace
   where namespace.nspname = 'public'
     and proc.proname = 'get_leadership_overview_pre_0029'
     and pg_get_function_identity_arguments(proc.oid) = 'p_scope text';

  if function_definition is null then
    raise exception 'the pre-0029 leadership projection was not found';
  end if;

  section_start := position($needle$'sections', coalesce($needle$ in function_definition);
  section_end := position($needle$'drift', coalesce($needle$ in function_definition);
  if section_start = 0 or section_end <= section_start then
    raise exception 'the expected Step 10 sections projection was not found';
  end if;

  sections_fragment := substring(function_definition from section_start for section_end - section_start);
  sections_fragment := replace(sections_fragment, 'from positioned', 'from positioned section_row');
  sections_fragment := replace(sections_fragment, 'positioned.', 'section_row.');
  function_definition := overlay(function_definition placing sections_fragment from section_start for section_end - section_start);

  execute function_definition;
end;
$do$;

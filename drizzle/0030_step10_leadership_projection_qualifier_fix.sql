-- Forward repair for the applied Step 10 leadership projection.
--
-- 0027's department summary correlated an inner lesson query against the
-- unaliased `positioned` relation. PostgreSQL resolves that reference as
-- missing from the subquery scope. Repair the already-renamed pre-0029
-- function without rewriting 0027 or 0028.
do $do$
declare
  function_definition text;
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

  if position($needle$lesson.teaching_section_id = positioned.id and lesson.lesson_state in$needle$ in function_definition) = 0
     or position($needle$order by department_name) from positioned group by department_id, department_name),$needle$ in function_definition) = 0 then
    raise exception 'the expected Step 10 department-summary fragment was not found';
  end if;

  function_definition := replace(
    function_definition,
    $needle$lesson.teaching_section_id = positioned.id and lesson.lesson_state in$needle$,
    $replacement$lesson.teaching_section_id = department_row.id and lesson.lesson_state in$replacement$
  );
  function_definition := replace(
    function_definition,
    $needle$order by department_name) from positioned group by department_id, department_name),$needle$,
    $replacement$order by department_row.department_name) from positioned department_row group by department_row.department_id, department_row.department_name),$replacement$
  );

  execute function_definition;
end;
$do$;

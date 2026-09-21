-- Forward repair for the applied Step 10 leadership projection.
-- Precompute department counts before aggregating them into JSON.
do $do$
declare
  function_definition text;
  department_start integer;
  programme_start integer;
  department_fragment text := $fragment$
'departments', coalesce((
      select jsonb_agg(jsonb_build_object('id', department_summary.department_id, 'name', department_summary.department_name, 'sectionCount', department_summary.section_count, 'exceptionCount', department_summary.exception_count) order by department_summary.department_name)
        from department_summary
    ), '[]'::jsonb),
    $fragment$;
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

  if position($needle$  ), department_summary as ($needle$ in function_definition) = 0 then
    function_definition := replace(
      function_definition,
      $needle$  ), assessment_state as ($needle$,
      $replacement$  ), department_summary as (
    select department_row.department_id,
           department_row.department_name,
           count(*) as section_count,
           count(*) filter (where department_row.position_status <> 'CONFIRMED' or exists (
             select 1 from lesson_state lesson_row
              where lesson_row.teaching_section_id = department_row.id
                and lesson_row.lesson_state in ('UNCONFIRMED', 'NOT_DELIVERED', 'PARTIALLY_DELIVERED', 'CHANGED')
           )) as exception_count
      from positioned department_row
     group by department_row.department_id, department_row.department_name
  ), assessment_state as ($replacement$
    );
  end if;

  department_start := position($needle$'departments', coalesce(($needle$ in function_definition);
  programme_start := department_start + position($needle$'programmeDisruptions'$needle$ in substring(function_definition from department_start)) - 1;
  if department_start = 0 or programme_start <= department_start then
    raise exception 'the expected Step 10 department projection was not found';
  end if;

  function_definition := overlay(function_definition placing department_fragment from department_start for programme_start - department_start);
  execute function_definition;
end;
$do$;

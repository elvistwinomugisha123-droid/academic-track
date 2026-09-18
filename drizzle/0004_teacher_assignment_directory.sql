-- Step 4C prerequisite: minimal, role-authorized teacher directory for assignment forms.

create or replace function public.list_assignable_teachers(p_school_id uuid)
returns table (membership_id uuid, display_name text)
language plpgsql
security definer
set search_path = '' as $$
begin
  if (select auth.uid()) is null then
    raise exception 'authentication required';
  end if;

  if not private.is_active_school_member(p_school_id)
    or not (private.has_school_role(p_school_id, 'DOS') or private.has_school_role(p_school_id, 'SCHOOL_ADMIN')) then
    raise exception 'academic operations authority required';
  end if;

  return query
    select membership.id, membership.display_name
    from public.memberships as membership
    where membership.school_id = p_school_id
      and membership.status = 'ACTIVE'
      and exists (
        select 1
        from public.role_grants as grant_row
        where grant_row.membership_id = membership.id
          and grant_row.school_id = p_school_id
          and grant_row.role = 'TEACHER'
          and grant_row.status = 'ACTIVE'
      )
    order by membership.display_name, membership.id;
end
$$;

revoke all on function public.list_assignable_teachers(uuid) from public;
revoke all on function public.list_assignable_teachers(uuid) from anon;
grant execute on function public.list_assignable_teachers(uuid) to authenticated;

-- Controlled pilot authorization is a separate, explicit source state. It does
-- not assert public-domain or unrestricted production rights.
alter table public.knowledge_sources drop constraint if exists knowledge_sources_rights_status_check;
alter table public.knowledge_sources add constraint knowledge_sources_rights_status_check
  check (rights_status in ('CLEARED', 'REVIEW_REQUIRED', 'RESTRICTED', 'UNKNOWN', 'OPERATOR_AUTHORIZED_FOR_PILOT'));

do $$
declare item record;
begin
  for item in select conname from pg_constraint
    where conrelid = 'public.knowledge_rights_decisions'::regclass and contype = 'c'
      and (pg_get_constraintdef(oid) like '%rights_status%' or pg_get_constraintdef(oid) like '%external_ai_allowed%')
  loop
    execute format('alter table public.knowledge_rights_decisions drop constraint %I', item.conname);
  end loop;
end $$;
alter table public.knowledge_rights_decisions add constraint knowledge_rights_decisions_rights_status_ck
  check (rights_status in ('CLEARED', 'REVIEW_REQUIRED', 'RESTRICTED', 'UNKNOWN', 'OPERATOR_AUTHORIZED_FOR_PILOT'));
alter table public.knowledge_rights_decisions add constraint knowledge_rights_decisions_permitted_ck
  check (production_use_status <> 'PERMITTED' or rights_status in ('CLEARED', 'OPERATOR_AUTHORIZED_FOR_PILOT'));
alter table public.knowledge_rights_decisions add constraint knowledge_rights_decisions_capabilities_ck
  check ((not external_ai_allowed and not formal_artifact_allowed and not export_allowed)
    or (rights_status in ('CLEARED', 'OPERATOR_AUTHORIZED_FOR_PILOT') and production_use_status = 'PERMITTED'));

-- Keep the narrower pilot state visible in saved artifacts and AI audit runs.
do $$
declare item record; table_name text;
begin
  for table_name in select unnest(array['public.lesson_artifacts', 'public.ai_generation_runs', 'public.assessment_ai_generation_runs'])
  loop
    if to_regclass(table_name) is not null then
      for item in select conname from pg_constraint
        where conrelid = to_regclass(table_name) and contype = 'c'
          and pg_get_constraintdef(oid) like '%rights_state%'
      loop
        execute format('alter table %s drop constraint %I', table_name, item.conname);
      end loop;
      execute format('alter table %s add constraint %I check (rights_state in (''CLEARED'', ''OPERATOR_AUTHORIZED_FOR_PILOT'', ''REVIEW_REQUIRED'', ''RESTRICTED'', ''UNKNOWN''))',
        table_name, split_part(table_name, '.', 2) || '_rights_state_check');
    end if;
  end loop;
end $$;

create or replace function private.prevent_unaudited_knowledge_rights()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if new.production_use_status = 'PERMITTED' and new.rights_status not in ('CLEARED', 'OPERATOR_AUTHORIZED_FOR_PILOT') then
    raise exception 'PERMITTED use requires cleared or explicit operator pilot authorization';
  end if;
  if (new.external_ai_allowed or new.formal_artifact_allowed or new.export_allowed)
      and (new.rights_status not in ('CLEARED', 'OPERATOR_AUTHORIZED_FOR_PILOT') or new.production_use_status <> 'PERMITTED') then
    raise exception 'AI, artifact, and export allowances require an eligible rights decision';
  end if;
  if tg_op = 'INSERT' then
    if (new.rights_status in ('CLEARED', 'OPERATOR_AUTHORIZED_FOR_PILOT') or new.production_use_status = 'PERMITTED'
        or new.external_ai_allowed or new.formal_artifact_allowed or new.export_allowed or not new.attribution_required)
        and coalesce(current_setting('ate.knowledge_rights_decision', true), '') <> 'true' then
      raise exception 'authority-elevating rights must be established by an append-only rights decision';
    end if;
  elsif (new.rights_status is distinct from old.rights_status or new.production_use_status is distinct from old.production_use_status
      or new.external_ai_allowed is distinct from old.external_ai_allowed or new.formal_artifact_allowed is distinct from old.formal_artifact_allowed
      or new.export_allowed is distinct from old.export_allowed or new.attribution_required is distinct from old.attribution_required)
      and coalesce(current_setting('ate.knowledge_rights_decision', true), '') <> 'true' then
    raise exception 'every knowledge rights transition requires an append-only decision';
  end if;
  return new;
end;
$$;

create or replace function public.record_knowledge_pilot_operator_authorization(
  p_source_id text, p_expected_checksum text, p_decision_source text, p_actor_user_id uuid, p_evidence_reference text
) returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare decision_id uuid; actual_checksum text; current_status text;
begin
  if p_actor_user_id is null or nullif(trim(p_decision_source), '') is null or nullif(trim(p_evidence_reference), '') is null then
    raise exception 'pilot authorization requires actor, decision source, and evidence reference';
  end if;
  select checksum_sha256, rights_status into actual_checksum, current_status
    from public.knowledge_sources where source_id = p_source_id for update;
  if actual_checksum is null or actual_checksum <> p_expected_checksum then
    raise exception 'pilot authorization source checksum does not match';
  end if;
  if current_status not in ('UNKNOWN', 'REVIEW_REQUIRED', 'OPERATOR_AUTHORIZED_FOR_PILOT') then
    raise exception 'restricted or production-cleared sources require separate governance';
  end if;
  perform set_config('ate.knowledge_rights_decision', 'true', true);
  insert into public.knowledge_rights_decisions
    (source_id, source_checksum_sha256, rights_status, production_use_status, external_ai_allowed,
     formal_artifact_allowed, export_allowed, attribution_required, decision_source, evidence_reference,
     actor_user_id, notes)
  values (p_source_id, actual_checksum, 'OPERATOR_AUTHORIZED_FOR_PILOT', 'PERMITTED', true, true, true,
          true, p_decision_source, p_evidence_reference, p_actor_user_id,
          'Controlled ATE pilot only. No public raw-PDF distribution or wider rights claim.')
  returning knowledge_rights_decisions.decision_id into decision_id;
  update public.knowledge_sources set rights_status = 'OPERATOR_AUTHORIZED_FOR_PILOT',
    production_use_status = 'PERMITTED', external_ai_allowed = true,
    formal_artifact_allowed = true, export_allowed = true, attribution_required = true
    where source_id = p_source_id;
  return decision_id;
end;
$$;

revoke all on function public.record_knowledge_pilot_operator_authorization(text,text,text,uuid,text) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function public.record_knowledge_pilot_operator_authorization(text,text,text,uuid,text) from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on function public.record_knowledge_pilot_operator_authorization(text,text,text,uuid,text) from authenticated;
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.record_knowledge_pilot_operator_authorization(text,text,text,uuid,text) to service_role;
  end if;
end $$;

-- Step 6B: central Academic Knowledge governance.
-- This migration is intentionally additive. It does not seed curriculum data,
-- grant rights, verify records, or activate a curriculum release.

create schema if not exists private;

alter table public.knowledge_sources
  add column source_schema_version text not null default 'ate-source-v1',
  add column effective_from date,
  add column effective_to date,
  add column formal_artifact_allowed boolean not null default false,
  add column export_allowed boolean not null default false,
  add column verified_by uuid,
  add column verified_at timestamptz,
  add column verification_reason text;

alter table public.knowledge_source_spans
  add column content_sha256 text,
  add column extractor_version text not null default 'unknown',
  add column schema_version text not null default 'ate-source-span-v1',
  add column verified_by uuid,
  add column verified_at timestamptz,
  add column verification_reason text;

alter table public.knowledge_records
  add column record_key text,
  add column content_sha256 text,
  add column payload_schema_version text not null default 'ate-knowledge-record-v1',
  add column verified_by uuid,
  add column verified_at timestamptz,
  add column verification_reason text;

alter table public.knowledge_relationships
  add column verified_by uuid,
  add column verified_at timestamptz,
  add column verification_reason text;

alter table public.knowledge_import_runs
  add column importer_version text not null default 'ate-knowledge-importer-1.0.0',
  add column schema_version text not null default 'ate-knowledge-v1',
  add column manifest_id text,
  add column transaction_status text not null default 'COMMITTED' check (transaction_status in ('STARTED', 'COMMITTED', 'ROLLED_BACK', 'FAILED')),
  add column completed_report_sha256 text;

alter table public.knowledge_sources
  add constraint knowledge_sources_effective_dates_ck check (effective_to is null or (effective_from is not null and effective_to >= effective_from)),
  add constraint knowledge_sources_checksum_format_ck check (checksum_sha256 ~* '^[0-9a-f]{64}$'),
  add constraint knowledge_sources_content_version_ck check (source_schema_version <> '');

alter table public.knowledge_source_spans
  add constraint knowledge_source_spans_checksum_format_ck check (content_sha256 is null or content_sha256 ~* '^[0-9a-f]{64}$'),
  add constraint knowledge_source_spans_source_span_unique unique (source_id, span_id);

alter table public.knowledge_records
  add constraint knowledge_records_checksum_format_ck check (content_sha256 is null or content_sha256 ~* '^[0-9a-f]{64}$'),
  add constraint knowledge_records_record_key_ck check (record_key is null or record_key <> ''),
  add constraint knowledge_records_payload_version_ck check (payload_schema_version <> '');

alter table public.knowledge_relationships
  add constraint knowledge_relationships_source_span_unique unique (source_id, span_id, relationship_id);

-- NOT VALID preserves any historical rows while enforcing the invariant for
-- new writes. Activation separately reports any legacy violations.
alter table public.knowledge_records
  add constraint knowledge_records_source_span_fk
  foreign key (source_id, span_id) references public.knowledge_source_spans (source_id, span_id) not valid;

alter table public.knowledge_relationships
  add constraint knowledge_relationships_from_fk
  foreign key (from_canonical_id) references public.knowledge_records (canonical_id) not valid,
  add constraint knowledge_relationships_source_span_fk
  foreign key (source_id, span_id) references public.knowledge_source_spans (source_id, span_id) not valid;

create table public.knowledge_record_taxonomy (
  record_type text primary key,
  domain text not null check (domain in ('CURRICULUM_STRUCTURE', 'CURRICULUM_INTENT', 'ASSESSMENT_KNOWLEDGE', 'SOURCE_INTERPRETATION', 'LEGACY_CANDIDATE')),
  authority_eligible boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.knowledge_record_taxonomy (record_type, domain, authority_eligible) values
  ('subject_profile', 'CURRICULUM_STRUCTURE', true),
  ('programme_planner', 'CURRICULUM_STRUCTURE', true),
  ('level_unit', 'CURRICULUM_STRUCTURE', true),
  ('term_unit', 'CURRICULUM_STRUCTURE', true),
  ('theme', 'CURRICULUM_STRUCTURE', true),
  ('topic', 'CURRICULUM_STRUCTURE', true),
  ('subtopic', 'CURRICULUM_STRUCTURE', true),
  ('curriculum_framework', 'CURRICULUM_STRUCTURE', true),
  ('competency', 'CURRICULUM_INTENT', true),
  ('learning_outcome', 'CURRICULUM_INTENT', true),
  ('learning_experience', 'CURRICULUM_INTENT', true),
  ('activity', 'CURRICULUM_INTENT', true),
  ('skill', 'CURRICULUM_INTENT', true),
  ('generic_skill', 'CURRICULUM_INTENT', true),
  ('value', 'CURRICULUM_INTENT', true),
  ('cross_cutting_issue', 'CURRICULUM_INTENT', true),
  ('resource', 'CURRICULUM_INTENT', true),
  ('ict_support', 'CURRICULUM_INTENT', true),
  ('practical_requirement', 'CURRICULUM_INTENT', true),
  ('time_allocation', 'CURRICULUM_INTENT', true),
  ('assessment_profile', 'ASSESSMENT_KNOWLEDGE', true),
  ('assessment_framework', 'ASSESSMENT_KNOWLEDGE', true),
  ('assessment_objective', 'ASSESSMENT_KNOWLEDGE', true),
  ('assessment_guidance', 'ASSESSMENT_KNOWLEDGE', true),
  ('assessment_strategy', 'ASSESSMENT_KNOWLEDGE', true),
  ('construct', 'ASSESSMENT_KNOWLEDGE', true),
  ('ability', 'ASSESSMENT_KNOWLEDGE', true),
  ('indicator', 'ASSESSMENT_KNOWLEDGE', true),
  ('assessment_rule', 'ASSESSMENT_KNOWLEDGE', true),
  ('paper_structure', 'ASSESSMENT_KNOWLEDGE', true),
  ('scoring_rule', 'ASSESSMENT_KNOWLEDGE', true),
  ('rubric_rule', 'ASSESSMENT_KNOWLEDGE', true),
  ('performance_descriptor', 'ASSESSMENT_KNOWLEDGE', true),
  ('source_note', 'SOURCE_INTERPRETATION', false),
  ('source_definition', 'SOURCE_INTERPRETATION', false),
  ('review_note', 'SOURCE_INTERPRETATION', false)
on conflict (record_type) do nothing;

insert into public.knowledge_record_taxonomy (record_type, domain, authority_eligible) values
  ('active_learning_expectation','CURRICULUM_INTENT',true),
  ('assessment_principle','ASSESSMENT_KNOWLEDGE',true),
  ('curriculum_menu','CURRICULUM_STRUCTURE',true),
  ('elective_subject_time_allocation','CURRICULUM_STRUCTURE',true),
  ('framework_model','CURRICULUM_STRUCTURE',true),
  ('gender_equity','CURRICULUM_INTENT',true),
  ('generic_skill_descriptor','CURRICULUM_INTENT',true),
  ('graduate_profile','CURRICULUM_INTENT',true),
  ('implementation_guidance','SOURCE_INTERPRETATION',false),
  ('inclusion_mixed_ability','CURRICULUM_INTENT',true),
  ('key_learning_outcome','CURRICULUM_INTENT',true),
  ('learning_environment','CURRICULUM_INTENT',true),
  ('subject_menu','CURRICULUM_STRUCTURE',true),
  ('subject_rationale','CURRICULUM_INTENT',true),
  ('subject_rationale_table','CURRICULUM_INTENT',true),
  ('subject_time_allocation','CURRICULUM_STRUCTURE',true),
  ('teaching_learning_principle','CURRICULUM_INTENT',true),
  ('time_allocation_guidance','CURRICULUM_STRUCTURE',true)
  ,('note','SOURCE_INTERPRETATION',false)
on conflict (record_type) do nothing;

-- Preserve pre-existing rows without allowing unknown types to become
-- production authority. New rows must be explicitly registered above or by a
-- reviewed taxonomy change.
insert into public.knowledge_record_taxonomy (record_type, domain, authority_eligible)
select distinct record_type, 'LEGACY_CANDIDATE', false
from public.knowledge_records
where record_type is not null
on conflict (record_type) do nothing;

alter table public.knowledge_records
  add constraint knowledge_records_record_type_fk
  foreign key (record_type) references public.knowledge_record_taxonomy (record_type) not valid;

create unique index knowledge_records_source_record_key_unique on public.knowledge_records (source_id, record_key) where record_key is not null;
create unique index knowledge_records_source_canonical_unique on public.knowledge_records (source_id, canonical_id);

create table public.knowledge_curriculum_subjects (
  id uuid primary key default gen_random_uuid(),
  subject_key text not null unique,
  title text not null,
  education_level text not null check (education_level in ('lower-secondary', 'advanced-secondary', 'cross-level')),
  programme_track text,
  status text not null default 'DRAFT' check (status in ('DRAFT', 'ACTIVE', 'RETIRED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, education_level)
);

create table public.knowledge_curriculum_releases (
  id uuid primary key default gen_random_uuid(),
  release_key text not null unique,
  authority text not null,
  display_name text not null,
  education_level text not null check (education_level in ('lower-secondary', 'advanced-secondary', 'cross-level')),
  version_label text not null,
  effective_from date not null,
  effective_to date,
  status text not null default 'DRAFT' check (status in ('DRAFT', 'REVIEW', 'ACTIVE', 'SUPERSEDED', 'RETIRED')),
  supersedes_release_id uuid references public.knowledge_curriculum_releases(id),
  manifest_checksum_sha256 text not null check (manifest_checksum_sha256 ~* '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  created_by uuid,
  activated_at timestamptz,
  activated_by uuid,
  unique (id, education_level),
  check (effective_to is null or effective_to >= effective_from)
);

create table public.knowledge_subject_profiles (
  id uuid primary key default gen_random_uuid(),
  release_id uuid not null,
  governed_subject_id uuid not null,
  profile_key text not null,
  display_title text not null,
  education_level text not null check (education_level in ('lower-secondary', 'advanced-secondary', 'cross-level')),
  programme_track text,
  status text not null default 'DRAFT' check (status in ('DRAFT', 'ACTIVE', 'RETIRED')),
  display_order integer not null default 0,
  requires_assessment_profile boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (release_id, profile_key),
  unique (id, release_id),
  foreign key (release_id, education_level) references public.knowledge_curriculum_releases(id, education_level),
  foreign key (governed_subject_id, education_level) references public.knowledge_curriculum_subjects(id, education_level)
);

create table public.knowledge_release_sources (
  id uuid primary key default gen_random_uuid(),
  release_id uuid not null references public.knowledge_curriculum_releases(id),
  subject_profile_id uuid,
  source_id text not null references public.knowledge_sources(source_id),
  source_role text not null check (source_role in ('FRAMEWORK', 'SUBJECT_SYLLABUS', 'ASSESSMENT_FRAMEWORK', 'SUBJECT_ASSESSMENT_GUIDELINE', 'SUPPORTING_REFERENCE')),
  is_required boolean not null default true,
  precedence_order integer not null default 0,
  status text not null default 'DRAFT' check (status in ('DRAFT', 'APPROVED', 'RETIRED')),
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by uuid,
  unique (release_id, subject_profile_id, source_id, source_role),
  foreign key (subject_profile_id, release_id) references public.knowledge_subject_profiles(id, release_id),
  check ((source_role in ('FRAMEWORK', 'ASSESSMENT_FRAMEWORK') and subject_profile_id is null) or (source_role in ('SUBJECT_SYLLABUS', 'SUBJECT_ASSESSMENT_GUIDELINE') and subject_profile_id is not null) or source_role = 'SUPPORTING_REFERENCE'),
  check (status <> 'APPROVED' or (approved_at is not null and approved_by is not null))
);

create table public.knowledge_profile_records (
  id uuid primary key default gen_random_uuid(),
  release_id uuid not null,
  subject_profile_id uuid not null,
  canonical_id text not null references public.knowledge_records(canonical_id),
  membership_role text not null default 'CURRICULUM' check (membership_role in ('CURRICULUM', 'ASSESSMENT', 'SUPPORTING')),
  ordering_key text,
  status text not null default 'DRAFT' check (status in ('DRAFT', 'APPROVED', 'RETIRED')),
  effective_from date,
  effective_to date,
  approved_at timestamptz,
  approved_by uuid,
  created_at timestamptz not null default now(),
  unique (subject_profile_id, canonical_id),
  foreign key (subject_profile_id, release_id) references public.knowledge_subject_profiles(id, release_id),
  check (effective_to is null or effective_from is not null and effective_to >= effective_from),
  check (status <> 'APPROVED' or (approved_at is not null and approved_by is not null))
);

create table public.knowledge_assessment_profiles (
  id uuid primary key default gen_random_uuid(),
  release_id uuid not null references public.knowledge_curriculum_releases(id),
  subject_profile_id uuid,
  assessment_key text not null,
  display_title text not null,
  purpose text not null,
  regime text not null,
  composition_mode text not null default 'FRAMEWORK_THEN_SUBJECT' check (composition_mode in ('FRAMEWORK_THEN_SUBJECT', 'SOURCE_PRECEDENCE')),
  applicable_source_roles text[] not null default array['ASSESSMENT_FRAMEWORK']::text[],
  status text not null default 'DRAFT' check (status in ('DRAFT', 'ACTIVE', 'RETIRED')),
  created_at timestamptz not null default now(),
  unique (release_id, assessment_key),
  foreign key (subject_profile_id, release_id) references public.knowledge_subject_profiles(id, release_id),
  check (applicable_source_roles <@ array['FRAMEWORK', 'SUBJECT_SYLLABUS', 'ASSESSMENT_FRAMEWORK', 'SUBJECT_ASSESSMENT_GUIDELINE', 'SUPPORTING_REFERENCE']::text[])
);

create table public.knowledge_conflicts (
  id uuid primary key default gen_random_uuid(),
  release_id uuid not null references public.knowledge_curriculum_releases(id),
  subject_profile_id uuid,
  category text not null,
  status text not null default 'OPEN' check (status in ('OPEN', 'RESOLVED', 'ACCEPTED_OVERRIDE')),
  summary text not null,
  resolution_text text,
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (subject_profile_id, release_id) references public.knowledge_subject_profiles(id, release_id),
  check ((status = 'OPEN' and resolved_by is null and resolved_at is null) or (status <> 'OPEN' and resolved_by is not null and resolved_at is not null)),
  check (status = 'OPEN' or resolution_text is not null)
);

create table public.knowledge_conflict_items (
  id uuid primary key default gen_random_uuid(),
  conflict_id uuid not null references public.knowledge_conflicts(id),
  item_type text not null check (item_type in ('RECORD', 'SOURCE', 'SPAN')),
  canonical_id text references public.knowledge_records(canonical_id),
  source_id text references public.knowledge_sources(source_id),
  span_id text references public.knowledge_source_spans(span_id),
  item_role text not null check (item_role in ('CLAIM_A', 'CLAIM_B', 'CONTEXT')),
  notes text,
  created_at timestamptz not null default now(),
  check (((canonical_id is not null)::integer + (source_id is not null)::integer + (span_id is not null)::integer) = 1),
  check ((item_type = 'RECORD' and canonical_id is not null) or (item_type = 'SOURCE' and source_id is not null) or (item_type = 'SPAN' and span_id is not null))
);

create table public.knowledge_verification_decisions (
  decision_id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('SOURCE', 'SPAN', 'RECORD', 'RELATIONSHIP')),
  entity_id text not null,
  resulting_status text not null check (resulting_status in ('UNVERIFIED', 'REVIEW_REQUIRED', 'VERIFIED')),
  actor_user_id uuid not null,
  decided_at timestamptz not null default now(),
  reason text not null,
  evidence_reference text,
  source_version_context text
);

create table public.knowledge_rights_decisions (
  decision_id uuid primary key default gen_random_uuid(),
  source_id text not null references public.knowledge_sources(source_id),
  source_checksum_sha256 text not null check (source_checksum_sha256 ~* '^[0-9a-f]{64}$'),
  rights_status text not null check (rights_status in ('CLEARED', 'REVIEW_REQUIRED', 'RESTRICTED', 'UNKNOWN')),
  production_use_status text not null check (production_use_status in ('PERMITTED', 'PERMISSION_PENDING', 'BLOCKED')),
  external_ai_allowed boolean not null default false,
  formal_artifact_allowed boolean not null default false,
  export_allowed boolean not null default false,
  attribution_required boolean not null default true,
  decision_source text not null,
  evidence_reference text,
  actor_user_id uuid not null,
  decided_at timestamptz not null default now(),
  review_expires_at date,
  notes text,
  check (production_use_status <> 'PERMITTED' or rights_status = 'CLEARED'),
  check ((not external_ai_allowed and not formal_artifact_allowed and not export_allowed) or (rights_status = 'CLEARED' and production_use_status = 'PERMITTED'))
);

create table public.knowledge_record_identity_mappings (
  mapping_id uuid primary key default gen_random_uuid(),
  source_id text not null references public.knowledge_sources(source_id),
  source_checksum_sha256 text not null check (source_checksum_sha256 ~* '^[0-9a-f]{64}$'),
  candidate_id text not null,
  importer_version text not null,
  schema_version text not null,
  candidate_content_sha256 text not null check (candidate_content_sha256 ~* '^[0-9a-f]{64}$'),
  canonical_id text not null references public.knowledge_records(canonical_id),
  created_at timestamptz not null default now(),
  unique (source_id, source_checksum_sha256, candidate_id, importer_version, schema_version, candidate_content_sha256),
  foreign key (source_id, canonical_id) references public.knowledge_records(source_id, canonical_id)
);

create unique index knowledge_record_identity_logical_unique
  on public.knowledge_record_identity_mappings (source_id, source_checksum_sha256, candidate_id, importer_version, schema_version);

create table public.knowledge_release_activation_runs (
  activation_run_id uuid primary key default gen_random_uuid(),
  release_id uuid not null references public.knowledge_curriculum_releases(id),
  actor_user_id uuid not null,
  checked_at timestamptz not null default now(),
  activated boolean not null,
  report jsonb not null,
  report_sha256 text not null check (report_sha256 ~* '^[0-9a-f]{64}$')
);

create index knowledge_subject_profiles_release_idx on public.knowledge_subject_profiles (release_id, status, display_order);
create index knowledge_release_sources_lookup_idx on public.knowledge_release_sources (release_id, subject_profile_id, source_id, status);
create unique index knowledge_release_sources_release_unique on public.knowledge_release_sources (release_id, source_id, source_role) where subject_profile_id is null;
create index knowledge_profile_records_lookup_idx on public.knowledge_profile_records (subject_profile_id, status, ordering_key, canonical_id);
create index knowledge_assessment_profiles_lookup_idx on public.knowledge_assessment_profiles (release_id, subject_profile_id, status);
create index knowledge_conflicts_scope_idx on public.knowledge_conflicts (release_id, subject_profile_id, status);
create index knowledge_verification_decisions_entity_idx on public.knowledge_verification_decisions (entity_type, entity_id, decided_at desc);
create index knowledge_rights_decisions_source_idx on public.knowledge_rights_decisions (source_id, source_checksum_sha256, decided_at desc, decision_id desc);
create index knowledge_release_activation_runs_release_idx on public.knowledge_release_activation_runs (release_id, checked_at desc);

create or replace function private.prevent_knowledge_decision_mutation()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  raise exception 'knowledge governance decision history is append-only';
end;
$$;

create trigger knowledge_verification_decisions_append_only
before update or delete on public.knowledge_verification_decisions
for each row execute function private.prevent_knowledge_decision_mutation();

create trigger knowledge_rights_decisions_append_only
before update or delete on public.knowledge_rights_decisions
for each row execute function private.prevent_knowledge_decision_mutation();

create or replace function private.prevent_unaudited_knowledge_verification()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if tg_op = 'INSERT' then
    if new.verification_status not in ('UNVERIFIED', 'REVIEW_REQUIRED') and coalesce(current_setting('ate.knowledge_verification_decision', true), '') <> 'true' then
      raise exception 'machine/import candidates may not insert VERIFIED knowledge';
    end if;
  elsif new.verification_status is distinct from old.verification_status and coalesce(current_setting('ate.knowledge_verification_decision', true), '') <> 'true' then
    raise exception 'every knowledge verification transition requires an append-only decision';
  end if;
  return new;
end;
$$;

create trigger knowledge_sources_verification_guard
before insert or update of verification_status on public.knowledge_sources
for each row execute function private.prevent_unaudited_knowledge_verification();

create trigger knowledge_source_spans_verification_guard
before insert or update of verification_status on public.knowledge_source_spans
for each row execute function private.prevent_unaudited_knowledge_verification();

create trigger knowledge_records_verification_guard
before insert or update of verification_status on public.knowledge_records
for each row execute function private.prevent_unaudited_knowledge_verification();

create trigger knowledge_relationships_verification_guard
before insert or update of verification_status on public.knowledge_relationships
for each row execute function private.prevent_unaudited_knowledge_verification();

create or replace function private.prevent_unaudited_knowledge_rights()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if new.production_use_status = 'PERMITTED' and new.rights_status <> 'CLEARED' then
    raise exception 'PERMITTED production use requires CLEARED rights';
  end if;
  if (new.external_ai_allowed or new.formal_artifact_allowed or new.export_allowed) and (new.rights_status <> 'CLEARED' or new.production_use_status <> 'PERMITTED') then
    raise exception 'external AI, formal artifact, and export allowances require CLEARED and PERMITTED rights';
  end if;
  if tg_op = 'INSERT' then
    if (new.rights_status = 'CLEARED' or new.production_use_status = 'PERMITTED' or new.external_ai_allowed or new.formal_artifact_allowed or new.export_allowed or not new.attribution_required) and coalesce(current_setting('ate.knowledge_rights_decision', true), '') <> 'true' then
      raise exception 'authority-elevating rights must be established by an append-only rights decision';
    end if;
  elsif (new.rights_status is distinct from old.rights_status or new.production_use_status is distinct from old.production_use_status or new.external_ai_allowed is distinct from old.external_ai_allowed or new.formal_artifact_allowed is distinct from old.formal_artifact_allowed or new.export_allowed is distinct from old.export_allowed or new.attribution_required is distinct from old.attribution_required) and coalesce(current_setting('ate.knowledge_rights_decision', true), '') <> 'true' then
    raise exception 'every knowledge rights transition requires an append-only decision';
  end if;
  return new;
end;
$$;

create trigger knowledge_sources_rights_guard
before insert or update of rights_status, production_use_status, external_ai_allowed, formal_artifact_allowed, export_allowed, attribution_required on public.knowledge_sources
for each row execute function private.prevent_unaudited_knowledge_rights();

create or replace function private.enforce_knowledge_release_lifecycle()
returns trigger language plpgsql set search_path = public, pg_temp as $$
declare command_name text := coalesce(current_setting('ate.knowledge_governance_command', true), '');
begin
  if tg_op = 'INSERT' and new.status <> 'DRAFT' then
    raise exception 'central knowledge releases/profiles/subjects must be created as DRAFT';
  end if;
  if tg_op = 'UPDATE' and old.status = 'ACTIVE' and new.status in ('ACTIVE', 'SUPERSEDED') and (to_jsonb(new) - 'status' - 'activated_at' - 'activated_by' - 'updated_at') is distinct from (to_jsonb(old) - 'status' - 'activated_at' - 'activated_by' - 'updated_at') then
    raise exception 'active central knowledge meaning is immutable; create a new release/profile';
  end if;
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    if new.status = 'REVIEW' and old.status = 'DRAFT' and command_name = 'SUBMIT_RELEASE_REVIEW' then
      return new;
    end if;
    if new.status = 'ACTIVE' and command_name = 'ACTIVATE_RELEASE' and ((tg_table_name = 'knowledge_curriculum_releases' and old.status = 'REVIEW') or (tg_table_name <> 'knowledge_curriculum_releases' and old.status in ('DRAFT', 'REVIEW'))) then
      return new;
    end if;
    if new.status = 'SUPERSEDED' and old.status = 'ACTIVE' and command_name = 'SUPERSEDE_RELEASE' then
      return new;
    end if;
    if new.status = 'RETIRED' and old.status in ('DRAFT', 'REVIEW', 'SUPERSEDED') and command_name = 'RETIRE_RELEASE' then
      return new;
    end if;
    raise exception 'unauthorised central knowledge lifecycle transition';
  end if;
  return new;
end;
$$;

create trigger knowledge_release_lifecycle_guard
before insert or update on public.knowledge_curriculum_releases
for each row execute function private.enforce_knowledge_release_lifecycle();

create trigger knowledge_profile_lifecycle_guard
before insert or update on public.knowledge_subject_profiles
for each row execute function private.enforce_knowledge_release_lifecycle();

create trigger knowledge_subject_lifecycle_guard
before insert or update on public.knowledge_curriculum_subjects
for each row execute function private.enforce_knowledge_release_lifecycle();

create trigger knowledge_assessment_profile_lifecycle_guard
before insert or update on public.knowledge_assessment_profiles
for each row execute function private.enforce_knowledge_release_lifecycle();

create or replace function private.prevent_active_knowledge_membership_edit()
returns trigger language plpgsql set search_path = public, pg_temp as $$
declare target_release_id uuid;
begin
  if tg_op = 'DELETE' then
    target_release_id := old.release_id;
  elsif tg_op = 'INSERT' then
    target_release_id := new.release_id;
  else
    if exists (select 1 from public.knowledge_curriculum_releases where id = old.release_id and status = 'ACTIVE') or exists (select 1 from public.knowledge_curriculum_releases where id = new.release_id and status = 'ACTIVE') then
      raise exception 'active release membership is immutable; create a new release';
    end if;
    return new;
  end if;
  if exists (select 1 from public.knowledge_curriculum_releases where id = target_release_id and status = 'ACTIVE') then
    raise exception 'active release membership is immutable; create a new release';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger knowledge_release_sources_active_guard
before insert or update or delete on public.knowledge_release_sources
for each row execute function private.prevent_active_knowledge_membership_edit();

create trigger knowledge_subject_profiles_active_guard
before insert or update or delete on public.knowledge_subject_profiles
for each row execute function private.prevent_active_knowledge_membership_edit();

create trigger knowledge_profile_records_active_guard
before insert or update or delete on public.knowledge_profile_records
for each row execute function private.prevent_active_knowledge_membership_edit();

create trigger knowledge_assessment_profiles_active_guard
before insert or update or delete on public.knowledge_assessment_profiles
for each row execute function private.prevent_active_knowledge_membership_edit();

create or replace function private.prevent_active_curriculum_content_mutation()
returns trigger language plpgsql set search_path = public, pg_temp as $$
declare protected boolean := false;
begin
  if tg_table_name = 'knowledge_sources' then
    protected := exists (select 1 from public.knowledge_release_sources rs join public.knowledge_curriculum_releases r on r.id = rs.release_id where rs.source_id = old.source_id and r.status = 'ACTIVE');
    if tg_op = 'DELETE' and protected then raise exception 'academic source content is immutable under an ACTIVE release'; end if;
    if tg_op = 'UPDATE' and protected and (new.source_id is distinct from old.source_id or new.authority is distinct from old.authority or new.title is distinct from old.title or new.document_type is distinct from old.document_type or new.education_level is distinct from old.education_level or new.subject is distinct from old.subject or new.publication_year is distinct from old.publication_year or new.effective_year is distinct from old.effective_year or new.source_version is distinct from old.source_version or new.source_path is distinct from old.source_path or new.source_schema_version is distinct from old.source_schema_version or new.checksum_sha256 is distinct from old.checksum_sha256 or new.effective_from is distinct from old.effective_from or new.effective_to is distinct from old.effective_to) then raise exception 'academic source content is immutable under an ACTIVE release'; end if;
  elsif tg_table_name = 'knowledge_source_spans' then
    protected := exists (select 1 from public.knowledge_profile_records pr join public.knowledge_curriculum_releases r on r.id = pr.release_id join public.knowledge_records kr on kr.canonical_id = pr.canonical_id where r.status = 'ACTIVE' and kr.span_id = old.span_id);
    if tg_op = 'DELETE' and protected then raise exception 'academic source span content is immutable under an ACTIVE release'; end if;
    if tg_op = 'UPDATE' and protected and (new.span_id is distinct from old.span_id or new.source_id is distinct from old.source_id or new.page_start is distinct from old.page_start or new.page_end is distinct from old.page_end or new.locator is distinct from old.locator or new.source_text is distinct from old.source_text or new.content_sha256 is distinct from old.content_sha256 or new.extractor_version is distinct from old.extractor_version or new.schema_version is distinct from old.schema_version) then raise exception 'academic source span content is immutable under an ACTIVE release'; end if;
  elsif tg_table_name = 'knowledge_records' then
    protected := exists (select 1 from public.knowledge_profile_records pr join public.knowledge_curriculum_releases r on r.id = pr.release_id where r.status = 'ACTIVE' and pr.canonical_id = old.canonical_id);
    if tg_op = 'DELETE' and protected then raise exception 'academic record content is immutable under an ACTIVE release'; end if;
    if tg_op = 'UPDATE' and protected and (new.canonical_id is distinct from old.canonical_id or new.source_id is distinct from old.source_id or new.span_id is distinct from old.span_id or new.record_type is distinct from old.record_type or new.education_level is distinct from old.education_level or new.subject is distinct from old.subject or new.source_wording is distinct from old.source_wording or new.normalized is distinct from old.normalized or new.extracted is distinct from old.extracted or new.record_key is distinct from old.record_key or new.content_sha256 is distinct from old.content_sha256 or new.payload_schema_version is distinct from old.payload_schema_version) then raise exception 'academic record content is immutable under an ACTIVE release'; end if;
  elsif tg_table_name = 'knowledge_relationships' then
    protected := exists (select 1 from public.knowledge_profile_records pr join public.knowledge_curriculum_releases r on r.id = pr.release_id where r.status = 'ACTIVE' and (pr.canonical_id = old.from_canonical_id or pr.canonical_id = old.to_canonical_id));
    if tg_op = 'DELETE' and protected then raise exception 'academic relationship content is immutable under an ACTIVE release'; end if;
    if tg_op = 'UPDATE' and protected and (new.relationship_id is distinct from old.relationship_id or new.relationship_type is distinct from old.relationship_type or new.from_canonical_id is distinct from old.from_canonical_id or new.to_canonical_id is distinct from old.to_canonical_id or new.source_id is distinct from old.source_id or new.span_id is distinct from old.span_id) then raise exception 'academic relationship content is immutable under an ACTIVE release'; end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create or replace function private.prevent_source_checksum_change()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if new.checksum_sha256 is distinct from old.checksum_sha256 then raise exception 'source checksum is immutable; create a new source identity'; end if;
  return new;
end;
$$;

create trigger knowledge_sources_content_guard before update or delete on public.knowledge_sources for each row execute function private.prevent_active_curriculum_content_mutation();
create trigger knowledge_source_spans_content_guard before update or delete on public.knowledge_source_spans for each row execute function private.prevent_active_curriculum_content_mutation();
create trigger knowledge_records_content_guard before update or delete on public.knowledge_records for each row execute function private.prevent_active_curriculum_content_mutation();
create trigger knowledge_relationships_content_guard before update or delete on public.knowledge_relationships for each row execute function private.prevent_active_curriculum_content_mutation();
create trigger knowledge_sources_checksum_guard before update of checksum_sha256 on public.knowledge_sources for each row execute function private.prevent_source_checksum_change();

create or replace function private.prevent_active_taxonomy_mutation()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if exists (select 1 from public.knowledge_profile_records pr join public.knowledge_curriculum_releases r on r.id = pr.release_id join public.knowledge_records kr on kr.canonical_id = pr.canonical_id where r.status = 'ACTIVE' and kr.record_type = old.record_type) then
    raise exception 'record taxonomy used by an ACTIVE release is immutable';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger knowledge_record_taxonomy_active_guard
before update or delete on public.knowledge_record_taxonomy
for each row execute function private.prevent_active_taxonomy_mutation();

create or replace function private.prevent_conflict_evidence_mutation()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if tg_table_name = 'knowledge_conflict_items' then
    raise exception 'conflict evidence is append-only';
  end if;
  if tg_op = 'DELETE' then
    raise exception 'conflicts cannot be deleted; resolve them instead';
  end if;
  if tg_op = 'UPDATE' and coalesce(current_setting('ate.knowledge_conflict_resolution', true), '') <> 'true' then
    raise exception 'conflict resolution requires the controlled resolution command';
  end if;
  if tg_op = 'UPDATE' and old.status <> 'OPEN' then
    raise exception 'resolved conflict evidence is immutable';
  end if;
  if tg_op = 'UPDATE' and (new.status not in ('RESOLVED', 'ACCEPTED_OVERRIDE') or new.resolution_text is null or new.resolved_by is null or new.resolved_at is null) then
    raise exception 'conflict resolution requires status, actor, timestamp, and resolution text';
  end if;
  return new;
end;
$$;

drop trigger if exists knowledge_conflicts_evidence_guard on public.knowledge_conflicts;
create trigger knowledge_conflicts_evidence_guard
before insert or update or delete on public.knowledge_conflicts
for each row execute function private.prevent_conflict_evidence_mutation();

create trigger knowledge_conflict_items_evidence_guard
before update or delete on public.knowledge_conflict_items
for each row execute function private.prevent_conflict_evidence_mutation();

create or replace function public.resolve_knowledge_conflict(
  p_conflict_id uuid,
  p_status text,
  p_actor_user_id uuid,
  p_reason text,
  p_resolution_text text
) returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if p_status not in ('RESOLVED', 'ACCEPTED_OVERRIDE') or p_actor_user_id is null or nullif(trim(p_reason), '') is null or nullif(trim(p_resolution_text), '') is null then
    raise exception 'conflict resolution requires an accepted status, actor, reason, and resolution';
  end if;
  perform set_config('ate.knowledge_conflict_resolution', 'true', true);
  update public.knowledge_conflicts set status = p_status, resolved_by = p_actor_user_id, resolved_at = now(), resolution_text = p_resolution_text, summary = summary || ' Resolution reason: ' || p_reason where id = p_conflict_id and status = 'OPEN';
  if not found then raise exception 'open knowledge conflict not found'; end if;
end;
$$;

create or replace function public.record_knowledge_verification_decision(
  p_entity_type text,
  p_entity_id text,
  p_resulting_status text,
  p_actor_user_id uuid,
  p_reason text,
  p_evidence_reference text default null,
  p_source_version_context text default null
) returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare decision_id uuid;
begin
  if p_entity_type not in ('SOURCE', 'SPAN', 'RECORD', 'RELATIONSHIP') then raise exception 'invalid knowledge verification entity type'; end if;
  if p_resulting_status not in ('UNVERIFIED', 'REVIEW_REQUIRED', 'VERIFIED') then raise exception 'invalid knowledge verification status'; end if;
  if p_actor_user_id is null or nullif(trim(p_reason), '') is null then raise exception 'verification actor and reason are required'; end if;

  perform set_config('ate.knowledge_verification_decision', 'true', true);
  insert into public.knowledge_verification_decisions (entity_type, entity_id, resulting_status, actor_user_id, reason, evidence_reference, source_version_context)
  values (p_entity_type, p_entity_id, p_resulting_status, p_actor_user_id, p_reason, p_evidence_reference, p_source_version_context)
  returning knowledge_verification_decisions.decision_id into decision_id;

  if p_entity_type = 'SOURCE' then
    update public.knowledge_sources set verification_status = p_resulting_status, verified_by = p_actor_user_id, verified_at = now(), verification_reason = p_reason where source_id = p_entity_id;
  elsif p_entity_type = 'SPAN' then
    update public.knowledge_source_spans set verification_status = p_resulting_status, verified_by = p_actor_user_id, verified_at = now(), verification_reason = p_reason where span_id = p_entity_id;
  elsif p_entity_type = 'RECORD' then
    update public.knowledge_records set verification_status = p_resulting_status, verified_by = p_actor_user_id, verified_at = now(), verification_reason = p_reason where canonical_id = p_entity_id;
  else
    update public.knowledge_relationships set verification_status = p_resulting_status, verified_by = p_actor_user_id, verified_at = now(), verification_reason = p_reason where relationship_id = p_entity_id;
  end if;

  if not found then raise exception 'knowledge verification entity not found'; end if;
  return decision_id;
end;
$$;

create or replace function public.record_knowledge_rights_decision(
  p_source_id text,
  p_rights_status text,
  p_production_use_status text,
  p_external_ai_allowed boolean,
  p_formal_artifact_allowed boolean,
  p_export_allowed boolean,
  p_attribution_required boolean,
  p_decision_source text,
  p_actor_user_id uuid,
  p_evidence_reference text default null,
  p_review_expires_at date default null,
  p_notes text default null
) returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare decision_id uuid; checksum text;
begin
  if p_rights_status not in ('CLEARED', 'REVIEW_REQUIRED', 'RESTRICTED', 'UNKNOWN') then raise exception 'invalid knowledge rights status'; end if;
  if p_production_use_status not in ('PERMITTED', 'PERMISSION_PENDING', 'BLOCKED') then raise exception 'invalid knowledge production-use status'; end if;
  if p_actor_user_id is null or nullif(trim(p_decision_source), '') is null then raise exception 'rights decision source and actor are required'; end if;
  select checksum_sha256 into checksum from public.knowledge_sources where source_id = p_source_id;
  if checksum is null then raise exception 'knowledge rights source not found'; end if;

  perform set_config('ate.knowledge_rights_decision', 'true', true);
  insert into public.knowledge_rights_decisions (source_id, source_checksum_sha256, rights_status, production_use_status, external_ai_allowed, formal_artifact_allowed, export_allowed, attribution_required, decision_source, evidence_reference, actor_user_id, review_expires_at, notes)
  values (p_source_id, checksum, p_rights_status, p_production_use_status, p_external_ai_allowed, p_formal_artifact_allowed, p_export_allowed, p_attribution_required, p_decision_source, p_evidence_reference, p_actor_user_id, p_review_expires_at, p_notes)
  returning knowledge_rights_decisions.decision_id into decision_id;

  update public.knowledge_sources
  set rights_status = p_rights_status,
      production_use_status = p_production_use_status,
      external_ai_allowed = p_external_ai_allowed,
      formal_artifact_allowed = p_formal_artifact_allowed,
      export_allowed = p_export_allowed,
      attribution_required = p_attribution_required
  where source_id = p_source_id;
  return decision_id;
end;
$$;

-- Central knowledge is server-only. There are no browser policies by design.
alter table public.knowledge_sources enable row level security;
alter table public.knowledge_source_spans enable row level security;
alter table public.knowledge_records enable row level security;
alter table public.knowledge_relationships enable row level security;
alter table public.knowledge_legacy_id_mappings enable row level security;
alter table public.knowledge_import_runs enable row level security;
alter table public.knowledge_record_taxonomy enable row level security;
alter table public.knowledge_curriculum_subjects enable row level security;
alter table public.knowledge_curriculum_releases enable row level security;
alter table public.knowledge_subject_profiles enable row level security;
alter table public.knowledge_release_sources enable row level security;
alter table public.knowledge_profile_records enable row level security;
alter table public.knowledge_assessment_profiles enable row level security;
alter table public.knowledge_conflicts enable row level security;
alter table public.knowledge_conflict_items enable row level security;
alter table public.knowledge_verification_decisions enable row level security;
alter table public.knowledge_rights_decisions enable row level security;
alter table public.knowledge_record_identity_mappings enable row level security;
alter table public.knowledge_release_activation_runs enable row level security;

revoke all privileges on table public.knowledge_sources, public.knowledge_source_spans, public.knowledge_records, public.knowledge_relationships, public.knowledge_legacy_id_mappings, public.knowledge_import_runs, public.knowledge_record_taxonomy, public.knowledge_curriculum_subjects, public.knowledge_curriculum_releases, public.knowledge_subject_profiles, public.knowledge_release_sources, public.knowledge_profile_records, public.knowledge_assessment_profiles, public.knowledge_conflicts, public.knowledge_conflict_items, public.knowledge_verification_decisions, public.knowledge_rights_decisions, public.knowledge_record_identity_mappings, public.knowledge_release_activation_runs from public;

do $$
declare role_name text;
begin
  foreach role_name in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = role_name) then
      execute format('revoke all privileges on table public.knowledge_sources, public.knowledge_source_spans, public.knowledge_records, public.knowledge_relationships, public.knowledge_legacy_id_mappings, public.knowledge_import_runs, public.knowledge_record_taxonomy, public.knowledge_curriculum_subjects, public.knowledge_curriculum_releases, public.knowledge_subject_profiles, public.knowledge_release_sources, public.knowledge_profile_records, public.knowledge_assessment_profiles, public.knowledge_conflicts, public.knowledge_conflict_items, public.knowledge_verification_decisions, public.knowledge_rights_decisions, public.knowledge_record_identity_mappings, public.knowledge_release_activation_runs from %I', role_name);
    end if;
  end loop;
end;
$$;

revoke all on function public.record_knowledge_verification_decision(text, text, text, uuid, text, text, text) from public;
revoke all on function public.record_knowledge_rights_decision(text, text, text, boolean, boolean, boolean, boolean, text, uuid, text, date, text) from public;
revoke all on function public.resolve_knowledge_conflict(uuid, text, uuid, text, text) from public;

do $$
declare role_name text;
begin
  foreach role_name in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = role_name) then
      execute format('revoke all on function public.record_knowledge_verification_decision(text, text, text, uuid, text, text, text) from %I', role_name);
      execute format('revoke all on function public.record_knowledge_rights_decision(text, text, text, boolean, boolean, boolean, boolean, text, uuid, text, date, text) from %I', role_name);
      execute format('revoke all on function public.resolve_knowledge_conflict(uuid, text, uuid, text, text) from %I', role_name);
    end if;
  end loop;
end;
$$;

-- Step 6 completion: runtime eligibility is an academic-operational projection,
-- deliberately independent from legal rights and redistribution permissions.
alter table public.knowledge_subject_profiles
  add column runtime_status text not null default 'CANDIDATE'
    check (runtime_status in ('CANDIDATE', 'ACADEMICALLY_VERIFIED', 'PILOT_ACTIVE', 'RETIRED'));

alter table public.knowledge_profile_records
  add column runtime_status text not null default 'CANDIDATE'
    check (runtime_status in ('CANDIDATE', 'ACADEMICALLY_VERIFIED', 'PILOT_ACTIVE', 'RETIRED'));

create or replace function private.enforce_knowledge_release_lifecycle()
returns trigger language plpgsql set search_path = public, pg_temp as $$
declare command_name text := coalesce(current_setting('ate.knowledge_governance_command', true), '');
begin
  if tg_op = 'INSERT' and new.status <> 'DRAFT' then raise exception 'central knowledge releases/profiles/subjects must be created as DRAFT'; end if;
  if tg_op = 'UPDATE' and old.status = 'ACTIVE' and new.status in ('ACTIVE', 'SUPERSEDED') and (to_jsonb(new) - 'status' - 'activated_at' - 'activated_by' - 'updated_at' - 'runtime_status') is distinct from (to_jsonb(old) - 'status' - 'activated_at' - 'activated_by' - 'updated_at' - 'runtime_status') then
    raise exception 'active central knowledge meaning is immutable; create a new release/profile';
  end if;
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    if new.status = 'REVIEW' and old.status = 'DRAFT' and command_name = 'SUBMIT_RELEASE_REVIEW' then return new; end if;
    if new.status = 'ACTIVE' and command_name = 'ACTIVATE_RELEASE' and ((tg_table_name = 'knowledge_curriculum_releases' and old.status = 'REVIEW') or (tg_table_name <> 'knowledge_curriculum_releases' and old.status in ('DRAFT','REVIEW'))) then return new; end if;
    if new.status = 'SUPERSEDED' and old.status = 'ACTIVE' and command_name = 'SUPERSEDE_RELEASE' then return new; end if;
    if new.status = 'RETIRED' and old.status in ('DRAFT','REVIEW','SUPERSEDED') and command_name = 'RETIRE_RELEASE' then return new; end if;
    raise exception 'unauthorised central knowledge lifecycle transition';
  end if;
  return new;
end;
$$;

create table public.knowledge_runtime_decisions (
  decision_id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('SUBJECT_PROFILE', 'PROFILE_RECORD')),
  entity_id text not null,
  previous_status text not null check (previous_status in ('CANDIDATE', 'ACADEMICALLY_VERIFIED', 'PILOT_ACTIVE', 'RETIRED')),
  resulting_status text not null check (resulting_status in ('CANDIDATE', 'ACADEMICALLY_VERIFIED', 'PILOT_ACTIVE', 'RETIRED')),
  actor_user_id uuid not null,
  decided_at timestamptz not null default now(),
  reason text not null,
  evidence_reference text
);
create index knowledge_runtime_decisions_entity_idx on public.knowledge_runtime_decisions (entity_type, entity_id, decided_at desc, decision_id desc);

create or replace function private.prevent_runtime_decision_mutation()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin raise exception 'knowledge runtime decision history is append-only'; end;
$$;
create trigger knowledge_runtime_decisions_append_only
before update or delete on public.knowledge_runtime_decisions
for each row execute function private.prevent_runtime_decision_mutation();

create or replace function private.prevent_unaudited_runtime_change()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if new.runtime_status is distinct from old.runtime_status
     and coalesce(current_setting('ate.knowledge_runtime_decision', true), '') <> 'true' then
    raise exception 'runtime eligibility changes require the controlled runtime decision command';
  end if;
  return new;
end;
$$;
create trigger knowledge_subject_profiles_runtime_guard
before update of runtime_status on public.knowledge_subject_profiles
for each row execute function private.prevent_unaudited_runtime_change();
create trigger knowledge_profile_records_runtime_guard
before update of runtime_status on public.knowledge_profile_records
for each row execute function private.prevent_unaudited_runtime_change();

-- Runtime-only changes are permitted after academic composition is active. Any
-- change to release/profile/source/membership meaning remains immutable.
create or replace function private.prevent_active_knowledge_membership_edit()
returns trigger language plpgsql set search_path = public, pg_temp as $$
declare target_release_id uuid;
begin
  if tg_op = 'DELETE' then
    target_release_id := old.release_id;
  elsif tg_op = 'INSERT' then
    target_release_id := new.release_id;
  else
    target_release_id := old.release_id;
    if old.release_id is distinct from new.release_id then
      raise exception 'active release membership is immutable; create a new release';
    end if;
    if exists (select 1 from public.knowledge_curriculum_releases where id = target_release_id and status = 'ACTIVE')
       and tg_table_name in ('knowledge_subject_profiles', 'knowledge_profile_records')
       and coalesce(current_setting('ate.knowledge_runtime_decision', true), '') = 'true'
       and (to_jsonb(new) - 'runtime_status' - 'updated_at') = (to_jsonb(old) - 'runtime_status' - 'updated_at') then
      return new;
    end if;
  end if;
  if exists (select 1 from public.knowledge_curriculum_releases where id = target_release_id and status = 'ACTIVE') then
    raise exception 'active release membership is immutable; create a new release';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

alter table public.knowledge_conflicts add column resolution_reason text;
create or replace function private.prevent_conflict_evidence_mutation()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if tg_table_name = 'knowledge_conflict_items' then raise exception 'conflict evidence is append-only'; end if;
  if tg_op = 'INSERT' then
    if new.status <> 'OPEN' then raise exception 'new conflicts must start OPEN'; end if;
    return new;
  end if;
  if tg_op = 'DELETE' then raise exception 'conflicts cannot be deleted; resolve them instead'; end if;
  if coalesce(current_setting('ate.knowledge_conflict_resolution', true), '') <> 'true' then raise exception 'conflict resolution requires the controlled resolution command'; end if;
  if old.status <> 'OPEN' then raise exception 'resolved conflict evidence is immutable'; end if;
  if new.summary is distinct from old.summary or new.release_id is distinct from old.release_id or new.subject_profile_id is distinct from old.subject_profile_id or new.category is distinct from old.category or new.created_at is distinct from old.created_at then
    raise exception 'conflict summary and scope are immutable';
  end if;
  if new.status not in ('RESOLVED', 'ACCEPTED_OVERRIDE') or new.resolution_text is null or new.resolution_reason is null or new.resolved_by is null or new.resolved_at is null then
    raise exception 'conflict resolution requires status, actor, timestamp, reason, and resolution text';
  end if;
  return new;
end;
$$;

create or replace function public.resolve_knowledge_conflict(
  p_conflict_id uuid, p_status text, p_actor_user_id uuid, p_reason text, p_resolution_text text
) returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if p_status not in ('RESOLVED', 'ACCEPTED_OVERRIDE') or p_actor_user_id is null or nullif(trim(p_reason), '') is null or nullif(trim(p_resolution_text), '') is null then
    raise exception 'conflict resolution requires an accepted status, actor, reason, and resolution';
  end if;
  perform set_config('ate.knowledge_conflict_resolution', 'true', true);
  update public.knowledge_conflicts
    set status = p_status, resolved_by = p_actor_user_id, resolved_at = now(), resolution_text = p_resolution_text, resolution_reason = p_reason
    where id = p_conflict_id and status = 'OPEN';
  if not found then raise exception 'open knowledge conflict not found'; end if;
end;
$$;

create or replace function public.record_knowledge_runtime_decision(
  p_entity_type text, p_entity_id text, p_resulting_status text, p_actor_user_id uuid, p_reason text, p_evidence_reference text default null
) returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare previous_status text; decision_id uuid;
begin
  if p_entity_type not in ('SUBJECT_PROFILE', 'PROFILE_RECORD') or p_resulting_status not in ('CANDIDATE', 'ACADEMICALLY_VERIFIED', 'PILOT_ACTIVE', 'RETIRED') or p_actor_user_id is null or nullif(trim(p_reason), '') is null then
    raise exception 'invalid runtime decision';
  end if;
  if p_resulting_status = 'PILOT_ACTIVE' and coalesce(current_setting('ate.knowledge_pilot_activation', true), '') <> 'true' then
    raise exception 'PILOT_ACTIVE requires the controlled pilot activation command';
  end if;
  if p_entity_type = 'SUBJECT_PROFILE' then
    select runtime_status into previous_status from public.knowledge_subject_profiles where id = p_entity_id::uuid for update;
  else
    select runtime_status into previous_status from public.knowledge_profile_records where id = p_entity_id::uuid for update;
  end if;
  if previous_status is null then raise exception 'runtime entity not found'; end if;
  perform set_config('ate.knowledge_runtime_decision', 'true', true);
  insert into public.knowledge_runtime_decisions(entity_type, entity_id, previous_status, resulting_status, actor_user_id, reason, evidence_reference)
    values(p_entity_type, p_entity_id, previous_status, p_resulting_status, p_actor_user_id, p_reason, p_evidence_reference)
    returning knowledge_runtime_decisions.decision_id into decision_id;
  if p_entity_type = 'SUBJECT_PROFILE' then
    update public.knowledge_subject_profiles set runtime_status = p_resulting_status where id = p_entity_id::uuid;
  else
    update public.knowledge_profile_records set runtime_status = p_resulting_status where id = p_entity_id::uuid;
  end if;
  return decision_id;
end;
$$;

create or replace function public.activate_knowledge_profile_pilot(
  p_subject_profile_id uuid, p_actor_user_id uuid, p_reason text
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare profile record; candidate record; report jsonb := jsonb_build_object('profileId', p_subject_profile_id, 'activated', false); count_records integer; total_records integer;
begin
  if p_actor_user_id is null or nullif(trim(p_reason), '') is null then raise exception 'pilot activation actor and reason are required'; end if;
  select p.*, r.status as release_status into profile from public.knowledge_subject_profiles p join public.knowledge_curriculum_releases r on r.id=p.release_id where p.id=p_subject_profile_id for update;
  if not found then raise exception 'subject profile not found'; end if;
  if profile.release_status <> 'ACTIVE' or profile.status <> 'ACTIVE' then raise exception 'pilot activation requires an ACTIVE academic release and profile'; end if;
  if exists(select 1 from public.knowledge_conflicts c where c.release_id=profile.release_id and c.status='OPEN' and (c.subject_profile_id is null or c.subject_profile_id=p_subject_profile_id)) then raise exception 'open conflict blocks pilot activation'; end if;
  select count(*) into total_records from public.knowledge_profile_records where subject_profile_id=p_subject_profile_id and status='APPROVED';
  if total_records = 0 then raise exception 'pilot activation requires at least one approved profile record'; end if;
  select count(*) into count_records from public.knowledge_profile_records pr join public.knowledge_records r on r.canonical_id=pr.canonical_id join public.knowledge_source_spans sp on sp.span_id=r.span_id and sp.source_id=r.source_id where pr.subject_profile_id=p_subject_profile_id and pr.status='APPROVED' and (pr.runtime_status not in ('CANDIDATE','ACADEMICALLY_VERIFIED') or r.verification_status <> 'VERIFIED' or sp.verification_status <> 'VERIFIED' or not exists(select 1 from public.knowledge_verification_decisions d where d.entity_type='RECORD' and d.entity_id=r.canonical_id and d.resulting_status='VERIFIED') or not exists(select 1 from public.knowledge_verification_decisions d where d.entity_type='SPAN' and d.entity_id=sp.span_id and d.resulting_status='VERIFIED') or exists(select 1 from public.knowledge_relationships rel where (rel.from_canonical_id=r.canonical_id or rel.to_canonical_id=r.canonical_id) and (rel.verification_status <> 'VERIFIED' or not exists(select 1 from public.knowledge_verification_decisions d where d.entity_type='RELATIONSHIP' and d.entity_id=rel.relationship_id and d.resulting_status='VERIFIED'))));
  if count_records > 0 then raise exception 'pilot activation requires verified, provenance-complete profile records'; end if;
  perform set_config('ate.knowledge_pilot_activation', 'true', true);
  perform public.record_knowledge_runtime_decision('SUBJECT_PROFILE', p_subject_profile_id::text, 'PILOT_ACTIVE', p_actor_user_id, p_reason, null);
  for candidate in select pr.id from public.knowledge_profile_records pr where pr.subject_profile_id=p_subject_profile_id and pr.status='APPROVED' and pr.runtime_status in ('CANDIDATE','ACADEMICALLY_VERIFIED') loop
    perform public.record_knowledge_runtime_decision('PROFILE_RECORD', candidate.id::text, 'PILOT_ACTIVE', p_actor_user_id, p_reason, null);
  end loop;
  return jsonb_build_object('profileId', p_subject_profile_id, 'activated', true, 'rightsIndependent', true);
end;
$$;

-- The immutable audit records cannot be edited or deleted, including by a
-- service-role client outside the narrow command path.
create trigger knowledge_release_activation_runs_append_only before update or delete on public.knowledge_release_activation_runs for each row execute function private.prevent_knowledge_decision_mutation();
create trigger knowledge_record_identity_mappings_append_only before update or delete on public.knowledge_record_identity_mappings for each row execute function private.prevent_knowledge_decision_mutation();
create trigger knowledge_legacy_id_mappings_append_only before update or delete on public.knowledge_legacy_id_mappings for each row execute function private.prevent_knowledge_decision_mutation();

alter table public.knowledge_release_activation_runs enable row level security;
alter table public.knowledge_runtime_decisions enable row level security;

create table public.school_subject_curriculum_bindings (
  id uuid primary key default gen_random_uuid(), school_id uuid not null, school_subject_id uuid not null, subject_profile_id uuid not null references public.knowledge_subject_profiles(id), effective_from date not null, effective_to date, status text not null default 'ACTIVE' check(status in ('ACTIVE','RETIRED')), bound_by uuid not null, created_at timestamptz not null default now(), retired_at timestamptz, unique (id, school_id), check(effective_to is null or effective_to >= effective_from)
);
create table public.teaching_section_curriculum_bindings (
  id uuid primary key default gen_random_uuid(), school_id uuid not null, teaching_section_id uuid not null, subject_profile_id uuid not null references public.knowledge_subject_profiles(id), effective_from date not null, effective_to date, status text not null default 'ACTIVE' check(status in ('ACTIVE','RETIRED')), bound_by uuid not null, created_at timestamptz not null default now(), retired_at timestamptz, unique (id, school_id), check(effective_to is null or effective_to >= effective_from)
);
create table public.teaching_section_curriculum_position_events (
  id uuid primary key default gen_random_uuid(), school_id uuid not null, teaching_section_id uuid not null, subject_profile_id uuid not null references public.knowledge_subject_profiles(id), canonical_id text not null references public.knowledge_records(canonical_id), position_kind text not null check(position_kind in ('TOPIC','LEARNING_OUTCOME','CURRICULAR_UNIT')), confirmed_by uuid not null, confirmed_at timestamptz not null default now(), supersedes_event_id uuid references public.teaching_section_curriculum_position_events(id), correction_reason text, unique (id, school_id)
);

do $$ begin
  if to_regclass('public.school_subjects') is not null then
    alter table public.school_subject_curriculum_bindings add constraint school_subject_curriculum_bindings_subject_fk foreign key (school_subject_id, school_id) references public.school_subjects(id, school_id);
  end if;
  if to_regclass('public.teaching_sections') is not null then
    alter table public.teaching_section_curriculum_bindings add constraint teaching_section_curriculum_bindings_section_fk foreign key (teaching_section_id, school_id) references public.teaching_sections(id, school_id);
    alter table public.teaching_section_curriculum_position_events add constraint teaching_section_curriculum_position_events_section_fk foreign key (teaching_section_id, school_id) references public.teaching_sections(id, school_id);
  end if;
end $$;
create index school_subject_curriculum_bindings_lookup_idx on public.school_subject_curriculum_bindings(school_id, school_subject_id, status, effective_from);
create index teaching_section_curriculum_bindings_lookup_idx on public.teaching_section_curriculum_bindings(school_id, teaching_section_id, status, effective_from);
create index teaching_section_curriculum_position_events_lookup_idx on public.teaching_section_curriculum_position_events(school_id, teaching_section_id, confirmed_at desc);

create or replace function private.validate_school_curriculum_binding()
returns trigger language plpgsql set search_path = public, pg_temp as $$
declare school_subject_record record; profile record; section_record record; bound_profile uuid;
begin
  select ss.school_id, ss.id into school_subject_record from public.school_subjects ss where ss.id=new.school_subject_id and ss.school_id=new.school_id;
  if not found then raise exception 'school subject does not belong to school'; end if;
  select p.id, p.governed_subject_id, p.education_level, p.runtime_status, p.status into profile from public.knowledge_subject_profiles p where p.id=new.subject_profile_id;
  if not found or profile.status <> 'ACTIVE' or profile.runtime_status <> 'PILOT_ACTIVE' then raise exception 'binding requires a PILOT_ACTIVE subject profile'; end if;
  if tg_table_name = 'school_subject_curriculum_bindings' then return new; end if;
  select ts.school_subject_id into section_record from public.teaching_sections ts where ts.id=new.teaching_section_id and ts.school_id=new.school_id;
  if not found then raise exception 'teaching section does not belong to school'; end if;
  select b.subject_profile_id into bound_profile from public.school_subject_curriculum_bindings b where b.school_id=new.school_id and b.school_subject_id=section_record.school_subject_id and b.status='ACTIVE' and b.effective_from <= new.effective_from and (b.effective_to is null or b.effective_to >= new.effective_from) order by b.effective_from desc limit 1;
  if bound_profile is null or bound_profile <> new.subject_profile_id then raise exception 'teaching section profile must match its school subject binding'; end if;
  return new;
end;
$$;
create trigger school_subject_curriculum_binding_validate before insert or update on public.school_subject_curriculum_bindings for each row execute function private.validate_school_curriculum_binding();
create trigger teaching_section_curriculum_binding_validate before insert or update on public.teaching_section_curriculum_bindings for each row execute function private.validate_school_curriculum_binding();

create or replace function private.validate_curriculum_position_event()
returns trigger language plpgsql set search_path = public, pg_temp as $$
declare section_profile uuid; record_profile uuid; current_teacher uuid;
begin
  select b.subject_profile_id into section_profile from public.teaching_section_curriculum_bindings b where b.school_id=new.school_id and b.teaching_section_id=new.teaching_section_id and b.status='ACTIVE' and b.effective_from <= new.confirmed_at::date and (b.effective_to is null or b.effective_to >= new.confirmed_at::date) order by b.effective_from desc limit 1;
  if section_profile is null or section_profile <> new.subject_profile_id then raise exception 'position profile does not match the active teaching-section binding'; end if;
  select pr.subject_profile_id into record_profile from public.knowledge_profile_records pr where pr.canonical_id=new.canonical_id and pr.subject_profile_id=new.subject_profile_id and pr.status='APPROVED' and pr.runtime_status='PILOT_ACTIVE';
  if record_profile is null then raise exception 'position record is not an active member of the selected subject profile'; end if;
  select m.user_id into current_teacher from public.teaching_sections ts join public.memberships m on m.id=ts.teacher_membership_id and m.school_id=ts.school_id where ts.id=new.teaching_section_id and ts.school_id=new.school_id;
  if current_teacher is not null and current_teacher <> new.confirmed_by and not private.has_school_role(new.school_id, 'DOS') and not private.has_school_role(new.school_id, 'SCHOOL_ADMIN') then raise exception 'only the assigned teacher or an authorised school academic role may confirm a curriculum position'; end if;
  return new;
end;
$$;
create trigger teaching_section_curriculum_position_validate before insert on public.teaching_section_curriculum_position_events for each row execute function private.validate_curriculum_position_event();

alter table public.school_subject_curriculum_bindings enable row level security;
alter table public.teaching_section_curriculum_bindings enable row level security;
alter table public.teaching_section_curriculum_position_events enable row level security;
do $$ begin
  if exists (select 1 from pg_roles where rolname='authenticated') then
    grant select, insert, update on public.school_subject_curriculum_bindings, public.teaching_section_curriculum_bindings, public.teaching_section_curriculum_position_events to authenticated;
    if to_regprocedure('private.is_active_school_member(uuid)') is not null then
      execute 'create policy school_subject_curriculum_bindings_read on public.school_subject_curriculum_bindings for select to authenticated using(private.is_active_school_member(school_id))';
      execute 'create policy teaching_section_curriculum_bindings_read on public.teaching_section_curriculum_bindings for select to authenticated using(private.is_active_school_member(school_id))';
      execute 'create policy teaching_section_curriculum_position_events_read on public.teaching_section_curriculum_position_events for select to authenticated using(private.is_active_school_member(school_id))';
    end if;
    if to_regprocedure('private.has_school_role(uuid,text)') is not null then
      execute 'create policy school_subject_curriculum_bindings_manage on public.school_subject_curriculum_bindings for all to authenticated using(private.has_school_role(school_id,''SCHOOL_ADMIN'') or private.has_school_role(school_id,''DOS'')) with check(private.has_school_role(school_id,''SCHOOL_ADMIN'') or private.has_school_role(school_id,''DOS''))';
      execute 'create policy teaching_section_curriculum_bindings_manage on public.teaching_section_curriculum_bindings for all to authenticated using(private.has_school_role(school_id,''SCHOOL_ADMIN'') or private.has_school_role(school_id,''DOS'')) with check(private.has_school_role(school_id,''SCHOOL_ADMIN'') or private.has_school_role(school_id,''DOS''))';
      execute 'create policy teaching_section_curriculum_position_events_insert on public.teaching_section_curriculum_position_events for insert to authenticated with check(private.is_active_school_member(school_id) and (confirmed_by = auth.uid() or private.has_school_role(school_id,''DOS'') or private.has_school_role(school_id,''SCHOOL_ADMIN'')))';
    end if;
  end if;
end $$;

revoke all on table public.knowledge_runtime_decisions from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname='anon') then revoke all on table public.school_subject_curriculum_bindings, public.teaching_section_curriculum_bindings, public.teaching_section_curriculum_position_events from anon; end if;
end $$;
revoke all on function public.record_knowledge_runtime_decision(text,text,text,uuid,text,text) from public;
revoke all on function public.activate_knowledge_profile_pilot(uuid,uuid,text) from public;

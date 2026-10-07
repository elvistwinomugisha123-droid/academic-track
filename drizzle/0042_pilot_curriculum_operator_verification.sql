-- One auditable operator decision may govern a validated, checksum-bound
-- curriculum dataset. This does not grant assessment runtime eligibility.
create table if not exists public.knowledge_pilot_curriculum_decisions (
  decision_id uuid primary key,
  release_id uuid not null references public.knowledge_curriculum_releases(id),
  manifest_checksum_sha256 text not null check (manifest_checksum_sha256 ~* '^[0-9a-f]{64}$'),
  dataset_checksum_sha256 text not null check (dataset_checksum_sha256 ~* '^[0-9a-f]{64}$'),
  source_checksums jsonb not null check (jsonb_typeof(source_checksums) = 'object'),
  parser_versions jsonb not null check (jsonb_typeof(parser_versions) = 'array'),
  decision_payload jsonb not null,
  decision_payload_sha256 text not null check (decision_payload_sha256 ~* '^[0-9a-f]{64}$'),
  actor_user_id uuid not null,
  decided_at timestamptz not null default now(),
  unique (release_id, manifest_checksum_sha256),
  unique (decision_id, release_id)
);
do $$ begin
  if to_regclass('auth.users') is not null then
    alter table public.knowledge_pilot_curriculum_decisions
      add constraint knowledge_pilot_curriculum_actor_fk foreign key (actor_user_id) references auth.users(id);
  end if;
end $$;

create table if not exists public.knowledge_pilot_curriculum_record_memberships (
  decision_id uuid not null,
  release_id uuid not null,
  subject_profile_id uuid not null,
  canonical_id text not null references public.knowledge_records(canonical_id),
  source_id text not null references public.knowledge_sources(source_id),
  source_checksum_sha256 text not null check (source_checksum_sha256 ~* '^[0-9a-f]{64}$'),
  candidate_id text not null,
  candidate_content_sha256 text not null check (candidate_content_sha256 ~* '^[0-9a-f]{64}$'),
  primary key (decision_id, subject_profile_id, canonical_id),
  foreign key (decision_id, release_id) references public.knowledge_pilot_curriculum_decisions(decision_id, release_id),
  foreign key (subject_profile_id, release_id) references public.knowledge_subject_profiles(id, release_id),
  foreign key (subject_profile_id, canonical_id) references public.knowledge_profile_records(subject_profile_id, canonical_id)
);

create table if not exists public.knowledge_pilot_curriculum_relationship_memberships (
  decision_id uuid not null,
  release_id uuid not null,
  subject_profile_id uuid not null,
  relationship_id text not null references public.knowledge_relationships(relationship_id),
  source_id text not null references public.knowledge_sources(source_id),
  source_checksum_sha256 text not null check (source_checksum_sha256 ~* '^[0-9a-f]{64}$'),
  primary key (decision_id, subject_profile_id, relationship_id),
  foreign key (decision_id, release_id) references public.knowledge_pilot_curriculum_decisions(decision_id, release_id),
  foreign key (subject_profile_id, release_id) references public.knowledge_subject_profiles(id, release_id)
);

create or replace function private.prevent_pilot_curriculum_decision_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'controlled-pilot curriculum verification evidence is append-only';
end
$$;

create trigger pilot_curriculum_decisions_append_only before update or delete on public.knowledge_pilot_curriculum_decisions
for each row execute function private.prevent_pilot_curriculum_decision_mutation();
create trigger pilot_curriculum_records_append_only before update or delete on public.knowledge_pilot_curriculum_record_memberships
for each row execute function private.prevent_pilot_curriculum_decision_mutation();
create trigger pilot_curriculum_relationships_append_only before update or delete on public.knowledge_pilot_curriculum_relationship_memberships
for each row execute function private.prevent_pilot_curriculum_decision_mutation();

alter table public.knowledge_pilot_curriculum_decisions enable row level security;
alter table public.knowledge_pilot_curriculum_record_memberships enable row level security;
alter table public.knowledge_pilot_curriculum_relationship_memberships enable row level security;

revoke all on public.knowledge_pilot_curriculum_decisions,
  public.knowledge_pilot_curriculum_record_memberships,
  public.knowledge_pilot_curriculum_relationship_memberships from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on public.knowledge_pilot_curriculum_decisions,
      public.knowledge_pilot_curriculum_record_memberships,
      public.knowledge_pilot_curriculum_relationship_memberships from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on public.knowledge_pilot_curriculum_decisions,
      public.knowledge_pilot_curriculum_record_memberships,
      public.knowledge_pilot_curriculum_relationship_memberships from authenticated;
  end if;
end $$;

create or replace function public.activate_knowledge_profile_pilot(
  p_subject_profile_id uuid, p_actor_user_id uuid, p_reason text
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  profile record;
  candidate record;
  invalid_count integer;
  total_records integer;
begin
  if p_actor_user_id is null or nullif(trim(p_reason), '') is null then
    raise exception 'pilot activation actor and reason are required'; end if;
  select p.*, r.status as release_status, r.manifest_checksum_sha256 as release_manifest_checksum
    into profile from public.knowledge_subject_profiles p
    join public.knowledge_curriculum_releases r on r.id=p.release_id
    where p.id=p_subject_profile_id for update;
  if not found or profile.release_status <> 'ACTIVE' or profile.status <> 'ACTIVE' then
    raise exception 'pilot activation requires an ACTIVE academic release and profile'; end if;
  if exists(select 1 from public.knowledge_conflicts c where c.release_id=profile.release_id and c.status='OPEN'
    and (c.subject_profile_id is null or c.subject_profile_id=p_subject_profile_id)) then
    raise exception 'open conflict blocks pilot activation'; end if;
  select count(*) into total_records from public.knowledge_profile_records
    where subject_profile_id=p_subject_profile_id and status='APPROVED';
  if total_records=0 then raise exception 'pilot activation requires approved profile records'; end if;
  select count(*) into invalid_count
    from public.knowledge_profile_records pr
    join public.knowledge_records r on r.canonical_id=pr.canonical_id
    join public.knowledge_source_spans sp on sp.span_id=r.span_id and sp.source_id=r.source_id
    join public.knowledge_sources s on s.source_id=r.source_id
    where pr.subject_profile_id=p_subject_profile_id and pr.status='APPROVED'
      and (pr.runtime_status not in ('CANDIDATE','ACADEMICALLY_VERIFIED') or
        not (exists (
          select 1 from public.knowledge_pilot_curriculum_record_memberships m
          join public.knowledge_pilot_curriculum_decisions d on d.decision_id=m.decision_id
          join public.knowledge_record_identity_mappings identity_map on identity_map.canonical_id=m.canonical_id
            and identity_map.source_id=m.source_id and identity_map.source_checksum_sha256=m.source_checksum_sha256
            and identity_map.candidate_id=m.candidate_id and identity_map.candidate_content_sha256=m.candidate_content_sha256
          where m.release_id=profile.release_id and m.subject_profile_id=p_subject_profile_id
            and m.canonical_id=r.canonical_id and m.source_id=r.source_id
            and m.source_checksum_sha256=s.checksum_sha256
            and d.manifest_checksum_sha256=profile.release_manifest_checksum
        ) or (r.verification_status='VERIFIED' and sp.verification_status='VERIFIED'
          and exists (select 1 from public.knowledge_verification_decisions d where d.entity_type='RECORD'
            and d.entity_id=r.canonical_id and d.resulting_status='VERIFIED')
          and exists (select 1 from public.knowledge_verification_decisions d where d.entity_type='SPAN'
            and d.entity_id=sp.span_id and d.resulting_status='VERIFIED')))
        or exists (
          select 1 from public.knowledge_relationships rel
          left join public.knowledge_pilot_curriculum_relationship_memberships m on m.relationship_id=rel.relationship_id
            and m.release_id=profile.release_id and m.subject_profile_id=p_subject_profile_id
            and m.source_id=rel.source_id and m.source_checksum_sha256=s.checksum_sha256
          where (rel.from_canonical_id=r.canonical_id or rel.to_canonical_id=r.canonical_id)
            and ((m.relationship_id is null or rel.source_id <> r.source_id)
              and not (rel.verification_status='VERIFIED' and exists (
                select 1 from public.knowledge_verification_decisions d where d.entity_type='RELATIONSHIP'
                  and d.entity_id=rel.relationship_id and d.resulting_status='VERIFIED')))
        ));
  if invalid_count > 0 then raise exception 'pilot profile has ungoverned records or relationships'; end if;
  perform set_config('ate.knowledge_pilot_activation','true',true);
  perform public.record_knowledge_runtime_decision('SUBJECT_PROFILE',p_subject_profile_id::text,'PILOT_ACTIVE',p_actor_user_id,p_reason,null);
  for candidate in select pr.id from public.knowledge_profile_records pr
    where pr.subject_profile_id=p_subject_profile_id and pr.status='APPROVED'
      and pr.runtime_status in ('CANDIDATE','ACADEMICALLY_VERIFIED') loop
    perform public.record_knowledge_runtime_decision('PROFILE_RECORD',candidate.id::text,'PILOT_ACTIVE',p_actor_user_id,p_reason,null);
  end loop;
  return jsonb_build_object('profileId',p_subject_profile_id,'activated',true,'verificationScope','OPERATOR_VERIFIED_FOR_PILOT');
end
$$;

# ATE v1 Step 6B — Academic Knowledge Governance

Status: Step 6 completion implementation; the committed real corpus is available only as a historical Lower Secondary Biology/framework controlled-pilot candidate. 0008 remains unapplied remotely.

This document records the Step 6B production design and implementation boundary. Academic Knowledge is central governed reference data. It is not school-tenanted operational data, classroom evidence, or an LLM memory store.

## 1. Boundary and authority model

ATE keeps three truths separate:

1. **Curriculum authority** is established only by a governed, provenance-complete, verified, rights-eligible release/profile.
2. **Classroom reality** is teacher-confirmed operational evidence and is not changed by importing or verifying curriculum records.
3. **AI output** is bounded assistance and never establishes, overwrites, verifies, resolves, activates, or grants rights to curriculum knowledge.

The Step 6B layer is central. No `school_id` is added to central knowledge tables. Step 6C will add school-owned references to central subject/profile identities; it will not fork or edit central curriculum records.

## 2. Existing foundation preserved

The six original tables remain the source registry and extraction foundation:

- `knowledge_sources`
- `knowledge_source_spans`
- `knowledge_records`
- `knowledge_relationships`
- `knowledge_legacy_id_mappings`
- `knowledge_import_runs`

Their source wording, normalized payload, spans, checksums, relationships, legacy mappings, import audit and deterministic exact-retrieval concepts are preserved. `normalized` remains JSONB as a versioned payload envelope; production code must validate its shape with the existing Zod schemas and a record taxonomy. It is not a substitute for release/profile membership or provenance.

## 3. Step 6B migration

`drizzle/0008_academic_knowledge_governance.sql` is additive, registered after 0007 in `drizzle/meta/_journal.json`, and remains unapplied to the remote test or production databases. It does not seed a real subject, release, source permission, verification decision, conflict resolution, or active profile.

It extends the original tables with source/schema/effective metadata, content hashes, record keys, payload schema versions, verification projections, import-run version/manifest/transaction metadata, and composite provenance constraints. Historical rows are preserved with `NOT VALID` constraints where necessary; new writes are held to the strengthened relationship rules.

The new central tables are:

- `knowledge_record_taxonomy`
- `knowledge_curriculum_subjects`
- `knowledge_curriculum_releases`
- `knowledge_subject_profiles`
- `knowledge_release_sources`
- `knowledge_profile_records`
- `knowledge_assessment_profiles`
- `knowledge_conflicts`
- `knowledge_conflict_items`
- `knowledge_verification_decisions`
- `knowledge_rights_decisions`
- `knowledge_record_identity_mappings`
- `knowledge_release_activation_runs`
- `knowledge_runtime_decisions`
- `school_subject_curriculum_bindings`
- `teaching_section_curriculum_bindings`
- `teaching_section_curriculum_position_events`

The migration enables RLS and revokes browser-role privileges on every central table. There are no `anon` or ordinary `authenticated` write policies. Governance decision functions are security-definer database commands and their execute privilege is revoked from browser roles; the application server/database owner is the intended access boundary.

## 4. Canonical identity

`canonical_id` is an immutable ATE-issued identifier for one source-version-specific normalized record. New imports use an ATE-generated UUID and persist the relationship between source checksum, candidate ID, importer version, schema version, deterministic candidate-content hash and canonical ID in `knowledge_record_identity_mappings`.

An extraction candidate ID is scoped to its source and checksum. It is not the production identity. A same-checksum re-import with the same importer/schema/content identity reuses the mapping. A changed checksum, importer/schema interpretation, or candidate-content hash produces a new candidate identity; an unexpected content change under the same mapping key fails closed. Reprocessing, page order, parser order, array position, or mutable wording cannot silently rewrite an existing canonical ID.

`record_key` is nullable and is populated only when a printed source code or human-approved stable semantic key exists. Page or line order is never fabricated into a record key. Cross-version continuity is an explicit future mapping/supersession decision, not automatic fingerprint identity.

## 5. Subjects, releases and profiles

`knowledge_curriculum_subjects` provides an internal stable `subject_key`, title, education regime, optional programme/track and lifecycle. These keys are ATE governance identifiers, not implied official national codes.

`knowledge_curriculum_releases` represents one coherent regime/version. It contains authority, display/version identity, effective dates, manifest checksum, status and optional supersession. Its lifecycle is:

`DRAFT → REVIEW → ACTIVE → SUPERSEDED → RETIRED`

Activation and consequential transitions run through narrow server commands. Direct insertion of an active release/profile/subject is rejected. A release must follow `DRAFT → REVIEW → ACTIVE`; activation accepts only `REVIEW`, and an already active release cannot be activated again. Active academic meaning is immutable: changed source sets, wording, profile composition or regime identity requires a new release/profile rather than a silent edit. Inserts, updates and deletes for profiles, source memberships, profile-record memberships and assessment profiles are rejected once their release is active.

`knowledge_subject_profiles` means “this governed subject offering under this release.” Composite foreign keys prevent incompatible release/profile/subject education-level combinations. A release can contain multiple profiles such as internally governed lower-secondary Physics or an advanced-secondary mathematics offering without relying on text equality.

`knowledge_release_sources` is the deliberate source set. Roles are constrained to framework, subject syllabus, assessment framework, subject assessment guideline and supporting reference. A source’s import order never establishes precedence. Release-wide sources have a null profile; profile-specific sources name the profile.

`knowledge_profile_records` is the authority membership boundary. A record existing in the extraction tables is not a curriculum authority record until it is approved into a profile.

## 6. Assessment knowledge

Assessment guidance remains separate from curriculum topic/outcome hierarchy. `knowledge_assessment_profiles` composes release-wide framework sources and, where applicable, subject-specific guidance through explicit source roles and composition mode. It does not copy assessment rules into topic records and it does not implement Assessment Studio.

A profile may declare `requires_assessment_profile`. Activation blocks if that required profile is missing. “What has been taught?” will later use classroom-confirmed scope; “what assessment rules apply?” will use the applicable assessment profile. These questions must not be collapsed.

## 7. Verification

Imported extraction is always a candidate. The importer maps incoming `VERIFIED` claims to `REVIEW_REQUIRED`; it cannot create verified authority. The normal path is:

`import → UNVERIFIED/REVIEW_REQUIRED → controlled human review → VERIFIED`

`VERIFIED` means ATE has established that the normalized record faithfully represents the cited source/version and its provenance, not merely that extraction returned text.

`knowledge_verification_decisions` is append-only and records source, span, record or relationship decisions, actor, time, reason/evidence and source-version context. Existing status columns remain current projections. Database guards reject every direct verification-state transition, not only elevation to `VERIFIED`. Activation and governed retrieval require the latest applicable decision evidence to agree with the current projection.

Activation requires the relevant source, span, record and required relationship path to be verified, and requires authority-eligible taxonomy membership. A verified record can still be blocked by rights or conflicts.

## 8. Rights

Rights are independent from verification. A source may be correctly extracted but restricted, or rights-cleared but academically unverified.

`knowledge_rights_decisions` is append-only and captures checksum, rights status, production permission, external-AI permission, formal-artifact/export permissions, attribution, decision evidence, actor, time and optional expiry. Database guards reject every rights projection transition without a rights decision, enforce coherent rights combinations, and make the current source-checksum decision (including expiry) part of activation and governed retrieval.

The use gates are:

| Use | Minimum gate |
| --- | --- |
| `DEVELOPMENT_VIEW` | deterministic match; restricted source text is not treated as production authority |
| `PRODUCTION_APP` | active applicable profile, verified provenance path, `CLEARED` + `PERMITTED` |
| `FORMAL_ARTIFACT` | all production gates plus formal-artifact allowance and attribution rules |
| `EXTERNAL_AI` | all production gates plus explicit `external_ai_allowed`; source wording only where policy allows |
| `CONTROLLED_PILOT` | active academic profile, clean verified provenance and no blocking conflict; normalized facts/provenance may be used while rights remain pending, with restricted source wording withheld |

`REVIEW_REQUIRED`, `PERMISSION_PENDING`, `RESTRICTED` and `BLOCKED` fail closed for the stricter modes. Rights-cleared does not make an unverified record usable as truth.

## 9. Conflicts

`knowledge_conflicts` and `knowledge_conflict_items` preserve competing records, sources or spans. Conflict evidence is append-only: conflicts and conflict items cannot be deleted or edited. The minimal lifecycle is `OPEN`, `RESOLVED`, `ACCEPTED_OVERRIDE`, and `resolveKnowledgeConflict` stores actor, time, reason and resolution text without erasing competing evidence. Complementary framework and subject guidance is not automatically a conflict.

An open conflict scoped to a release/profile blocks activation and affected production retrieval. A release/profile-wide conflict with no items blocks the whole applicable scope; an item-scoped conflict blocks matching records, sources or spans. Resolving it never deletes competing evidence. No AI path can resolve or override a conflict.

## 10. Activation algorithm

`activateKnowledgeRelease` is a server-side transaction returning a structured report. It does not partially activate. It checks:

- release state and effective-date overlap;
- profile/release/subject regime compatibility;
- required source membership and checksums;
- source-role/profile compatibility and source education-level compatibility;
- rights `CLEARED` + `PERMITTED`;
- a current matching, unexpired rights decision for the source checksum;
- verified source/span/record paths;
- append-only verification evidence for source/span/record and required relationships;
- authority-eligible taxonomy and approved profile membership;
- approval actor/time for source and profile-record membership;
- relationship endpoint/provenance/verification integrity;
- open conflicts;
- required assessment profiles with complete applicable approved source-role composition;
- profile-record and source effective windows;
- no incompatible active effective-date overlap.

On any blocker it rolls back and returns `activated: false`. Every actor-bearing attempt is recorded in append-only `knowledge_release_activation_runs` with the deterministic report and hash. On success it transitions the release and its profiles/subjects/required assessment profiles through the activation command and records the activating actor/time. Import completion never invokes this command.

`CONTROLLED_PILOT` uses the same academic activation checks but does not convert legal rights metadata into permission. A pilot profile is explicitly labelled historical/reference when currentness has not been established. `PILOT_ACTIVE` is a runtime eligibility projection, not NCDC endorsement, legal clearance, export permission, republication permission or external-AI permission. Runtime transitions have their own append-only decision history and narrow database command.

## 11. Retrieval contract

The legacy exact path remains available for controlled development compatibility. Governed production/formal/external retrieval requires explicit release, subject profile, effective date and record types. It joins the profile membership and approved source set, validates active/effective release state, subject/profile regime, verification evidence, rights decision expiry, conflict state, source/profile compatibility and complete span/source provenance. It returns canonical IDs plus source title, authority, version, the full `sourceChecksumSha256`, extracted `spanContentSha256`, normalized `recordContentSha256`, page/locator, rights and governance context.

Governed retrieval fails closed with explicit errors including `NOT_FOUND`, `NOT_VERIFIED`, `RIGHTS_DENIED`, `PROFILE_MISMATCH`, `CONFLICT_UNRESOLVED`, `SOURCE_INACTIVE`, `RELEASE_SUPERSEDED`, `PROVENANCE_BROKEN`, `SUBJECT_PROFILE_MISMATCH` and `EFFECTIVE_DATE_MISMATCH`. It does not silently discard ineligible rows and present an incomplete result as authoritative.

## 12. Import boundary

The importer is transactional and idempotent for mode + dataset checksum + importer version + schema version. It records manifest identity, outcome and report hash. It writes candidates only, never verification, rights elevation or activation. Source checksum changes for an existing source identity are rejected rather than silently overwriting version identity. Legacy IDs are insert-only/idempotent and cannot silently repoint.

The committed real adapter is intentionally narrow. It reads only `ncdc-biology-2019` and `ncdc-framework-2019`, excludes `user-extraction-brief`, preserves source checksums/page locators/source wording and relationship evidence, and emits a deterministic clean-subset report. The 26 open review items remain report evidence; records and relationships directly depending on those items are excluded rather than silently repaired. No missing hierarchy, assessment rule, currentness, permission or endorsement is inferred. The real source registry remains `UNKNOWN` / `PERMISSION_PENDING`.

## 13. External AI boundary

Step 6B makes no model calls. It establishes only the deterministic eligibility boundary for a future bounded context package. A future package may contain eligible canonical IDs, normalized academic content, allowed source wording, attribution, release/profile and provenance locator. It must exclude rights-blocked wording, review-queue content presented as truth, arbitrary raw PDFs, unrelated corpus and unbounded school data.

## 14. Synthetic test strategy

The governance tests use clearly labelled `TEST_SYNTHETIC_*` source/release/profile identities. They prove independent verification and rights gates, no direct elevation, provenance constraints, append-only decision history, activation blockers and success, stable governed retrieval, external-AI permission, conflicts, profile mismatch and supersession. No real source receives a rights or verification decision, and no real release is activated.

FACT: `public.knowledge_sources` does not currently exist in `ATE_Security_Test`; the 0000 Academic Knowledge foundation has not been applied there. Later live testing must first apply existing 0000, then corrected 0008, then run live integration/advisor checks. The local test applies 0000 and 0008 to an isolated PGlite database; this does not apply anything remotely.

## 15. School binding and teacher position history

School-owned bindings reference central profile UUIDs and are tenant-scoped. A school subject can bind only to a `PILOT_ACTIVE` compatible profile. A Teaching Section can bind only to the profile selected for its school subject. Teacher position events reference a `PILOT_ACTIVE` topic/outcome membership, record actor/time and correction/successor history, and resolve the latest non-superseded event with full provenance. No `teaching_sections.current_topic` is introduced; no timetable inference or scheme-of-work upload is required. Classroom continuity remains separate and a classroom event does not create a curriculum position automatically.

The school tables are guarded by RLS and school-role policies when the full tenancy foundation is present. The local knowledge-only PGlite harness conditionally omits tenancy FKs/policies because it does not install 0001/0002; full live testing must run against the complete migration sequence.

## 16. Real-corpus limitations and unavailable sources

FACT: the checkout contains two official-source-labelled 2019 documents, 588 Biology entities, 130 framework records, 1,103 relationships and 26 open review items. The manifest explicitly says authenticity/currentness and permission/endorsement were not independently established.

UNKNOWN / BLOCKED: Lower Secondary Physics, Advanced Secondary Physics/Chemistry/Biology/Mathematics and other Advanced Secondary subjects, the Advanced Secondary Assessment Framework 2026 and subject assessment guidelines are not present in this checkout. No records or profiles are invented for them. Their absence remains a blocker for corresponding production claims and later assessment workflows.

The Biology pilot is therefore a controlled historical reference runtime only. It supports navigation, normalized curriculum facts, teacher-position anchoring and deterministic scope logic for the clean subset. It does not authorize public republication, bulk export, formal artifact generation from restricted wording, external AI transmission of restricted wording, or any claim of current national curriculum status.

## 17. Required live test-database sequence

FACT: `public.knowledge_sources` does not currently exist in `ATE_Security_Test`; the 0000 Academic Knowledge foundation has not been applied there. Later live testing must first apply existing `0000_academic_knowledge.sql`, then corrected `0008_academic_knowledge_governance.sql`, then run live migration/RLS/governance/real-corpus/binding tests and Supabase advisor checks. No remote database was modified by this implementation pass.

## 18. Deferred Step 7

No Lesson Readiness, Assessment Studio, AI integration, large UI build, or Step 7 work is included. The next school-facing vertical slice may refine the minimal binding commands and add UI while preserving the central governance boundary.

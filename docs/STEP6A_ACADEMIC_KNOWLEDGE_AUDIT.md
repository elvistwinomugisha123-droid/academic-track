# Step 6A — Academic Knowledge Audit and Production Design

**Status:** Audit/design only. Step 6B is not implemented by this document.

**Branch inspected:** `rebuild/ate-v1-production`

**Audit date:** 2026-09-18

**Decision vocabulary:**

- **FACT** — directly observed in the checked-out repository, tests, committed data, or migration history.
- **INFERENCE** — strongly implied by observed implementation or documented contracts, but not independently established.
- **RECOMMENDATION** — proposed Step 6 production design.
- **UNKNOWN** — not available or not verifiable from this checkout.

## 1. Executive conclusion

### Conclusion: NO for production curriculum authority; PARTIALLY for the development foundation

**FACT:** The repository contains a useful Academic Knowledge foundation: source registry concepts, source spans, checksums, typed import schemas, canonical records, relationships, legacy mappings, import reports, rights gates, deterministic retrieval, and a human-review queue. These are worth preserving.

**FACT:** The committed production database does not yet model curriculum releases, active profiles, governed subject identities, profile/source membership, assessment profiles, conflict resolution, activation, or teacher curriculum-position history. The existing `school_subjects` and `teaching_sections` tables have no central knowledge binding.

**FACT:** Migrations `0001`–`0007` do not add grants, RLS policies, or server-side access procedures for the `knowledge_*` tables. The intended server-only boundary is therefore not yet an explicit database contract and must be made deliberate before production exposure.

**FACT:** `retrieveExactKnowledge` filters by subject, education level, record type, and use mode, but production retrieval does not require a verified record, active profile/release, conflict-free state, or effective date. Rights are checked after selection, while verification is returned but not enforced.

**FACT:** The importer’s `PRODUCTION_AUTHORISED` mode gates source rights only. It is not a release activation process and does not prove that records, relationships, provenance, or profiles are production-authoritative.

**FACT:** The current checked-out corpus is not the historical 45-source generated corpus. The private `knowledge-sources/derived` and `knowledge-sources/review` outputs are absent. Committed `curriculum-data/` contains a Lower Secondary framework, a Biology-focused workbench, and a task-instructions manifest entry. Advanced Secondary syllabi and assessment-guideline files are not present in the committed workbench.

**FACT:** The committed Biology extraction is explicitly `extracted_with_human_review_required`; its rights notice says prior written permission is required, and the manifest explicitly says that permission, endorsement, or licence was not inferred. The queue contains 26 open review items.

**RECOMMENDATION:** Reuse the foundation as a controlled development/import layer, then add an additive governance layer before any curriculum record can be used as production authority. Production authority must be the intersection of:

`verified source/span/record/relationship` × `rights-cleared use` × `active release/profile` × `resolved conflicts` × `valid school binding`.

The current corpus should remain **development-only** until those gates are established and independently reviewed.

## 2. Audit scope and method

**FACT:** The following were read or inspected:

- `AGENTS.md`;
- `docs/ATE_V1_PRODUCT_SPEC.md`;
- `docs/STEP4_ACADEMIC_OPERATIONS_DESIGN.md`;
- `docs/STEP5_CLASSROOM_CONTINUITY.md`;
- migrations `drizzle/0000_academic_knowledge.sql` through `drizzle/0007_classroom_rpc_privileges.sql`;
- `src/knowledge/**`;
- `knowledge-tools/**`;
- committed `curriculum-data/**` and `knowledge-sources/README.md`;
- Academic Knowledge and curriculum tests;
- package scripts and migration journal;
- relevant Git history, especially commit `8134fc7` (`feat: add academic knowledge postgres foundation`).

**FACT:** No database connection was used for this audit. Production Supabase was not contacted. No source PDF was downloaded, re-extracted, or modified.

**UNKNOWN:** The current contents of the isolated `ATE_Security_Test` database and the ignored private corpus cannot be verified from this checkout.

## 3. Existing architecture inventory

| Area | Existing implementation | Audit result |
|---|---|---|
| Source registry | `knowledge_sources` with authority, title, type, level, subject, year, version, SHA-256, rights, processing, verification, and path metadata | Preserve; extend for immutable source versions and governance evidence |
| Source spans | `knowledge_source_spans` with source FK, page range, locator, extracted text, extraction confidence, verification status | Preserve; strengthen composite provenance constraints and extraction metadata |
| Knowledge records | `knowledge_records` with text fields plus `normalized` and `extracted` JSONB | Preserve as a generic record envelope; add typed/profile/governance controls and keep critical identity relational |
| Relationships | `knowledge_relationships` with typed-in-practice relationship names and source/span provenance | Preserve; add endpoint FKs, source/span consistency, profile compatibility, and conflict handling |
| Legacy migration | `knowledge_legacy_id_mappings` | Preserve as a compatibility boundary; do not treat mappings as authority without review |
| Import audit | `knowledge_import_runs` with dataset checksum, counts, mode, and JSON report | Preserve; separate import completion from production activation |
| Rights | `src/knowledge/rights.ts` and source-level rights columns | Preserve the fail-closed direction; add record/profile/use-mode enforcement |
| Retrieval | `retrieveExactKnowledge` performs deterministic SQL selection and returns provenance | Preserve exact retrieval; require explicit profile/release and production gates |
| Workbench | committed Biology/Lower Secondary JSON and review queue | Preserve as development evidence and migration input only |
| School operations | `school_subjects`, `teaching_sections`, scheduled lessons, classroom events | Preserve tenant-owned boundary; add explicit school-to-profile binding later |
| Classroom continuity | Step 5 append-style classroom events and projections | Preserve separately; never infer curriculum completion from event outcome |

## 4. Corpus evidence actually inspected

### 4.1 Current committed evidence

| Evidence | Observed value | Status |
|---|---:|---|
| Entries in `curriculum-data/01_source_manifest.json` | 3 | **FACT** |
| Actual curriculum/assessment authority documents represented in that manifest | 2 NCDC 2019 documents: Lower Secondary Biology syllabus and Lower Secondary curriculum framework | **FACT** |
| Non-authority manifest entry | 1 user-provided task-instructions entry | **FACT** |
| Biology entity JSONL lines | 588 | **FACT** |
| Biology entity types | 32 topics, 167 learning outcomes, 32 competencies, 197 activities, 115 assessment strategies, 28 ICT-support records, 12 notes plus preambles | **FACT** |
| Framework records | 130 | **FACT** |
| Biology relationship JSONL lines | 1,103 | **FACT** |
| Biology review queue | 26 open items | **FACT** |
| Biology topics | 32 across Senior 1–4 and Terms 1–3 | **FACT** |
| Private generated source registry | absent from checkout; path is gitignored | **FACT** |
| Private generated spans/structured corpus | absent from checkout; paths are gitignored | **FACT** |
| Raw source PDFs | absent from checkout | **FACT** |

### 4.2 Historical corpus figures

**FACT:** `src/knowledge/knowledge.integration.test.ts` contains assertions for 45 sources, more than 10,000 relationships, 10,186 rejected records in production-authorised mode, and representative Lower/Advanced Secondary subjects.

**UNKNOWN:** Those figures are not reproducible from the current checkout because the generated source registry and structured corpus are absent. The test is guarded by `skipIf(!corpusAvailable)`, so a normal test run cannot establish those counts here.

**RECOMMENDATION:** Do not use the historical figures as a release gate until the exact dataset manifest, source registry, checksums, validation report, and test-database import are made available to the review process.

### 4.3 Extraction quality evidence

**FACT:** `curriculum-data/08_validation_report.md` records targeted visual checks, page/span provenance, continuation-page handling, table extraction checks, and 26 known review items. It also explicitly says the visual verification was targeted rather than a line-by-line proof of the entire corpus.

**FACT:** The review queue records ambiguities including missing or incomplete classification codes, duplicated notation, conflicting assessment statements, table/diagram extraction damage, unclear topic references, and source wording tensions.

**INFERENCE:** The workbench demonstrates a promising conservative extraction method, but it does not establish corpus-wide production quality. It is evidence for a review process, not evidence that the corpus is verified.

**UNKNOWN:** Representative extraction quality for Lower Secondary Physics, a Lower Secondary humanities/language subject, Advanced Secondary Physics, Advanced Secondary Mathematics, Advanced Secondary Biology/Chemistry, and Advanced Secondary humanities/business subjects cannot be inspected because those source extracts are not committed or available in the working area.

## 5. Data-quality audit matrix

| Concern | Status | Evidence and meaning |
|---|---|---|
| Source provenance | PARTIAL | Committed workbench records carry document/page/section data; database FKs exist, but no current generated corpus or cross-source/span integrity proof is available. |
| Source checksums | PARTIAL | Manifest and importer use SHA-256; SQL does not enforce format/immutability, and source files are unavailable for recheck. |
| Span provenance | PARTIAL | Page and locator fields exist; span-to-source is FK-backed, but locator semantics, extractor version, span hash, and source/span consistency are not fully governed. |
| Subject identity | FAIL | Records and sources use free-text subjects; no governed central subject/profile identity exists. |
| Education-level identity | PARTIAL | SQL constrains level values, but record level is not constrained to source/profile level and no release regime exists. |
| Record taxonomy | PARTIAL | Zod import enums exist, but the database accepts any `record_type`, the legacy workbench has additional categories, and the generic taxonomy is not release-governed. |
| Topic hierarchy | PARTIAL | Biology has nested topic structures and relationships; generic import uses JSON `parentId` and unverified relationships without relational hierarchy constraints. |
| Outcome hierarchy | PARTIAL | Biology outcomes are linked in workbench structures; database relationship endpoints and semantics are not fully constrained. |
| Assessment guidance structure | PARTIAL | Assessment record types and relationships exist in tooling; no assessment-profile composition, precedence, or regime binding exists in storage. |
| Relationship integrity | FAIL | `from_canonical_id` has no FK; importer checks the relationship target but not the source endpoint; source/span and endpoint/profile consistency are not enforced. |
| Canonical ID stability | FAIL | New extractor IDs include source, record kind, PDF page, and line number; reflow or parser changes can change IDs. |
| Verification | PARTIAL | Status fields and a validator preventing automatic VERIFIED exist; no governed verification evidence or production enforcement exists, and the prototype repository derives VERIFIED when no review item is open. |
| Rights | PARTIAL | Rights and production-use statuses exist and rights retrieval fails closed for non-cleared production use; there is no rights decision history, field-level use policy, or activation linkage. |
| Production eligibility | FAIL | Production retrieval does not require VERIFIED, active release/profile, no unresolved conflict, or effective-date validity. |
| External AI eligibility | PARTIAL | `external_ai_allowed` and rights checks are present; verification, profile, conflict, source-wording, and context-package gates are incomplete. |
| Release/version governance | FAIL | Publication/effective year and source version are metadata only; no release/profile, source set, activation, supersession, or active-date model exists. |
| Conflict handling | FAIL | Review queues preserve extraction uncertainty, but no competing-record conflict entity, resolution authority, or activation blocker exists. |
| School binding | FAIL | `school_subjects` is tenant-owned and text-named; no FK or binding to a central subject profile exists. |
| Teacher position support | FAIL | Prototype `TeachingSection` contains a mutable `topicId`; production Step 4 deliberately did not add position state, and no append-only teacher-confirmed position model exists. |

## 6. Existing schema findings

### 6.1 `knowledge_sources`

**Purpose:** Registry of source documents and source-level authority, rights, checksum, processing, and verification metadata.

**Sound and preserved:** Stable text `source_id`; authority/title/type; education-level constraint; SHA-256 field; independent rights and production-use statuses; attribution flag; source-level verification; imported timestamp.

**Insufficient:** `source_version`, `effective_year`, `processing_status`, and `verification_status` are ungoverned text. There is no release membership, effective date range, supersession, activation status, rights decision evidence, verification actor/time, or source-content immutability. `source_path` is a local working-path concept and should not be the production provenance locator.

**Provenance risk:** A source checksum exists, but the database does not prove which immutable source object was checked or prevent silent metadata updates on a source identity.

**Rights risk:** Rights are stored at source level only. That is a safe default for conservative blocking, but it cannot yet express approved uses, attribution scope, excerpt limits, or a dated permission decision.

**Activation risk:** A source can be imported without being part of any active release/profile.

### 6.2 `knowledge_source_spans`

**Purpose:** Extracted source text with page range, locator, confidence, and verification state.

**Sound and preserved:** Source FK; positive page checks; non-empty locator/text; extraction confidence; independent span verification.

**Insufficient:** No source/span composite FK is used by records or relationships, so a record can name one source and a span belonging to another. There is no extraction-tool/parser version, span content hash, locator type, or verification evidence. Page numbers alone do not prove a table cell, diagram region, or continuation relationship.

**Rights risk:** `source_text` is protected source material in a database row. Access to it must be controlled independently of access to normalized metadata and must never be assumed safe for external AI.

### 6.3 `knowledge_records`

**Purpose:** Generic canonical knowledge envelope containing source wording, normalized data, extraction metadata, and verification state.

**Sound and preserved:** Immutable-looking text primary key; source/span references; source wording kept separately from normalized content; `jsonb` allows gradual coverage of heterogeneous curriculum records; verification state exists.

**Insufficient:** `record_type` is free text; `education_level` and `subject` duplicate source metadata without equality constraints; `normalized` and `extracted` are not schema-versioned in the database; no profile/release membership, content identity, active/superseded state, verification evidence, conflict state, effective period, or stable ordering exists.

**`normalized jsonb` decision:** Do not replace it wholesale with dozens of tables. Keep JSONB for type-specific, versioned payloads and extraction candidates. Move only governance-critical and join-critical data into relational columns/tables: stable record identity, record type, profile/release membership, subject profile, parent/relationship endpoints, verification evidence, content hash, active/superseded state, and production eligibility. A typed validator must be selected from a closed record taxonomy before a record can enter an active profile.

### 6.4 `knowledge_relationships`

**Purpose:** Graph edges between canonical records with relationship type and source/span evidence.

**Sound and preserved:** Relationship primary key; target FK; source/span FKs; indexes for both directions; independent verification state.

**Insufficient:** `from_canonical_id` is not FK-backed; source/span may not belong to the same source; endpoints can be in different subjects, levels, releases, or profiles; relationship types are not constrained in SQL; no ordering/priority/validity period/conflict or reviewer evidence exists.

**Important current incompatibility:** The committed Biology workbench uses `from_id`, `to_id`, and `relationship`, with values such as `belongs_to_topic` and `suggested_for_topic`. The newer import schema expects `fromId`, `toId`, `relationshipType`, and a closed relationship enum such as `TOPIC_CONTAINS_OUTCOME`. The legacy workbench is therefore not directly importable into the current knowledge tables without an explicit reviewed adapter.

### 6.5 `knowledge_legacy_id_mappings`

**Purpose:** Compatibility mapping from old IDs to current canonical IDs.

**Sound and preserved:** Makes migration explicit instead of silently changing downstream IDs; mapping reason and verification status are retained.

**Insufficient:** No old source checksum/version, mapping cardinality, reviewer evidence, supersession, or profile scope exists. The importer currently maps legacy Biology entities by normalized source wording and updates mappings on conflict. Wording equality is not a sufficient identity contract for duplicate statements or revised editions.

### 6.6 `knowledge_import_runs`

**Purpose:** Import audit record for dataset checksum, counts, mode, timestamps, and report.

**Sound and preserved:** Dataset-level checksum and counts; explicit import mode; report retention.

**Insufficient:** No importer version, schema version, actor, source manifest ID, transaction status, idempotency key, activation link, failure state, or immutable run result. The importer writes incrementally and does not wrap source/span/record/relationship insertion and run registration in a single transaction.

**Critical semantic distinction:** `PRODUCTION_AUTHORISED` currently means “source rights passed the import gate.” It must not mean “this dataset is active production authority.”

## 7. Record taxonomy findings

### 7.1 Actual committed workbench types

**FACT:** The framework workbench contains these record types: `active_learning_expectation`, `assessment_principle`, `cross_cutting_issue`, `curriculum_menu`, `elective_subject_time_allocation`, `framework_model`, `gender_equity`, `generic_skill`, `generic_skill_descriptor`, `graduate_profile`, `implementation_guidance`, `inclusion_mixed_ability`, `key_learning_outcome`, `learning_environment`, `subject_menu`, `subject_rationale`, `subject_rationale_table`, `subject_time_allocation`, `teaching_learning_principle`, `time_allocation_guidance`, and `value`.

**FACT:** The Biology workbench contains `topic`, `competency`, `learning_outcome`, `activity`, `assessment_strategy`, `ict_support`, `note`, and related preamble records.

**FACT:** The current import tooling additionally permits `subject_profile`, `subtopic`, `learning_experience`, `knowledge_concept`, `skill`, `generic_skill`, `value`, `cross_cutting_issue`, `resource`, `time_allocation`, `programme_planner`, `practical_requirement`, `assessment_profile`, `assessment_objective`, `construct`, `ability`, `indicator`, `assessment_rule`, `paper_structure`, `scoring_rule`, `rubric_rule`, `performance_descriptor`, and `assessment_guidance`.

### 7.2 Recommended material taxonomy

**RECOMMENDATION:** Keep a small closed taxonomy with clear domains:

- **Curriculum structure:** `CURRICULUM_FRAMEWORK`, `SUBJECT_PROFILE`, `LEVEL_UNIT`, `TERM_UNIT`, `THEME`, `TOPIC`, `SUBTOPIC`, `PROGRAMME_PLANNER`.
- **Curriculum intent:** `COMPETENCY`, `LEARNING_OUTCOME`, `SKILL`, `VALUE`, `CROSS_CUTTING_ISSUE`, `LEARNING_EXPERIENCE`, `PRACTICAL_REQUIREMENT`, `RESOURCE_REFERENCE`, `TIME_ALLOCATION`.
- **Assessment knowledge:** `ASSESSMENT_FRAMEWORK`, `ASSESSMENT_PROFILE`, `ASSESSMENT_OBJECTIVE`, `CONSTRUCT`, `ABILITY`, `INDICATOR`, `ASSESSMENT_RULE`, `PAPER_STRUCTURE`, `SCORING_RULE`, `RUBRIC_RULE`, `PERFORMANCE_DESCRIPTOR`, `ASSESSMENT_GUIDANCE`.
- **Source interpretation:** `SOURCE_NOTE`, `SOURCE_DEFINITION`, `REVIEW_NOTE` — never silently presented as authoritative curriculum content.

The exact final enum should be approved against the source corpus before Step 6B. The key rule is that every type has a defined domain, profile scope, hierarchy semantics, and verification requirement.

### 7.3 Required fields by material type

| Type | Required normalized fields | Parent/scope requirements |
|---|---|---|
| Subject profile | governed subject identity, profile code, level/regime, title | belongs to one release; source set is explicit |
| Topic/subtopic | title, source label/code if printed, ordering key, level/unit context | belongs to one subject profile and has an explicit parent where the source states one |
| Learning outcome | verbatim wording, source notation/classification if present, ordering key | belongs to a topic or other explicit curricular unit; missing classification remains null, never inferred |
| Competency/skill/value | wording, category, ordering/parent if explicit | profile/framework scope must be explicit; generic framework items are not silently subject-specific |
| Assessment profile/rule | purpose/regime, level, subject profile, source role, precedence/constraint semantics | composes with curriculum profile but is not inserted into topic hierarchy |
| Assessment objective/construct/indicator | wording, applicable assessment profile, ordering/relationship semantics | cannot be treated as a learning outcome without explicit source support |
| Relationship | type, both endpoint IDs, source/span evidence, ordering/strength if applicable | endpoint subject/profile compatibility is validated |

## 8. Canonical-ID findings

**FACT:** The private extractor creates IDs such as `source_id:kind:p{page}:l{line}` and suppresses repeated `(kind, line.lower())` fingerprints within a source. The committed Biology workbench uses IDs such as `bio-s4-t1-10.3-lo-09` and declares an ID convention based on source/level/term/topic code.

**Risk:** Page/line IDs change when PDF layout, extraction ordering, parser behavior, or line wrapping changes. Content wording can also repeat legitimately. A re-import can therefore create a new ID for the same source claim or suppress a distinct claim.

**RECOMMENDATION — production identifier contract:**

1. `canonical_id` is an immutable ATE-issued identifier for one source-version-specific normalized record. Existing IDs are never silently reassigned.
2. Add a separate stable semantic `record_key` only where the source provides a durable identifier/code. Do not manufacture one from page order.
3. For records without a source identifier, a reviewer establishes the identity within a release/profile. A content fingerprint may propose a match; it cannot automatically replace the ID.
4. Reprocessing the same source checksum and parser/schema version may be idempotent. A changed source checksum creates a new source version and new record revision candidates; it does not rewrite historical authority.
5. Downstream artifacts store `canonical_id` plus release/profile identity and source version/hash. They must not depend on an unscoped display label or a legacy ID.
6. Legacy mappings remain explicit, scoped, and reviewable. They are not a fallback authority path.

## 9. Provenance findings

### 9.1 Required resolution chain

Every production-usable claim must resolve as:

`record → span → source version → authority/document metadata → checksum → verification evidence → rights decision → active release/profile`

For graph-derived meaning, add:

`relationship → both endpoint records → relationship span/source evidence → relationship verification/conflict state`

**FACT:** The current retrieval response returns record, source, span locator/page, extraction confidence, rights status, production-use status, and attribution flag. It does not return release/profile, verification evidence, conflict state, or effective period.

### 9.2 Broken or weak links

- **FACT:** `knowledge_records` stores independent `source_id` and `span_id` FKs; there is no composite constraint proving that the span belongs to the named source.
- **FACT:** `knowledge_relationships` stores independent source/span FKs and has no FK on `from_canonical_id`.
- **FACT:** The importer checks that relationship `toId` was imported but does not check that `fromId` exists or that both endpoints are compatible.
- **FACT:** The committed workbench carries page and section provenance, and child Biology entities often carry geometric spans, but the raw documents and generated source spans are unavailable for revalidation.
- **INFERENCE:** A record can currently be retrievable with an apparently complete provenance object while still having a semantically broken source/span or endpoint/profile association.

**RECOMMENDATION:** Add composite FKs, locator kind/coordinates, source/span/record content hashes, extractor/parser/schema versions, verification evidence, and deterministic provenance validation before activation.

## 10. Verification governance

### 10.1 Status semantics

- `UNVERIFIED` — imported or changed, but no human/controlled verification decision has been made.
- `REVIEW_REQUIRED` — a reviewer must inspect a known ambiguity, extraction issue, source tension, or incomplete field before production use. It is not a weaker form of VERIFIED.
- `VERIFIED` — an authorised curriculum reviewer has established that the normalized record faithfully represents the cited authoritative source for its stated scope, and the verification decision is recorded with actor, time, evidence, and version.
- **Recommended additional lifecycle state:** `REJECTED` or `SUPERSEDED` may be needed for non-authoritative candidates, but this should not be overloaded into VERIFIED/REVIEW_REQUIRED.

### 10.2 What may become VERIFIED

**RECOMMENDATION:** A machine import may create only `UNVERIFIED` or `REVIEW_REQUIRED`. A controlled reviewer or approved verification workflow may set `VERIFIED`; no model, parser, import completion, or absence of a queue item may do so.

Verification should be independent at four levels:

1. **Source:** identity, authority, edition/version, checksum, and currentness are established.
2. **Span:** extracted text/locator faithfully represents the cited source region.
3. **Record:** normalized fields and source wording accurately represent the span without invented interpretation.
4. **Relationship:** the relation is explicit in the source or separately justified as a controlled interpretation, with both endpoints correct.

Production use requires all levels relevant to the requested operation. A verified record with an unverified relationship cannot use that relationship as authoritative hierarchy.

### 10.3 Existing weakness

**FACT:** `src/curriculum/repository.ts` maps any entity without an open review item to `VERIFIED`. That is incompatible with the stronger meaning above because “not currently queued” is not proof of controlled verification. This prototype repository must not become the Step 6 production authority path.

## 11. Rights findings and eligibility matrix

**FACT:** The current rights function correctly requires `CLEARED` and `PERMITTED` for production/external use and requires `externalAiAllowed` for `EXTERNAL_AI`. `DEVELOPMENT_VIEW` currently allows every source except `RESTRICTED`, including `UNKNOWN` and `PERMISSION_PENDING`.

**FACT:** The importer currently hardcodes `externalAiAllowed` to `false` when creating a source object, while the source metadata schema does not carry the full production-use/attribution decision. This is conservative for external AI, but it is not a complete rights-decision ingestion contract.

**RECOMMENDATION:** Verification and rights remain independent dimensions. Use the following matrix:

| Source/record state | Internal controlled development review | School production display/use | Formal artifact generation | External AI context | Export/source wording |
|---|---|---|---|---|---|
| Rights `CLEARED`, production `PERMITTED`; record path VERIFIED; active profile; no conflict | Allowed | Allowed | Allowed, with attribution rules | Only if explicit external-AI approval is true | Allowed only within approved use and attribution |
| Rights `REVIEW_REQUIRED`, `UNKNOWN`, or `PERMISSION_PENDING` | Metadata/candidate review only; clearly labelled | Blocked | Blocked | Blocked | Blocked except controlled rights review |
| Rights `RESTRICTED` or production `BLOCKED` | Restricted reviewer-only inspection if separately authorised | Blocked | Blocked | Blocked | Blocked |
| Rights-cleared but record/span/relationship not VERIFIED | Candidate review only | Blocked as authority | Blocked as authority | Blocked | No authoritative source wording |
| Verified but rights-pending | Controlled internal review only | Blocked | Blocked | Blocked | Blocked |

The gate is conjunctive. Rights-cleared does not imply verified; verified does not imply rights-cleared.

**RECOMMENDATION:** Store rights decisions with decision source, actor, timestamp, allowed use modes, attribution requirement, expiry/review date, and affected source version. Do not infer NCDC permission from public downloadability or a rights notice alone.

## 12. Release/profile design

### 12.1 Minimum credible model

**RECOMMENDATION:** Use the following small central model:

`Curriculum Release → Subject Profile → approved source set → profile record membership`

Add an `Assessment Profile` attached to the release and subject profile where assessment rules need distinct regime/purpose semantics.

#### Curriculum release

Represents a coherent curriculum regime/edition, not merely an import batch.

Required identity: release key, authority/regime, display name, education level/regime, version label, effective-from/effective-to, status, supersedes-release, release manifest/checksum, activation metadata.

Suggested lifecycle: `DRAFT → REVIEW → ACTIVE → SUPERSEDED → RETIRED`.

#### Subject profile

Represents a governed subject offering within a release, including cases such as Lower Secondary Physics, Advanced Secondary Physics, Principal Mathematics, Subsidiary Mathematics, General Paper, and framework-only subject context.

Required identity: stable profile key/code, release, governed subject identity, education level, programme/track, title, status, ordering, and whether an assessment profile is required.

#### Approved source set

Maps source versions to a release/profile with source role and order, for example `FRAMEWORK`, `SUBJECT_SYLLABUS`, `ASSESSMENT_FRAMEWORK`, `SUBJECT_ASSESSMENT_GUIDELINE`, or `SUPPORTING_REFERENCE`. It must state whether each source is required, optional, or supplementary.

#### Assessment profile

Represents the applicable assessment regime/purpose for a release/profile. It references general and subject-specific assessment sources without placing them into the topic hierarchy. It stores composition/precedence rules and the activation gate for assessment guidance.

### 12.2 Activation and supersession

- An active release/profile is immutable in meaning. Revisions create a new release or profile version.
- Only one applicable active release/profile may govern a given subject/regime/effective date for a school binding.
- A superseded release remains readable for historical artifacts and positions, but is rejected for new production selection after its effective end.
- Source membership is explicit; import order never chooses authority.
- Effective dates are part of selection, not display-only metadata.

## 13. Conflict design

**RECOMMENDATION:** Add a minimal central conflict model rather than silently choosing the latest import:

- `knowledge_conflicts`: conflict ID, release/profile scope, category, status, summary, resolution text, resolved-by, resolved-at, and audit metadata.
- `knowledge_conflict_items`: conflict ID, referenced record/source/span, role (`CLAIM_A`, `CLAIM_B`, `CONTEXT`), and notes.

Use only justified states: `OPEN`, `RESOLVED`, `ACCEPTED_OVERRIDE`. `ACCEPTED_OVERRIDE` preserves the competing evidence and records why one interpretation is used for the profile; it does not delete or rewrite the other source.

Examples include genuinely conflicting syllabus wording, old versus revised editions, and assessment-framework versus subject-guideline tension. Complementary framework and subject guidance is not a conflict merely because both apply.

**Rules:**

- No AI auto-resolution.
- `OPEN` conflicts block affected production records and block release/profile activation when required scope is affected.
- A resolution names the authorised human/authority, reason, timestamp, and affected release/profile.
- Historical artifacts retain the resolved release/profile and conflict decision used at creation.

## 14. Central versus school-owned boundary

### Central, shared, governed

- curriculum releases and profiles;
- governed subject identities;
- source registry and immutable source versions;
- source spans and provenance;
- canonical records and relationships;
- verification and rights decisions;
- conflicts and activation state.

These records must not receive `school_id` merely to simplify access control. They are shared reference data, accessed through a server-side policy/repository boundary.

### School-owned, tenant-scoped

- `school_subjects`;
- school-to-subject-profile bindings;
- Teaching Sections and their selected profile binding;
- teacher-confirmed curriculum-position events/read model;
- school planning/artifact/continuity facts.

The school references central IDs. It cannot casually edit central wording, hierarchy, rights, or verification. A school-specific adaptation is a school-owned artifact or note, not a mutation of curriculum truth.

## 15. Subject mapping design

**FACT:** Current `school_subjects.name` is unique only within a school and current knowledge records carry a text `subject`. This cannot safely distinguish `Physics`, `Principal Physics`, `Subsidiary Mathematics`, or similarly named lower/advanced offerings.

**RECOMMENDATION:** Introduce a central governed subject identity and profile identity. A profile must include level/regime and programme/track; display names are not keys.

Example conceptual identities:

- `UG-LSC-PHYSICS` → Lower Secondary Physics;
- `UG-ASC-PHYSICS` → Advanced Secondary Physics;
- `UG-ASC-PRINCIPAL-MATHEMATICS`;
- `UG-ASC-SUBSIDIARY-MATHEMATICS`;
- `UG-ASC-GENERAL-PAPER`.

Do not assume these codes are authoritative until the source/governance review approves them. The codes illustrate the identity shape, not a fabricated national taxonomy.

Add a school-owned binding containing `school_id`, `school_subject_id`, central `subject_profile_id`, applicable academic period/effective dates, status, confirmation actor/time, and audit history. A Teaching Section may use only a binding compatible with its school, class level, academic period, and profile level.

No production authority may result from string equality or case normalization. String names can assist a proposal/search UI later, but the saved binding must reference a central ID.

## 16. Teacher curriculum-position design

**RECOMMENDATION:** Do not add `teaching_sections.current_topic` as truth. Use an append-only teacher-confirmed position record plus a deterministic current projection.

Minimum conceptual record:

- position event ID;
- school and Teaching Section;
- selected subject profile/release;
- canonical curricular unit ID (`TOPIC`, `SUBTOPIC`, `LEARNING_OUTCOME`, or another allowed unit type);
- position kind (`PLANNED`, `CONFIRMED`, or `PROPOSED`);
- actor membership and server timestamp;
- reason/source action;
- optional supersedes predecessor;
- verification/confirmation state;
- provenance of the central record.

Rules:

- The selected canonical ID must belong to the selected subject profile and active release at the relevant date.
- A teacher confirms the operational position; timetable data does not infer it.
- Corrections append a successor or correction event; they do not destroy history.
- Planned, confirmed, and proposed positions are separate authorities. A proposal cannot silently become confirmed.
- An outcome may be selected as a curriculum anchor without claiming that learners mastered it.
- A teacher can select a topic or appropriate curricular unit; the model must not force a learning-outcome selection when the source structure does not support that granularity.

## 17. Classroom continuity interaction

Step 5 remains operational truth:

`scheduled lesson → classroom event → continuity projection → carry-forward`

Academic Knowledge remains reference truth:

`active curriculum profile → governed topic/outcome reference`

**RECOMMENDATION:** The later vertical slice joins them only through an explicit teacher workflow. A teacher may confirm a curriculum position or explicitly link a lesson/continuity event to a curricular unit, creating a separate position/link record with its own authority and timestamp.

- `DELIVERED` does not prove an outcome was completed.
- `PARTIALLY_DELIVERED` does not identify which outcome remains unfinished.
- `UNCONFIRMED` does not create a curriculum position.
- Carry-forward is an operational prompt; it is not a curriculum rewrite.

This preserves the distinction between what the source says, what happened in class, and what ATE proposes or helps draft.

## 18. Retrieval contract

### 18.1 Required request context

Production retrieval should require one of:

- an explicit canonical ID plus active release/profile context; or
- a subject profile/release, record type, and exact structured selector.

Required use mode: `DEVELOPMENT_VIEW`, `PRODUCTION_APP`, `FORMAL_ARTIFACT`, or `EXTERNAL_AI`. `PRODUCTION_APP` and `FORMAL_ARTIFACT` are separate because output/export rights may differ.

The request must carry subject profile/release, effective date, record types, and deterministic ordering intent. Subject text and education level are filters/diagnostics, never authority.

### 18.2 Production gates

Before returning institutional truth, retrieval must prove:

1. canonical record exists and belongs to the requested profile/release;
2. release/profile is active and effective;
3. source membership is approved and source is active;
4. source, span, record, and relevant relationships are VERIFIED;
5. rights/production-use mode is eligible;
6. no OPEN conflict affects the requested record/path;
7. subject, level, and profile are compatible;
8. record is not superseded or retired for the requested date;
9. provenance is complete and resolvable.

Development retrieval may expose candidates for controlled review, but the result must carry a non-authority status and may not be passed to a production context builder.

### 18.3 Error contract

Use explicit errors rather than returning an empty or mixed result:

- `NOT_FOUND`;
- `NOT_VERIFIED`;
- `RIGHTS_DENIED`;
- `PROFILE_MISMATCH`;
- `CONFLICT_UNRESOLVED`;
- `SOURCE_INACTIVE`;
- `RELEASE_SUPERSEDED`;
- `PROVENANCE_BROKEN`;
- `SUBJECT_PROFILE_MISMATCH`.

Deterministic ordering should be profile order, then source-defined/order keys, then stable canonical ID. Repeated retrieval over unchanged data must return the same records and order.

## 19. Future AI-context boundary

Step 6A implements no AI. The future AI Gateway may receive only a bounded context package produced after the deterministic gates above.

**Allowed package content:**

- canonical ID and record type;
- release/profile identity and effective date;
- normalized academic content;
- source wording only when the rights decision allows the use;
- authority/source title/version/checksum reference;
- page/section/span locator where allowed;
- verification and eligibility metadata;
- explicit attribution/citation data;
- minimal school/teacher context required for the workflow, with personal data minimized.

**Never send as authoritative context:**

- rights-blocked or permission-pending source text;
- unverified or review-queue records presented as truth;
- unresolved conflict candidates;
- arbitrary raw PDFs or whole protected documents;
- unrelated corpus records;
- school data outside the authorised Teaching Section/workflow;
- learner identifiers or private teacher drafts unless explicitly required and authorised;
- secrets, database access, shell/filesystem access, or arbitrary HTTP tools.

Generated output remains a draft/proposal until an authorised human action applies it. The AI package must retain enough provenance to reconstruct which release/profile/records were supplied.

## 20. Assessment-knowledge boundary

Curriculum content and assessment guidance coexist but are not the same hierarchy.

- Curriculum records answer: “What content, outcomes, competencies, skills, or structure does this curriculum state?”
- Assessment records answer: “What assessment regime, objectives, constructs, evidence, paper structure, scoring, or guidance applies?”
- Classroom continuity answers: “What did this Teaching Section confirm happened?”

**RECOMMENDATION:** General Advanced Secondary framework guidance and subject-specific assessment guidelines compose through an explicit `Assessment Profile` with source roles, applicability, precedence, and conflicts. Do not copy assessment rules into topic records or infer a learning outcome from an assessment objective.

Later Assessment Studio should resolve, separately:

1. active curriculum/release/profile;
2. applicable assessment profile and purpose;
3. confirmed taught/eligible scope from classroom/position evidence;
4. blueprint and marking instrument rules.

This permits the system to answer both “what has been taught?” and “what rules apply?” without collapsing either into the other.

## 21. Activation rules

**FACT:** The current system distinguishes import mode from retrieval use, but has no activation process. Import completion currently creates rows; it does not make a release authoritative.

**RECOMMENDATION:** Activation is an explicit, audited transaction performed by an authorised curriculum governance role. It must fail closed if any required-path blocker remains.

### Activation blockers

- source checksum missing/mismatched or source version unresolved;
- required source rights not `CLEARED`/`PERMITTED` for the requested use;
- source, span, record, or required relationship verification gaps;
- unresolved critical conflict in the release/profile;
- broken source/span/endpoint provenance;
- duplicate or unstable canonical identity unresolved;
- required subject/profile mappings absent or incompatible;
- lower/advanced or subject-profile mixing;
- missing assessment profile where the release declares one required;
- effective-date overlap with another active release/profile;
- source set incomplete for the declared release.

### Warnings, not silent permission

Optional supplementary source gaps, non-authoritative review notes, or low-confidence records outside the active required path may be warnings. They must be visible in the activation report and cannot be used as authoritative context until separately eligible.

An activated release is not edited in place. Supersession creates a new release/profile and preserves historical references.

## 22. Proposed Step 6B implementation

This is a proposal only. No migration or application change is created by Step 6A.

### 22.1 Migration

**RECOMMENDATION:** Create `drizzle/0008_academic_knowledge_governance.sql` as an additive migration after applied `0000`–`0007`. Do not edit any prior migration.

### 22.2 Existing tables to keep

Keep all six existing Academic Knowledge tables:

- `knowledge_sources`;
- `knowledge_source_spans`;
- `knowledge_records`;
- `knowledge_relationships`;
- `knowledge_legacy_id_mappings`;
- `knowledge_import_runs`.

### 22.3 Additive extensions to existing tables

Add only fields that encode governance or stable identity:

- source version identity, lifecycle/active state, effective date range, immutable verification metadata, rights decision metadata;
- span content hash, locator kind/coordinates, extractor/parser/schema version, verification metadata;
- record stable key/content hash, source-version identity, typed payload/schema version, active/superseded state, verification metadata;
- relationship endpoint/source-span consistency and verification metadata;
- import actor/tool/schema version, transaction status, and activation reference.

Where a constraint cannot be expressed safely by a column, use a reviewed relational table rather than a JSON flag.

### 22.4 New central tables justified

- `knowledge_curriculum_releases`;
- `knowledge_curriculum_subjects`;
- `knowledge_subject_profiles`;
- `knowledge_release_sources`;
- `knowledge_profile_records`;
- `knowledge_assessment_profiles`;
- `knowledge_conflicts` and `knowledge_conflict_items`.

The profile-record membership table is preferable to copying release/profile fields into every record because a governed record may be reused in more than one compatible profile while retaining one source-specific identity.

### 22.5 New school-owned tables justified

- `school_subject_curriculum_bindings`;
- `teaching_section_curriculum_bindings` or an equivalent section-level profile binding;
- append-only `teaching_section_curriculum_position_events` plus a deterministic current projection.

These tables carry `school_id`, RLS, active membership authorization, and cross-tenant composite FKs. Central knowledge tables do not receive `school_id`.

### 22.6 Code modules and APIs

Change only after the schema design is approved:

- `src/knowledge/types.ts` — closed taxonomy, lifecycle, release/profile, rights, verification, and retrieval error contracts;
- `src/knowledge/db/schema.ts` — additive Drizzle schema;
- `src/knowledge/rights.ts` — use-mode matrix and attribution/export gates;
- `src/knowledge/retrieval.ts` — profile/release/effective-date/verification/conflict/rights-aware exact retrieval;
- `src/knowledge/importer.ts` — transactional, idempotent import and candidate-only status;
- a new governance/activation service for validation and audit;
- a school-binding/position service under the Academic Operations boundary;
- import/validation tooling to adapt legacy workbench data explicitly, never by blind merge.

Do not route production curriculum through `src/curriculum/repository.ts` after the governed path exists. It may remain as a compatibility fixture adapter until downstream code is migrated.

### 22.7 Retrieval API changes

Replace the current minimal request with a contract requiring explicit use and profile context, for example:

`retrieveExactKnowledge({ releaseId, subjectProfileId, effectiveOn, recordTypes, canonicalId?, selector?, use })`

Return eligibility, release/profile identity, verification evidence, conflict state, stable ordering keys, and complete provenance. A production call must fail rather than return a mixed set with hidden ineligible rows.

## 23. Proposed tests

The Step 6B test suite must prove at least the following, using deterministic unit tests plus isolated database/integration tests where constraints and RLS matter:

1. An unverified record cannot become production curriculum authority.
2. A rights-ineligible record cannot be used in production.
3. A rights-ineligible source cannot enter an `EXTERNAL_AI` context.
4. A verified but permission-pending record remains blocked where required.
5. A rights-cleared but unverified record remains blocked as truth.
6. Lower and Advanced Secondary cross-profile mixing is rejected.
7. A wrong subject-profile mapping is rejected.
8. An inactive or superseded release is rejected for new production selection.
9. An unresolved conflict blocks affected production use.
10. Provenance survives retrieval, including release/profile and rights metadata.
11. Every canonical record resolves to its exact source/span with matching source identity.
12. A school subject references a central subject/profile safely through an explicit binding.
13. A teacher position cannot reference another subject/profile.
14. String-only subject matching cannot create authority.
15. Import completion does not activate a release.
16. An external AI context contains only eligible, verified, rights-cleared records.
17. Deterministic retrieval returns stable results and ordering.

Also require negative tests for missing spans, orphan relationship endpoints, mismatched source/span pairs, invalid hierarchy edges, duplicate stable keys, changed source checksums, overlapping active releases, invalid effective dates, correction history, cross-tenant school bindings, and unauthorised activation.

## 24. Known unknowns

- **UNKNOWN:** The exact 45-source corpus, 3,357 spans, 10,186 records/relationships, 4,823 topics, 888 outcomes, 4,377 assessment-guidance records, and 98 assessment objectives are not available in the working tree or independently verified in a test database.
- **UNKNOWN:** Which Advanced Secondary framework, syllabus, and subject-guideline editions are intended to be current for each subject.
- **UNKNOWN:** Current authority/currentness of each supplied document beyond its manifest metadata.
- **UNKNOWN:** Whether any source owner has granted ATE internal display, formal-artifact, export, storage, or external-AI rights.
- **UNKNOWN:** The required central subject codes and approved subject/profile mappings for all Ugandan secondary offerings, including local languages and framework-only subjects.
- **UNKNOWN:** The authorised human roles and evidence requirements for curriculum verification and release activation.
- **UNKNOWN:** Whether future releases need cohort-specific variation beyond effective dates and subject profiles.
- **UNKNOWN:** Whether assessment profiles require formal precedence rules for each subject family or whether source-role composition is sufficient.
- **UNKNOWN:** Whether the isolated test database already contains any additional Academic Knowledge rows not represented by the current repository.

## 25. Stop conditions before Step 6B

Stop and obtain human/source review before implementation if any of the following remains unresolved:

1. source rights or permitted use are assumed rather than documented;
2. a release/profile would mix incompatible editions or levels;
3. canonical identity cannot be made stable across reprocessing;
4. a conflict affects a required production path without an authorised resolution;
5. source/span/relationship provenance cannot be proven;
6. the central subject identity is being inferred from display strings;
7. a school-owned write could mutate central curriculum truth;
8. production retrieval would need to treat review-queue or rights-pending material as authority;
9. migration rollback/recovery and test-database application are not defined;
10. the proposed teacher-position model would collapse planned, confirmed, proposed, or classroom-event state.

## 26. Recommendation

**Recommendation:** Proceed to Step 6B only as a small additive governance migration and service-boundary change after the corpus and source review questions are answered. Preserve the six existing Academic Knowledge tables, the rights/provenance concepts, deterministic exact retrieval, import validation, and legacy mappings. Do not promote the current Biology workbench or the historical 45-source assertions to production authority.

The correct Step 6B order is:

1. approve source/version/rights and central subject identity contracts;
2. add release/profile/source-set/assessment-profile/conflict/activation schema;
3. add provenance and verification enforcement;
4. add school subject/profile binding and append-only teacher-position support;
5. adapt and validate corpus candidates without automatic verification;
6. activate only a reviewed, rights-eligible, conflict-free release/profile;
7. update exact retrieval and tests;
8. stop again before Step 7 unless the production gates pass.

No UI, Lesson Readiness, Assessment Studio, AI workflow, vector search, embeddings, RAG infrastructure, or Step 7 work belongs in Step 6A.

## 27. Step 6A completion record

- **Files changed by this task:** this document only, once committed.
- **Migration created:** No.
- **Database modified:** No.
- **Production Supabase touched:** No.
- **Application behavior changed:** No.
- **Corpus re-extracted:** No.
- **Production readiness:** **NO** for curriculum authority; **PARTIALLY** ready as a development/import foundation.

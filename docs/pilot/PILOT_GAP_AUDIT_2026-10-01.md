# ATE controlled-pilot gap audit

**Audit baseline:** 1 October 2026 execution plan

**Audit performed:** 2 October 2026

**Branch:** `codex/pilot-readiness-hardening`

**Audited commit:** `89fa94b74c23a37a67d2272b72f00767bf8f90ae`
**Decision:** **NO-GO** — Gates 1–7 are not yet evidenced; the repository has strong teacher, continuity, assessment, tenancy and governance foundations, but the required curriculum breadth, pilot environment, PWA/push system, deterministic coverage product, operational proof and recovery evidence are not complete.

## 1. Method and classification rules

This was a repository audit, not an implementation pass. It inspected the execution plan, product specification, application routes and components, domain/application modules, all migrations, CI, automated tests, curriculum workbench and existing delivery reports. No live Supabase, Vercel, device, email provider or real-school dataset was available in the checkout, so those facts are not inferred from code.

Classifications are intentionally strict:

- `IMPLEMENTED_AND_PROVEN`: implemented and supported by passing evidence obtained in this audit (normally deterministic tests).
- `IMPLEMENTED_NOT_PROVEN`: implementation exists, but the required live, browser, device, environment or end-to-end evidence was unavailable.
- `PARTIAL`: a reusable implementation exists but one or more required behaviours are absent.
- `MISSING`: no substantive implementation or evidence was found.
- `BLOCKED_BY_EXTERNAL_ACTION`: completion or proof requires credentials, infrastructure, source rights, a deployment, a physical device, or real school input outside this repository. This does **not** mean all engineering work for the item is complete.

Severity uses the plan's launch semantics: P0 is an absolute safety/authority blocker, P1 blocks an expected pilot workflow, and P2 is only tolerable with an owner and workaround. “Parallel” means implementation can proceed concurrently, not that its readiness gate may be skipped.

### Evidence captured

- `npm run typecheck`, `npm run lint`, deterministic `npm test`, and `npm run build` completed successfully in the audit checkout.
- The committed curriculum reporting and validation scripts could not run because `knowledge-sources/derived/manifests/source-registry.json` is absent. This confirms the committed checkout cannot reproduce the historical corpus report.
- No `public/` assets, web manifest, service worker, push route, push schema, notification scheduler, pilot health command, recovery runbook, or pilot evidence pack exists.
- `.env.example` is a template only; it establishes no pilot environment fact. CI is deliberately wired to the destructive TEST project.

## 2. Executive gap register

### Workstream A — complete curriculum corpus (Gate 1)

| ID | Requirement | Classification | Severity | Evidence and gap | Required change and test | Dependencies | Parallel? |
|---|---|---|---|---|---|---|---|
| A1 | Subject/level readiness matrix | `MISSING` | P1 | No human- or machine-readable matrix exists under `docs/pilot`; the committed workbench is Biology-focused. | Generate Markdown + JSON with every advertised subject/level and all plan columns; schema-test status derivation. | Final advertised catalogue. | Yes |
| A2 | Complete source inventory, fingerprints, versions, locators and rights | `PARTIAL` | P0 | `curriculum-data/01_source_manifest.json`, source/governance schemas and checksum tooling exist, but prior audits state only two authority documents are represented, source binaries/derived registry are absent, authenticity/currentness is unproved and rights remain unresolved. Objects: `knowledge_sources`, `knowledge_source_spans`, `knowledge_release_sources`, `knowledge_rights_decisions`. | Ingest the supplied O/A-Level source set, preserve checksums/locators/version/rights, regenerate registry, and test every catalogue row against its source. | Owner supplies lawful sources and rights decisions. | Yes |
| A3 | Extract and normalise all intended O/A-Level subjects | `PARTIAL` | P1 | Extractors and Lower/Advanced schemas exist, but the committed corpus contains Lower Secondary Biology/framework records, not the full catalogue. Objects: `knowledge_records`, `knowledge_relationships`, `knowledge_record_taxonomy`. | Run/review extraction per source without fabricating absent structures; add subject/level counts and parentage tests. | A2. | Yes |
| A4 | Structural validation including mappings, ordering, provenance, applicability and bindings | `PARTIAL` | P1 | Importer/governance tests cover identity, transactions and some relationships. `validate_corpus.py` currently cannot start without the missing derived registry, and no all-subject binding/applicability validator exists. | Make validation reproducible from an authorised corpus; add all eleven plan checks, actionable failures and CI report artifact. | A2–A3. | Yes |
| A5 | Human source review | `BLOCKED_BY_EXTERNAL_ACTION` | P0 | `09_human_review_queue.json` contains open review work; no signed subject-by-subject review evidence exists. Objects: `knowledge_verification_decisions`, `knowledge_conflicts`, `knowledge_conflict_items`. | Qualified reviewer checks irregular extraction against originals and records decisions; add readiness query that fails closed on open blocking review. | Source access and named academic reviewer. | Yes |
| A6 | Publish releases/profiles and school/section bindings | `PARTIAL` | P1 | Governance and activation objects/RPC exist: `knowledge_curriculum_releases`, `knowledge_subject_profiles`, `knowledge_profile_records`, `knowledge_assessment_profiles`, `school_subject_curriculum_bindings`, `teaching_section_curriculum_bindings`, `activate_knowledge_profile_pilot`. Binding tests exist, but no complete pilot catalogue or live school bindings exist. | Publish only verified/right-cleared profiles, bind every selected school subject and section, and test effective dates plus position options per subject/level. | A1–A5 and real setup. | Yes, after each subject clears review |
| A7 | Automated per-subject runtime smoke suite | `MISSING` | P1 | Existing unit/integration/Playwright tests prove selected synthetic Biology paths, not the 13-step catalogue matrix. | Build TEST fixture orchestration and a per-subject report covering position, Home, readiness, plan, reopen, pack, Ask ATE, context, export and assessment. | A1–A6; TEST credentials; AI key for live generation. | Yes |
| A-exit | 100% of advertised subjects pilot-ready | `MISSING` | P1 | No advertised-scope matrix or full-chain evidence. | Gate from the generated matrix; do not advertise rows that fail any mandatory column. | A1–A7. | No |

### Workstream B — pilot environment and security closure (Gate 2)

| ID | Requirement | Classification | Severity | Evidence and gap | Required change and test | Dependencies | Parallel? |
|---|---|---|---|---|---|---|---|
| B1 | Dedicated clean pilot Supabase with verified migrations and no TEST fixtures | `BLOCKED_BY_EXTERNAL_ACTION` | P0 | Repository migrations `0000`–`0037` exist; no pilot ref, migration ledger/export or clean-project evidence exists. CI explicitly targets TEST ref `lwbkxhimqlfuzzxilaga`. | Owner creates the pilot project; engineering applies the immutable chain, verifies schema/version/fixture absence, and records evidence. | Supabase owner access. | Yes |
| B2 | Rotate uncertain credentials and prove old credentials fail | `BLOCKED_BY_EXTERNAL_ACTION` | P0 | Secrets are not committed (correct), but rotation cannot be inferred. | Rotate DB, service-role and suspected provider secrets; update Vercel/CI securely; record redacted verification. | Supabase/Vercel/provider owner. | Yes |
| B3 | One canonical Vercel production target with safe deployment identity | `BLOCKED_BY_EXTERNAL_ACTION` | P1 | `vercel.json` is generic; no protected/redacted health surface or deployment evidence ties `academic-track-v2` to the audited SHA/environment. | Select canonical project, remove pilot use of duplicate, configure environment, expose authenticated/redacted SHA/environment metadata and archive deployment evidence. | Vercel owner access; B1–B2. | Yes |
| B4 | `pilot:check` readiness command | `MISSING` | P1 | `scripts/dev-check.ts` checks only TEST basics and five tables; no `pilot:check` script or READY/NOT READY contract exists. | Add fail-closed pilot environment/ref, migration, Auth, storage, AI, curriculum/binding, push, PWA, deployment and reachability checks with secret-safe output and unit tests. | Configuration contracts; B1/B3 for live proof. | Yes |
| B5a | Tenant/RBAC/RPC security implementation | `IMPLEMENTED_NOT_PROVEN` | P0 | RLS/policies, role checks, service isolation and SECURITY DEFINER hardening span migrations; security tests exist. Live suite was not runnable without credentials. | Re-run migrations and full integration attacks on TEST, then non-destructive smoke proof on pilot; review every definer function search path and grants. | TEST and pilot credentials. | Yes |
| B5b | Storage and export access boundaries | `PARTIAL` | P0 | `school_files` is private by policy and export actions re-resolve membership/rights. No object-storage upload/download path or live storage attack suite was found; export tests are mainly policy/unit level. | Add live cross-tenant storage/export denial tests for every visible endpoint and object path. | Configured private bucket and TEST accounts. | Yes |
| B5c | Invitation boundary security | `IMPLEMENTED_NOT_PROVEN` | P0 | Hashed, email-bound, expiring, single-use acceptance exists and security tests cover abuse; live acceptance was not run in this audit. | Run invitation attacks and complete authenticated browser acceptance against final Auth redirect/site URL configuration. | TEST/pilot Auth config. | Yes |
| B-exit | Pilot health/security green | `BLOCKED_BY_EXTERNAL_ACTION` | P0 | No dedicated environment or evidence. | Complete B1–B5 and attach dated SHA/ref/deployment/account evidence. | External environment actions. | No |

### Workstream C — real school onboarding and timetable (Gate 3)

| ID | Requirement | Classification | Severity | Evidence and gap | Required change and test | Dependencies | Parallel? |
|---|---|---|---|---|---|---|---|
| C1 | School/period/classes/streams/departments/subjects/staff/roles/sections/programme/timetable setup | `PARTIAL` | P1 | Relational objects and an authenticated Academic Operations UI exist, but no controlled onboarding/import runbook or Mount of Olives dataset is present. | Define assisted, repeatable setup/import procedure with validation and rollback; load and jointly verify real data in pilot. | Real school data; B1; A catalogue. | Yes |
| C2 | Invitation lifecycle: create, email, status, resend, revoke, accept, membership, roles, assignment confirmation | `PARTIAL` | P1 | Create-link, pending status, revoke, accept, membership/role creation and section confirmation exist. No email delivery integration or distinct resend action exists; acceptance is not end-to-end proven. Objects: `invitations`, `invitation_role_grants`, `memberships`, `role_grants`. | Add transactional send/resend delivery with status/audit/failure handling, prove Auth callback/site URL, and browser-test revoke/expiry/wrong email/reuse. | Email provider and pilot domain/Auth config. | Yes |
| C3 | Multi-subject, O/A-Level, multi-class/stream assignment independence | `IMPLEMENTED_NOT_PROVEN` | P1 | `teaching_sections` is first-class and teacher queries preserve section IDs; fixture/domain tests cover independence concepts. No difficult multi-section O/A-Level authenticated acceptance exists. | Seed the required matrix and assert separate bindings, positions, lessons, carry-forward, artifacts and assessment scope through DB + browser tests. | A profiles; TEST fixture. | Yes |
| C4 | Flexible Excel/CSV timetable import, mapping, reconciliation, corrections, conflicts, activation and occurrence generation | `PARTIAL` | P1 | CSV parsing/reconciliation, preview, unknown/mismatch/duplicate/time validation, draft creation, server verify/activate and idempotent occurrence generation exist. Excel is explicitly unsupported; columns are fixed rather than user-mapped; unresolved rows cannot be corrected in-place; no real timetable test exists. Objects: `timetable_versions`, `timetable_slots`, `scheduled_lessons`. | Add XLSX or documented accepted school conversion, column mapper, resolution UI, full overlap/invalid-duration coverage, and real-file rehearsal through activation. | Real timetable and teacher/section directory. | Yes |
| C5 | Programme events and teaching disruption facts | `IMPLEMENTED_NOT_PROVEN` | P1 | Create/cancel/scoped programme events and overlap query exist for holidays, assemblies, exams and other events. Catch-up/recovery semantics and real schedule impact are not acceptance-proven. Objects: `school_programme_events`, `programme_event_targets`. | Test all relevant scopes/types, overlap visibility, cancellation and recovery-period representation against scheduled lessons. | Real programme calendar. | Yes |
| C-exit | Real pilot setup produces correct lessons | `BLOCKED_BY_EXTERNAL_ACTION` | P1 | No real school structure/timetable was supplied or loaded. | Joint leader/Bankai reconciliation report. | C1–C5, real data, B1. | No |

### Workstream D — teacher core loop and recovery (Gate 4)

| ID | Requirement | Classification | Severity | Evidence and gap | Required change and test | Dependencies | Parallel? |
|---|---|---|---|---|---|---|---|
| D1 | Sparse, deterministic Teacher Home | `IMPLEMENTED_NOT_PROVEN` | P1 | Home shows next lesson, governed position, previous/carry-forward state, preparation CTA, today and bounded attention; it does not block on AI. Browser/mobile and final environment proof remain outstanding. | Add authenticated mobile acceptance for no lesson, partial data, stale session, Supabase failure, multi-section day and timezone boundaries. | Gate 3 fixtures/environment. | Yes |
| D2 | Independent first-position confirmation | `IMPLEMENTED_NOT_PROVEN` | P1 | Section workspace and position event RPC validate active teacher/binding and append history. No all-section O/A-Level acceptance proof. Objects: `teaching_section_curriculum_position_events`. | Test initial/corrected position independently for multiple streams/subjects, invalid profile/record rejection and rights failure. | A6. | Yes |
| D3 | Readiness context assembly and human-approved AI proposal | `PARTIAL` | P1 | Lesson Readiness assembles section, duration, governed position, previous outcome, unfinished work and saved preparation; AI gateway and proposal UI exist. School constraints are not modelled comprehensively and live provider/persistence proof is absent. | Define available constraint inputs, prove fail-closed grounding, AI outage degradation, proposal acceptance and AI run persistence. | AI config; A6; final environment. | Yes |
| D4 | Formal Lesson Plan generate/edit/accept/save/version/reopen/export | `IMPLEMENTED_NOT_PROVEN` | P1 | Structured artifact contract/editor, immutable versions, optimistic version checks, PDF/DOCX/print and tests exist. Real AI, sign-out/in durability and deployed PDF packaging are not proven. Objects: `lesson_artifacts`, `lesson_artifact_versions`, `ai_generation_runs`. | Run twice-consecutive authenticated scenario including stale conflict, refresh/login, AI failure and both exports on deployment. | B3; AI key; A6. | Yes |
| D5 | Five Teaching Pack types generate/save/reopen/export | `IMPLEMENTED_NOT_PROVEN` | P1 | All five types are defined and share canonical artifact/version/export pathways with parent-staleness handling. No live proof for every visible type. | Matrix-test Board Notes, Learner Notes, Activity Sheet, Lesson Summary and Homework, including rights-denied and stale-parent cases. | D4; AI and export runtime. | Yes |
| D6 | Lesson-contextual Ask ATE using saved plan when relevant; proposal/apply boundary | `PARTIAL` | P1 | Ask ATE is scoped to the lesson/governed curriculum and does not directly mutate artifacts. The query/action path does not demonstrably include the current saved Formal Lesson Plan, and no explicit consequential patch accept/reject flow is evidenced. | Add minimal authorised saved-plan context, typed patch proposal with explicit apply/reject, provenance/run metadata and mutation-boundary tests. | D4. | Yes |
| D7 | Seconds-long Delivered/Partial/Not Delivered/Changed closeout | `IMPLEMENTED_NOT_PROVEN` | P1 | Four outcomes, concise continuation input, append-style events, corrections and projection tests exist. Real-phone speed/accessibility/double-submit proof is absent. Objects: `classroom_events`; RPCs `confirm_classroom_outcome`, `correct_classroom_outcome`, `get_classroom_continuity`. | Browser/mobile test all outcomes, correction history, duplicate/double-click behaviour, session/network failure and timing with pilot users. | Gate 3 lessons. | Yes |
| D8 | Active carry-forward/recovery UX with explicit teacher authority | `PARTIAL` | P1 | Projection and Home/readiness surfaces carry unfinished work forward and never silently advance. The plan's explicit recovery proposal/teacher confirmation experience is incomplete and not twice-consecutively proven. | Add deterministic recovery state/action, minimum proposal and confirmation boundary; test next lesson, stream isolation, programme disruption and correction. | D7 and governed ordering. | Yes |
| D-exit | Difficult multi-section scenario passes twice without intervention | `MISSING` | P1 | No dated run/evidence file exists. | Automate core path where possible, then perform two consecutive authenticated device runs and record exact SHA/environment/accounts. | Gates 1–3 and D1–D8. | No |

### Workstream E — PWA and push notifications (Gate 5)

| ID | Requirement | Classification | Severity | Evidence and gap | Required change and test | Dependencies | Parallel? |
|---|---|---|---|---|---|---|---|
| E1 | Manifest, icons, standalone app, scope/start URL, service worker/update, installability, auth launch and deep links | `MISSING` | P1 | There is no `public/` directory, manifest metadata, icon set, service worker or registration. | Implement privacy-safe PWA shell/update strategy and route/deep-link handling; add manifest/service-worker automated checks. | Brand icon approval; final app URL. | Yes |
| E2 | Network/degraded behaviour, local draft preservation, retry and duplicate prevention | `PARTIAL` | P1 | Server read retry and recoverable error/session pages exist; artifact writes use expected versions. No online-state UX, local unsaved-form protection, retry state or network-interruption acceptance exists. | Add narrow connectivity state and draft protection only where safe; idempotency keys/disabled repeat submissions; Playwright offline/reconnect tests. | D forms. | Yes |
| E3 | Secure multi-device push subscription storage | `MISSING` | P1 | No push tables, application routes, VAPID configuration or subscription code exists. | Migration + RLS for endpoint/key metadata, ownership, lifecycle and multiple devices; subscribe/unsubscribe endpoints and cross-tenant/security tests. | Supabase migration; VAPID secrets. | Yes |
| E4 | User/type preferences, brief time and timezone | `MISSING` | P1 | School timezone exists, but notification preference schema/UI does not. | Add validated preference model/UI/defaults and timezone/DST boundary tests. | E3; product default decision. | Yes |
| E5 | Deterministic scheduler, delivery history, idempotency, retry and invalid cleanup | `MISSING` | P1 | No scheduler/cron, delivery table or web-push dependency exists. | Add Vercel-suitable authenticated cron, deterministic eligibility service, unique delivery key, safe retry/terminal cleanup and tests for all four classes. | E3–E4; Vercel cron; VAPID. | Yes |
| E6 | Privacy-safe bodies and deep links | `MISSING` | P1 | No notification renderer exists. | Central allow-listed payload schema and lesson deep-link validation; tests that bodies exclude curriculum/notes/private drafts and links cannot cross scope. | E5. | Yes |
| E7 | Android and iPhone physical-device acceptance | `BLOCKED_BY_EXTERNAL_ACTION` | P1 | No device evidence and E1–E6 are absent. | Run the complete matrix on named OS/browser versions; record install, auth, receipt, tap/deep link, reopen and update results. | Physical devices, HTTPS deployment, E1–E6. | No |
| E-exit | No known P1 on supported phones | `MISSING` | P1 | Entire required notification path is absent. | Complete E1–E7 and `PWA_PUSH_ACCEPTANCE.md`. | E1–E7. | No |

### Workstream F — coverage and leadership intelligence (Gate 6)

| ID | Requirement | Classification | Severity | Evidence and gap | Required change and test | Dependencies | Parallel? |
|---|---|---|---|---|---|---|---|
| F1 | One documented deterministic coverage projection | `PARTIAL` | P1 | Current leadership RPC deterministically reports outcomes, position review, stream drift, assessments and disruptions. It is not a single documented projection over governed sequence + position history + outcomes + unfinished work + schedule + programme disruptions, and no coverage semantics document exists. | Specify semantics first; implement/query one reconcilable projection with unknown/stale states and no artifact/activity proxies. | Governed ordering from Gate 1. | Yes |
| F2 | Mobile Teacher Curriculum Journey | `PARTIAL` | P1 | Section page shows current position, position history, recent lessons and outcomes, but not an ordered full journey with confirmed earlier/current/unresolved/next/review states. | Add accessible sequence/journey derived from F1; mobile and raw-record reconciliation tests. | F1. | Yes |
| F3 | HOD department coverage and assessment-risk visualisations | `PARTIAL` | P1 | HOD overview has scoped section positions, exception counts, drift and review work. Advanced curriculum implementation map, stale/unknown treatment, recovery trend and common-scope risk are incomplete. | Build role-scoped views from F1, not private artifacts; test department isolation and seeded chart/value reconciliation. | F1; assessment scope data. | Yes |
| F4 | DOS school-wide academic coverage | `PARTIAL` | P1 | DOS summary/departments/disruptions/drift exist, but comprehensive coverage completeness, recovery workload, disruption impact and intervention projection are incomplete. | Add school-wide aggregation over F1 with traceable drill-down and seeded reconciliation. | F1/F3. | Yes |
| F5 | Principal high-level signals and privacy boundary | `IMPLEMENTED_NOT_PROVEN` | P1 | Principal route/RPC is high-level and no private artifact/chat query is present. Live role-boundary/browser proof is absent. | Add principal-specific privacy assertions, direct-RPC denial tests and UI checks that drafts/chat/teacher rankings never appear. | Security environment. | Yes |
| F6 | Optional AI narrative only after deterministic facts | `MISSING` | P2 | No narrative was found, which is safe and acceptable; this remains optional and must not block Gate 6. | Defer until deterministic coverage is proven; if added, schema-ground only in F1 output with unsupported-claim tests. | F1 proven. | Yes/deferred |
| F-exit | Seeded visuals reconcile exactly on phone/desktop | `MISSING` | P1 | No coverage seed/evidence or responsive reconciliation suite exists. | Add controlled dataset, projection tests, role-scoped Playwright and manual raw-record worksheet. | F1–F5. | No |

### Workstream G — exports, resilience, recovery, support and telemetry (Gate 7)

| ID | Requirement | Classification | Severity | Evidence and gap | Required change and test | Dependencies | Parallel? |
|---|---|---|---|---|---|---|---|
| G1 | Every visible lesson/pack/assessment PDF/DOCX export works or is removed | `IMPLEMENTED_NOT_PROVEN` | P1 | All listed route families and deterministic renderer tests exist, with rights/access checks. Deployed runtime packaging and authenticated matrix proof are absent. | Exercise every visible export against saved canonical versions in final deployment; assert content/type/filename/access and hide any failing action. | B3, D4–D5, assessment fixture. | Yes |
| G2 | Recoverable failures; no raw crash screens | `PARTIAL` | P1 | App/workspace error boundaries, session/access pages, server retries and user-facing errors exist. AI timeout, export exception, offline interruption, stale conflict and Supabase outage are not comprehensively acceptance-tested; export routes lack explicit exception conversion. | Standardise recoverable states and retry guidance; inject failures in browser/integration tests. | Core flows. | Yes |
| G3 | Idempotency for outcomes, artifact acceptance, invite acceptance, timetable activation, notification delivery and assessment finalisation | `PARTIAL` | P0/P1 | Invitation acceptance, timetable activation/generation, optimistic artifact versions and assessment finalisation contain strong DB guards; classroom event duplicate submission lacks a documented idempotency key; notification delivery is absent. | Threat-model each write, add missing unique keys/request IDs and concurrent/double-click tests, especially classroom and notifications. | E5 for notifications. | Yes |
| G4 | Backup, restore and rollback evidence | `BLOCKED_BY_EXTERNAL_ACTION` | P0 | No backup status, restore drill, rollback runbook or environment manifest exists. Existing delivery docs explicitly call this outstanding. | Confirm Supabase backups/RPO/RTO, restore a pilot-like backup into a safe project, reconcile protected entities, document Vercel rollback and record SHA/ref/migration/deployment. | Supabase/Vercel owner. | Yes |
| G5 | Safe support diagnostics for listed incidents | `MISSING` | P1 | Generic logs/errors and analytics are insufficient; no protected diagnostic surface/command correlates user, membership, section, lesson, AI run, export, push and coverage state. | Add audited least-privilege support diagnostics/redacted correlation IDs and incident runbook; test support cannot read private drafts by default. | Observability and support-role decision. | Yes |
| G6 | Required pilot telemetry without surveillance | `PARTIAL` | P1 | Vercel Analytics/Speed Insights and AI run latency/token/cost records exist. The listed domain events, push/export failures and operational dashboards are not implemented. | Define privacy-reviewed event taxonomy, server-authoritative events, retention/access and alerting; add emission tests and prohibit ranking derivations. | Observability destination/config. | Yes |
| G-exit | Operable without ad-hoc DB surgery | `MISSING` | P1 | Required recovery/operations/onboarding runbooks and rehearsal evidence do not exist. | Complete runbooks, diagnostics and a support/recovery exercise. | G1–G6. | No |

## 3. Cross-cutting requirements and gates

| Requirement | Classification | Gate/readiness impact | Finding |
|---|---|---|---|
| Gate 0 scope and architecture freeze | `IMPLEMENTED_AND_PROVEN` | Gate 0 PASS for repository direction | Current code remains a TypeScript/Next.js modular monolith with PostgreSQL/Supabase, no learner portal/marks DB/native app/microservices. The execution plan explicitly includes PWA, push, coverage and full intended curriculum. |
| Planned vs confirmed vs proposed state separation | `IMPLEMENTED_AND_PROVEN` | Gates 4/6 | Domain and DB paths keep timetable intent, classroom events, curriculum positions and AI proposals separate; deterministic tests pass. |
| Scheduled is not taught; human-confirmed classroom truth | `IMPLEMENTED_AND_PROVEN` | Gate 4/P0 | Scheduled lessons remain unconfirmed without `classroom_events`; outcome confirmation/correction is authorised and append-style. |
| Rules before AI; AI gateway and explicit acceptance | `IMPLEMENTED_AND_PROVEN` | Gate 4/P0 | Feature paths use the gateway; provider coupling is isolated; artifact proposal acceptance/versioning and AI contract tests pass. Live provider reliability remains a separate D3/D4 gap. |
| Assessment authoring/eligibility foundations | `IMPLEMENTED_NOT_PROVEN` | Gates 4/6/7 | Blueprint/profile/scope/version/review/finalise and exports exist with extensive deterministic tests, but final environment/browser proof remains outstanding. |
| Required engineering artifacts | `PARTIAL` | Gates 1–8 | Only the execution plan and this audit exist. `CURRICULUM_READINESS_MATRIX`, `PILOT_GO_NO_GO`, `PILOT_ACCEPTANCE_EVIDENCE`, recovery/operations/onboarding runbooks, `PWA_PUSH_ACCEPTANCE`, `LEADERSHIP_COVERAGE_SEMANTICS` and `KNOWN_PILOT_LIMITATIONS` are missing. |
| Required curriculum acceptance suite | `PARTIAL` | Gate 1 | Resolution/binding/governance tests exist; invalid mapping, release applicability and all-subject smoke matrix are incomplete. |
| Required teacher acceptance suite | `PARTIAL` | Gate 4 | Position, artifact versioning and carry-forward unit/integration coverage exists; difficult multi-subject O/A-Level save/reopen/stream-independence browser scenario is missing. |
| Required timetable acceptance suite | `PARTIAL` | Gate 3 | Parsing/reconciliation and activation integration tests exist; configurable mapping, real-file rehearsal and broader conflict matrix are incomplete. |
| Required security acceptance suite | `IMPLEMENTED_NOT_PROVEN` | Gate 2/P0 | Cross-tenant/role/RPC/invitation tests exist; live storage/export/device/environment proof is incomplete. |
| Required PWA/push acceptance suite | `MISSING` | Gate 5 | No implementation or tests. |
| Required leadership acceptance suite | `PARTIAL` | Gate 6 | Drift and assessment-review domain tests exist; coverage projection, department/principal privacy and seeded reconciliation suite are incomplete. |
| Responsive/mobile matrix (360/390/430 + leadership tablet/desktop) | `IMPLEMENTED_NOT_PROVEN` | Gates 4–6 | CSS and Playwright viewport coverage exist for current screens, but final required flows, PWA/push, offline and coverage do not have dated rendered evidence. |
| Full dress rehearsal | `MISSING` | Gate 8 | Cannot start until Gates 1–7 pass. |

### Gate status

| Gate | Status | Primary blocker |
|---|---|---|
| 0 — Scope/architecture | **PASS** | None; protect this freeze. |
| 1 — Curriculum | **FAIL** | Incomplete/rights-unproved corpus, no readiness matrix or all-subject smoke suite. |
| 2 — Environment/security | **FAIL** | No dedicated pilot proof, rotation evidence, pilot health check or live closure. |
| 3 — School setup | **FAIL** | Real school data/timetable absent; invitation email and flexible import incomplete. |
| 4 — Teacher core loop | **FAIL** | No twice-consecutive acceptance; Ask ATE saved-plan and active recovery gaps; live persistence/export/AI proof absent. |
| 5 — PWA/notifications | **FAIL** | Required system is absent. |
| 6 — Leadership coverage | **FAIL** | Existing pulse is not the required documented/reconcilable coverage projection and visualisation. |
| 7 — Reliability/support | **FAIL** | Backup/restore, diagnostics, telemetry, runbooks and export/failure matrix incomplete. |
| 8 — Dress rehearsal | **BLOCKED** | Gates 1–7 must pass first. |

## 4. P0 blockers

1. **Curriculum authority and rights are not closed.** The checkout cannot prove the complete source set, currentness, review or lawful production/external-AI/export use. Wrong subject/level/release or unauthorised use is a P0.
2. **No isolated pilot data boundary is proven.** A dedicated Supabase project must exist and be verified before any real school data is loaded; TEST must remain destructive and synthetic.
3. **Live security closure is absent.** Existing controls are substantial, but cross-tenant, role, definer-RPC, storage, export and invitation attacks must pass against the applied final schema.
4. **Credential state is unknown.** Required rotations and proof that uncertain old credentials no longer work are external release actions.
5. **Backup/restore and rollback are unproved.** Pilot state must not become irrecoverable.
6. **Write idempotency needs closure.** Classroom outcome and future notification delivery require explicit duplicate/concurrency proof; all other consequential writes need a documented matrix.

## 5. P1 blockers

- Complete curriculum readiness matrix, extraction/validation/binding and all-subject runtime smoke evidence.
- Pilot health check and canonical Vercel deployment identity.
- Real school onboarding, invitation email/resend, final assignments, programme and real timetable rehearsal.
- Twice-consecutive multi-section teacher acceptance, including live AI persistence, save/reopen, all promised exports, Ask ATE saved-plan context and explicit recovery.
- Entire PWA and Web Push workstream, including physical Android/iPhone acceptance.
- Deterministic coverage semantics/projection, Teacher Journey and reconcilable HOD/DOS views.
- Full export matrix, injected failure/network tests, support diagnostics, domain telemetry and runbooks.

## 6. Critical path to controlled pilot

1. **Freeze catalogue and obtain sources/rights (A1–A2).** This sets the honest advertised scope and unlocks review.
2. **In parallel, create and secure the pilot environment (B1–B3)** while engineering implements `pilot:check` and reruns security closure (B4–B5).
3. **Extract, validate, review, publish and bind every advertised subject (A3–A6),** then run the generated subject smoke matrix (A7). Gate 1 must pass before curriculum-dependent acceptance can be trusted.
4. **Load real school structure and reconcile invitations/assignments/timetable/programme (C1–C5).** Gate 3 depends on the dedicated environment and actual data.
5. **Close focused teacher gaps (D3, D6, D8) and prove the existing core twice.** Do not rewrite Home, artifacts, continuity or assessment foundations.
6. **Build PWA/push (E1–E6) and deterministic coverage (F1–F5) concurrently** on top of the stable auth/teacher and curriculum projections; then complete physical-device and seeded reconciliation acceptance.
7. **Converge reliability (G1–G6):** exports, failure injection, idempotency, restore drill, diagnostics, telemetry and runbooks.
8. **Run Gate 8 on the exact frozen SHA/deployment/project** with 2–4 pilot-like users; GO only with P0=0, P1=0 and owned/documented P2s.

The longest externally constrained chain is **lawful sources → extraction/review → release/bindings → subject smoke → real assignments → teacher/coverage acceptance**. The second launch-critical chain is **pilot Supabase/secrets/Vercel → migration/security proof → real setup → restore rehearsal**. Device push acceptance cannot finish until HTTPS deployment, VAPID configuration and the notification implementation exist.

## 7. Parallel workstreams

| Track | Work that can start now | Convergence dependency |
|---|---|---|
| Curriculum | Matrix generator, validator coverage, smoke harness; source ingestion as soon as sources arrive | Human review/rights and profiles before Gate 1 |
| Environment/security | `pilot:check`, security matrix review, migration inventory | Owner-created Supabase/Vercel and rotated secrets |
| Teacher/reliability | Ask ATE saved-plan context, recovery UX, idempotency/failure tests, export matrix | Governed profiles and final environment for proof |
| PWA/push | Manifest/service worker, schemas, preference UI, eligibility service and tests | VAPID/Vercel cron/HTTPS + devices for final proof |
| School operations | Email delivery/resend and timetable mapper/resolution UI | Real directory/timetable for Gate 3 |
| Coverage | Semantics document, deterministic projection, seeded reconciliation tests and UI | Governed sequence/position data for correct calculation |
| Operations | Runbook templates, diagnostic design and telemetry taxonomy | Final environment/flows for rehearsal evidence |

## 8. Actions requiring owner, Supabase, Vercel or real school data

### Product owner / academic authority

- Confirm the complete advertised O-Level/A-Level pilot subject catalogue.
- Supply/access the authoritative source corpus outside Git and decide current release/profile applicability.
- Provide documented rights decisions for internal runtime, external AI, formal artifacts and exports.
- Name qualified reviewers and close the human review queue.
- Approve notification defaults/times, coverage semantics and accepted P2 policy.

### Supabase / security owner

- Create the dedicated pilot project; provide its ref through secure configuration.
- Configure Auth site URL/redirects, email delivery and private storage.
- Rotate database/service credentials; invalidate uncertain old credentials.
- Apply and attest the verified migration chain; retain TEST isolation.
- Confirm backups/PITR capabilities and facilitate a restore drill into a safe target.
- Provide short-lived access for non-destructive pilot security/health evidence.

### Vercel / deployment owner

- Confirm `academic-track-v2` as the sole canonical pilot project and prevent use of the duplicate.
- Configure production/pilot variables, deployment protection, canonical URL and cron.
- Supply VAPID/provider secrets after push implementation without exposing them to the client beyond the public VAPID key.
- Confirm the frozen deployment ID/SHA and perform a rollback rehearsal.

### Mount of Olives / real school data

- Provide approved academic year/term, timezone, departments, classes, streams, selected subjects, pilot staff/roles and Teaching Section assignments.
- Provide the actual timetable in its source format plus the school programme/disruptions.
- Verify imported assignments and scheduled lessons jointly with Bankai.
- Nominate 2–4 willing pilot users and supported Android/iPhone devices.
- Participate in invitation, multi-section teacher, notification, coverage and recovery rehearsal without placing data in TEST.

### External provider/device actions

- Configure and test the production Anthropic model/key and confirm AI run persistence/telemetry.
- Configure invitation email delivery and Web Push VAPID credentials.
- Perform physical Android Chrome and iPhone Safari/Add to Home Screen acceptance; emulation is insufficient for Gate 5.

## 9. Preserve, harden, do not rebuild

The audit found reusable, coherent foundations in tenancy/RLS, Teaching Sections, timetable activation, programme events, curriculum governance/bindings, teacher Home, position history, lesson readiness, canonical/versioned artifacts, classroom continuity, assessment eligibility/review, export renderers and leadership exception queries. Subsequent tasks should close the identified gaps through these boundaries. Replacing them would add migration and regression risk without advancing a readiness gate.

## 10. Immediate next engineering slice

The smallest safe next slice is to create the **curriculum readiness matrix generator/schema and pilot health-check contract in parallel**, while the owner initiates source/rights review and infrastructure creation. Both produce fail-closed evidence, expose the exact external blockers early, and avoid broad UI work before the critical-path facts exist.

# ATE v4 Migration Plan

**Status:** Active migration guide  
**Target:** Upgrade the existing ATE prototype in place to the v4 product defined by `PRD.md` and `TRD.md`.

## 1. Migration principle

The current repository is not disposable. It contains working UI, domain logic, assessment/PDF work, AI seams and product learnings that should be preserved where they still fit v4.

The migration should therefore be incremental:

1. establish v4 documentation authority;
2. protect current working behavior with tests;
3. introduce production data/auth/storage boundaries;
4. move existing features behind the new domain/application contracts;
5. deepen lesson planning and assessment;
6. add onboarding, role-aware operations, reporting and offline behavior;
7. remove obsolete prototype-only paths only after replacements are validated.

Do not perform a broad rewrite merely to match an ideal folder tree.

## 2. Current repository observations

The current repository already has:
- Next.js + React + TypeScript;
- Zustand/Zod/React Hook Form;
- Anthropic SDK integration;
- PDF generation;
- domain/store separation;
- curriculum data tooling;
- Teacher/HOD/DOS/Principal product documentation;
- Vercel configuration;
- Vitest;
- installed design skills (`gpt-taste`, `emil-design-eng`).

The v4 migration must preserve useful working behavior while replacing prototype assumptions such as:
- browser-only persistence as the system of record;
- direct provider coupling inside feature code;
- Biology-first curriculum data as if it were the permanent production corpus;
- old PRD scope around marks/student profiling/over-broad management workflows;
- any static/demo-only state that conflicts with verified school state.

## 3. Documentation authority migration

Add and use:
- `PRD.md` — product specification of record.
- `TRD.md` — technical specification of record.
- `AGENTS.md` — Codex operating contract.
- `DESIGN.md` — UI/interaction direction.

Existing `PRODUCT.md` and historical docs remain reference material until reconciled, but cannot override PRD/TRD.

## 4. Phase 0 — Baseline and safety net

Before feature migration:
- run and record current typecheck, lint, tests and build;
- add Playwright if not present;
- capture visual baselines for critical current screens;
- identify hard-coded demo facts;
- identify direct AI-provider usage;
- identify localStorage/browser-persistence dependencies;
- identify current curriculum-data imports;
- inventory PDF/export paths;
- inventory assessment generation paths.

Deliverable: `docs/V4_BASELINE_AUDIT.md`.

## 5. Phase 1 — Repository and package foundation

Move toward the target modular-monolith structure incrementally.

Do not move files solely for aesthetics. First create clear module boundaries for:
- domain;
- database;
- knowledge;
- intelligence;
- documents;
- design system;
- shared infrastructure.

Introduce pnpm workspaces/Turborepo only when the migration commit is coherent and the existing app remains runnable.

## 6. Phase 2 — Production persistence and identity

Introduce:
- Supabase project integration;
- PostgreSQL schema;
- Drizzle schema/migrations;
- Supabase Auth;
- school memberships and additive roles;
- private object storage;
- Row-Level Security;
- audit/event records for consequential actions.

The current browser store becomes UI/draft state, not institutional truth.

Required access tests:
- teacher cannot read another teacher's private section data unless policy permits;
- HOD scope is department-bound;
- DOS scope is school-operations-bound;
- HT scope is institutional;
- cross-school access is impossible.

## 7. Phase 3 — School onboarding and digital twin

Implement the locked onboarding flow:
1. school context;
2. timetable/programme upload;
3. extraction + deterministic conflict checks;
4. human verification;
5. teacher invitations;
6. teacher assignment confirmation;
7. teacher selects current curriculum position;
8. optional unfinished-work note;
9. Teaching Section becomes ready.

Scheme upload must not block onboarding.

The Digital Twin remains computed from verified records.

## 8. Phase 4 — Knowledge layer

Create a rights-aware knowledge pipeline:
- raw authorised sources in private storage;
- source registry;
- extraction into canonical JSON/JSONL;
- validation/human review;
- import into PostgreSQL;
- exact structured retrieval as default;
- relationship traversal where useful;
- pgvector only for semantic fallback;
- provenance on retrieved entities.

Do not expand the Git repository with new protected curriculum text.

## 9. Phase 5 — AI gateway and context assembly

Create one ATE AI Gateway.

Feature modules must not call provider SDKs directly.

Gateway requirements:
- provider abstraction;
- Zod contracts;
- prompt/workflow versions;
- context minimisation;
- structured outputs;
- retries/degradation policy;
- cost/latency telemetry;
- provenance/source references;
- eval hooks.

Create a shared Context Assembler for:
- user/role;
- school;
- Teaching Section;
- timetable;
- current curriculum position;
- previous lesson outcome;
- unfinished work;
- scheme context;
- available resources;
- active artifact;
- assessment profile when relevant.

## 10. Phase 6 — Lesson planning v4

Preserve the useful quick Lesson Readiness workflow.

Add the full Formal Lesson Plan artifact defined in PRD:
- curriculum anchor;
- prior learning/continuity;
- preparation notes;
- classroom context;
- methods/pedagogy;
- resources/safety;
- timed phases;
- teacher and learner activity;
- formative evidence;
- genuine skills/values/cross-cutting opportunities;
- differentiation/inclusion;
- misconceptions;
- contingencies;
- follow-up;
- provenance.

Add:
- save/history;
- duplicate/adapt across streams;
- school-template mapping;
- DOCX/PDF export;
- Ask ATE artifact patching with explicit user apply.

## 11. Phase 7 — Assessment v4

Replace generic generation with the locked assessment pipeline:
1. resolve assessment regime;
2. resolve subject/profile;
3. resolve purpose;
4. resolve eligible scope;
5. build blueprint;
6. generate scenarios/items;
7. generate marking/scoring instrument;
8. run quality evaluator;
9. teacher review/edit;
10. finalise/export.

Add:
- Lower Secondary profile behavior;
- Advanced Secondary profile behavior;
- Improve Existing Paper;
- marking guides;
- analytic rubrics;
- bases of assessment;
- indicators/descriptors;
- score sheets;
- DOCX/PDF export.

Do not add learner mark upload, AI grading or learner profiling.

## 12. Phase 8 — Resource discovery

Implement lesson-contextual resource discovery:
- web/video/provider search;
- verification of URL/provider metadata;
- ranking by current lesson context;
- concise "why relevant" explanation;
- save/attach to artifact;
- no mandatory department approval step.

Institutional recommendation state may exist as an optional signal, never as a blocker.

## 13. Phase 9 — Leadership/reporting

Keep leadership surfaces lightweight.

HOD:
- Department Pulse;
- meaningful stream differences;
- common-assessment readiness;
- issues needing coordination;
- Ask ATE;
- generate department brief.

DOS:
- timetable/Teaching Section administration;
- operational exceptions;
- recovery decisions;
- school programme;
- Ask ATE;
- generate operations brief.

HT/Principal:
- high-level academic assurance;
- major institutional issues;
- pending senior decisions;
- Ask ATE;
- generate academic brief.

Reports are derived from existing facts, never new reporting forms.

## 14. Phase 10 — PWA/offline

Implement narrow offline support:
- today timetable;
- current Teaching Section context;
- saved lesson artifacts;
- lesson-outcome capture;
- queued sync.

AI generation may remain online-only.

## 15. Quality gates

Every phase must preserve:
- strict TypeScript;
- lint;
- Vitest;
- Playwright for critical flows;
- visual inspection/regression;
- RLS/access tests where relevant;
- AI evals where relevant;
- production build.

Representative golden eval cases must include:
- Lower Secondary lesson planning;
- Advanced Secondary lesson planning;
- Lower Secondary Physics assessment;
- Advanced Secondary Physics assessment;
- existing-paper audit;
- retrieval/provenance;
- resource recommendation.

## 16. Migration completion definition

The v4 migration is complete when:
- PostgreSQL/Supabase is the institutional system of record;
- auth/tenancy/RLS are active;
- onboarding creates verified Teaching Sections;
- lesson planning and assessment meet the v4 quality bar;
- AI calls flow through the gateway;
- curriculum retrieval is rights-aware and provenance-preserving;
- PDF/DOCX exports work from canonical artifacts;
- leadership views derive from the same academic state;
- critical teacher flow works on mobile and tolerates intermittent connectivity;
- old prototype-only paths have been removed or explicitly retained for a documented reason.

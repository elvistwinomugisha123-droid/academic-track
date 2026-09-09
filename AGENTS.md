# AGENTS.md — Academic Track Engine v4

This file is the repository operating contract for Codex and other coding agents.

ATE is a teacher-first curriculum implementation and academic operations product for secondary schools. It is not a generic school ERP, LMS, chatbot, AI wrapper, marks platform, or teacher-surveillance system.

The existing repository contains a working prototype. v4 is an **in-place production upgrade**, not permission to discard working behavior and rebuild arbitrary screens.

## 1. Mandatory source-of-truth order

Before substantive work, read the relevant documents in this order:

1. `PRD.md` — product truth: what ATE is and how it must behave.
2. `TRD.md` — technical truth: architecture, stack, security and engineering boundaries.
3. `DESIGN.md` — visual and interaction direction, except where superseded by PRD/TRD.
4. `docs/V4_MIGRATION_PLAN.md` — how to move the current prototype toward v4.
5. `docs/DECISIONS.md` — accepted historical decisions that do not conflict with v4.
6. Other files in `docs/` — historical/domain context only; reconcile against PRD/TRD before using.
7. Existing code — current implementation, never authority over explicit v4 requirements.

`PRODUCT.md`, the old architecture documents, and the existing Biology-oriented curriculum fixtures predate v4. They are useful historical references but **must not override PRD.md or TRD.md**.

If two sources conflict, stop and follow the higher-precedence source. Do not silently create a second product model in code.

## 2. Product invariants

### 2.1 Teacher-first
The teacher is the primary daily user. ATE must reduce repeated academic work. Do not add data entry merely to feed leadership dashboards.

### 2.2 Authority separation
Keep these categories distinct:

- curriculum/assessment authority;
- verified school operational facts;
- teacher-confirmed classroom reality;
- AI reasoning and recommendations.

AI may retrieve, draft, explain, adapt, compare and propose. It must not silently establish curriculum truth, school facts, lesson occurrence, official marks, timetable changes, or consequential academic decisions.

### 2.3 Teaching Section is first-class
The primary operational unit is:

> teacher × subject × level/class × stream × academic period

Parallel streams are independently stateful.

### 2.4 Classroom reality belongs to the teacher
A scheduled lesson does not prove teaching occurred. Missing outcome data means `UNCONFIRMED`, never absent, failed or missed by inference.

### 2.5 Rules before AI
Use deterministic code for deterministic facts, including:

- timetable conflicts;
- role permissions;
- common-test scope intersections;
- taught-scope eligibility;
- version state;
- whether an outcome is unconfirmed;
- whether an issue has crossed an explicit escalation condition.

AI may explain or draft around those results.

### 2.6 Retrieval before generation
Curriculum-specific generation must use retrieved, rights-eligible, versioned context. Model memory is never the curriculum source of truth.

### 2.7 Human authority
AI output is draft/advisory until an authorised user explicitly applies, confirms or finalises it.

### 2.8 Non-surveillance
Never add:

- teacher rankings;
- coverage leaderboards;
- AI-use rankings;
- teacher speed indices;
- punitive activity metrics;
- hidden teacher-quality scores.

### 2.9 Graceful degradation
Core school state and previously saved artifacts must remain usable when AI is unavailable. Teacher outcome capture must not depend on an AI call.

## 3. Current locked product scope

The v4 product includes:

- secure school workspaces and additive user roles;
- timetable/programme onboarding and teacher invitations;
- teacher confirmation of assigned Teaching Sections and current curriculum position;
- Scheme of Work planning;
- quick Lesson Readiness;
- professional Formal Lesson Plans;
- contextual Ask ATE that can propose artifact patches;
- teacher-confirmed lesson outcomes and continuity;
- curriculum-aware Resource Discovery;
- curriculum/regime-aware Assessment Engine;
- Improve Existing Paper;
- marking guides, analytic rubrics, bases of assessment, indicators/descriptors and score sheets;
- HOD Department Pulse and common-assessment coordination;
- DOS academic operations and recovery decisions;
- Head Teacher/Principal academic assurance;
- AI-generated reports from already-recorded facts;
- PDF/DOCX artifact export;
- narrow offline/PWA support for critical teacher workflows.

Current scope explicitly excludes learner accounts, parent portal, learner marks database, AI marking, learner profiling, teacher ranking and generic ERP features unless PRD is deliberately changed.

## 4. Engineering architecture

ATE v4 is a **TypeScript modular monolith** with strict logical boundaries:

- Academic Knowledge;
- Academic Operations;
- Academic Intelligence;
- Documents/Artifacts;
- Product Experience;
- Platform/Security.

Do not introduce microservices, Kubernetes, Kafka, a separate graph database, a separate vector database, a Python backend, or speculative infrastructure without an explicit architecture decision.

Target stack and repository structure are defined by `TRD.md`.

## 5. Migration discipline

The current application is valuable evidence. Upgrade it deliberately.

Before modifying a feature:

1. inspect its current behavior;
2. identify the v4 requirement;
3. identify reusable code/state;
4. write or update tests around behavior worth preserving;
5. migrate behind typed boundaries;
6. remove obsolete paths only after their replacement works.

Do not perform a large uncontrolled rewrite.

Do not rename/move the entire repository purely to match an ideal folder tree. Introduce the target module structure incrementally unless a planned migration step explicitly calls for a structural move.

## 6. Curriculum and protected content

The repository must contain the **machinery for curriculum intelligence**, not a growing production library of protected source documents.

Do not commit new raw NCDC/UNEB/school-private files to Git.

Do not commit production secrets, school-private documents, raw timetables, private exports or private user data.

The existing `curriculum-data/` directory is legacy development material. Treat it as migration-sensitive:
- do not expand it with additional protected text;
- do not assume it is licensed for production;
- preserve provenance;
- migrate authorised production content to the rights-aware private storage + knowledge database architecture in TRD.

Curriculum retrieval must respect source version, rights state and provenance.

## 7. AI implementation rules

All AI calls flow through the ATE AI Gateway/provider abstraction.

Feature modules must not instantiate provider SDK clients directly.

For structured workflows:
- define Zod input/output contracts;
- retrieve minimum required context;
- record prompt/workflow version;
- validate model output;
- run deterministic/domain quality checks;
- expose provenance/why information where relevant;
- require human confirmation before state-changing application.

Ask ATE may return a message plus a proposed artifact patch. The patch is not written until the user explicitly applies it.

AI agents do not directly write official academic state.

## 8. Assessment rules

Assessment is a first-class subsystem, not a one-prompt question generator.

Generation order is broadly:

1. resolve level/assessment regime;
2. resolve subject/profile;
3. resolve purpose;
4. resolve eligible curriculum/taught scope;
5. build blueprint;
6. generate scenarios/items;
7. build marking/scoring instrument;
8. run quality evaluation;
9. present teacher-editable artifact.

Lower Secondary and Advanced Secondary must use different assessment profiles where the authoritative material differs.

The teacher does the marking. Do not add learner mark-upload, AI grading or learner result profiling unless PRD is changed.

## 9. Lesson planning rules

Keep Lesson Readiness and Formal Lesson Plan distinct.

Formal plans are structured artifacts, not prose blobs. They must support:
- curriculum anchor;
- prior learning/continuity;
- teacher preparation;
- classroom conditions;
- pedagogy;
- resources/safety where relevant;
- timed lesson phases;
- teacher and learner activity;
- formative evidence;
- genuine skills/values/cross-cutting opportunities;
- differentiation/inclusion;
- misconceptions;
- contingencies;
- follow-up;
- references/provenance.

Do not mechanically populate curriculum buzzwords that the activity does not actually support.

## 10. UI/UX is a correctness requirement

ATE must look like credible institutional software, not generated SaaS.

For significant UI work:
- use the installed `gpt-taste` and `emil-design-eng` skills;
- use Impeccable when available for critique/polish;
- product documents outrank design skills;
- preserve the established design system rather than creating page-specific styles.

Teacher experience:
- mobile-first;
- 360–430 px primary validation widths;
- next class/action dominant;
- low density;
- thumb-friendly controls;
- fast outcome logging.

HOD/DOS:
- desktop-friendly, responsive, exception-oriented.

Head Teacher:
- restrained, assurance-oriented, low noise.

Avoid:
- neon AI visuals;
- decorative gradients/glow;
- card-in-card layouts everywhere;
- giant KPI tiles;
- generic chatbot shells;
- meaningless charts;
- gratuitous pills/icons;
- excessive motion;
- dense teacher dashboards.

A compile-successful interface is not automatically acceptable.

## 11. State and data rules

- PostgreSQL becomes the production system of record.
- Supabase Auth/Storage/RLS are infrastructure boundaries defined in TRD.
- Zustand is UI/draft state, not the database.
- Every school-owned record must be tenant scoped.
- Authorisation is enforced server/database-side, not only by hidden navigation.
- Significant mutable institutional facts require versioning/auditability.
- The Digital Twin is computed from current verified facts; do not create one giant mutable twin blob.

## 12. Files, documents and artifacts

Major artifacts are structured and versioned.

The same canonical artifact content should power:
- the UI;
- PDF rendering;
- DOCX rendering.

Do not maintain three divergent textual copies.

School templates are private files with a confirmed mapping to canonical artifact fields.

External web/video resources normally store metadata and URLs, not copied content.

## 13. Testing requirements

Before reporting substantive work complete, run the checks relevant to the change:

- typecheck;
- lint;
- unit/domain tests;
- integration tests where data/security boundaries changed;
- access/RLS tests where permissions changed;
- Playwright for critical product flows;
- visual/responsive inspection for UI;
- AI schema/eval checks where an AI workflow changed;
- build.

For UI work validate at least:
- teacher mobile;
- desktop leadership;
- loading;
- empty;
- error;
- offline/degraded state where relevant;
- long-content/overflow behavior;
- keyboard/focus behavior for interactive primitives.

Do not report completion with known failing quality gates.

## 14. Evaluation and regression protection

Important AI workflows require golden cases/evals.

At minimum preserve representative evaluation cases for:
- Lower Secondary lesson planning;
- Advanced Secondary lesson planning;
- Lower Secondary Physics assessment;
- Advanced Secondary Physics assessment;
- retrieval/provenance;
- existing-paper audit;
- resource recommendations.

A prompt/model change that degrades these cases is a regression.

## 15. Security rules

Never:
- expose service-role keys to the browser;
- log secrets or full protected documents unnecessarily;
- trust client-supplied school/role scope;
- create public buckets for school/curriculum private content;
- send unnecessary teacher/school identifiers to external AI providers;
- let invitation links grant self-selected privileges.

Security-sensitive changes require explicit tests.

## 16. Commit and change discipline

Prefer small, reviewable commits.

Do not combine:
- broad structural refactor;
- new product behavior;
- major design rewrite;
- database migration;
- AI prompt rewrite

in one uncontrolled change.

For large phases, leave the application runnable after each phase.

## 17. Definition of professional completion

A change is professionally complete when it is:

- consistent with PRD;
- consistent with TRD;
- domain-correct;
- secure for its boundary;
- typed and validated;
- visually coherent;
- responsive;
- accessible enough for the interaction;
- test-covered at the appropriate level;
- honest about provenance and AI authority;
- free of obvious hard-coded school/demo assumptions;
- not adding unnecessary teacher burden.

If unsure whether a feature is useful, ask: **does this reduce work or preserve context for the educator, or does it merely create more data for ATE?**

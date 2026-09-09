# Academic Track Engine (ATE)
## Technical Reference Document

**Company:** Bankai Technologies  
**Document:** TRD.md  
**Version:** 4.0  
**Status:** Technical specification of record  
**Date:** 9 September 2026

> `PRD.md` defines product truth. This document defines how the production system is built so that the PRD remains true.

## 1. Architectural position

ATE is a **TypeScript modular monolith** with three strict logical domains:

1. **Academic Knowledge** — curriculum, assessment profiles, provenance, rights and retrieval.
2. **Academic Operations** — schools, users, timetable, Teaching Sections, academic state and artifacts.
3. **Academic Intelligence** — AI-assisted planning, assessment, resources, reporting and contextual reasoning.

These domains share one application/deployment boundary initially. Do not split them into microservices without a demonstrated scaling or organisational need.

## 2. Locked technology stack

| Layer | Technology |
|---|---|
| Language | TypeScript, strict mode |
| Runtime | Node.js LTS |
| Frontend/App | Next.js + React, App Router |
| Package manager | pnpm |
| Monorepo | Turborepo |
| Styling | Tailwind CSS |
| UI primitives | Radix UI + customised shadcn/ui |
| Icons | Lucide |
| Server state | TanStack Query where useful |
| Client/UI state | Zustand, UI/draft state only |
| Forms | React Hook Form |
| Validation | Zod |
| Database | PostgreSQL |
| Managed DB/Auth/Storage | Supabase |
| Schema/migrations | Drizzle ORM / Drizzle Kit |
| Tenant isolation | PostgreSQL Row-Level Security |
| Semantic retrieval | pgvector, secondary path only |
| AI transport | Vercel AI SDK where useful |
| AI boundary | ATE AI Gateway |
| Background jobs | Trigger.dev |
| Offline/PWA | Serwist + IndexedDB/Dexie |
| PDF generation | @react-pdf/renderer |
| DOCX generation | docx |
| DOCX template mapping | Docxtemplater where appropriate |
| PDF parsing | pdfjs-dist/server parser + fallback |
| DOCX parsing | Mammoth |
| Spreadsheet parsing | ExcelJS |
| Unit/integration tests | Vitest |
| Browser/E2E | Playwright |
| Error monitoring | Sentry |
| Hosting | Vercel |
| CI/CD | GitHub Actions + Vercel |
| Source control | GitHub |

Explicit non-choices at this stage:
- microservices;
- Kubernetes;
- Kafka/RabbitMQ;
- separate graph database;
- separate vector database;
- Elasticsearch/OpenSearch;
- a separate Python/FastAPI backend;
- learner analytics infrastructure.

## 3. High-level architecture

```text
ATE WEB / PWA
     │
Experience / UI
     │
Application Services
     │
┌────┼───────────────────────────────┐
│    │                               │
▼    ▼                               ▼
Knowledge                    Operations                    Intelligence
│                            │                             │
└────────────────────────────┼─────────────────────────────┘
                             │
                       Domain boundaries
                             │
        ┌────────────────────┼────────────────────┐
        ▼                    ▼                    ▼
   PostgreSQL          Private Storage       Background Jobs
   + pgvector           (Supabase)            (Trigger.dev)
                                                   │
                                                   ▼
                                     AI/Search/YouTube/SMS providers
```

## 4. Repository direction

Target structure:

```text
academic-track/
├── apps/
│   └── web/
├── packages/
│   ├── domain/
│   ├── database/
│   ├── knowledge/
│   ├── intelligence/
│   ├── documents/
│   ├── design-system/
│   └── shared/
├── knowledge-tools/
│   ├── extraction/
│   ├── validation/
│   ├── import/
│   └── fixtures/
├── supabase/
│   ├── migrations/
│   ├── policies/
│   └── seed/
├── trigger/
├── evals/
├── tests/
├── docs/
├── PRD.md
├── TRD.md
├── DESIGN.md
└── AGENTS.md
```

This is a migration target, not permission for an uncontrolled file-moving rewrite. Follow `docs/V4_MIGRATION_PLAN.md`.

## 5. Product experience architecture

UI is a first-class engineering boundary.

### 5.1 One role-adaptive app
Do not build separate Teacher/HOD/DOS/HT applications. A single authenticated application exposes capabilities according to memberships and additive roles.

### 5.2 Teacher UI
Primary validation widths: 360, 390 and 430 px.

Requirements:
- next lesson/action visible immediately;
- low density;
- large touch targets;
- short navigation paths;
- fast outcome capture;
- meaningful offline/degraded states.

### 5.3 Leadership UI
Primary desktop validation widths: 1280, 1440 and 1600 px.

Requirements:
- exception-first;
- action-oriented;
- low noise;
- explainable;
- responsive;
- no surveillance dashboards.

### 5.4 Design system
Build domain components above Radix/shadcn primitives. No page-specific visual system.

## 6. Core data model

### 6.1 Identity/tenancy
Core entities:
- `schools`
- `users`
- `school_memberships`
- `roles`
- `membership_roles`
- `departments`

Roles are additive.

Every school-owned record is tenant-scoped by `school_id`.

### 6.2 Academic structure
- `academic_years`
- `terms`
- `levels`
- `streams`
- `subjects`
- `teaching_sections`

Teaching Section remains the operational anchor.

### 6.3 Timetable/programme
- `timetable_versions`
- `timetable_slots`
- `school_programme_versions`
- `school_events`

Only an activated verified version becomes current operational truth.

### 6.4 Classroom state
- `section_curriculum_positions`
- `lesson_events`
- `lesson_outcomes`
- `unfinished_work`

A scheduled timetable slot never implies a completed lesson. Missing outcome remains `UNCONFIRMED`.

### 6.5 Artifacts
Common artifact model:
- `artifacts`
- `artifact_versions`
- subtype/domain tables as required.

Artifact types include lesson readiness, formal lesson plan, scheme, assessment, marking guide, rubric, score sheet and report.

## 7. Digital Twin implementation

Do not create a single mutable `digital_twin` blob.

The Digital Twin is assembled from current verified entities through typed context/query functions such as:

```ts
getTeachingSectionContext(sectionId)
getDepartmentContext(departmentId)
getAcademicOperationsContext(schoolId)
getAcademicAssuranceContext(schoolId)
```

## 8. Persistence and versioning

Use normal relational state for current records and explicit version/event records where history matters.

Version:
- timetable;
- school programme;
- teacher assignments when changed;
- curriculum source versions;
- school templates;
- artifact versions;
- curriculum position corrections where material.

Audit/event records should cover consequential actions such as:
- invitation accepted;
- role changed;
- timetable activated;
- lesson outcome confirmed/corrected;
- assessment finalised;
- recovery decision approved;
- AI artifact patch applied.

Do not adopt full event sourcing for the whole product.

## 9. Academic Knowledge Platform

### 9.1 Source Registry
Each source records:
- source id;
- authority;
- document type;
- level;
- subject;
- version/effective year;
- checksum;
- rights status;
- permission reference where applicable;
- processing status;
- verification status.

### 9.2 Knowledge layers
Keep separate:
1. **Curriculum Knowledge** — what should be taught.
2. **Assessment Knowledge** — how learning should be assessed.
3. **School/Classroom State** — what actually happened.

AI operates on these layers; it does not merge their authority.

### 9.3 Canonical curriculum entities
Representative entities:
- subjects;
- levels;
- terms;
- topics/subtopics;
- learning outcomes;
- competencies;
- learning experiences;
- generic skills;
- values;
- cross-cutting issues;
- resources;
- assessment objectives;
- constructs;
- abilities;
- indicators of mastery;
- paper/rubric rules;
- source spans;
- curriculum relationships.

## 10. Curriculum source pipeline

Production flow:

```text
authorised original document
        ↓
private object storage
        ↓
source registry + checksum + rights state
        ↓
extraction pipeline
        ↓
canonical JSON / JSONL work product
        ↓
validation + human review
        ↓
PostgreSQL knowledge tables
        ↓
rights-aware retrieval API
```

### 10.1 What stays in Git
The repository may contain:
- schemas;
- extractors;
- validators;
- importers;
- synthetic fixtures;
- test/evaluation cases;
- source manifests that do not reproduce protected content unnecessarily.

### 10.2 What does not stay in Git
Do not commit:
- protected raw curriculum PDFs;
- production extracted protected corpus;
- school-private timetables/templates;
- private user data;
- secrets.

The local `knowledge-sources/` working area is gitignored and documented for controlled ingestion.

## 11. Retrieval

Use the least complex retrieval method that is correct.

### 11.1 Exact structured lookup — default
Use relational queries for:
- subject;
- level;
- term;
- topic;
- outcome;
- assessment profile.

### 11.2 Relationship traversal
Use normal PostgreSQL relationship tables/recursive queries for prerequisites and curriculum links.

### 11.3 Semantic retrieval — secondary
Use pgvector only where free-text semantic matching materially helps.

Do not use vector search as the source of truth.

## 12. Rights gate

Every curriculum-specific retrieval checks:
- source rights status;
- permitted use;
- current validity/version;
- whether external AI processing is allowed;
- attribution requirements.

If rights do not permit a requested operation, fail closed or use an explicitly authorised reference mode. Do not silently send protected text to external providers.

## 13. AI Gateway

All AI calls pass through one ATE boundary.

Feature modules must not instantiate provider SDKs directly.

Conceptual interface:

```ts
interface AIProvider {
  generateText(input: TextRequest): Promise<TextResult>
  generateStructured<T>(input: StructuredRequest<T>): Promise<T>
}
```

The Gateway owns:
- provider routing;
- retry/degradation policy;
- timeouts;
- prompt/workflow version;
- structured output validation;
- cost/latency telemetry;
- data minimisation;
- provider-safe identifiers;
- evaluation hooks.

## 14. Context Assembler

Before an AI workflow runs, the Context Assembler gathers only necessary authorised context:

- user and role;
- school;
- Teaching Section;
- timetable slot;
- current curriculum position;
- previous confirmed lesson outcome;
- unfinished work;
- scheme position;
- classroom/resource constraints;
- active artifact;
- assessment profile where relevant;
- rights/provenance metadata.

This component is deterministic infrastructure, not an AI agent.

## 15. AI authority boundary

Normal pattern:

```text
user request
  ↓
authorisation
  ↓
context assembly
  ↓
rights-aware retrieval
  ↓
AI workflow
  ↓
Zod validation
  ↓
domain quality checks
  ↓
draft/proposed patch
  ↓
human confirmation
  ↓
normal application code writes state
```

AI never directly writes official academic state.

## 16. Lesson Planning Engine

Pipeline:

```text
Teaching Section
 → curriculum anchor
 → previous confirmed state
 → scheme position
 → class/resource conditions
 → scope for available time
 → pedagogy/activity selection
 → formative evidence design
 → resource discovery
 → structured lesson draft
 → lesson quality evaluator
 → teacher review
 → save/version/export
```

Formal Lesson Plan is structured data, not one Markdown blob.

Quality checks include:
- official outcome altered;
- activity misaligned to outcome;
- impossible resources;
- unrealistic timing;
- fake generic-skill claims;
- missing formative evidence;
- ignored unfinished work;
- safety issues.

## 17. Ask ATE

Ask ATE is scoped to current product context.

Response contract may include:

```ts
{
  message: string
  proposedPatch?: ArtifactPatch
  suggestedActions?: SuggestedAction[]
}
```

Applying a patch requires explicit user action.

## 18. Assessment Engine

Generation order:

```text
purpose
 → regime/profile
 → eligible taught scope
 → constructs/competencies/outcomes
 → evidence requirement
 → blueprint
 → scenarios/items
 → scoring instrument
 → quality evaluation
 → teacher review
 → finalise/export
```

### 18.1 Lower Secondary
Use versioned Lower Secondary profiles. Formative tasks may involve observation, conversation and product evidence; do not collapse all assessment into written tests.

### 18.2 Advanced Secondary
Use the overall Advanced Secondary framework plus the subject-specific profile when available.

Store structured:
- assessment objectives;
- constructs;
- outcomes;
- abilities;
- indicators of mastery;
- complexity;
- paper structures;
- rubric rules.

### 18.3 Deterministic scope guard
Confirmed taught content is eligible for normal class tests. Partial/unconfirmed/not-taught content is excluded unless purpose explicitly permits it. Common Stream Test uses intersection of confirmed eligible scope.

### 18.4 Quality evaluator
Check:
- curriculum alignment;
- out-of-scope content;
- construct/competency actually elicited;
- scenario authenticity;
- cognitive demand;
- fairness/bias;
- wording clarity;
- timing/marks;
- duplicates;
- impossible data;
- topic balance;
- scoring/rubric quality;
- correct level/subject/regime.

## 19. Improve Existing Paper

Ingestion pipeline:

```text
PDF/DOCX upload
 → parse document
 → identify items/sections
 → map to curriculum/assessment profile
 → quality audit
 → issue list
 → teacher chooses Keep / Rewrite / Replace
```

Never silently rewrite the entire paper.

## 20. Resource Discovery

Resource workflow:
1. receive structured lesson context;
2. query supported external sources;
3. verify URL/provider metadata;
4. rank for relevance, duration, practicality and constraints;
5. return a small set of recommendations;
6. teacher opens/ignores/saves/attaches.

Store metadata rather than copying external content unless permission exists.

## 21. Document architecture

The same canonical artifact drives:
- UI rendering;
- PDF;
- DOCX.

Never maintain separate divergent text copies.

School templates are private files mapped once to canonical artifact fields.

## 22. Onboarding extraction

Timetable/programme/template ingestion may use AI for extraction but must follow:

```text
file
 → parser/OCR/multimodal extraction where necessary
 → structured proposal
 → deterministic validation/conflict checks
 → human verification
 → activated operational state
```

AI extraction is not operational truth until confirmed.

## 23. Background jobs

Use Trigger.dev for slow/durable work such as:
- curriculum ingestion;
- timetable/programme extraction;
- large document parsing;
- assessment paper audit;
- long AI generation;
- PDF/DOCX generation when appropriate;
- resource link verification;
- report generation.

Normal interactive requests should not wait synchronously for unnecessary long jobs.

## 24. Authentication and security

### 24.1 Authentication
Use Supabase Auth.

### 24.2 Authorisation
Use server-side permission checks plus PostgreSQL RLS.

Never trust:
- hidden UI;
- client-supplied school id;
- client-supplied role;
- route visibility

as the authorisation boundary.

### 24.3 Tenant isolation
Every school-owned table includes `school_id` or derives tenant ownership through a protected relation.

Cross-school access must be impossible under policy tests.

### 24.4 External AI privacy
Use minimum necessary context. Prefer internal identifiers over real teacher/school names where identity is not required. Never send secrets or unrelated records.

## 25. File/storage security

Use private Supabase Storage buckets for:
- source documents;
- timetable/programme uploads;
- school templates;
- generated private artifacts where persisted.

Use signed URLs with short lifetimes for authorised access.

Do not expose service-role keys to the browser.

## 26. Offline/PWA architecture

Offline scope is intentionally narrow.

Cache:
- today’s timetable;
- current Teaching Section context;
- selected saved lesson artifacts;
- required local metadata.

Allow offline lesson-outcome capture via IndexedDB/Dexie and a sync queue.

Server remains authoritative. Conflicts must be explicit; do not silently overwrite later confirmed state.

AI generation may remain online-only initially.

## 27. Reporting architecture

Reporting follows:

```text
PostgreSQL facts
 → deterministic aggregation/rules
 → reporting context
 → AI explanation/summarisation
 → editable brief
 → export
```

AI never invents the underlying figures or event state.

## 28. Exception and escalation engine

Store evidence and deterministic rule results separately from AI explanations.

Conceptual issue model:
- issue type;
- evidence refs;
- current owner;
- required authority;
- severity/urgency rules;
- possible actions;
- status.

AI may explain patterns and options, but escalation eligibility must be deterministic where rules exist.

## 29. Testing strategy

### 29.1 Unit/domain
Vitest for:
- Teaching Section transitions;
- outcome state;
- assessment scope;
- common-stream intersection;
- timetable conflict logic;
- escalation rules;
- permission helpers;
- artifact patch validation.

### 29.2 Integration
Test:
- database repositories;
- auth/membership logic;
- storage access;
- curriculum retrieval;
- AI Gateway contracts;
- document rendering.

### 29.3 Access/RLS
Adversarial tests for:
- cross-school isolation;
- teacher scope;
- HOD department scope;
- DOS operations scope;
- HT institutional scope;
- revoked membership.

### 29.4 Browser/E2E
Playwright critical flows:
- school setup/timetable verification;
- teacher invitation/onboarding;
- Teacher Home;
- prepare lesson;
- Ask ATE patch + apply;
- record outcome and next-lesson continuity;
- create assessment;
- improve existing paper;
- export artifact;
- HOD/DOS/HT role views.

### 29.5 Visual regression
Protect critical mobile/desktop surfaces and verify loading, empty, error and long-content states.

## 30. AI evaluation

Every important AI workflow has:
- input schema;
- output schema;
- prompt/workflow version;
- golden cases;
- failure cases;
- quality rubric;
- minimum acceptance threshold.

Required representative evals include:
- Lower Secondary lesson plan;
- Advanced Secondary lesson plan;
- Lower Secondary Physics assessment;
- Advanced Secondary Physics assessment;
- existing-paper audit;
- retrieval/provenance;
- resource recommendation.

Do not treat “Zod passed” as sufficient academic quality.

## 31. Observability

Capture:
- application errors;
- AI provider errors;
- workflow latency;
- background job failures;
- export failures;
- auth/storage failures;
- model usage/cost;
- sync conflicts;
- key performance timings.

Do not log protected document content or unnecessary personal data.

## 32. Environments

Maintain:
- local;
- preview/staging;
- production.

Environment variables are never committed.

At minimum expect configuration groups for:
- Supabase;
- AI providers/gateway;
- Trigger.dev;
- Sentry;
- external search/video APIs;
- application URLs.

## 33. CI/CD

Pull requests should run:
- typecheck;
- lint;
- unit tests;
- relevant integration tests;
- build.

As infrastructure matures, add:
- Playwright smoke tests;
- RLS/access tests;
- AI eval regression checks;
- visual regression.

Vercel preview deployments should be used for UI/product review.

## 34. Failure/degradation model

If AI is unavailable, preserve:
- login;
- timetable;
- Teaching Sections;
- saved plans/schemes/assessments;
- lesson outcomes;
- academic state;
- reports already generated;
- leadership views based on existing data.

Temporarily unavailable:
- new AI generation;
- Ask ATE reasoning;
- new resource discovery requiring providers.

This is a core design constraint.

## 35. Engineering rules for Codex

- read `PRD.md`, `TRD.md`, `AGENTS.md` and `DESIGN.md` before substantive feature work;
- follow `docs/V4_MIGRATION_PLAN.md`;
- preserve working current behavior where it remains compatible;
- do not add infrastructure speculatively;
- keep business rules out of React render branches;
- use strict TypeScript and Zod at boundaries;
- write tests for deterministic state before adding AI around it;
- visually inspect UI; compilation is not a design review;
- never hard-code one school/subject/stream as product architecture;
- do not expand protected curriculum content in Git.

## 36. Definition of technical completion

ATE v4 is technically ready for controlled production use when:
- Postgres/Supabase is system of record;
- Auth + RLS enforce tenancy;
- onboarding creates verified Teaching Sections;
- curriculum retrieval is rights-aware and provenance-preserving;
- lesson planning and assessment meet evaluation thresholds;
- AI calls flow through the Gateway;
- canonical artifacts render to UI/PDF/DOCX;
- leadership views derive from the same academic state;
- critical teacher mobile flow works under intermittent connectivity;
- CI/security/eval gates are operational.

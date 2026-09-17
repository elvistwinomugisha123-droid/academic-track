> **HISTORICAL PROTOTYPE ARCHITECTURE:** This file predates the September 2026 ATE v1 rebuild. Use `AGENTS.md` and `docs/ATE_V1_PRODUCT_SPEC.md` as current authority.

# Architecture — Academic Track Engine

## 1. Architecture Goal

The initial architecture should support the current product correctly with the smallest maintainable system.

The architecture must:
- preserve clean domain boundaries;
- keep curriculum authority separate from generated AI output;
- support deterministic state propagation;
- make UI state consistent across roles;
- permit AI provider substitution;
- permit later migration to durable backend persistence;
- avoid speculative infrastructure.

## 2. Current Technology Direction

### Application
- Next.js
- TypeScript strict mode

### UI
- Tailwind CSS
- Radix UI primitives
- customized shadcn components where helpful
- Lucide icons
- Motion for restrained transitions
- TanStack Table for timetable / dense operational tables
- React Hook Form
- Zod

### State
- Zustand
- browser persistence for the initial release

### AI
- server-side Next.js route handlers
- one primary hosted model provider
- structured JSON output
- Zod validation
- deterministic fallback fixtures where operationally necessary

### Documents
- `@react-pdf/renderer` or equivalent for assessment/marking-guide PDF generation

## 3. High-Level Architecture

```text
┌──────────────────────────────────────────┐
│              Next.js UI                 │
│                                          │
│ Teacher  HOD  DOS  Principal             │
└────────────────┬─────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────┐
│         Application / Domain Layer       │
│                                          │
│ lesson state                             │
│ teaching-section state                   │
│ assessment scope                         │
│ exception/recovery rules                 │
│ role-derived views                       │
└───────────┬─────────────────┬────────────┘
            │                 │
            ▼                 ▼
┌───────────────────┐   ┌──────────────────┐
│ Structured        │   │ AI Orchestration │
│ Curriculum Data   │   │                  │
│                   │   │ lesson drafts    │
│ NCDC authority    │   │ assessments      │
│ framework rules   │   │ Ask ATE          │
└───────────────────┘   │ resource ranking │
                        └─────────┬────────┘
                                  │
                                  ▼
                        ┌──────────────────┐
                        │ External APIs    │
                        │ model provider   │
                        │ resource search  │
                        └──────────────────┘
```

## 4. Layer Responsibilities

### 4.1 Presentation Layer

Responsible for:
- rendering state;
- collecting user intent;
- accessibility;
- responsive behavior;
- local interaction state.

Not responsible for:
- curriculum interpretation;
- assessment eligibility;
- recovery decision logic;
- state propagation rules.

### 4.2 Domain Layer

Responsible for deterministic academic behavior:
- Teaching Section state;
- scheduled lesson state;
- lesson outcomes;
- unfinished work;
- confirmed addressed content;
- assessment eligibility;
- common assessment intersection;
- role escalation;
- recovery eligibility;
- unconfirmed state.

This layer must remain callable independently from React components.

### 4.3 Curriculum Data Layer

Responsible for:
- canonical curriculum entities;
- source provenance;
- runtime curriculum context;
- framework guidance;
- restrictions/notes.

The data layer does not call AI to decide curriculum truth at runtime.

### 4.4 AI Orchestration Layer

Responsible for:
- building compact model context;
- calling model provider;
- validating structured output;
- applying retries/fallbacks;
- returning recommendations/drafts.

Not responsible for:
- establishing curriculum authority;
- changing school truth;
- confirming classroom outcomes;
- approving actions.

### 4.5 External Resource Providers

Provider adapters may include:
- video search;
- book metadata search;
- web resource search;
- school resource catalog.

Provider adapters return source facts.

AI can rank/explain candidates but does not invent provider metadata.

## 5. State Architecture

Use one coherent store or domain-state source.

Expected broad state:

```ts
type ATEState = {
  school: School;
  academicTerm: AcademicTerm;
  people: Person[];
  teachingSections: TeachingSection[];
  timetable: Timetable;
  scheduledLessons: ScheduledLesson[];
  lessonReadiness: LessonReadiness[];
  lessonOutcomes: LessonOutcome[];
  assessmentDrafts: Assessment[];
  recoveryCases: RecoveryCase[];
  resources: LearningResource[];
  activeRole: Role;
  activeUserId: string;
}
```

Avoid independent role-specific data stores containing duplicated academic truth.

Role views should be derived.

## 6. State Transition Pattern

Example:

```text
recordLessonOutcome()
  -> validate actor and scheduled lesson
  -> persist lesson outcome
  -> update TeachingSection confirmed state
  -> derive unfinished work
  -> derive next lesson context
  -> derive stream drift
  -> evaluate exception state
  -> derive role summaries
```

AI is not required for this state transition.

## 7. AI Endpoint Direction

Initial route pattern:

```text
POST /api/ai
```

Request:

```ts
type AIWorkflow =
  | "LESSON_READINESS"
  | "ADAPT_LESSON"
  | "ASSESSMENT_DRAFT"
  | "ASK_ATE"
  | "RESOURCE_RANKING";
```

The route:
1. validates input;
2. builds compact context;
3. calls provider;
4. validates output;
5. returns typed data.

Provider keys never ship to browser code.

## 8. Model Abstraction

Use a small adapter interface.

```ts
interface ModelProvider {
  generateStructured<T>(
    request: StructuredGenerationRequest<T>
  ): Promise<T>;
}
```

Do not build a multi-model router in the initial release.

A single provider is enough.

Preserve provider substitution by isolating provider-specific code.

## 9. Error / Fallback Behavior

The product must remain usable when AI generation fails.

AI failure should not break:
- Teacher Home;
- timetable browsing;
- lesson outcome recording;
- current Teaching Section state;
- leadership views;
- existing saved lesson artifacts;
- existing assessments.

For important guided product flows, a deterministic valid fallback fixture may be used in the initial release when configured.

Fallback behavior must not pretend a live AI result occurred.

## 10. Timetable Extraction

Timetable extraction is conceptually:

```text
source upload
 -> extraction result
 -> confidence / ambiguity
 -> DOS verification
 -> activation
```

The initial implementation may use prepared extraction data rather than production OCR.

Keep the boundary explicit so real OCR/vision extraction can replace the adapter later.

## 11. PDF Generation

Assessment data remains structured.

PDF generation is a rendering concern.

Do not store the generated PDF as the primary assessment data model.

Expected:

```text
Assessment object
  -> Question Paper renderer
  -> Marking Guide renderer
```

## 12. Future Migration Path

The likely pilot/production migration path may add:
- real authentication;
- durable Postgres persistence;
- multi-school tenancy;
- audit log;
- object storage;
- offline event synchronization;
- observability;
- background jobs;
- role-based authorization;
- encrypted secret management.

Do not implement these now solely because they may be needed later.

Clean interfaces are the migration strategy.

## 13. Explicitly Rejected Initial Complexity

Do not add:
- microservices;
- Kubernetes;
- Redis;
- Kafka;
- Celery;
- separate FastAPI service;
- vector database;
- production multi-tenancy;
- generalized event bus;
- CQRS;
- full workflow engine.

These can be revisited only when validated product requirements justify them.

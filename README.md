# Academic Track Engine

Academic Track Engine (ATE) is a **teacher-first curriculum implementation and academic operations platform for secondary schools**, built by Bankai Technologies.

ATE connects:
- curriculum and assessment authority;
- school operational context;
- teacher-confirmed classroom reality;
- academic planning, assessment, resources and authorised action.

The repository is currently migrating the existing working prototype to the ATE v4 production architecture.

## Start here

Before implementing or modifying the product, read in this order:

1. `PRD.md` — product specification of record.
2. `TRD.md` — technical specification of record.
3. `AGENTS.md` — Codex/agent operating contract.
4. `DESIGN.md` — UI/UX specification of record.
5. `CODEX_SETUP.md` — Codex skills, working method and first prompts.
6. `docs/V4_MIGRATION_PLAN.md` — phased migration plan.
7. `docs/DECISIONS.md` — historical accepted decisions that do not conflict with v4.
8. other `docs/` files as historical/domain context.

`PRODUCT.md`, older architecture/implementation documents and Biology-first prototype data predate v4. They may help explain the current codebase but they do **not** override `PRD.md` or `TRD.md`.

## Product scope

ATE is not Biology-only.

The architecture is subject-agnostic and level-aware. Curriculum intelligence is activated only where the relevant curriculum/assessment source has been structured, verified and is legally/operationally eligible for use.

The product supports the following core areas:

- school workspace and secure role-based onboarding;
- timetable and school-programme ingestion/verification;
- Teaching Sections and current classroom position;
- Scheme of Work;
- Quick Lesson Readiness;
- professional Formal Lesson Plans;
- contextual Ask ATE;
- lesson continuity and unfinished work;
- curriculum-aware resource discovery;
- Lower Secondary and Advanced Secondary assessment profiles;
- Create Assessment;
- Improve Existing Paper;
- marking guides/rubrics/score sheets;
- PDF/DOCX academic artifacts;
- HOD department coordination;
- DOS academic operations;
- Head Teacher / Principal academic assurance;
- reports generated from existing academic state;
- narrow offline/PWA support for critical teacher workflows.

Current non-goals include learner accounts, learner marks database, AI grading, learner profiling, teacher rankings and generic school ERP functionality.

## Core authority model

ATE keeps four categories separate:

1. **Curriculum authority** — what authorised curriculum/assessment sources state.
2. **School operational truth** — timetable, assignments, school structure, programme and approved configuration.
3. **Classroom reality** — teacher-confirmed facts about what actually happened.
4. **AI reasoning** — drafts, explanations, adaptations and recommendations.

AI is not the system of record.

## Technology direction

The v4 target stack is defined in `TRD.md`. Core choices include:

- TypeScript strict mode;
- Next.js + React;
- pnpm + Turborepo;
- Tailwind CSS;
- Radix UI + customised shadcn/ui;
- Zustand for UI/draft state;
- Zod;
- PostgreSQL;
- Supabase Auth/Storage/RLS;
- Drizzle ORM;
- pgvector only where semantic retrieval adds value;
- ATE AI Gateway/provider abstraction;
- Trigger.dev;
- PWA/IndexedDB;
- PDF + DOCX generation;
- Vitest + Playwright;
- Sentry;
- Vercel + GitHub Actions.

ATE remains a modular monolith at this stage.

## Codex setup

Run:

```bash
bash scripts/setup-codex.sh
```

This installs or refreshes the recommended local Codex skills:

- Impeccable;
- Emil Kowalski `emil-design-eng`;
- `gpt-taste`;
- Vercel `react-best-practices`;
- Vercel `web-design-guidelines`;
- ATE-owned test-engineering skill;
- ATE-owned UI-verification skill.

See `CODEX_SETUP.md` for exact usage and the first baseline-audit prompt.

## Curriculum/source documents

**Do not commit protected source PDFs or the extracted protected production corpus to Git.**

Use the local gitignored workspace:

```text
knowledge-sources/
├── raw/
├── derived/
├── review/
└── README.md
```

Place source PDFs in `knowledge-sources/raw/` locally. Codex/knowledge tooling can then inventory, manifest, extract and validate them into the local derived/review areas.

The intended production path is:

```text
authorised original PDF
  → private source storage
  → source registry + rights/version metadata
  → structured JSON/JSONL extraction
  → validation/human review
  → PostgreSQL knowledge layer
  → rights-aware retrieval
```

The repository contains the **code and schemas for this pipeline**, not the protected production corpus.

See `knowledge-sources/README.md` and `TRD.md`.

## Migration

Do not perform an uncontrolled rewrite of the current application.

The upgrade sequence is defined in `docs/V4_MIGRATION_PLAN.md`. The first Codex task should be a baseline audit of the current working product before structural migration begins.

## Quality bar

A feature is not complete because it compiles.

Relevant work must include:
- strict type checking;
- lint;
- deterministic tests;
- access/RLS tests where relevant;
- Playwright for critical flows;
- visual/responsive inspection for UI;
- AI evaluation where AI behavior changes;
- production build.

The product should look and behave like credible institutional academic software, not an AI demo.

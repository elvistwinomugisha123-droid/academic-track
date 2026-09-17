> **ATE v4 notice — 9 September 2026:** This file predates the v4 product/technical split. It is retained as historical implementation context. Where it conflicts with `PRD.md`, `TRD.md`, `AGENTS.md`, `DESIGN.md` or `docs/V4_MIGRATION_PLAN.md`, the v4 documents take precedence.

# Implementation Plan — Academic Track Engine

> **HISTORICAL PROTOTYPE PLAN:** This file is retained for context only. The current rebuild sequence is defined in `docs/ATE_V1_PRODUCT_SPEC.md` and the approved Step 2 execution plan.

## 1. Strategy

Build one coherent vertical academic system.

Do not build isolated screenshots.

Each phase should leave the product in a runnable, reviewable state.

## 2. Phase 0 — Repository Bootstrap

Deliver:
- Next.js + TypeScript project;
- strict mode;
- linting;
- design dependencies;
- state dependencies;
- PDF dependency;
- project-local skills;
- repository docs;
- basic CI/local validation scripts.

Exit criteria:
- project runs;
- typecheck works;
- lint works.

## 3. Phase 1 — Design System

Deliver:
- semantic CSS variables;
- typography;
- spacing tokens;
- app shell;
- teacher mobile shell;
- leadership desktop shell;
- buttons;
- inputs;
- selects;
- tabs;
- dialog/sheet;
- status badges;
- provenance badges;
- Teaching Section identity;
- exception panel;
- assessment scope summary;
- lesson state;
- `/design-system`.

Use:
- gpt-taste
- emil-design-eng
- Impeccable critique

Exit:
- visual system approved before page proliferation.

## 4. Phase 2 — Domain Data & State

Deliver:
- typed school configuration;
- people/roles;
- timetable;
- Teaching Sections;
- scheduled lessons;
- curriculum loader;
- lesson outcomes;
- implementation state;
- unfinished work;
- assessment scope engine;
- exception/recovery engine;
- role-derived selectors.

Tests:
- unconfirmed logic;
- partial lesson;
- missed lesson;
- common test intersection;
- recovery escalation.

## 5. Phase 3 — Teacher Core

Deliver:
- Teacher Home;
- Lesson Readiness display;
- lesson outcome capture;
- state propagation;
- multi-stream continuity.

Initially, Lesson Readiness can load a valid structured fixture before live AI is integrated.

Exit:
- recording a lesson outcome visibly changes the next lesson context.

## 6. Phase 4 — AI Lesson Workflows

Deliver:
- server-side model adapter;
- lesson readiness schema;
- lesson generation;
- lesson adaptation;
- Ask ATE;
- fallback/error handling;
- provenance.

Exit:
- live generation produces structured valid UI;
- invalid model output cannot break rendering.

## 7. Phase 5 — Assessment

Deliver:
- mode selection;
- deterministic scope;
- generation schema;
- question editor;
- question provenance;
- class test guard;
- diagnostic distinction;
- common stream scope;
- question-paper preview;
- PDF export;
- marking-guide export.

Exit:
- teacher can generate a real assessment and export it.

## 8. Phase 6 — HOD

Deliver:
- department Teaching Sections;
- stream drift;
- unconfirmed state;
- common assessment readiness;
- resource approval placeholder/state.

Exit:
- HOD view derives from same state changed by teacher.

## 9. Phase 7 — DOS

Deliver:
- timetable review workflow;
- academic exceptions;
- recovery case;
- absorbability state;
- approve/modify/decline.

Exit:
- missed/unfinished state can create DOS action only when rules require.

## 10. Phase 8 — Principal

Deliver:
- aggregate academic health;
- institutional issues;
- department attention;
- DOS action;
- unconfirmed state;
- teacher burden indicator only if grounded in actual app telemetry/state.

Exit:
- Principal sees lower resolution than DOS.

## 11. Phase 9 — Resource Discovery

Deliver:
- curriculum activity card;
- school resource card;
- ATE adaptation;
- external resource card;
- provider adapter boundary;
- optional live video search;
- saved/approved resource states.

Exit:
- resource provenance is visible and correct.

## 12. Phase 10 — Onboarding

Deliver:
- timetable upload shell;
- extraction review;
- activation;
- teacher assignment confirmation.

Real OCR/authentication is not required to prove the current product flow unless explicitly added.

## 13. Phase 11 — Audit & Polish

Run:
- Impeccable audit;
- Impeccable critique;
- Impeccable distill;
- Impeccable polish.

Then:
- manually inspect all roles;
- inspect mobile;
- inspect long content;
- test AI failure;
- test reset;
- test assessment export.

## 14. Implementation Rule

Do not advance to the next phase if the previous phase has unstable domain state or obvious visual inconsistency.

The goal is a coherent product, not maximum feature count.

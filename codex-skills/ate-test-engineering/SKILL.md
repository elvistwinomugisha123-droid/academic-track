---
name: ate-test-engineering
description: ATE-specific test and verification discipline for domain rules, Supabase/RLS, Playwright user flows, AI evals, exports, offline behavior and regression protection.
---

# ATE Test Engineering

Use this skill whenever a change affects product behavior, academic state, permissions, AI workflows, document generation, onboarding, offline sync or a critical user flow.

## 1. Principle

A successful build is not proof of product correctness.

Choose the smallest test layer that can actually prove the behavior, then add higher-level coverage when the boundary crosses systems.

## 2. Required test layers

### Domain / deterministic logic — Vitest
Use for:
- Teaching Section state;
- lesson outcomes;
- unfinished-work carry-forward;
- assessment scope eligibility;
- common-stream intersections;
- timetable conflicts;
- escalation rules;
- artifact patch validation;
- version transitions.

Do not test deterministic rules by asking an LLM.

### Database / repository integration
Use for:
- Drizzle repositories;
- transactions;
- version activation;
- artifact persistence;
- retrieval queries.

### Security / RLS
Whenever access scope changes, test:
- cross-school isolation;
- teacher-own scope;
- HOD department scope;
- DOS operations scope;
- Head Teacher institutional scope;
- revoked/expired membership;
- direct ID guessing;
- signed-storage access.

Hidden navigation is not an access test.

### Browser / E2E — Playwright
Critical flows include:
- school setup;
- timetable verification;
- invitation acceptance;
- teacher assignment confirmation;
- current-position onboarding;
- Teacher Home;
- Quick Readiness;
- Formal Lesson Plan;
- Ask ATE patch/apply;
- lesson outcome and next-lesson continuity;
- assessment creation;
- Improve Existing Paper;
- export;
- HOD/DOS/HT views.

### AI workflow evals
Every consequential AI workflow requires:
- fixed inputs;
- expected invariants;
- golden examples;
- failure examples;
- rubric;
- prompt/workflow version.

Zod validation passing is necessary but not sufficient.

### Document tests
PDF/DOCX generation should verify:
- required sections;
- no missing content;
- stable filename/metadata behavior;
- no duplicated content;
- reasonable pagination/layout for representative long artifacts.

## 3. Regression rules

Before refactoring an existing working flow:
1. capture current expected behavior;
2. add a regression test if the behavior should survive;
3. refactor;
4. rerun the relevant suite.

Do not rewrite first and “add tests later.”

## 4. UI verification matrix

For teacher UI check at least:
- 360 px;
- 390 px;
- 430 px.

For leadership:
- 1280 px;
- 1440 px;
- 1600 px.

Always exercise:
- loading;
- empty;
- error;
- long content;
- permission denied;
- offline/degraded state where relevant.

## 5. AI-specific assertions

Depending on workflow, assert:
- correct curriculum source/profile selected;
- out-of-scope content excluded;
- official outcome text not silently altered;
- no invented provenance;
- no impossible resources;
- human-review state preserved;
- no state-changing write without confirmation.

## 6. Test completion report

When reporting completion, state:
- commands run;
- tests passed/failed/skipped;
- browser widths checked;
- any untested risk;
- any fixture/golden case added;
- whether the production build passed.

Never hide skipped or flaky tests.

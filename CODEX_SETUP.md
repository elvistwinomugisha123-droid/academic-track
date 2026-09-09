# Codex Setup — Academic Track Engine v4

**Status:** Repository setup guide  
**Purpose:** Make Codex work from one consistent product/technical truth and use the right design, engineering and testing skills.

## 1. Repository authority

Codex must use this order:

1. `PRD.md` — what the product must do.
2. `TRD.md` — how the production system is engineered.
3. `AGENTS.md` — operating rules for coding agents.
4. `DESIGN.md` — UI/UX specification.
5. `docs/V4_MIGRATION_PLAN.md` — upgrade sequence.
6. `docs/DECISIONS.md` and other historical docs only where they do not conflict with v4.

`PRODUCT.md`, the old architecture docs and Biology-first prototype fixtures are historical references, not v4 authority.

## 2. Codex philosophy for this repository

ATE is an existing working prototype being upgraded in place.

Codex must:
- inspect before rewriting;
- preserve working behavior that still satisfies v4;
- add tests around valuable behavior before structural migration;
- implement deterministic domain rules before AI;
- treat UI quality as product correctness;
- keep commits narrow and reviewable;
- leave the app runnable at phase boundaries.

Do not ask Codex to “build the whole product” in one prompt.

## 3. Required design and engineering skills

Skills are execution aids. They do not outrank repository truth.

### 3.1 Impeccable

Source:
`pbakaus/impeccable`

Verified installation:

```bash
npx impeccable install --providers=codex --scope=project
```

After installation, Codex may require approval of the project hook through `/hooks`.

Use Impeccable for:
- `/impeccable shape`;
- `/impeccable critique`;
- `/impeccable audit`;
- `/impeccable harden`;
- `/impeccable adapt`;
- `/impeccable polish`.

**Important:** do not run `/impeccable init` if it would overwrite authoritative `PRD.md`, `PRODUCT.md` or `DESIGN.md`. ATE already has product/design truth.

### 3.2 Emil Kowalski — Design Engineering

Source:
`emilkowalski/skills`

Install:

```bash
npx skills@latest add emilkowalski/skills --skill emil-design-eng
```

Primary use:
- interaction craft;
- motion judgement;
- easing/duration;
- component behavior;
- subtle interface quality;
- avoiding unnecessary animation.

Optional companion skills from the same repository may be installed later when a task specifically needs them, such as `review-animations` or `pick-ui-library`.

### 3.3 Taste — Codex/GPT variant

Source:
`Leonxlnx/taste-skill`

Install the Codex-focused variant:

```bash
npx skills@latest add https://github.com/Leonxlnx/taste-skill --skill gpt-taste
```

Use for:
- anti-slop layout decisions;
- stronger visual composition;
- typography/spacing discipline;
- avoiding generic AI dashboard aesthetics.

Do not let Taste force high-variance/flashy design where `DESIGN.md` requires restraint.

### 3.4 Vercel React best practices

Source:
`vercel-labs/agent-skills`

Install:

```bash
npx skills@latest add vercel-labs/agent-skills --skill vercel-react-best-practices
```

Use after meaningful React/Next.js work to review:
- waterfalls;
- bundle cost;
- server/client boundaries;
- rerenders;
- rendering performance;
- component structure.

### 3.5 Vercel Web Design Guidelines

Install:

```bash
npx skills@latest add vercel-labs/agent-skills --skill web-design-guidelines
```

Use for:
- accessibility;
- keyboard/focus;
- forms;
- touch interaction;
- reduced motion;
- typography;
- navigation/state;
- responsive UX;
- performance-related UI issues.

### 3.6 ATE Test Engineering skill

ATE has a repository-owned testing skill at:

`codex-skills/ate-test-engineering/SKILL.md`

The setup script copies it into the project-local agent skills directory.

It enforces the ATE-specific test matrix:
- Vitest domain tests;
- integration tests;
- RLS/access tests;
- Playwright flows;
- responsive/browser verification;
- AI eval regression;
- no “build passed therefore done” behavior.

### 3.7 ATE UI Verification skill

ATE has a repository-owned UI verification skill at:

`codex-skills/ate-ui-verification/SKILL.md`

It forces:
- real mobile/desktop width checks;
- loading/empty/error/offline states;
- accessibility checks;
- screenshot/visual regression review;
- design-system consistency.

## 4. One-command project setup

From the repository root run:

```bash
bash scripts/setup-codex.sh
```

The script installs/refreshes the recommended project-local skills and copies ATE-owned skills into the local agent skills directory.

Third-party skill payloads stay local/ignored. Their install commands and sources remain reproducible in this repository.

## 5. Testing toolchain

ATE’s engineering quality stack is:

- **Vitest** — deterministic domain/unit/integration tests;
- **Playwright** — browser/E2E and screenshot verification;
- **PostgreSQL/Supabase test environment** — RLS/tenant isolation;
- **AI eval harness** — golden cases for lesson, assessment, retrieval and resources;
- **TypeScript strict mode** — compile-time correctness;
- **ESLint** — static quality;
- **Vercel preview deployments** — product review;
- **Sentry** — production error/performance monitoring.

The test skill tells Codex which layer is required for a change.

## 6. UI skill precedence

For UI work use:

1. `PRD.md` — user need and product behavior;
2. `DESIGN.md` — visual/interaction truth;
3. existing ATE design-system components;
4. `gpt-taste` — composition/anti-slop;
5. `emil-design-eng` — interaction/motion;
6. Impeccable — shape/critique/audit/polish;
7. `web-design-guidelines` — accessibility and web UX checks;
8. `react-best-practices` — React/Next performance review.

No external skill may redefine product scope.

## 7. First Codex task — baseline audit

Do not start by adding features.

Use:

```text
Read AGENTS.md, PRD.md, TRD.md, DESIGN.md and docs/V4_MIGRATION_PLAN.md.

Do not implement product features yet.

Audit the existing repository against ATE v4 and create docs/V4_BASELINE_AUDIT.md.

The audit must identify:
1. current working routes and workflows;
2. current state/persistence model;
3. direct AI-provider coupling;
4. hard-coded school/subject/stream/demo facts;
5. current curriculum-data imports;
6. current assessment and PDF/export paths;
7. UI/design-system assets worth preserving;
8. missing production infrastructure;
9. test coverage and gaps;
10. a migration map: preserve / refactor / replace / remove.

Run typecheck, lint, tests and build before editing.
Do not perform the migration in the audit task.
```

## 8. Second Codex task — quality foundation

After the audit is reviewed:

```text
Read the v4 authority documents again and the approved V4_BASELINE_AUDIT.md.

Create the quality foundation required for safe migration:
- add/repair Playwright configuration;
- protect current critical flows with smoke tests;
- add responsive screenshot baselines for teacher mobile and leadership desktop;
- establish test/eval directory conventions from TRD.md;
- do not change product behavior except where required to make deterministic tests possible.

Use the ATE Test Engineering and ATE UI Verification skills.
Run all quality gates and report exact results.
```

## 9. Third Codex task — production data foundation

Then begin the first production migration:

```text
Implement the production persistence/identity foundation defined in TRD.md and docs/V4_MIGRATION_PLAN.md.

Scope:
- Supabase/PostgreSQL integration;
- Drizzle schema/migrations;
- school workspace;
- memberships and additive roles;
- TeachingSection as first-class entity;
- RLS/tenant isolation;
- repository interfaces;
- preserve current prototype behavior behind migration seams where practical.

Do not migrate lesson AI or assessment AI in the same change.
Access tests are mandatory.
```

## 10. Subsequent phase order

Follow this order unless an explicit repository decision changes it:

1. baseline + regression safety;
2. design-system reconciliation;
3. production persistence/auth/RLS;
4. school onboarding + timetable/programme;
5. rights-aware knowledge layer;
6. AI Gateway + Context Assembler;
7. Lesson Readiness + Formal Lesson Plan;
8. contextual Ask ATE;
9. Assessment Engine + Improve Existing Paper;
10. Resource Discovery;
11. HOD/DOS/HT role surfaces and reporting;
12. PWA/offline;
13. hardening, evals, security and pilot readiness.

## 11. Prompt pattern for implementation tasks

Every serious Codex prompt should state:

- authoritative files to read;
- exact user problem;
- exact scope;
- state/domain rules;
- explicit non-goals;
- migration constraints;
- validation required;
- design skills to use if UI is involved;
- acceptance condition.

Bad:
> Build the HOD dashboard.

Better:
> Implement HOD Department Pulse from the shared Teaching Section state. Show only meaningful coordination issues, common-assessment readiness and department actions. Do not add teacher rankings or new teacher reporting fields. Use existing design-system components, validate at 1280/1440/1600, run Playwright and Impeccable critique.

## 12. Skill usage by task

| Task | Required/recommended skills |
|---|---|
| New/reworked UI | gpt-taste + emil-design-eng + Impeccable |
| UI audit | Impeccable audit + web-design-guidelines |
| Motion | emil-design-eng; optionally review-animations |
| React refactor | react-best-practices |
| E2E/testing | ate-test-engineering |
| Visual verification | ate-ui-verification + Impeccable adapt |
| Accessibility | web-design-guidelines + ate-ui-verification |
| Final UI polish | Impeccable polish + gpt-taste |
| Domain rules | ate-test-engineering |
| AI workflow | ate-test-engineering + workflow evals |

## 13. Commit discipline

Prefer commits such as:

- `docs: establish ATE v4 source of truth`
- `test: baseline current teacher workflows`
- `feat: add production school identity model`
- `feat: add timetable onboarding foundation`
- `feat: add rights-aware curriculum retrieval`
- `refactor: route AI workflows through ATE gateway`
- `feat: add formal lesson plan artifact`
- `feat: add assessment blueprint engine`
- `feat: add existing-paper audit`
- `feat: add department coordination view`
- `chore: harden pilot release`

Do not combine a database migration, broad UI rewrite and prompt rewrite into one uncontrolled commit.

## 14. Curriculum/PDF working rule

Do not commit a folder of protected PDFs to Git.

The repository contains a gitignored local working area:

```text
knowledge-sources/
├── raw/
├── derived/
├── review/
└── README.md
```

You place source PDFs in `knowledge-sources/raw/` locally.

Codex then:
1. inventories sources;
2. creates source manifests/checksums;
3. extracts canonical structured JSON/JSONL into `derived/`;
4. generates validation/review output;
5. does not treat extraction as verified automatically;
6. later imports rights-authorised content into the production knowledge database.

The whole source/derived corpus stays outside normal Git commits unless a specific item is demonstrably safe and deliberately approved.

## 15. Completion rule for Codex

Codex may call a task complete only when:
- product behavior matches PRD;
- architecture matches TRD;
- relevant tests pass;
- UI has been visually inspected where applicable;
- no new security/rights breach was introduced;
- no unnecessary teacher burden was added;
- the app remains runnable;
- known limitations are explicitly reported.

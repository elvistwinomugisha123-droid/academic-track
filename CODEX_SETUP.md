# Codex Setup — Academic Track Engine

This document defines the recommended Codex environment for building ATE.

## 1. Design Skills

Install the following project-local skills.

### Impeccable

Repository:
`https://github.com/pbakaus/impeccable`

Recommended installation:

```bash
npx impeccable install
```

Choose Codex and project-local scope when prompted.

For Codex, approve the installed project hook via `/hooks` if prompted.

After installation, initialize product context only after `PRODUCT.md` and `DESIGN.md` are present and reviewed. Do not allow generated initialization output to overwrite authoritative project files without review.

Impeccable is used primarily for:
- design critique;
- audit;
- polish;
- distillation;
- anti-pattern detection;
- consistency review.

### Emil Kowalski — Design Engineering

Repository:
`https://github.com/emilkowalski/skills`

Install:

```bash
npx skills@latest add emilkowalski/skills
```

Ensure `emil-design-eng` is available.

Use primarily for:
- interaction craft;
- motion decisions;
- component behavior;
- subtle interface quality;
- animation/easing judgment.

### Taste — GPT/Codex Variant

Repository:
`https://github.com/Leonxlnx/taste-skill`

Install the stricter GPT/Codex variant:

```bash
npx skills add https://github.com/Leonxlnx/taste-skill --skill gpt-taste
```

Use primarily for:
- anti-slop frontend decisions;
- visual composition;
- layout variance;
- avoiding generic AI dashboard aesthetics.

## 2. Skill Precedence

Skills are execution aids.

They do not outrank repository product truth.

Precedence:

1. `docs/DECISIONS.md`
2. `PRODUCT.md`
3. `docs/DOMAIN_MODEL.md`
4. `docs/ARCHITECTURE.md`
5. `curriculum-data/` for curriculum facts
6. `DESIGN.md`
7. `docs/PRODUCT_FLOWS.md`
8. design skills
9. visual reference images

## 3. Repository-Local Installation

Prefer project-local skills so the repository is reproducible.

Expected structure after installation may include:

```text
.agents/
  skills/
    impeccable/
    emil-design-eng/
    gpt-taste/

.codex/
  hooks.json
```

Exact generated structure can vary by installer version. Do not manually duplicate skills if installers already created them.

## 4. Recommended Codex Working Method

### Phase A — Establish repository understanding

Prompt Codex to:

1. read `AGENTS.md`;
2. read `PRODUCT.md`;
3. read `DESIGN.md`;
4. read all current docs in `docs/`;
5. inspect `reference-ui/README.md`;
6. inspect the structured curriculum directory;
7. summarize constraints before coding.

Do not ask Codex to build the whole product in the first prompt.

### Phase B — Build design system foundation

Before product screens:

1. create design tokens;
2. create base application shell;
3. create ATE domain components;
4. create a `/design-system` route;
5. render typography, controls, statuses, provenance, lesson components, exception components, and responsive shells;
6. run design critique;
7. refine.

Suggested skills:
- `gpt-taste`
- `emil-design-eng`
- Impeccable critique/audit

### Phase C — Build domain/state foundation

Before AI:

1. implement typed domain models;
2. load configuration data;
3. load curriculum data;
4. implement deterministic state transitions;
5. implement derived role views;
6. test propagation.

### Phase D — Build teacher core loop

Recommended order:

1. Teacher Home
2. Lesson Readiness
3. Record Lesson Outcome
4. next-lesson continuity update
5. multi-stream adaptation
6. Ask ATE panel

### Phase E — Assessment

1. assessment mode selector;
2. scope engine;
3. deterministic eligibility;
4. structured AI generation;
5. teacher editing;
6. PDF export;
7. marking guide;
8. Common Stream Test.

### Phase F — Institutional views

1. HOD department state;
2. DOS academic exceptions;
3. recovery decision;
4. Principal academic health.

### Phase G — Setup and resource workflows

1. timetable upload / verification;
2. teacher assignment confirmation;
3. resource recommendation surfaces;
4. optional external provider integration.

### Phase H — Final product polish

Use Impeccable:
- audit
- critique
- distill
- polish

Then perform manual visual inspection.

## 5. First Codex Prompt

Use a prompt similar to:

```text
Read AGENTS.md and all authoritative repository documents it references.

Do not implement features yet.

Your first task is to establish the frontend foundation for Academic Track Engine.

1. Inspect PRODUCT.md, DESIGN.md, docs/DOMAIN_MODEL.md, docs/ARCHITECTURE.md,
   docs/PRODUCT_FLOWS.md, and reference-ui/README.md.
2. Inspect the visual references only as art direction.
3. Use the installed gpt-taste and emil-design-eng skills for design judgment.
4. Create the application's design token system, typography, responsive shells,
   and reusable ATE domain components.
5. Create a /design-system route that demonstrates the visual language across
   teacher-mobile and leadership-desktop contexts.
6. Do not hard-code school, teacher, subject, level, stream, timetable, or
   curriculum values into presentational components.
7. Do not build page-specific visual styles that bypass the design system.
8. Do not add backend infrastructure.
9. Do not implement AI yet.
10. Run typecheck, lint, and visually inspect the design-system route.

Before editing code, summarize the product/design constraints you are applying
and propose the component/tokens architecture.
```

## 6. Second Codex Prompt

After the design system is approved:

```text
Read AGENTS.md again and preserve the existing design system.

Implement the typed domain/state foundation described in:
- PRODUCT.md
- docs/DOMAIN_MODEL.md
- docs/PRODUCT_FLOWS.md
- docs/CURRICULUM_DATA.md

Requirements:
- all current school/subject/stream values come from configuration;
- implement TeachingSection as a first-class domain entity;
- implement scheduled lesson state;
- implement lesson outcomes including UNCONFIRMED;
- implement deterministic state propagation;
- derive teacher, HOD, DOS, and Principal role views from shared state;
- no AI calls yet;
- no fake metrics;
- no teacher ranking;
- tests for state transitions are required.

Do not build UI pages beyond what is necessary to validate the domain state.
```

## 7. Third Codex Prompt

Then build the teacher vertical slice:

```text
Implement the Teacher core flow using the established design system and domain state.

Required:
- Teacher Home;
- next lesson;
- previous confirmed outcome;
- current curriculum context;
- Lesson Readiness;
- Record Outcome;
- state propagation into the next lesson;
- multi-stream continuity;
- mobile-first quality.

Use reference-ui teacher images only as visual direction.
Use gpt-taste and emil-design-eng.
Do not introduce page-specific arbitrary styling.
Run Impeccable critique after implementation and resolve material findings.
```

## 8. General Codex Instruction Pattern

Every implementation prompt should specify:

- authoritative docs to read;
- exact user problem;
- exact state/domain requirements;
- explicit non-goals;
- validation required;
- which reference image(s) are advisory;
- which design skills should be used.

Avoid prompts like:
> "Build the dashboard."

Prefer:
> "Implement the DOS Academic Exceptions surface from the existing domain state. The DOS sees only cases requiring operational intervention or active monitoring. Use the established exception components. Do not expose teacher rankings. Validate desktop at 1280 and 1440 widths."

## 9. Commit Discipline

Recommended commit sequence:

- `chore: initialize ATE frontend foundation`
- `feat: add ATE design system`
- `feat: add academic domain model`
- `feat: add teacher lesson workflow`
- `feat: add assessment workflow`
- `feat: add HOD department operations`
- `feat: add DOS exception workflow`
- `feat: add principal academic health`
- `feat: add curriculum resource discovery`
- `chore: audit and polish initial product`

Do not mix structural refactors, product behavior, and visual rewrites in one uncontrolled commit.

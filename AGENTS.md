# AGENTS.md — Academic Track Engine

This file is the repository operating guide for Codex and other coding agents.

ATE is not a generic dashboard, chatbot, school ERP, or AI wrapper. It is a teacher-first academic operations product. Product correctness, institutional trust, curriculum provenance, and interface quality are first-class requirements.

## 1. Mandatory Reading Order

Before substantive work, read the files relevant to the task.

For most product work:

1. `PRODUCT.md`
2. `DESIGN.md`
3. `docs/DOMAIN_MODEL.md`
4. `docs/PRODUCT_FLOWS.md`
5. `docs/ARCHITECTURE.md`
6. `docs/DECISIONS.md`

For curriculum-related work:

1. `docs/CURRICULUM_DATA.md`
2. `curriculum-data/`
3. `PRODUCT.md`

For AI-related work:

1. `docs/AI_SYSTEM.md`
2. `docs/CURRICULUM_DATA.md`
3. `docs/DOMAIN_MODEL.md`

For UI work:

1. `DESIGN.md`
2. `reference-ui/README.md`
3. the specific relevant image(s) in `reference-ui/`
4. the installed UI/design skills

For release readiness:

1. `docs/ACCEPTANCE_CRITERIA.md`
2. `docs/IMPLEMENTATION_PLAN.md`

Do not proceed from screenshots alone.

## 2. Source-of-Truth Precedence

When sources disagree, use this order:

1. accepted decisions in `docs/DECISIONS.md`;
2. product requirements in `PRODUCT.md`;
3. domain invariants in `docs/DOMAIN_MODEL.md`;
4. architecture boundaries in `docs/ARCHITECTURE.md`;
5. structured curriculum data in `curriculum-data/` for curriculum facts;
6. `DESIGN.md` for visual and interaction behavior;
7. `docs/PRODUCT_FLOWS.md`;
8. visual references in `reference-ui/`.

Reference images are never a source of product facts.

## 3. Product Invariants

The following are non-negotiable unless an explicit decision updates them.

### 3.1 Curriculum authority

Official curriculum data establishes curriculum intent.

AI may retrieve, summarize, transform, and propose around curriculum data. AI must not silently modify or invent curriculum authority.

### 3.2 School operational truth

School structure, timetable, teacher assignment, academic calendar, resource inventory, and approved configuration are operational facts.

AI may extract or propose these values, but an authorized human confirms them before they become operational truth.

### 3.3 Classroom reality

Teachers establish what actually happened in their lessons.

Missing data means `UNCONFIRMED`. It does not mean absent, missed, failed, or incomplete.

### 3.4 AI authority boundary

AI output is advisory unless a human explicitly confirms an action.

AI may generate lesson drafts, assessment drafts, explanations, adaptations, recovery suggestions, and resource recommendations.

AI must not silently:
- mark a lesson complete;
- record teacher absence;
- change curriculum state;
- approve a recovery plan;
- change a timetable;
- establish a school fact;
- create a final assessment without teacher review.

### 3.5 Lowest-authority resolution

Facts originate at the lowest legitimate authority.

Decisions should be handled by the lowest role capable of resolving them.

Information escalates only when higher authority is required.

### 3.6 Non-surveillance

ATE supports academic coordination, not teacher ranking.

Do not add:
- teacher leaderboards;
- AI-use rankings;
- "fastest teacher" metrics;
- punitive coverage comparisons;
- teacher speed indices;
- hidden performance scoring.

### 3.7 Teacher burden

Do not add data entry solely to make a leadership dashboard look richer.

Prefer teacher actions that directly help the teacher and incidentally create useful institutional visibility.

## 4. Engineering Rules

### 4.1 TypeScript

Use TypeScript strict mode.

Avoid `any` unless there is a documented boundary where it is unavoidable.

Domain types must be explicit.

### 4.2 Separation of concerns

Keep these layers separate:

- presentation;
- application state;
- deterministic domain logic;
- curriculum data access;
- AI orchestration;
- external resource providers.

Do not put business rules inside React render branches.

### 4.3 No hard-coded product facts in presentation components

The current school, subject, levels, streams, teacher names, dates, period length, timetable, topics, and assessment data are configuration/domain data.

Incorrect:

```tsx
<h2>S2 East Biology</h2>
```

Correct:

```tsx
<h2>{section.level} {section.stream} {section.subjectName}</h2>
```

The current narrow scope is intentional. The implementation must remain structurally configurable without building premature enterprise abstractions.

### 4.4 Deterministic rules before AI

Use deterministic software when the rule is deterministic.

Examples:
- whether a timetable conflicts;
- whether a learning outcome is confirmed taught;
- whether a common test scope is the intersection of selected streams;
- whether a record is unconfirmed;
- whether a user has permission;
- whether an issue should be visible at a role level.

AI can explain or draft around these facts. It should not calculate institutional truth when deterministic code can.

### 4.5 Structured AI output

AI application calls must return validated structured output.

Use Zod schemas at boundaries.

Do not render raw prose blobs for structured product artifacts such as:
- lesson readiness;
- assessments;
- marking guides;
- recovery recommendations;
- resource recommendation cards.

### 4.6 State propagation

Teacher actions must update shared academic state through domain functions.

Do not independently hard-code Teacher, HOD, DOS, and Principal views.

The same domain state should derive all role-appropriate views.

### 4.7 Dependencies

Do not add a dependency because it is convenient.

Before adding one, establish:
- the current requirement;
- why existing dependencies are insufficient;
- bundle/runtime impact;
- maintenance cost.

### 4.8 Infrastructure

Do not introduce Postgres, Redis, FastAPI, microservices, queues, container orchestration, vector databases, or production authentication unless a current product requirement explicitly requires them.

Preserve migration paths through clean interfaces, not speculative infrastructure.

## 5. UI Rules

For significant UI work, use the installed design skills deliberately.

Expected repository-local design tooling includes:

- Impeccable
- Emil Kowalski's `emil-design-eng`
- `gpt-taste`

The product documents outrank the skills.

Use skills to improve execution, not to redefine product behavior.

### 5.1 Visual references

Read `reference-ui/README.md`.

Images communicate:
- visual hierarchy;
- density;
- relative layout;
- mobile vs desktop intent;
- interaction concepts;
- product character.

Images do not define:
- business rules;
- school facts;
- metrics;
- dates;
- names;
- curriculum;
- states;
- data counts;
- navigation labels that conflict with product docs.

### 5.2 Anti-slop expectation

Avoid generic AI-generated interface habits:
- card-in-card everywhere;
- gradients for decoration;
- excessive rounded containers;
- every metric as a large tile;
- giant page titles;
- purple "AI" branding;
- unnecessary pills;
- meaningless charts;
- excessive icon boxes;
- marketing copy inside operational screens;
- gratuitous motion.

### 5.3 Visual inspection is mandatory

Do not assume compilation means the UI is good.

For UI tasks:
- inspect desktop rendering;
- inspect teacher mobile rendering;
- check spacing and hierarchy;
- check overflow;
- check long content;
- check loading states;
- check empty states;
- check error states;
- check keyboard/focus behavior for interactive primitives.

## 6. Testing and Validation

Before reporting a task complete:

1. run type checking;
2. run linting;
3. run relevant tests;
4. verify the affected flow manually;
5. verify responsive behavior where applicable;
6. inspect for hard-coded product facts;
7. inspect for state divergence between roles;
8. verify AI schema validation if AI output changed;
9. verify error/fallback behavior if external calls changed;
10. confirm product invariants remain intact.

Do not call work complete with known validation failures.

## 7. Change Discipline

If a requested change conflicts with an accepted decision or invariant:

- stop;
- identify the conflict;
- explain the consequence;
- update the decision deliberately before implementing the new direction.

Do not silently create a second product model in code.

## 8. Definition of Professional Completion

A change is professionally complete when it is:

- functionally correct;
- domain-consistent;
- curriculum-safe;
- state-consistent;
- visually coherent;
- responsive where required;
- typed;
- validated;
- maintainable;
- free of obvious hard-coded assumptions;
- honest about AI and provenance boundaries.

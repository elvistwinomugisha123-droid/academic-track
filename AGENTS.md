# AGENTS.md — Academic Track Engine v1 Production Build Contract

This file is the repository operating contract for Codex and any other coding agent working on Academic Track Engine (ATE).

ATE is being rebuilt from a prototype into production-grade institutional software for Ugandan secondary schools. The standard is not “the feature works.” The standard is: product-correct, visually excellent, secure, recoverable, testable, understandable, and credible in front of teachers and school leadership.

The active rebuild branch is `rebuild/ate-v1-production`. The frozen prototype is preserved on `archive/prototype-v4`. Do not modify the archive branch.

---

## 1. Source of truth and precedence

### 1.1 Upstream canonical authority

The canonical ATE v1 dossier is the September 2026 documentation in:

`ATE v1 — Canonical Documentation`

https://drive.google.com/drive/folders/1RcVn7MdFoUIAH64P9yaG-DBOv8aFtqXB

It contains the authoritative product, engineering, Academic Knowledge, AI, pilot, school implementation, security/data-governance, and ADR material.

The most important upstream documents are:

1. **ATE v1 Product Description — Product Bible** — product semantics, scope, workflows, principles and product boundaries.
2. **ATE v1 Technical Architecture & Engineering Specification** — implementation architecture and engineering source of truth.
3. **Academic Knowledge & Curriculum specification** — curriculum/profile/provenance/rights model.
4. **ATE AI System, Safety & Evaluation Specification** — AI boundaries, evaluation and safety controls.
5. **Security, Privacy, Data & Governance** — security/data-handling authority.
6. **Product Decision Record & ADR Register** — approved decisions and explicit supersessions.

### 1.2 Repository working authority

For day-to-day Codex work, read in this order:

1. `AGENTS.md` — how work must be performed.
2. `docs/ATE_V1_PRODUCT_SPEC.md` — the repo-local consolidated implementation-facing definition of the product we are building.
3. Approved current ADRs/decision records created during the rebuild.
4. Task-specific instructions from the user, provided they do not conflict with 1–3 or the canonical dossier.
5. Current implementation.
6. Historical prototype documents/code only as evidence or salvage material.

The old September 9 `PRD.md`, `TRD.md`, `DESIGN.md`, `PRODUCT.md`, `docs/V4_MIGRATION_PLAN.md`, and related prototype-era material are **not current product authority**. Do not allow them to override the September 15–16 canonical ATE v1 dossier or `docs/ATE_V1_PRODUCT_SPEC.md`.

If a requirement is materially ambiguous or sources conflict, stop and identify the conflict. Do not silently invent a third product model.

---

## 2. Core product identity

ATE is a **teacher-first Academic Operating System / academic execution layer** for secondary schools.

It connects three questions:

1. What should be taught?
2. What actually happened in the classroom?
3. What should happen next?

ATE is not a generic chatbot, school ERP, LMS, timetable product, marks database, autonomous academic agent, teacher-surveillance platform, learner analytics system, or “AI lesson-plan generator.”

The durable value is governed academic state and continuity, not generated text.

### Locked thesis

> Curriculum owns truth. Operations owns facts. Intelligence owns bounded reasoning. Educators own consequential decisions.

### Locked teacher loop

`Prepare → Teach → Confirm what happened → Carry forward what remains → Assess within applicable rules → Continue`

Leadership visibility must emerge from the same verified academic state rather than from an additional teacher-reporting bureaucracy.

---

## 3. Non-negotiable product invariants

These invariants are architectural and product constraints. Do not violate them to make implementation easier.

### 3.1 Teacher-first

The teacher is the primary daily user. A required teacher input is justified only when it helps the teacher perform academic work or creates an agreed institutional output without duplicate reporting.

If leadership value requires teachers to perform extra reporting that does not help their work, redesign the feature.

### 3.2 Teaching Section is first-class

The primary operational unit is:

> Teacher × Subject × Level/Class × Stream × Academic Period

Parallel streams are independently stateful. “S2 Physics” alone is not sufficient operational context.

### 3.3 Planned, confirmed and proposed state are different

Never collapse:

- planned curriculum position;
- confirmed classroom position;
- proposed next position.

They have different authorities.

### 3.4 Scheduled does not mean taught

A timetable slot proves only that teaching was expected.

A scheduled lesson without an authorised outcome confirmation is `UNCONFIRMED`, not delivered and not missed.

### 3.5 Coverage does not prove learning

Do not infer learner understanding, achievement or competency mastery from lesson coverage or teacher activity.

### 3.6 Classroom reality is human-confirmed

The teacher confirms what happened. AI may not infer that a lesson occurred or silently write classroom facts.

Corrections preserve history.

### 3.7 State before intelligence

ATE must resolve deterministic school and academic state before an AI call is considered. AI failure must not remove timetable, continuity, saved artifacts, eligibility, permissions or navigation.

### 3.8 Rules before AI

Use deterministic code for deterministic facts, including permissions, scope, timetable rules, state transitions, eligibility, common-scope intersections, version state, escalation rules and audit requirements.

### 3.9 Retrieval before generation

Curriculum-specific generation must use rights-eligible, versioned, provenance-backed context. Model memory is not curriculum authority.

### 3.10 AI assists; humans authorise

AI output is a draft, explanation, recommendation or proposed patch until an authorised user explicitly applies, confirms or finalises it.

AI must not silently:

- change curriculum truth;
- mark a lesson delivered;
- publish/finalise an assessment;
- alter roles or permissions;
- change timetable facts;
- create institutional decisions;
- invent sources, pages, books or URLs.

### 3.11 Leadership is exception-oriented, not surveillance-oriented

Never add:

- teacher rankings;
- “best/worst teacher” views;
- coverage leaderboards;
- AI-use rankings;
- teacher speed/productivity indices;
- hidden teacher-quality scores;
- punitive activity metrics;
- raw private AI conversation visibility for leaders by default.

### 3.12 Lowest competent authority

Issues remain with the lowest role that can resolve them. Escalate only when additional authority is genuinely required.

### 3.13 One canonical artifact, many renderings

UI, PDF and DOCX must render from the same canonical structured artifact/version. Do not maintain divergent document copies.

### 3.14 Rights and permissions fail closed

Unknown rights or ambiguous authorisation do not become implicit access.

### 3.15 Reliability is part of product correctness

No lost work, dead controls, fake production data, silent AI fallback, ambiguous save state or hidden failure.

---

## 4. Rebuild strategy

This branch is a **controlled application-layer reset**, not an in-place polishing exercise.

The prototype remains available through Git history and `archive/prototype-v4`. Preserve useful concepts, but do not preserve prototype architecture merely because it exists.

### Preserve and evolve

- Academic Knowledge extraction/import tooling where still valid.
- Rights/provenance concepts.
- Deterministic exact-retrieval ideas.
- Useful document/PDF rendering techniques.
- Git history.
- CI concepts that are worth rebuilding.

### Replace as active production foundations

- browser/localStorage institutional state;
- hard-coded pilot/demo school state;
- local role switchers as authorisation;
- the monolithic demo `AteApp` shell;
- mutable continuity truth that overwrites history;
- assessment flows that jump directly from “mode/scope” to generated questions;
- direct provider coupling in feature code;
- legacy curriculum corpus as production authority;
- obsolete prototype PRD/TRD/DESIGN authority.

Do not perform a blind delete-all rewrite. Inspect before replacing and salvage only what passes the current product/architecture rules.

---

## 5. Mandatory Codex working method

For every non-trivial task:

1. **Read the contract.** Read `AGENTS.md` and the relevant sections of `docs/ATE_V1_PRODUCT_SPEC.md`.
2. **Inspect before editing.** Read relevant code, tests, schema/migrations and current runtime behaviour.
3. **State the objective.** Briefly identify the user outcome and product invariant(s) involved.
4. **Identify risks.** Especially data migration, authorisation, rights, AI authority, continuity history and UI regression risk.
5. **Plan the smallest correct slice.** Avoid unrelated refactors.
6. **Implement through domain boundaries.** Do not bypass services/policies for convenience.
7. **Verify behaviour.** Run the appropriate automated and visual checks.
8. **Review your own work.** Inspect the diff and rendered behaviour for unintended changes.
9. **Report evidence.** State files changed, behaviour changed, checks run, results and remaining risks.

Do not start coding a major task from a one-line guess about what the product means.

### Stop and ask before proceeding when

- a task conflicts with a locked product invariant;
- a destructive migration is not clearly reversible;
- curriculum/content rights are unclear;
- a security boundary is being weakened;
- a new external vendor would create material lock-in;
- the requested behaviour changes institutional truth semantics;
- an expensive architectural decision is not justified by current requirements.

---

## 6. Mandatory skill workflow

The following skills are part of this project’s build discipline.

### 6.1 Karpathy guidelines — engineering discipline

Use `karpathy-guidelines` for implementation discipline: understand the code first, make minimal coherent changes, keep assumptions explicit, avoid speculative abstraction, preserve readability, and verify the result.

### 6.2 Taste — product/design judgement

For substantial interface work, use the repo-local design skills as appropriate, especially:

- `gpt-taste`;
- `design-taste-frontend`;
- `high-end-visual-design` where it strengthens the current product direction;
- `redesign-existing-projects` when correcting existing screens.

The product specification outranks any generic stylistic suggestion from a skill.

### 6.3 Impeccable — critique and polish

Use the installed `impeccable` skill for visual critique/refinement on significant UI work.

### 6.4 Playwright — rendered verification

Use the `playwright` skill/tooling for critical user flows and rendered UI inspection when the environment supports it.

### 6.5 Skill conflicts

Do not blindly combine every visual skill. Use Taste to establish direction, implement deliberately, then use Impeccable as a critique/polish pass. ATE must remain visually coherent rather than becoming a collage of design styles.

---

## 7. UI/UX is a release gate, not polish

ATE’s UI/UX quality is a first-class product requirement.

A screen that compiles but looks generic, crowded, amateur, inconsistent, mobile-stretched, or “AI generated” is not complete.

### 7.1 Visual character

ATE should feel:

- premium;
- calm;
- precise;
- institutional;
- contemporary;
- highly intentional;
- trustworthy rather than flashy.

Avoid visual theatre that competes with academic work.

### 7.2 ATE visual language

Use a restrained white/off-white base, Bankai navy/deep blue, clear blue and restrained cyan accents. Use a high-quality sans-serif UI typographic system. Use whitespace, alignment, typographic hierarchy and component consistency before decoration.

Do not use “Bankai green.”

Avoid:

- purple AI gradients;
- neon/glow treatments;
- glassmorphism as a default language;
- giant KPI tiles;
- card-inside-card-inside-card layouts;
- decorative corner text;
- generic SaaS dashboard chart zoos;
- meaningless charts;
- oversized sidebars;
- excessive pills and badges;
- huge empty hero sections inside the application;
- generic chatbot shells;
- decorative motion with no information purpose.

### 7.3 Responsive acceptance widths

For meaningful teacher-facing UI, visually validate at least:

- 360 px;
- 390 px;
- 430 px;
- 768 px where tablet behaviour matters;
- 1280 px;
- 1440 px;
- 1600 px.

Leadership surfaces are desktop-first but must remain responsive. Teacher interfaces are mobile-first but must become a real browser/desktop layout rather than a narrow mobile column floating in a large viewport.

### 7.4 Visual verification loop

For every significant screen or interaction:

1. determine hierarchy and information priority;
2. use the appropriate Taste guidance;
3. implement;
4. render the actual application;
5. inspect the relevant widths;
6. check typography, spacing, alignment, density, responsive behaviour, overflow, touch targets, keyboard/focus behaviour and empty/error/loading states;
7. use Impeccable to critique/refine where appropriate;
8. revise;
9. repeat until the rendered result passes the quality bar;
10. run relevant Playwright checks.

Do not declare UI work finished from code inspection alone.

### 7.5 Accessibility baseline

Major interactions must include:

- semantic controls;
- keyboard navigation;
- visible focus states;
- readable contrast;
- non-colour-only status communication;
- appropriate labels;
- scalable text;
- adequate touch targets.

---

## 8. Canonical Teacher Home behaviour

Teacher Home answers only:

1. What am I teaching next?
2. What do I need to know before I enter class?
3. What action should I take now?

The canonical composition is intentionally sparse:

- restrained application chrome;
- optional greeting/date;
- one dominant **Next Lesson**;
- Teaching Section identity;
- time;
- current curriculum/topic position from governed context;
- previous confirmed classroom state;
- carry-forward when unfinished;
- preparation status;
- primary CTA: **Prepare Lesson**;
- compact **Today’s Schedule**;
- at most one or two meaningful attention items.

Do not put learner marks, learner performance charts, completion donuts, curriculum-progress vanity charts, KPI tiles, teacher rankings, student counts, AI-use metrics, generic “Reports & Insights”, motivational quotes or a generic chatbot on Teacher Home.

Ask ATE is contextual within class/lesson/workflow context rather than a blank chat surface dominating Home.

---

## 9. Classroom Continuity implementation rules

Continuity is conservative and event-derived.

Expected flow:

`Scheduled Lesson → Continuity Event → Projection → Confirmed Classroom Position → Carry-forward / Next Context`

Normal outcomes:

- `DELIVERED`;
- `PARTIALLY_DELIVERED`;
- `MISSED_OR_CANCELLED`;
- `CHANGED_FROM_PLAN`;
- `UNCONFIRMED` is a computed absence of authorised confirmation, not a teacher-entered failure state;
- `CORRECTED` is represented through correction/supersession history rather than destructive replacement.

A normal post-lesson confirmation should take seconds, not minutes.

Do not turn it into a mandatory reflection essay, evidence-upload flow, attendance workflow or checklist bundle.

Recovery is proposed, not imposed. The teacher decides academic feasibility. HOD/DOS involvement occurs only when the resolution requires their authority.

Use append-style factual history where corrections matter; maintain a transactionally updated projection/read model for fast reads. This does **not** mean full-system event sourcing.

---

## 10. Lesson Workspace rules

Keep these concepts distinct:

### Lesson Readiness

A concise, practical preparation surface built from the current Teaching Section, curriculum anchor, previous confirmed outcome, carry-forward work and known constraints.

It must remain useful in reduced form without an AI call.

### Formal Lesson Plan

A professional structured artifact, not a prose blob. The canonical model should support, where applicable:

- identity and Teaching Section;
- curriculum anchor;
- continuity/prior learning;
- lesson intention and expected evidence;
- preparation and classroom context;
- pedagogy/method;
- resources and safety;
- timed sequence;
- teacher facilitation;
- learner activity;
- prompts/questions;
- formative checks;
- genuine skills/values/cross-cutting opportunities;
- differentiation/inclusion;
- misconceptions;
- contingencies;
- conclusion/follow-up;
- reflection;
- references/provenance.

Do not claim one universal layout is “the NCDC format.” Support canonical structured content plus verified school-template mappings where configured.

### Teaching Pack

Downstream artifacts may include board/teaching notes, learner notes, activities/worksheets, homework, practical sheets and lesson summaries. Generate only what is useful for the lesson; do not force every artifact type every time.

Linked Teaching Pack artifacts inherit their parent lesson context/version and can become stale when the parent changes.

---

## 11. Ask ATE rules

Ask ATE is contextual and permission-bound.

The application resolves scope and authorised context server-side. The user may ask for an explanation or adaptation, but generated changes are proposed patches until explicitly applied.

Do not let Ask ATE become a second state store.

Do not give the model generic SQL, shell, filesystem or arbitrary HTTP access for normal academic workflows.

---

## 12. Assessment Studio rules

Assessment Studio is an authoring and quality-assurance subsystem, not a one-prompt question generator.

Canonical sequence:

`Purpose → Assessment Profile → Eligible Scope → Blueprint → Draft Items/Tasks/Scenarios → Marking Instrument → Deterministic/AI Quality Checks → Human Review → Final Artifact`

Rules:

- resolve level/subject/cohort/version/profile before drafting;
- Lower Secondary and Advanced Secondary are not one generic assessment regime;
- normal classroom assessment is constrained by confirmed taught/eligible scope;
- diagnostic assessment may intentionally target prerequisites;
- mock/end-of-cycle scope may be broader only when the applicable profile permits and must be represented honestly;
- common-paper default scope across parallel streams is the intersection of confirmed eligible scope, subject to explicit authorised override;
- blueprint precedes item generation;
- AI drafts only inside the approved blueprint;
- marking instruments are first-class artifacts;
- routine formative work stays teacher-owned;
- higher-stakes/common internal assessments may use configurable review/finalisation;
- restricted papers/marking instruments require stronger access/export controls;
- ATE prepares the instrument; the teacher marks.

Do not add learner marks database, AI grading, learner-result profiling or autonomous psychometrics to v1.

---

## 13. Leadership rules

Leadership surfaces are role-specific:

- **HOD — Department Pulse:** department coordination, meaningful stream divergence, common assessment readiness, department exceptions and reusable resources.
- **DOS / Academic Director — Academic Operations:** timetable/programme exceptions, recovery requiring scheduling authority, cross-department/resource constraints and operational reports.
- **Principal / Head Teacher — Academic Assurance:** material systemic issues, recurring institutional constraints and senior decisions.

Leadership reports are generated from normal academic evidence. Do not create extra teacher reporting solely to feed dashboards.

AI may summarise verified evidence; it may not invent counts, causal explanations or institutional facts.

---

## 14. Academic Knowledge and curriculum rules

Academic Knowledge is governed reference authority, not an LLM memory store.

Preserve:

- source registry;
- source spans/locators;
- canonical records;
- source/document versions;
- official wording separately from ATE interpretation;
- relationships;
- release/profile activation;
- verification/review state;
- rights state;
- effective periods;
- provenance and content hashes where appropriate;
- deterministic exact retrieval;
- external-AI eligibility controls.

Semantic/vector retrieval is secondary and may assist free-text mapping or non-authoritative resources. It does not replace exact structured retrieval for authoritative curriculum facts.

Do not commit additional raw protected NCDC/UNEB/private-school source documents or production curriculum corpora to Git.

Production and external-AI retrieval must fail closed when rights are not eligible.

---

## 15. AI engineering rules

All external-model calls flow through the ATE AI Gateway/provider abstraction.

Feature modules must not directly instantiate provider SDKs.

Every production AI workflow must define:

- named purpose;
- authorised input/context sources;
- data classification/minimisation;
- model/provider version;
- prompt/workflow version;
- structured input and output schema;
- deterministic validation/quality checks;
- bounded retry/repair policy;
- explicit failure handling;
- latency/token/cost telemetry;
- human approval/application boundary;
- reproducibility metadata sufficient to reconstruct the run conditions.

Context hierarchy:

`ATE invariant policy → authorised structured curriculum facts → authorised operational facts → user request → clearly isolated supplementary/untrusted content`

Use minimal sufficient context.

### Failure behaviour

- Provider/network failure: bounded retry, then visible graceful degradation; preserve user work.
- Invalid schema: bounded repair attempt, then visible failure.
- Missing authoritative context: abstain/retrieve/ask rather than invent.
- Suspected prompt injection: quarantine/reject untrusted content; never solve by “using a smarter model.”
- No silent production fixture fallback that masquerades as a real model result.

---

## 16. Security, tenancy and privacy rules

The school is the tenant boundary.

ATE uses defence-in-depth:

`Authenticated identity → active school membership → role/scope/action authorisation → database RLS → record classification`

Roles are additive. Leadership role does not equal unrestricted access.

Never:

- trust client-supplied school/role scope as authority;
- expose Supabase/service-role credentials to the browser;
- use client-side hidden navigation as the only access control;
- create public buckets for private school/curriculum material;
- log secrets or full protected documents unnecessarily;
- send unnecessary school/teacher/learner identifiers to external AI providers;
- let invitation links grant self-selected privileges;
- expose private teacher drafts/AI conversations to leaders by default.

Sensitive changes require server-side/RLS tests.

---

## 17. Data and state rules

PostgreSQL is the production system of record.

- Zustand may hold ephemeral UI/draft state, not institutional truth.
- Every school-owned record is tenant-scoped.
- Core domain entities are relational and explicit.
- Flexible JSON is for versioned artifact payloads/event payloads/provider metadata where appropriate, not as a substitute for the domain model.
- Consequential corrections preserve history.
- Important mutable meaning is versioned.
- Audit consequential actions, not every cursor movement.
- Do not build one giant mutable “digital twin” blob; derive views from verified facts.

---

## 18. Target production architecture

ATE v1 converges on a TypeScript modular monolith with managed infrastructure.

Target direction:

- Node.js 22;
- TypeScript strict;
- Next.js App Router + React;
- a coherent component/design-system layer using customised accessible primitives;
- Tailwind where retained/selected by the foundation step;
- Lucide icons;
- React Hook Form + Zod for forms/contracts where appropriate;
- Zustand only for ephemeral UI/draft state;
- PostgreSQL / Supabase DB, Auth, Storage and RLS;
- Drizzle ORM/Kit;
- vector/pgvector only as a secondary retrieval aid where justified;
- bounded AI gateway with provider abstraction;
- background jobs only when request/response execution is unsuitable;
- narrow offline resilience later, not full replication;
- react-pdf / DOCX rendering from canonical artifacts;
- Vitest + Playwright;
- Sentry/structured observability;
- Vercel + GitHub Actions unless an explicit architecture decision changes deployment.

Do not introduce microservices, Kafka, Kubernetes, a separate graph DB, a separate vector DB, a Python backend, autonomous multi-agent orchestration or self-hosted model infrastructure without measured need and an approved ADR.

---

## 19. Migrations and schema changes

Database changes must be deliberate and reviewable.

For each non-trivial migration:

- explain the invariant being enforced;
- prefer constraints/foreign keys/uniqueness where they encode real domain truth;
- consider existing data and rollback/recovery;
- avoid destructive rewrites when a staged migration is safer;
- test tenant isolation and authorisation when relevant;
- do not infer production data from demo fixtures.

Do not modify historical migrations after they have been treated as applied in a shared environment unless the task explicitly establishes that rewriting history is safe.

---

## 20. Demo/test data discipline

Production code must not contain hard-coded Mount of Olives staff identities, fake leadership identities, fixed pilot dates, fake school counts or fake academic metrics.

Clearly separated demo/test fixtures may use:

- `Demo School`;
- fictional names such as `Ms. Amina K.`;
- explicitly labelled demo content.

Do not imply that a real school, NCDC, UNEB, the Ministry or another institution endorses ATE without evidence.

---

## 21. Testing and release gates

A feature is not complete because the happy path renders.

Run checks appropriate to the change:

- TypeScript typecheck;
- lint;
- unit/domain tests;
- integration tests;
- database/RLS/access tests for security/data changes;
- Playwright for critical product flows;
- visual/responsive inspection for UI work;
- accessibility checks relevant to the interaction;
- AI schema/eval regression checks for AI changes;
- production build;
- dependency/security checks where dependencies changed.

Do not report completion with known failing quality gates unless the failure is explicitly documented as pre-existing and unrelated, and even then do not hide it.

### UI acceptance includes

- loading;
- empty;
- partial-data;
- permission-denied;
- failure/retry;
- long-content/overflow;
- responsive layout;
- keyboard/focus;
- save state;
- destructive-action confirmation where relevant;
- degraded/offline behaviour where the workflow claims resilience.

### AI acceptance includes

- schema validity;
- correct rights/context resolution;
- curriculum grounding;
- wrong-level/wrong-profile protection;
- hallucination/unsupported-claim checks;
- prompt-injection handling for untrusted content;
- human approval boundary;
- latency/cost telemetry;
- deterministic fallback/degradation behaviour.

---

## 22. Performance and operational quality

Teacher Home and other core deterministic views must not block on AI.

Prioritise:

- fast deterministic read models;
- progressive loading of optional intelligence;
- efficient queries with explicit indexes when justified;
- predictable cache invalidation;
- durable save state;
- recoverable drafts;
- observable jobs;
- backup/restore capability;
- low-bandwidth behaviour appropriate to Ugandan school conditions.

Do not claim full offline-first operation until conflict handling and sync behaviour are actually proven.

---

## 23. Change and Git discipline

- Work on `rebuild/ate-v1-production` unless explicitly instructed otherwise.
- Never modify `archive/prototype-v4`.
- Do not push directly to `main` as part of ordinary rebuild work.
- Prefer small, coherent, reviewable changes.
- Do not combine a broad structural refactor, major UI redesign, database migration and AI rewrite in one uncontrolled change.
- Keep the application runnable after meaningful phases.
- Inspect `git diff` before reporting completion.
- Do not commit or push unless the current task explicitly asks for it.
- Never commit `.env`, secrets, private school files, raw protected curriculum source material or generated private exports.

---

## 24. Definition of done

A substantive change is complete only when it is:

- consistent with the canonical ATE v1 product semantics;
- consistent with the engineering specification or an approved ADR;
- domain-correct;
- tenant-safe and authorised correctly;
- typed and validated;
- visually excellent for UI work;
- responsive at the required widths;
- accessible enough for the interaction;
- reliable under expected failure states;
- tested at the appropriate level;
- honest about source/provenance and AI authority;
- free of prototype-only fake institutional assumptions;
- not adding unjustified teacher burden;
- understandable to the next engineer.

The completion report must state:

1. what changed;
2. why it changed;
3. files changed;
4. migrations/configuration introduced;
5. checks run and exact results;
6. screenshots/visual checks performed for significant UI work;
7. known limitations/risks;
8. next dependency, if any.

---

## 25. Final standard

ATE should not look or behave like a prototype that has been cosmetically polished.

It should feel like a coherent academic product whose interface, data model, workflows, security boundaries and AI behaviour all express the same system.

When choosing between more features and a cleaner core loop, choose the cleaner core loop.

When choosing between AI convenience and trustworthy state, choose trustworthy state.

When choosing between a generic interface and a carefully designed role-specific experience, choose the role-specific experience.

When uncertain whether a feature belongs, ask:

> Does this reduce academic work, preserve useful context, protect academic integrity, or enable an authorised decision — or does it merely make ATE look more sophisticated?

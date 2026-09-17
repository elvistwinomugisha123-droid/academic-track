# Academic Track Engine (ATE) v1 — Product & Build Specification

**Status:** Repository working specification for the ATE v1 production rebuild  
**Owner:** Bankai Technologies — Product & Engineering  
**Upstream authority:** September 2026 ATE v1 canonical dossier  
**Primary upstream documents:** ATE v1 Product Description / Product Bible; ATE v1 Technical Architecture & Engineering Specification; Academic Knowledge & Curriculum specification; ATE AI System, Safety & Evaluation Specification; Security/Privacy/Data/Governance material; Product Decision Record & ADR Register  
**Purpose:** Give Codex and engineers one coherent, implementation-facing description of the ATE product we are actually building.

---

## 0. Authority, scope and interpretation

This file is the repository-local implementation-facing consolidation of the current ATE v1 direction.

It does **not** replace the canonical dossier. If this file conflicts materially with the current canonical dossier or an approved newer ADR, the canonical source/ADR governs and this file must be updated.

The upstream canonical dossier lives in:

`ATE v1 — Canonical Documentation`

https://drive.google.com/drive/folders/1RcVn7MdFoUIAH64P9yaG-DBOv8aFtqXB

The September 9 prototype-era repository documents (`PRD.md`, `TRD.md`, `DESIGN.md`, `PRODUCT.md`, `docs/V4_MIGRATION_PLAN.md` and related material) are historical context only where they conflict with this specification.

### Status language used here

- **LOCKED** — current ATE decision; implementation must follow it unless an explicit newer decision supersedes it.
- **TARGET V1** — required target state for production v1; may not yet be implemented.
- **VALIDATE** — intentionally provisional; pilot/operational evidence must confirm it.
- **DEFERRED** — explicitly outside v1.
- **ASSUMPTION** — plausible but unproven; never present as fact.

This specification describes the **target product**, not what happens to exist in the old prototype.

---

# Part I — Product definition

## 1. Executive product definition

Academic Track Engine (ATE) is a **teacher-first Academic Operating System / academic execution layer for secondary schools**.

ATE connects three permanent questions:

1. **What should be taught?**
2. **What is actually happening in classrooms?**
3. **What should happen next?**

### LOCKED product thesis

> **When academic reality is captured as work happens, a school can intervene while improvement is still possible.**

ATE is not valuable because it can generate a lesson plan or a test. General-purpose AI can already generate those artifacts.

ATE’s structural value is that it maintains governed context and coherent academic state across:

- curriculum/assessment authority;
- school configuration;
- Teaching Sections;
- timetable and programme;
- teacher preparation;
- teacher-confirmed classroom outcomes;
- unfinished work and recovery;
- artifacts and versions;
- assessment purpose and eligible scope;
- role/permission context;
- leadership exceptions;
- provenance and rights.

That state changes what the product should do next.

A teacher’s next lesson changes because the previous lesson outcome changed. A common assessment scope changes because parallel streams differ. A recovery option appears because work remains unfinished. A leadership issue appears only because additional authority is needed.

### LOCKED core teacher loop

```text
Verified context
      ↓
Prepare
      ↓
Teach
      ↓
Confirm what actually happened
      ↓
Carry unfinished work forward / resolve recovery
      ↓
Assess within applicable academic rules
      ↓
Continue from current confirmed reality
```

Leadership visibility is a by-product of this normal academic work, not a second teacher-reporting system.

---

## 2. The problem ATE solves

ATE is solving a **coordination gap across required academic work**, not a shortage of AI-generated content.

The evidence is strongest around teacher preparation burden, curriculum interpretation, repetitive academic documentation, assessment preparation and fragmented academic records.

ATE should not make unsupported claims that every Ugandan school has a proven “classroom memory crisis.” Continuity is strategically important, but its incremental value must be validated through repeated real use.

### The operational fragmentation

```text
Curriculum intent
      ↓
Teacher preparation
      ↓
Classroom delivery
      ↓
Evidence of what happened
      ↓
Academic response
```

In ordinary school practice those stages can become disconnected:

- the scheme says one thing while a particular stream stopped elsewhere;
- the plan assumes a resource that was unavailable;
- the timetable says a lesson was scheduled, but the lesson did not happen;
- one stream is ready for a common paper while another is not;
- leaders reconstruct progress only after the useful intervention window has narrowed;
- teachers repeatedly rebuild context for AI prompts or formal documents.

ATE should connect the stages without forcing teachers to duplicate every notebook, scheme, report and informal conversation digitally.

### Product test for mandatory teacher input

Every mandatory teacher input must have an obvious next use, such as:

- improving the next lesson;
- updating the record of work/current position;
- carrying unfinished work forward;
- protecting assessment scope;
- supporting recovery;
- producing an agreed institutional view without extra reporting.

If an input exists mainly because “management wants more data,” redesign it.

---

## 3. What ATE is not

ATE v1 is explicitly **not**:

- a generic AI lesson-plan generator;
- “ChatGPT for teachers”;
- a school ERP;
- fees/payroll/admissions/hostel/discipline software;
- an LMS or course-hosting platform;
- a learner chatbot;
- a timetable-generation/autonomous scheduling engine;
- a marks database;
- an AI grading system;
- a learner profiling/predictive mastery system;
- a teacher-ranking or surveillance platform;
- an autonomous agent that decides academic truth;
- a curriculum repository whose only purpose is to store documents.

Ask ATE is contextual and permission-bound. Assessment Studio is purpose/profile/scope/blueprint-led rather than a generic question generator. Academic Knowledge exists to operationalise curriculum through real school workflows.

---

## 4. Users, customer and authority

### Teacher — primary daily user

Primary jobs:

- understand the next class context;
- prepare;
- produce professional academic artifacts;
- teach;
- confirm what happened;
- carry unfinished work forward;
- create appropriate assessments;
- adapt using contextual Ask ATE/resources.

Authority:

- confirms classroom reality for assigned Teaching Sections;
- owns ordinary teacher academic work and private drafts;
- approves/applies AI-generated changes to their work.

### HOD — department coordination

Primary jobs:

- understand meaningful department exceptions;
- coordinate parallel streams where needed;
- coordinate common assessment where authorised;
- review/moderate only when school policy requires it;
- produce a Department Brief from normal evidence.

HOD is **not** a mandatory approver for every lesson plan, quiz or teacher action.

### DOS / Academic Director — academic operations

Primary jobs:

- school academic programme/timetable context;
- recovery that requires scheduling authority;
- cross-department operational constraints;
- academic operations exceptions;
- Academic Operations Reports.

DOS does not micromanage lesson content by default and does not receive unrestricted access to private teacher AI conversations.

### Principal / Head Teacher — academic assurance

Primary jobs:

- understand whether the academic programme is broadly under control;
- act on material institutional issues;
- identify recurring constraints;
- resolve senior institutional decisions;
- produce Academic Assurance Reports.

Principal sees the level of abstraction appropriate to institutional responsibility rather than raw teacher activity by default.

### School — customer and institutional workspace owner

The school owns its institutional workspace, memberships and school-operational data subject to applicable agreements/law.

The actual primary buyer is the person with budget authority; this is not automatically the same person as the daily operational champion.

### Bankai implementation/support

Bankai may support setup, imports, diagnostics and controlled operations, but support access must not become unrestricted access to school academic data.

### LOCKED role model

Roles are additive. A user may be Teacher + HOD, Teacher + DOS, etc. Adding a leadership role does not remove the Teacher Workspace.

---

# Part II — Truth architecture and domain model

## 5. Product operating model

ATE deliberately separates five authority layers.

| Layer | Owns | Must not become |
|---|---|---|
| Curriculum Truth | authoritative subject/level/cohort/version knowledge, assessment rules, source provenance | model memory, approximate vector output, unreviewed paraphrase |
| Operational Truth | school setup, timetable, programme, Teaching Sections, approved artifacts, teacher-confirmed classroom events | AI inference about what happened |
| Decision Logic | permissions, state transition, scope, eligibility, escalation, validation, audit | probabilistic judgement where deterministic rules suffice |
| Intelligence | bounded drafting, explanation, adaptation, comparison, proposed actions | permanent source of curriculum, school facts or workflow state |
| Human Authority | consequential teacher/leadership judgement | ceremonial approval added to every routine action |

This separation must be visible in system behaviour and, where useful, UI language.

The application should be able to distinguish:

- **recorded by the school/teacher**;
- **calculated deterministically by ATE**;
- **proposed/generated by AI**.

---

## 6. Primary domain unit — Teaching Section

### LOCKED definition

A `TeachingSection` is:

> **Teacher × Subject × Level/Class × Stream × Academic Period**

It is the primary operational unit for teacher context and classroom continuity.

Parallel streams are independently stateful even when the same teacher/subject/class is involved.

A Teaching Section is the anchor for:

- curriculum/profile resolution;
- timetable occurrences;
- current confirmed classroom position;
- previous lesson outcome;
- unfinished work/carry-forward;
- saved teacher artifacts;
- resource constraints;
- assessment eligibility;
- section-specific Ask ATE context.

Do not replace this with a generic “S2 Physics” context.

---

## 7. Truth/state distinctions that must never collapse

### LOCKED

```text
Planned curriculum position
    ≠
Confirmed classroom position
    ≠
Proposed next position
```

```text
Scheduled lesson
    ≠
Taught lesson
```

```text
Taught/covered content
    ≠
Learning outcome achieved
    ≠
Competency mastered
```

```text
Draft artifact
    ≠
Reviewed artifact
    ≠
Final artifact
```

```text
AI proposal
    ≠
Approved/applied change
```

```text
School programme assessment event
    ≠
Curriculum/assessment rule
```

```text
Current corrected truth
    ≠
Correction history
```

These distinctions are not terminology preferences. They are product correctness requirements.

---

## 8. Conceptual domain entities

The production domain should converge on explicit relational concepts roughly equivalent to:

- `School`
- `User`
- `Membership`
- additive `RoleGrant` / scoped authority
- `Department`
- `AcademicPeriod`
- `Level/Class`
- `Stream`
- `Subject/Profile binding`
- `TeachingSection`
- `TimetableVersion`
- `TimetableSlot`
- `ScheduledLesson`
- `SchoolProgrammeEvent`
- `ContinuityEvent`
- `TeachingSectionProjection` / current read model
- `CarryForwardItem` / recovery context
- `CurriculumSource`
- `CurriculumRelease/Profile`
- typed curriculum/assessment knowledge records
- `Artifact`
- immutable `ArtifactVersion`
- `AssessmentProfile`
- `AssessmentWorkspace`
- `AssessmentBlueprint`
- `Issue/Escalation`
- `AIRun`
- `AuditEvent`

ATE should not use one giant mutable “digital twin” JSON object as institutional truth. The useful “digital twin” is a projection/composition of verified records.

---

# Part III — School setup and entry into daily use

## 9. School onboarding

### Objective

Start from real school structure with the minimum repeated manual setup.

### Target flow

An authorised school user provides or verifies:

- school identity;
- academic year/term/period;
- levels/classes;
- streams;
- departments;
- staff;
- role/membership assignments;
- timetable;
- school programme/calendar;
- school templates where relevant.

Where existing files can be imported/reconstructed, ATE should propose structure, flag uncertainty and ask humans to verify rather than manually retype everything.

Teachers then verify their own assigned Teaching Sections and current curriculum position.

### LOCKED onboarding principle

> Reconstruct from existing school information where possible; ask people to verify what matters to them.

Do not create a 20-step teacher onboarding ceremony.

### Timetable rule

The timetable provides expected academic occurrences. It does not establish classroom delivery.

### School programme rule

The school programme owns **when** an internal event occurs. The Assessment Profile owns **how** that assessment should be constructed under the applicable academic regime.

---

# Part IV — Teacher experience

## 10. Teacher Workspace philosophy

The Teacher Workspace should feel like an operational workspace, not a management dashboard.

The experience is:

> **class → current academic state → action**

Teacher interaction should minimise context rebuilding and navigation overhead.

The system should already know the assigned section, relevant profile, timetable, previous confirmed state, saved artifacts and applicable constraints whenever possible.

---

## 11. Teacher Home — canonical screen definition

Teacher Home answers only:

1. **What am I teaching next?**
2. **What do I need to know before I enter class?**
3. **What action should I take now?**

### Required hierarchy

Teacher Home should normally contain:

1. restrained application chrome;
2. optional greeting/date;
3. one dominant **Next Lesson** block;
4. Teaching Section identity;
5. lesson time;
6. current governed curriculum/topic position;
7. previous confirmed classroom state;
8. carry-forward/unfinished work if present;
9. preparation state;
10. primary CTA: **Prepare Lesson**;
11. compact **Today’s Schedule**;
12. no more than one or two meaningful attention items.

### Example safe demo state

For demo fixtures only:

- `Demo School`;
- fictional teacher such as `Ms. Amina K.`;
- section such as `S5 Biology · Stream A · Term 3 2026`;
- previous state such as `Partially delivered — stopped after learner activity`;
- carry-forward such as `Complete heredity examples before new content`;
- CTA: `Prepare Lesson`.

Do not associate invented staff identities with Mount of Olives College or any other real school.

### Explicitly forbidden on Teacher Home

Do **not** add:

- learner marks;
- learner-performance charts;
- class averages;
- curriculum completion donuts/bars used as vanity progress;
- teacher KPI tiles;
- teacher rankings;
- coverage leaderboards;
- AI-use metrics;
- student counts with no immediate teacher need;
- generic “Reports & Insights” sections;
- “recent assessment marked” language that implies AI grading;
- motivational quote cards;
- marketing slogans;
- generic chatbot shells;
- chart zoos;
- huge navigation sidebars;
- unrelated quick-action grids that compete with Next Lesson.

### Performance rule

Teacher Home is primarily a deterministic read model. It must not block behind an AI call.

---

## 12. Class/Teaching Section context

Opening a Teaching Section should resolve:

- school/period;
- teacher assignment;
- subject/level/stream;
- active curriculum profile;
- timetable context;
- previous confirmed outcome;
- current confirmed position;
- carry-forward/unfinished work;
- relevant saved artifacts;
- assessment eligibility;
- known constraints/resources where confirmed.

This context becomes the basis for Lesson Readiness, Formal Lesson Plan, Teaching Pack, Ask ATE and relevant assessment actions.

---

## 13. Lesson Readiness

### Purpose

Lesson Readiness is the lightweight practical preparation surface for the next lesson.

It exists because teachers repeatedly reconcile curriculum, prior progress, classroom constraints and resources.

### Inputs

Deterministically resolved first:

- Teaching Section;
- exact authorised curriculum anchor;
- previous confirmed classroom state;
- carry-forward/unfinished work;
- timetable/time;
- known school/section constraints;
- saved relevant resources/artifacts.

Teacher may add current constraints where needed.

### Output

A concise, usable preparation view. AI may assist with contextual suggestions, but the page remains meaningful if AI is unavailable.

### Stored evidence

When saved, preserve:

- artifact/version;
- canonical curriculum anchor;
- source/provenance refs;
- context snapshot/version;
- teacher edits;
- AI run metadata where AI contributed.

### UX rule

Lesson Readiness is not the same thing as a full formal lesson plan. It should remain fast.

---

## 14. Formal Lesson Plan

### Purpose

Produce a professional detailed lesson artifact where the teacher/school needs formal planning documentation.

### Canonical structured model

The plan should support, where applicable:

- school/teacher/Teaching Section identity;
- date/time/period;
- curriculum anchor and official wording reference;
- previous learning/confirmed continuity;
- lesson intention/objectives and expected evidence;
- competences where genuinely applicable;
- teacher preparation;
- classroom context/constraints;
- methods/pedagogy;
- resources;
- safety/practical considerations;
- differentiation/inclusion;
- timed lesson phases;
- teacher facilitation;
- learner activity;
- prompts/questions;
- formative assessment/checks;
- skills/values/cross-cutting opportunities only when genuinely supported;
- common misconceptions;
- contingency adaptations;
- conclusion;
- homework/follow-up where appropriate;
- teacher reflection after use where chosen;
- references/provenance.

### LOCKED format rule

ATE does **not** claim one universal lesson-plan layout is “the NCDC format.”

ATE owns a canonical structured content model. A school may configure a verified mapping/template that renders the canonical artifact into its preferred format.

### Artifact behaviour

Teacher can:

- generate/draft;
- edit;
- save;
- reopen;
- version;
- duplicate/adapt for another section where authorised;
- map to configured school template;
- export PDF/DOCX.

Exports are renderings of the canonical artifact version, not disconnected files.

---

## 15. Teaching Pack

A lesson plan alone may not give the teacher what they need inside the classroom.

Teaching Pack artifacts can include, selectively:

- Board / Teaching Notes;
- Learner Notes;
- Activity / Worksheet;
- Homework;
- Practical Sheet;
- Lesson Summary.

ATE should recommend useful artifact types rather than forcing every lesson to generate every artifact.

Teaching Pack items derive from the same lesson context. They retain lineage to parent plan/context/version. If the parent changes materially, dependent artifacts can be marked stale rather than silently pretending alignment.

---

## 16. Ask ATE

Ask ATE is **contextual intelligence inside the current workflow**.

It is not a blank generic chatbot on Teacher Home.

Example legitimate requests:

- “Adapt this activity because I only have four microscopes.”
- “Shorten this plan to 40 minutes while preserving the learning intention.”
- “Explain why these two streams have different eligible assessment scope.”
- “Propose a change to the learner activity.”

### Context assembly

ATE resolves authorisation and context server-side before the model is called.

Context hierarchy:

```text
ATE invariant policy
      ↓
Authorised structured curriculum facts
      ↓
Authorised operational facts
      ↓
Current artifact/workflow context
      ↓
User request
      ↓
Isolated supplementary/untrusted content if relevant
```

### Change rule

Ask ATE may return an explanation and/or proposed patch.

A proposed patch does not write authoritative state until the user explicitly applies it.

### Memory rule

Memory is scoped and deliberate. Do not create vague global teacher-memory behaviour that can silently change academic facts.

---

## 17. Resources

ATE may recommend resources such as:

- trusted web references;
- video links;
- school-approved/internal materials;
- textbook/resource metadata where lawfully/accurately represented;
- practical/resource suggestions.

### Rules

- deterministic trust/licence/context filtering precedes AI ranking/explanation;
- never invent a book title, edition, page, chapter or URL;
- store metadata/links rather than copying external copyrighted content by default;
- user constraints such as equipment availability can shape recommendations;
- department approval should not be a mandatory friction step for ordinary suggestions unless school policy explicitly requires it.

Resource intelligence is valuable but secondary to the core prepare-teach-confirm loop.

---

# Part V — Classroom Continuity

## 18. Continuity thesis

Classroom continuity is the mechanism that allows ordinary teacher work to update the next useful context.

### LOCKED rule

A scheduled lesson with no teacher confirmation is `UNCONFIRMED`.

It is **not** automatically missed and is **never** automatically treated as taught.

### Canonical state/event outcomes

#### DELIVERED

The intended instructional work was substantially delivered.

Effect:

- advance confirmed state as appropriate;
- retain optional teacher note;
- update downstream context.

#### PARTIALLY_DELIVERED

The lesson occurred but meaningful planned work remains.

Effect:

- capture stopping point and/or very short unfinished-work note;
- create carry-forward context;
- next preparation reflects the unfinished work.

#### MISSED_OR_CANCELLED

The scheduled lesson did not occur.

Effect:

- optionally capture reason;
- do not invent recovery;
- propose feasible options.

#### CHANGED_FROM_PLAN

Teaching occurred materially differently from the saved plan.

Effect:

- record what actually happened;
- current state and future assessment scope follow reality, not the old plan.

#### UNCONFIRMED

No authorised outcome exists yet.

Effect:

- do not infer success/failure;
- surface only when the missing state itself becomes operationally relevant.

#### CORRECTION

A prior confirmation is amended.

Effect:

- current projection reflects corrected truth;
- original history is retained with who/when/reason/new value.

### Canonical technical flow

```text
ScheduledLesson
      ↓
ContinuityEvent (append fact/correction)
      ↓
Transactional projection update
      ↓
Confirmed classroom position
      ↓
CarryForward / eligible scope / next lesson context
```

This is **narrow event-style history where facts matter**, not a blanket full-system event-sourcing architecture.

### UX target

Normal outcome confirmation should take roughly **10–20 seconds**, often less.

Do not require a reflection essay, evidence upload, learner attendance, photo proof or long checklist as part of routine confirmation.

### Recovery

ATE may propose options such as:

- continue unfinished work next lesson;
- integrate unfinished work into next activity;
- reschedule;
- request timetable recovery;
- explicitly carry forward while continuing.

The teacher decides academic feasibility. Escalate to HOD/DOS only if department/timetable authority is needed.

### Assessment relation

Confirmed taught state constrains ordinary assessment eligibility.

Partial work is not automatically wholly ineligible: where the assessment profile allows, a teacher may confirm the specific portion that is ready.

---

# Part VI — Assessment Studio

## 19. Assessment Studio identity

Assessment Studio is a **curriculum-aware authoring and quality-assurance environment**, not an AI question generator.

The workflow starts with purpose because purpose changes the rules.

Examples of different purposes:

- formative classroom check;
- diagnostic assessment;
- end-of-topic/activity-of-integration style assessment where applicable;
- common departmental assessment;
- term/internal examination;
- mock/end-of-cycle practice;
- improve/audit an existing paper.

### Canonical workflow

```text
1. Purpose
      ↓
2. Assessment Profile / regime resolution
      ↓
3. Eligible curriculum/taught scope
      ↓
4. Assessment Blueprint
      ↓
5. Draft items/tasks/scenarios
      ↓
6. Marking Instrument
      ↓
7. Quality checks
      ↓
8. Teacher / authorised reviewer editing
      ↓
9. Final artifact + controlled export
```

---

## 20. Assessment Profile

Assessment rules are typed by relevant dimensions such as:

- education level;
- subject;
- cohort/version;
- authoritative guidance/version;
- assessment purpose/type.

Do not implement a global generic “CBC assessment rules” prompt.

Lower Secondary and Advanced Secondary may have materially different structures and must remain distinct where authoritative material differs.

Current Advanced Secondary guidance should resolve to the applicable 2026 framework/subject guidance where activated and rights/verification permit it. Conflicts with older materials should be preserved/flagged rather than silently reconciled.

---

## 21. Eligible scope

### Normal classroom assessment

Use confirmed taught/eligible content.

### Diagnostic assessment

May intentionally assess prerequisites or prior knowledge beyond current confirmed coverage when that is the explicit purpose.

### Mock/end-of-cycle practice

May use broader end-of-cycle scope when the resolved profile/purpose permits it, but must distinguish scope that is not confirmed taught.

### Common assessment across parallel streams

Default common eligible scope is the **intersection** of confirmed eligible content across participating sections.

Professional override may exist only where the assessment profile and school authority permit it and should be explicit/auditable.

---

## 22. Assessment Blueprint

The blueprint must exist before AI item drafting.

It can capture:

- purpose;
- profile/regime;
- participating Teaching Sections;
- eligible curriculum scope;
- outcomes/constructs;
- expected evidence;
- task/item distribution;
- difficulty/cognitive expectations where applicable;
- marks/weighting where applicable;
- duration;
- practical/material requirements;
- subject-specific constraints;
- accessibility/inclusion constraints;
- security/review status.

AI drafts only inside the approved blueprint.

---

## 23. Assessment pack

A complete assessment workspace may produce:

- Assessment Blueprint;
- Question Paper / Candidate Task / Assessment Activity;
- Marking Instrument;
- Marking Guide / Expected Responses;
- Analytic Rubric where appropriate;
- Bases of Assessment;
- Indicators/Descriptors;
- Evaluation Grid / Score Sheet where appropriate;
- Teacher Quality Report;
- PDF/DOCX/school-template rendering;
- version/audit history.

The exact instrument depends on the resolved profile and assessment type.

### LOCKED marking boundary

ATE prepares the assessment and marking instrument.

**The teacher marks.**

Learner marks storage, AI grading and learner-result profiling are outside v1 unless separately approved through product/security decisions.

---

## 24. Assessment review and security

Routine formative work should not be trapped in bureaucracy.

Common or higher-stakes internal assessments may use configurable states such as:

`Draft → In Review → Final`

Reviewer requirements should follow school policy/assessment risk, not be hard-coded globally.

Restricted papers and marking instruments require stronger controls:

- record/action authorisation;
- controlled export;
- version history;
- optional embargo/release dates;
- finalisation/export audit;
- Ask ATE cannot reveal restricted content outside authorised scope.

After use, teachers may record lightweight paper-quality reflections such as ambiguity or unrealistic practical setup. This is about improving the assessment artifact, not creating a learner analytics platform.

---

# Part VII — Leadership and institutional visibility

## 25. Leadership principle

Leadership sees **minimum verified evidence necessary for decisions that belong to its role**.

Leadership is not the product’s primary data-entry customer and should not turn ATE into surveillance.

### HOD — Department Pulse

Primary question:

> Where does my department need coordination or academic support?

Potential evidence/action:

- meaningful stream divergence;
- unfinished work affecting common assessment;
- common-paper readiness;
- department-level recovery/support;
- reusable departmental resources;
- Department Brief.

### DOS — Academic Operations

Primary question:

> Is the academic programme operating as intended, and where is operational authority required?

Potential evidence/action:

- timetable/programme exceptions;
- recovery requiring scheduling authority;
- lab/room/resource conflicts;
- cross-department constraints;
- Academic Operations Report.

### Principal — Academic Assurance

Primary question:

> Is the school’s academic programme broadly under control, and what material issues require institutional action?

Potential evidence/action:

- recurring systemic constraints;
- material programme disruption;
- unresolved senior decisions;
- Academic Assurance Report.

---

## 26. Progressive escalation

Issues remain at the lowest competent authority.

Example:

```text
Normal partial lesson
    → teacher resolves

Meaningful parallel-stream divergence
    → HOD if coordination authority is needed

Recovery requiring timetable change
    → DOS

Recurring whole-school lab/resource constraint
    → Principal / institutional decision
```

Every escalated issue should retain:

- evidence;
- current owner;
- required authority;
- possible actions/recommendation;
- status;
- resolution history.

### Explicit prohibition

No:

- teacher leaderboards;
- best/worst teacher ranking;
- AI teacher-quality scores;
- prompt-use rankings;
- coverage rankings;
- surveillance-oriented activity feeds.

Coverage does not equal learning. Surveillance can also reduce honesty in the teacher-confirmed data ATE depends on.

---

# Part VIII — Academic Knowledge and curriculum governance

## 27. Academic Knowledge identity

Academic Knowledge is the governed academic reference layer that lets ATE resolve exact curriculum/assessment context without using model memory as authority.

It should represent structured, typed, versioned knowledge with provenance.

### Core concepts

- Source Registry;
- source document/version;
- source span/locator/page/section;
- canonical knowledge record;
- official wording;
- separate ATE interpretation where needed;
- relationships;
- curriculum release/profile;
- subject/level/cohort binding;
- assessment profile/rules;
- review/verification status;
- rights status;
- external-AI eligibility;
- effective period;
- activation/deactivation;
- conflict/review queue;
- content identity/hash;
- import/review history.

### Retrieval order

1. exact structured deterministic retrieval for authoritative facts;
2. deterministic filtering/relationships;
3. semantic/vector retrieval only as a secondary aid for mapping/free text/non-authoritative content.

Vector similarity must never silently replace exact curriculum authority.

### Rights rule

Production and external-AI use fail closed when the source/profile is not eligible.

Do not burden ordinary teachers with internal rights machinery; enforce it in the platform.

### Repository rule

Git stores the machinery, schemas and safe fixtures — not a growing library of protected NCDC/UNEB/private school source text.

---

# Part IX — AI system

## 28. AI philosophy

ATE treats AI as a **probabilistic subsystem inside deterministic controls**.

AI is used where language generation, synthesis, explanation, adaptation or contextual judgement adds value.

AI is not used where deterministic software is sufficient.

### AI may assist with

- Lesson Readiness suggestions;
- lesson adaptation;
- Formal Lesson Plan drafting;
- Teaching Pack drafting;
- contextual Ask ATE;
- assessment scenario/item/instrument drafting within approved blueprint;
- resource explanation/ranking after deterministic filtering;
- leadership narrative summaries from verified evidence.

### AI must not own

- official curriculum facts;
- assessment authority;
- school identity/configuration facts;
- actual classroom delivery;
- timetable facts;
- permissions;
- workflow state;
- assessment publication/finalisation;
- learner marks/grading;
- institutional decisions;
- causal claims unsupported by evidence.

---

## 29. AI Gateway

All external AI calls flow through a central server-side AI Gateway/context builder/provider abstraction.

Feature modules must not directly instantiate provider SDK clients.

A production AI workflow must define:

- workflow name/purpose;
- authorisation rule;
- approved context sources;
- data classification/minimisation;
- context-builder version;
- model/provider version;
- prompt/workflow version;
- structured input schema;
- structured output schema;
- deterministic validation/quality checks;
- retry/repair policy;
- failure behaviour;
- human apply/approval boundary;
- latency/token/cost telemetry;
- reproducibility metadata.

### Minimal sufficient context

Do not send whole databases, entire protected documents or unnecessary personal data “just in case.”

### External/untrusted content

External web/resource text is untrusted. It must be isolated from authoritative curriculum/operational facts and cannot instruct the model to override system policy.

### No arbitrary tool surface

Normal academic workflows do not give the model generic:

- SQL;
- shell;
- filesystem;
- arbitrary HTTP access.

---

## 30. AI failure and safety behaviour

### Provider/network failure

- bounded retry;
- preserve user draft;
- visible retry/manual/saved-version path;
- deterministic core remains usable.

### Invalid structured output

- one bounded repair attempt where justified;
- fail visibly if still invalid;
- never silently accept malformed data.

### Missing curriculum/operational context

- retrieve/ask/abstain;
- do not fill the gap confidently from model memory.

### Prompt injection

- treat untrusted content as data, not instructions;
- quarantine/reject suspicious content;
- do not solve by switching to a “smarter model.”

### Reproducibility

Record enough to identify the conditions of an AI output:

- model;
- provider;
- prompt/workflow version;
- context-builder version;
- schema version;
- curriculum/source versions;
- validation status;
- relevant hashes/references.

### Human boundary

Generated output remains draft/recommendation until an authorised action changes institutional state.

---

# Part X — Technical architecture

## 31. Architecture objective

ATE should behave like reliable institutional software that happens to use AI — not an AI demo wrapped in school workflows.

### LOCKED architecture principles

1. **State before intelligence** — deterministic state first.
2. **Append facts, project views** — preserve consequential history without making everything event-sourced.
3. **Version what changes meaning** — curriculum profiles, timetable versions, artifacts, prompts/schemas where reconstruction matters.
4. **Authorise at record and action level** — role name alone is insufficient.
5. **One canonical artifact, many renderings**.
6. **Fail closed on rights and permissions**.
7. **Progressive escalation**.
8. **Operational simplicity is a feature**.

---

## 32. Target v1 stack

The production rebuild should converge on the simplest credible implementation of:

- **Node.js 22**;
- **TypeScript strict**;
- **Next.js App Router + React**;
- coherent design-system/component primitives;
- **Tailwind** if retained/selected during foundation reset;
- customised accessible Radix/shadcn-style primitives where useful rather than stock visual identity;
- **Lucide** icons;
- **React Hook Form + Zod** where appropriate;
- **Zustand only for ephemeral UI/draft state**;
- **PostgreSQL / Supabase** for DB/Auth/Storage/RLS;
- **Drizzle ORM/Kit**;
- **pgvector/vector search only as a secondary retrieval aid**;
- bounded AI Gateway/provider abstraction;
- background jobs only where request/response is unsuitable;
- narrow low-bandwidth/offline resilience later where justified;
- **react-pdf + DOCX** rendering from canonical structured artifacts;
- **Vitest + Playwright**;
- structured observability/Sentry;
- Vercel + GitHub Actions unless an approved ADR changes deployment.

### Explicitly deferred architecture

Do not introduce without measured need + ADR:

- microservices;
- Kafka/event streaming platform;
- Kubernetes;
- separate graph database;
- separate vector database/search cluster;
- Python backend merely for AI;
- autonomous multi-agent control plane;
- self-hosted model infrastructure;
- full offline-first replication;
- infrastructure for hypothetical national scale.

---

## 33. Runtime/container model

Conceptually:

```text
Browser / PWA-like client
    ↓ authenticated requests
Next.js application / BFF / modular monolith
    ├── Domain/application services
    ├── Authorisation/policy
    ├── Academic Knowledge retrieval
    ├── AI Gateway
    ├── Artifact rendering orchestration
    └── Background job coordination
            ↓
PostgreSQL / Supabase
Private object storage
External AI provider(s)
Observability
Controlled job runner where required
```

The browser has no privileged service credentials.

---

# Part XI — Security, tenancy, privacy and governance

## 34. Tenant boundary

The **school is the tenant boundary** for school-owned state.

Shared centrally governed Academic Knowledge may exist across tenants, but school operational data does not become cross-school content.

### Defence in depth

```text
Authenticated identity
      ↓
Active school membership
      ↓
Role + configured scope
      ↓
Requested action + record classification
      ↓
Server-side policy
      ↓
Database RLS / relational constraints
```

Client-side visibility checks are UX only, not enforcement.

### Additive roles

A leader may also teach. Permissions depend on role + scope + action + resource, not merely the word “HOD” or “Principal.”

### Private drafts

Teacher private AI conversations/drafts are not automatically leadership-visible.

### Service role

Supabase/service-role credentials are server-only.

---

## 35. Data minimisation and privacy

ATE v1 should avoid collecting learner/personal data that the core product does not need.

Do not send unnecessary identifiers or protected school content to external model providers.

Do not log full sensitive prompts/documents by default.

Audit consequential actions, not private drafting behaviour or every UI interaction.

Contracts/retention/provider handling must remain explicit before expansion.

---

# Part XII — Artifacts and documents

## 36. Artifact architecture

Major academic outputs are structured, versioned artifacts.

One artifact has:

- stable identity;
- type;
- school/owner/scope;
- canonical curriculum anchor/context;
- immutable versions;
- current-version pointer;
- status;
- provenance;
- human/AI contribution metadata as appropriate;
- export history where important.

### Rendering rule

```text
Canonical Artifact Version
        ├── UI
        ├── PDF
        └── DOCX / School Template
```

Do not maintain independent textual copies for UI/PDF/DOCX.

---

# Part XIII — UI/UX product specification

## 37. UI/UX status

### LOCKED

UI/UX is a **product correctness and release requirement**, not a cosmetic phase after engineering.

ATE must look and feel credible enough for serious school stakeholders while remaining practical for daily teachers.

The target is not flashy consumer software and not a generic admin dashboard.

### Desired character

- calm;
- premium;
- institutional;
- modern;
- precise;
- confident;
- low-noise;
- highly legible;
- deliberate rather than decorative.

---

## 38. Visual language

Current ATE visual direction:

- white/off-white foundations;
- deep Bankai navy such as the `#0B2343` / `#14365D` family;
- clear action blue such as the `#0878C9` / `#0099D8` family;
- restrained cyan accents;
- dark neutral text;
- quiet borders/surfaces;
- high-quality sans-serif UI typography in an Inter/Noto Sans-type direction;
- generous but disciplined whitespace;
- strong alignment and typographic hierarchy;
- moderate radii, not bubble UI;
- subtle elevation only where hierarchy requires it;
- Lucide-style coherent iconography.

Exact tokens should be centralised in the design system rather than copied page by page.

### Do not use

- “Bankai green”;
- purple AI gradients;
- neon glow;
- default glassmorphism;
- heavy glossy effects;
- giant gradient hero blocks inside the application;
- excessive floating cards;
- card-within-card nesting;
- random visual styles per screen;
- decorative corner copy;
- meaningless charts;
- generic “AI magic” badges everywhere.

---

## 39. Information hierarchy

Every screen needs a dominant job.

Do not give five actions equal visual weight.

Use hierarchy approximately as:

```text
Current context / primary task
        ↓
Primary action
        ↓
Immediate supporting state
        ↓
Secondary actions
        ↓
History / advanced detail / configuration
```

Progressive disclosure should hide complexity until it is useful.

---

## 40. Responsive product behaviour

### Teacher surfaces

Mobile-first because realistic daily use includes low/mid-range Android devices.

Validate at least:

- 360 px;
- 390 px;
- 430 px.

Also ensure real desktop/browser adaptation at:

- 1280 px;
- 1440 px;
- 1600 px.

A desktop teacher view must not be a narrow mobile column awkwardly centered on a large screen.

### Leadership surfaces

Desktop-first, but responsive. Use denser information where leadership work genuinely benefits from comparison/tables, while maintaining clarity.

### Tablet

Validate around 768 px where the specific screen is likely to be used.

---

## 41. Navigation

Teacher navigation must remain minimal.

A mobile model may use a small set such as:

- Today;
- Classes;
- Create;
- Work;
- More.

Exact labels can evolve if the underlying jobs remain coherent.

Desktop can use a restrained top/side application frame, but do not create a massive enterprise sidebar with every module exposed at once.

Ask ATE should usually live inside the relevant workflow/context rather than become the global dominant navigation destination.

---

## 42. UI states

Major surfaces must design:

- loading;
- empty;
- partial-data;
- unconfirmed academic state;
- permission denied;
- provider/AI failure;
- retry;
- offline/degraded;
- stale artifact;
- save/saved/saving failure;
- long content;
- destructive confirmation;
- successful completion without excessive celebratory UI.

No dead ends.

---

## 43. Interaction quality

Requirements:

- obvious click/tap targets;
- touch-friendly controls;
- fast teacher outcome logging;
- keyboard navigation for browser use;
- visible focus;
- accessible contrast;
- non-colour-only status;
- predictable back/cancel behaviour;
- autosave/save-state clarity where applicable;
- no hidden destructive side effects;
- intentional motion only when it clarifies hierarchy/state/transition.

Animation should feel refined, not distracting.

---

## 44. Mandatory UI build workflow

For significant UI work, Codex should:

1. read this product specification;
2. use `gpt-taste` / `design-taste-frontend` as appropriate;
3. use `karpathy-guidelines` for implementation discipline;
4. establish information hierarchy before decoration;
5. implement against real component/state contracts;
6. render the actual application;
7. inspect mobile and desktop widths;
8. use `impeccable` for critique/polish where appropriate;
9. fix spacing, hierarchy, typography, alignment, responsive behaviour, states and accessibility findings;
10. run Playwright/visual checks where supported;
11. repeat until the rendered product passes the quality bar.

A successful build is not proof of good UI.

---

# Part XIV — Operational quality and resilience

## 45. Reliability contract

ATE is not production-ready unless it behaves predictably under:

- weak connectivity;
- provider failure;
- user correction;
- device variation;
- stale data;
- permissions differences;
- long content;
- import failures;
- partial school setup.

### Quality contract

> **Fast enough. Clear enough. Recoverable. No fake state. No silent failure. No lost work. AI can fail without ATE collapsing.**

---

## 46. Low-bandwidth/offline direction

TARGET V1 is **online-first with narrow resilience**, not a full offline-first distributed database.

Prioritise:

- resilient current draft;
- protected outcome capture;
- small controlled outbox if evidence justifies it;
- retry/conflict handling;
- clear sync state.

Do not advertise full offline behaviour until sync/conflict recovery has been proven.

---

## 47. Observability and support

Bankai must be able to answer:

- what failed;
- when;
- for which school/user/workflow (without exposing unnecessary sensitive data);
- whether data was lost;
- what retry/recovery path exists;
- AI latency/token/cost/failure for controlled workflows;
- job/import/export health;
- backup/restore status.

A small support/admin surface may manage:

- school setup health;
- invitations/roles;
- failed imports/jobs;
- Academic Knowledge processing/review issues;
- support diagnostics.

It must not become a shortcut around tenant privacy or database governance.

---

# Part XV — Pilot and evidence discipline

## 48. Current stage

ATE is in controlled rebuild/pilot preparation, not proven product-market fit.

Mount of Olives College, Kakiri is the intended controlled pilot/design-partnership context in current project planning. Staff have seen a demo and expressed interest; the operational pilot has not yet begun and teachers should not be described as current ATE users until that changes.

Do not seed production code with real staff identities or imply school/NCDC/UNEB/Ministry endorsement.

---

## 49. Pilot questions

The pilot should test, among other things:

- Do teachers voluntarily repeat the prepare → teach → confirm → reuse loop after novelty/support fades?
- Does ATE reduce preparation/documentation time including correction time?
- Are lesson artifacts professionally usable?
- Does 10–20-second outcome confirmation feel worth doing?
- Is continuity accurate enough to improve the next lesson?
- Does assessment scope/profile logic produce better/safer assessment preparation?
- Do HOD/DOS/Principal surfaces create useful decisions without adding teacher bureaucracy?
- Does low-bandwidth/recovery behaviour protect work?
- What onboarding/support effort does Bankai actually spend?
- What would the school pay/renew for?

Positive demo feedback is directional evidence, not proof.

---

# Part XVI — Scope boundaries

## 50. Essential v1 core

The v1 production direction includes:

- secure school tenant/workspace;
- real authentication/membership/additive roles;
- school structure and academic periods;
- timetable/programme context;
- Teaching Sections;
- governed curriculum/assessment profiles;
- Teacher Home;
- Lesson Readiness;
- Formal Lesson Plan;
- Teaching Pack;
- version/reuse/export;
- contextual Ask ATE;
- classroom continuity/outcome correction;
- unfinished work/carry-forward/recovery;
- rights/provenance;
- AI Gateway and evaluation controls;
- reliable responsive UI;
- audit/security/observability foundations.

---

## 51. Secondary / controlled activation

Important but should not derail proof of the core teacher loop:

- Assessment Studio depth;
- common-paper coordination;
- department exceptions;
- richer leadership reports;
- resource intelligence depth;
- post-use assessment reflection;
- narrow offline outbox/resilience beyond basic draft protection.

These are v1 direction but should be sequenced after the production foundation and core vertical slice.

---

## 52. Explicitly deferred

Unless a new approved decision changes scope:

- learner accounts;
- parent portal;
- learner marks database;
- AI marking/grading;
- automated learner profiling;
- predictive mastery;
- broad school ERP;
- fees/payroll/admissions;
- autonomous timetable changes;
- teacher rankings;
- autonomous institutional academic decisions;
- national-scale integrations before evidence;
- broad multi-agent architecture;
- microservices/event-streaming platform;
- full offline-first replication.

Do not implement deferred features opportunistically because they make a demo look richer.

---

# Part XVII — Production rebuild sequence

## 53. Rebuild sequence

### Step 0 — Freeze prototype — COMPLETE

- preserve old state in `archive/prototype-v4`;
- rebuild work on `rebuild/ate-v1-production`.

### Step 1 — Establish authority and build contract — CURRENT

- replace old repo authority with this specification + `AGENTS.md`;
- skills/build quality rules active;
- no product code change until authority is coherent.

### Step 2 — Reset application foundation

- clean Next.js/TypeScript foundation;
- dependency refresh;
- package/tooling decision;
- design-system foundation;
- environment separation;
- CI green;
- remove fake school state from production path;
- establish quality/visual test scaffolding.

### Step 3 — Production security and tenancy

Build:

- Supabase Auth;
- School;
- Membership;
- additive roles;
- Departments;
- Academic periods;
- RLS;
- private storage;
- audit events.

Do this before creating a beautiful shell that is still fake/insecure.

### Step 4 — Academic Operations core

Build:

- Level/Class;
- Stream;
- Subject/Profile binding;
- Teaching Section;
- Timetable Version;
- Timetable Slot;
- Scheduled Lesson;
- School Programme.

### Step 5 — Classroom Continuity

Implement correctly:

```text
scheduled lesson
      ↓
continuity event
      ↓
projection
      ↓
confirmed classroom position
      ↓
carry-forward
```

No mutable `current_topic` field as the ultimate truth.

### Step 6 — Reconnect Academic Knowledge

Refactor/salvage the strong existing machinery into the new release/profile/rights/provenance architecture.

Do not blindly re-import protected content.

### Step 7 — First production vertical slice

The first full proof should be:

> **Real teacher logs in → sees real Next Lesson → opens Lesson Readiness → saves/reopens work → teaches → records outcome in seconds → continuity changes the next lesson context.**

This slice must be visually excellent, not a backend demo.

### Step 8

Formal Lesson Plan + Teaching Pack + contextual Ask ATE.

### Step 9

Assessment Studio.

### Step 10

HOD / DOS / Principal surfaces and reports.

### Step 11

Narrow offline resilience, operational support tooling, pilot hardening, restore/recovery drills and release gates.

---

# Part XVIII — Acceptance rules

## 54. Product acceptance

A feature should not ship merely because it exists.

It must be:

- useful in the real role workflow;
- consistent with ATE’s truth model;
- low-friction enough for school reality;
- honest about what is recorded/calculated/generated;
- appropriately human-controlled;
- not dependent on fake data;
- not silently dependent on AI for core truth.

---

## 55. Engineering acceptance

Relevant changes must pass:

- TypeScript strict typecheck;
- lint;
- unit/domain tests;
- integration tests;
- RLS/authorisation tests for sensitive data boundaries;
- AI schema/eval tests for AI workflows;
- Playwright for critical flows;
- production build;
- dependency/security review when dependencies change.

Known failures must be stated, not hidden.

---

## 56. UI acceptance

A significant screen is not accepted until the actual rendered product has been checked at the required viewports.

At minimum check:

- visual hierarchy;
- spacing rhythm;
- typography;
- alignment;
- density;
- icon consistency;
- responsive transformation;
- long content;
- loading/empty/error/permission states;
- touch targets;
- keyboard/focus;
- accessibility contrast;
- save/destructive-action clarity;
- lack of fake/ambiguous data;
- absence of generic “vibecoded” UI patterns.

Use Taste before/while designing and Impeccable as a critical polish/review pass.

---

## 57. Final product standard

ATE must feel like **one coherent product**.

The database model, classroom state machine, AI boundary, leadership model and interface should all tell the same story:

```text
What should be taught
        ↓
What this Teaching Section was prepared to do
        ↓
What the teacher confirms actually happened
        ↓
What remains / what comes next
        ↓
What is legitimately assessable
        ↓
What authorised people need to act on
```

ATE should not sound sophisticated while behaving inconsistently.

When there is a choice:

- choose trustworthy state over AI cleverness;
- choose teacher value over management vanity;
- choose a clean core loop over feature breadth;
- choose explicit states over vague “progress”;
- choose human authority over automated certainty;
- choose a carefully designed interface over a generic dashboard;
- choose the simplest architecture that meets real requirements.

That is the ATE v1 we are building.

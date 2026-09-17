# Academic Track Engine (ATE)
## Product Requirements Document

**Company:** Bankai Technologies  
**Document:** PRD.md  
**Version:** 4.0  
**Status:** Product specification of record  
**Date:** 9 September 2026

> This document defines what ATE is, who it serves, how the product should behave, and which product principles are non-negotiable. Technical architecture and implementation choices belong in `TRD.md`.

## 1. Product identity

Academic Track Engine (ATE) is a **teacher-first curriculum implementation and academic operations platform for secondary schools**.

ATE connects three realities that are usually fragmented:

1. **What should be taught** — curriculum and assessment authority.
2. **What is actually happening** — timetable, Teaching Sections and teacher-confirmed classroom state.
3. **What should happen next** — planning, assessment, resources, continuity and authorised academic action.

ATE is not primarily a chatbot, lesson-plan generator, LMS, marks system or school ERP. It is the **context-aware academic workspace that connects curriculum intention to everyday teaching and school academic operations**.

### Core value proposition

> **ATE helps teachers create the academic work they already need without rebuilding their context every time, while giving authorised leaders useful visibility from the same underlying academic state.**

## 2. Problem

Teachers repeatedly reconstruct context across planning and assessment:

- curriculum expectation;
- scheme position;
- class/stream;
- previous lesson outcome;
- unfinished work;
- available resources;
- current timetable;
- assessment purpose;
- what has actually been taught;
- school document format.

General-purpose AI can generate content, but usually begins from a prompt. ATE reduces this **context tax** by retaining verified school and classroom context and applying it to academic workflows.

## 3. Product principles

### 3.1 Teacher-first
The teacher is the primary daily user. Leadership value must come from normal teacher work, not from extra reporting forms.

### 3.2 Curriculum owns truth
Official curriculum and assessment requirements come from authorised sources. AI must not invent curriculum authority.

### 3.3 School operations own facts
Timetable, school programme, teacher assignments, Teaching Sections and school configuration are verified school facts.

### 3.4 Teachers own classroom reality
Only an authorised educator can confirm what actually happened. A scheduled lesson does not prove teaching occurred.

### 3.5 Intelligence reasons; educators decide
AI may retrieve, draft, explain, adapt, compare and propose. Consequential changes require human confirmation.

### 3.6 Rules before AI
Deterministic facts are determined by code first.

### 3.7 Retrieval before generation
Curriculum-specific generation begins from retrieved, rights-eligible context rather than model memory.

### 3.8 Low friction
ATE must reduce work. It should never request information merely because a database field exists.

### 3.9 Visibility without surveillance
No teacher leaderboards, coverage rankings, AI-use rankings, speed indices or hidden teacher-quality scores. Missing information is `UNCONFIRMED`.

### 3.10 Explainability
Important generated outputs and recommendations support a clear **Why this?** view.

### 3.11 Graceful degradation
Core records and saved artifacts remain usable if AI or connectivity is temporarily unavailable.

## 4. Core concepts

### 4.1 School workspace
Each school has an isolated workspace containing its people, roles, timetable, programme, Teaching Sections, templates, academic artifacts and operational state.

### 4.2 Teaching Section
The primary operational unit is:

> **Teacher × Subject × Level/Class × Stream × Academic Period**

Parallel streams are independent. The same teacher may have different current positions in different streams.

### 4.3 Academic state
For each Teaching Section, ATE may maintain:

- current curriculum position;
- previous confirmed lesson outcome;
- unfinished work;
- upcoming timetable slot;
- scheme position where available;
- assessment eligibility;
- relevant class/resource context.

### 4.4 Digital Twin
The Digital Twin is the **computed latest verified picture of the school**. It emerges from current records; it is not one mutable AI-generated blob.

### 4.5 Academic artifact
Major artifacts include:

- Scheme of Work;
- Lesson Readiness;
- Formal Lesson Plan;
- Assessment;
- Marking Guide;
- Analytic Rubric;
- Score Sheet;
- Department Brief;
- Academic Operations Brief;
- School Academic Brief.

Artifacts are editable, versioned and exportable where appropriate.

## 5. Roles

Roles are additive.

A user may be:
- Teacher;
- Teacher + HOD;
- Teacher + DOS;
- Head Teacher / Principal;
- another authorised academic role configured by the school.

Leadership responsibility must not remove the normal teacher workspace when that person teaches.

## 6. School onboarding

Onboarding should feel like:

> **Give ATE the school’s existing information → ATE reconstructs the school → people verify only their part → go live.**

### 6.1 School context
An authorised school user establishes:
- school identity;
- academic year and term;
- levels/classes;
- streams;
- departments;
- bell/period structure.

The school may upload its current programme/calendar so ATE knows holidays, examinations, assemblies, sports days, trips, visitation days and other known disruptions.

### 6.2 Timetable import and verification
ATE accepts practical timetable formats such as spreadsheet, PDF or image.

ATE should:
- extract days, periods, streams/classes, subjects, teacher labels and rooms where available;
- identify uncertain cells;
- detect obvious double-bookings/conflicts;
- propose Teaching Sections;
- ask the authorised user to verify only uncertain/conflicting items;
- activate only after explicit confirmation.

A timetable revision creates a new version and shows the difference rather than forcing full re-entry.

### 6.3 Invite users
The school adds/imports staff and assigns authorised roles. ATE matches teachers to proposed Teaching Sections. Invitations are secure; users do not self-assign leadership roles.

### 6.4 Teacher confirms assignment and current point
After joining, the teacher:
1. confirms the Teaching Sections ATE believes they teach or flags an error;
2. for each confirmed Teaching Section, selects the current curriculum position;
3. optionally records a short unfinished-work note.

**Scheme of Work upload is not required for onboarding.**

### 6.5 Setup completion
Once the required facts are confirmed, the Teaching Section becomes ready for planning and continuity.

## 7. Teacher Home

Teacher Home is mobile-first and answers:

> **What do I need to do next?**

Priority:
1. next lesson;
2. where that class stopped;
3. unfinished work;
4. preparation status;
5. today’s remaining lessons;
6. any outcome awaiting confirmation.

Primary actions:
- Prepare Lesson;
- Create Assessment;
- Record Outcome;
- Ask ATE.

Teacher Home is not an analytics dashboard.

## 8. Scheme of Work

Scheme of Work is a first-class planning artifact.

ATE should support:
- upload an existing scheme;
- extract and verify its structure;
- generate a draft from curriculum + term dates + timetable;
- edit/save/version;
- render in a school-preferred format where configured.

The scheme becomes planning context, but it does not independently determine what was actually taught.

## 9. Lesson preparation

ATE has two related but distinct planning outputs.

### 9.1 Lesson Readiness
A quick operational preparation view containing the essentials needed for the next lesson.

### 9.2 Formal Lesson Plan
A complete professional artifact that may include:

1. lesson identity;
2. curriculum anchor;
3. prior learning and continuity;
4. lesson intention and success evidence;
5. teacher preparation notes;
6. classroom context;
7. methods/pedagogy;
8. materials/resources and safety where relevant;
9. detailed timed lesson development;
10. formative assessment plan;
11. genuine generic skills/values/cross-cutting opportunities;
12. differentiation and inclusion;
13. misconceptions and contingencies;
14. conclusion/follow-up/homework where meaningful;
15. reflection/actual outcome;
16. references and provenance.

ATE must not claim one universal Bankai layout is “the NCDC lesson-plan format.” The canonical lesson model should render into ATE’s professional format or an uploaded school template.

## 10. Classroom continuity

After a scheduled lesson, the teacher records one of:

- Delivered as planned;
- Partially delivered;
- Missed / cancelled;
- Changed from plan.

Missing data remains `UNCONFIRMED`.

For partial delivery, ATE should make unfinished work easy to record. The next lesson uses that confirmed state. Parallel streams remain independent.

Normal outcome logging should take seconds, not minutes.

## 11. Ask ATE

Ask ATE is contextual, not a blank chatbot.

It inherits the active context, such as:
- Teaching Section;
- current artifact;
- curriculum position;
- previous lesson outcome;
- scheme context;
- timetable;
- available resources;
- assessment scope.

Examples:
- “Make this practical work with four microscopes.”
- “Break this outcome across two periods.”
- “Make this suitable for 65 learners.”
- “Change the formative assessment.”
- “Make Question 4 more application-based.”

Ask ATE may return a proposed **artifact patch**. The artifact changes only after the user explicitly applies it.

## 12. Resource discovery

Resource discovery should work in the background around the lesson.

ATE may recommend:
- practical/activity resources;
- verified videos;
- useful websites;
- school resources;
- textbook/reference suggestions where verified;
- low-resource alternatives.

The teacher may open, ignore, save or attach a recommendation.

**Verification is not approval.** Routine resource use must not require an HOD approval ceremony.

Optional institutional “preferred/recommended” states may exist but cannot block normal teacher recommendations.

ATE must not invent a book title, chapter, page, edition or URL.

## 13. Assessment Engine

Assessment is a first-class subsystem.

### 13.1 Principle
ATE does not generate questions first. It establishes:

> purpose → regime → eligible scope → construct/competency/outcome → evidence requirement → blueprint → item/scenario → scoring instrument → quality evaluation.

### 13.2 Lower Secondary
Lower Secondary assessment follows the relevant Lower Secondary curriculum/assessment logic. Formative assessment should not be reduced to constant written tests. Observation, conversation and product evidence may be relevant depending on the task.

### 13.3 Advanced Secondary
Advanced Secondary generation must use the applicable framework and subject-specific assessment profile, including assessment objectives, constructs, abilities, indicators of mastery, complexity and paper/rubric requirements where available.

### 13.4 Scope guard
Normal class tests use confirmed-taught scope. Partial/unconfirmed/not-taught content is excluded unless the selected purpose deliberately permits it (for example diagnostic use).

Common Stream Test scope is the intersection of confirmed-taught eligible content across selected streams.

### 13.5 Assessment surfaces
ATE supports:

- **Create Assessment**
- **Improve Existing Paper**
- **My Assessments**
- **Marking Materials**
- **Assessment Quality / Blueprint**

### 13.6 Improve Existing Paper
A teacher may upload an existing paper. ATE audits the paper itself for:
- curriculum scope;
- outcome/construct coverage;
- balance;
- cognitive demand;
- scenario quality;
- ambiguous wording;
- scientific/subject accuracy;
- duplicated items;
- unrealistic data;
- time/marks;
- scoring quality.

Issues should support teacher-controlled actions such as:

**Keep | Rewrite | Replace**

ATE must not silently rewrite the whole paper.

### 13.7 Marking boundary
ATE prepares:
- conventional marking guides;
- analytic rubrics;
- bases of assessment;
- indicators/descriptors;
- score sheets.

> **ATE prepares the assessment and marking instrument. The teacher does the marking.**

Current scope excludes learner mark upload, AI grading and learner-result profiling.

## 14. Documents and export

Major teacher artifacts support:
- save;
- version history;
- reopen;
- duplicate;
- adapt to another stream;
- PDF export;
- DOCX export where appropriate.

The same canonical artifact should drive UI and exports.

## 15. HOD workspace

The HOD retains the normal teacher workspace plus department coordination.

Primary value:
- Department Pulse;
- Teaching Sections and meaningful stream differences;
- common-assessment readiness;
- academic issues requiring coordination;
- reusable department resources/knowledge;
- Ask ATE with department context;
- generate a Department Brief.

The HOD does not approve every routine lesson and does not receive a teacher leaderboard.

## 16. DOS workspace

The DOS retains teacher tools if they teach, plus Academic Operations.

Primary value:
- timetable and Teaching Sections;
- school programme;
- operational exceptions;
- recovery/scheduling decisions;
- cross-department constraints;
- common-assessment readiness;
- Ask ATE with operational context;
- generate an Academic Operations Brief.

The DOS should see what actually requires operational authority, not every teacher event.

## 17. Head Teacher / Principal workspace

The Head Teacher sees institutional academic assurance, not detailed teacher micromanagement.

Primary value:
- school-level academic health;
- department attention;
- systemic constraints;
- unresolved senior decisions;
- cross-department patterns;
- Ask ATE with institutional context;
- generate an Academic Brief.

Routine teacher-level details should not appear by default.

## 18. Progressive escalation

Information rises only as far as required.

Typical pattern:

Teacher partial lesson → teacher continuity update.  
Meaningful stream divergence → HOD may coordinate.  
Normal timetable cannot recover → DOS may intervene.  
Systemic/repeated institutional issue → Head Teacher may need visibility.

ATE should model:

> issue → evidence → recommended owner → required authority → possible actions → status.

## 19. Reporting

Reporting must be an output of normal academic work, not another reporting task.

Three reporting levels:
1. **Live operational view** — what needs attention now;
2. **AI-generated brief** — editable narrative from verified facts;
3. **Formal export** — PDF/DOCX where required.

Facts are calculated deterministically. AI may explain, group and summarise them.

## 20. UI/UX requirements

UI quality is part of product correctness.

### Teacher
- mobile-first;
- designed for typical Android widths around 360–430 px;
- next action dominant;
- low information density;
- large touch targets;
- short interactions;
- offline-aware.

### Leadership
- desktop-friendly but responsive;
- exception-first;
- action-oriented;
- restrained.

ATE should feel:
- institutional;
- modern;
- calm;
- precise;
- trustworthy.

ATE should not feel:
- futuristic;
- gamified;
- like a generic AI dashboard;
- like ChatGPT wrapped in school colours;
- like a wall of KPI cards.

Avoid excessive gradients, glassmorphism, nested cards, decorative AI purple, fake analytics and meaningless charts.

## 21. Connectivity and offline direction

Critical teacher workflows should tolerate unreliable connectivity.

Initial offline target:
- today’s timetable;
- current Teaching Section context;
- saved lesson artifacts;
- lesson-outcome capture;
- queued sync when connectivity returns.

AI generation may require internet initially.

## 22. Rights, provenance and institutional trust

ATE must preserve source authority, version and rights status.

ATE must not imply NCDC, UNEB, Ministry or school endorsement without written authority.

Protected curriculum content must not be activated in production outside the applicable permission/licensing basis.

## 23. Current non-goals

Do not implement unless this PRD is deliberately changed:

- learner accounts;
- parent portal;
- learner marks database;
- AI marking/grading;
- learner profiling;
- teacher rankings;
- payroll;
- fees;
- admissions;
- discipline management;
- generic LMS functionality;
- general school ERP;
- autonomous timetable changes;
- AI-created official school facts.

## 24. Success standard

Teacher:
> “ATE already knows my teaching context, helps me prepare from where this class actually is, and makes the next work easier.”

HOD:
> “I can coordinate the department without chasing teachers for routine updates.”

DOS:
> “I see the academic-operational exceptions that actually need action.”

Head Teacher:
> “I have academic assurance without micromanaging teachers.”

## 25. Product quality bar

ATE should feel like credible institutional software that happens to use AI.

The strongest proof is coherent state:
- teacher confirmation changes the next lesson;
- the same fact affects department/operations only when relevant;
- assessment scope reflects confirmed classroom state;
- leadership receives only the resolution it needs;
- AI remains explainable and subordinate to educator authority.
# HISTORICAL PROTOTYPE DOCUMENT — NOT CURRENT PRODUCT AUTHORITY
#
# For the September 2026 ATE v1 rebuild, use AGENTS.md and docs/ATE_V1_PRODUCT_SPEC.md.

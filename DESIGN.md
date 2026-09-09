# Academic Track Engine — Product Design System

**Document:** DESIGN.md  
**Version:** 4.0  
**Status:** UI/UX specification of record  
**Date:** 9 September 2026

> ATE is institutional academic software for real Ugandan secondary-school workflows. UI quality is not decoration. Poor UX increases teacher burden, weakens state quality and damages trust.

## 1. Design objective

ATE should communicate:

- competence;
- calm;
- trust;
- precision;
- institutional maturity;
- teacher empathy;
- restrained technical sophistication.

ATE should feel like credible academic infrastructure that happens to use AI.

It must not feel like:
- a generic SaaS admin template;
- a futuristic AI demo;
- ChatGPT wrapped in school terminology;
- a dashboard full of vanity metrics;
- a gamified school app;
- a crypto/fintech interface.

## 2. Experience principles

### 2.1 Reduce cognitive load
Every screen should have one obvious primary job.

### 2.2 Role-adaptive, not role-fragmented
Teacher, HOD, DOS and Head Teacher use one coherent product. Leadership roles add capability; they do not create separate visual universes.

### 2.3 Teacher-mobile first
Teacher workflows must be designed for normal Android phones and intermittent connectivity.

Primary validation widths:
- 360 px;
- 390 px;
- 430 px.

### 2.4 Leadership-desktop first
HOD, DOS and Head Teacher workflows may be denser, but must stay quiet and exception-oriented.

Primary validation widths:
- 1280 px;
- 1440 px;
- 1600 px.

### 2.5 Context before controls
Show the teacher the class, current point and previous state before presenting AI actions.

### 2.6 Evidence before assertion
Where trust matters, show provenance, source or “Why this?” rather than decorative confidence signals.

### 2.7 Offline-aware
Do not design core teacher screens as though every interaction has perfect internet.

## 3. Core visual character

Use:
- restrained institutional colour;
- strong typography;
- generous but efficient spacing;
- subtle borders/surfaces;
- precise alignment;
- clear hierarchy;
- limited elevation;
- purposeful motion.

Avoid:
- purple-to-blue AI gradients;
- glow;
- glassmorphism;
- giant rounded cards;
- decorative icon tiles;
- nested cards;
- excessive pills;
- fake dashboards;
- random charting;
- unnecessary shadows;
- oversized headings;
- bounce/elastic motion;
- marketing copy inside operational screens.

## 4. Information hierarchy

Prefer hierarchy in this order:

1. typography;
2. spacing;
3. alignment;
4. grouping;
5. surface/border contrast;
6. colour;
7. iconography;
8. motion.

Do not use a card or bright colour where spacing and type can solve the problem.

## 5. Design system architecture

ATE should have a real design-system package or module containing:

```text
design-system/
├── tokens/
├── primitives/
├── components/
├── patterns/
├── layouts/
├── accessibility/
└── examples/
```

The design system must sit above Radix/shadcn. shadcn is a primitive source, not ATE’s visual identity.

## 6. Tokens

### 6.1 Spacing
Use an 8-point-derived scale:

- 4;
- 8;
- 12;
- 16;
- 24;
- 32;
- 40;
- 48;
- 64.

Avoid arbitrary one-off spacing without a documented reason.

### 6.2 Radius
Use restrained rounding:
- controls: ~8 px;
- standard panels: 10–12 px;
- larger contextual surfaces: 14–16 px only when justified.

### 6.3 Elevation
ATE is mostly flat. Prefer borders, subtle surfaces and whitespace.

Shadows are reserved for:
- dialogs;
- sheets;
- popovers;
- floating contextual surfaces.

### 6.4 Semantic colour
Define CSS variables for:
- app background;
- surface;
- subtle surface;
- primary text;
- secondary text;
- muted text;
- border;
- brand accent;
- success;
- information;
- warning;
- danger;
- focus.

Do not hard-code role colours or arbitrary “AI purple.”

## 7. Typography

Use one strong sans-serif system, preferably Geist unless implementation constraints justify another.

Suggested scale:

| Token | Size / line-height | Use |
|---|---:|---|
| h1 | 28 / 36 | page title |
| h2 | 20 / 28 | major section |
| h3 | 16 / 24 | panel heading |
| body | 14 / 20 | default UI |
| body-sm | 13 / 18 | supporting text |
| meta | 12 / 16 | metadata/provenance |

Use 400/500/600 weights primarily.

Avoid using bold everywhere as fake hierarchy.

## 8. Application shell

### Teacher shell
Mobile-first:
- compact identity/workspace context;
- single-column content;
- bottom navigation where it materially reduces navigation burden;
- no horizontal desktop tables;
- thumb-friendly primary actions.

### Leadership shell
Desktop-first:
- stable side/top navigation;
- clear school and role context;
- fluid operational content width;
- right contextual panel only when it improves decision-making.

## 9. Teacher Home

Teacher Home answers, in order:

1. What is my next lesson?
2. Where did this class stop?
3. What needs preparation?
4. What else do I teach today?
5. Is any lesson outcome still unconfirmed?

The next lesson should visually dominate.

Good primary actions:
- Prepare Lesson;
- Record Outcome;
- Create Assessment;
- Ask ATE.

Do not make Teacher Home a KPI dashboard.

## 10. Lesson planning surfaces

### 10.1 Quick Readiness
Fast, scannable, operational.

Show:
- Teaching Section;
- current topic/outcome;
- previous state;
- unfinished work;
- sequence;
- required resources;
- formative check;
- source/provenance;
- clear path to Formal Lesson Plan.

### 10.2 Formal Lesson Plan
This is a professional working artifact, not an AI response.

Use structured sections and an editor that supports:
- curriculum anchor;
- prior learning;
- preparation notes;
- classroom context;
- pedagogy;
- timed lesson phases;
- teacher/learner activity;
- formative evidence;
- differentiation;
- misconceptions;
- contingencies;
- follow-up;
- references.

Do not display:
> “Certainly! Here is your lesson plan...”

### 10.3 Artifact editing
Ask ATE should appear as a contextual companion to the artifact, not replace the artifact with chat.

When AI proposes a change, show:
- what changed;
- why;
- Apply / Dismiss.

## 11. Lesson outcome recording

This must be one of the fastest workflows in the product.

Primary choices:
- Delivered as planned;
- Partially delivered;
- Missed / cancelled;
- Changed from plan.

If partial:
- reveal lesson phases/unfinished point;
- optional short note.

Detailed reflection is optional.

Never require arbitrary percentages.

## 12. Assessment experience

Assessment creation should visually communicate:

- assessment purpose/mode;
- selected class/streams;
- duration/marks;
- confirmed eligible scope;
- excluded content and reason;
- blueprint;
- generated items;
- marking material;
- teacher review/finalisation status.

### Improve Existing Paper
The audit should be issue-oriented.

Each issue should clearly show:
- what ATE found;
- evidence/reason;
- severity or impact;
- Keep / Rewrite / Replace.

Do not silently “fix everything.”

## 13. Resource discovery

Recommendations should be compact and useful.

A resource card may show:
- title;
- provider/source;
- type;
- duration where relevant;
- why it fits this lesson;
- verification state;
- Open / Save / Attach.

Do not create an approval bureaucracy in the normal teacher flow.

## 14. HOD experience

Primary question:
> **What needs coordination in my department?**

Show:
- meaningful Teaching Section differences;
- common-assessment readiness;
- unresolved department issues;
- reusable resources/knowledge;
- generated department brief.

Do not show:
- teacher leaderboard;
- “fastest coverage”;
- AI-use activity rankings.

## 15. DOS experience

Primary question:
> **What requires academic-operational intervention?**

Show:
- timetable/programme;
- Teaching Sections;
- exceptions;
- recovery options;
- constraints;
- decisions requiring DOS authority.

Normal self-recovering classroom differences should not dominate the interface.

## 16. Head Teacher / Principal experience

Primary question:
> **Is the academic system broadly healthy, and where is senior authority required?**

Show:
- institutional exceptions;
- department health;
- systemic resource/scheduling patterns;
- pending senior decisions;
- concise academic brief.

Do not expose routine teacher-level detail by default.

## 17. Provenance system

Use consistent labels for:

### Curriculum authority
Official curriculum/assessment source.

### School
School-provided or verified operational fact.

### Teacher-confirmed
Classroom reality established by the teacher/authorised educator.

### ATE
Generated interpretation/recommendation.

### External
Third-party resource.

Do not visually imply endorsement that does not exist.

## 18. Status language

Prefer explicit operational language:
- Confirmed;
- Unconfirmed;
- Partially Delivered;
- Missed / Cancelled;
- Changed from Plan;
- Needs Review;
- Can Recover Normally;
- Requires HOD Coordination;
- Requires DOS Decision;
- Institutional Attention.

Avoid judgemental language such as:
- poor teacher;
- weak performance;
- slow teacher;
- failing department.

## 19. Loading and AI progress

Fast local operations should feel immediate.

Long AI tasks may show concise truthful stages such as:
- Preparing context;
- Drafting;
- Checking alignment;
- Finalising artifact.

Do not simulate fake AI theatre.

Users should be able to navigate away from background work where technically appropriate.

## 20. Empty states

Explain state; do not celebrate it.

Good:
> No academic exceptions currently require DOS action.

Bad:
> Great job! You’re all caught up!

## 21. Error states

Errors must answer:
- what failed;
- what remains safe;
- what the user can do next.

If AI fails, preserve the underlying artifact/context.

If sync fails, clearly show pending local state.

## 22. Accessibility

Minimum expectations:
- semantic HTML;
- visible focus;
- keyboard-operable controls;
- labelled inputs;
- sufficient contrast;
- reduced-motion support;
- touch targets suitable for phones;
- error messages associated with fields;
- no colour-only status meaning.

## 23. Motion

Motion is functional.

Use it to:
- reveal context;
- preserve continuity;
- show artifact/state changes;
- confirm an applied patch;
- smooth layout transitions.

Avoid decorative motion.

Follow Emil Kowalski guidance for easing, timing and motion restraint, but repository product requirements always outrank skills.

## 24. Responsive rules

Teacher:
- no desktop table squeezed onto mobile;
- preserve primary action above the fold where reasonable;
- no tiny text;
- no side-by-side forms that collapse badly;
- long lesson/assessment content must remain readable.

Leadership:
- dense information may use tables;
- preserve filters/actions;
- avoid horizontal overflow at common laptop widths.

## 25. Visual regression surfaces

Protect at least:
- Teacher Home mobile;
- Quick Readiness mobile;
- Formal Lesson Plan mobile + desktop;
- Outcome Recording mobile;
- Assessment Builder desktop + mobile review;
- Onboarding/timetable verification;
- HOD Department Pulse;
- DOS Academic Operations;
- Head Teacher Academic Assurance.

## 26. Design review workflow

For significant UI work:

1. read `PRD.md`, `DESIGN.md` and relevant flow/domain docs;
2. use `gpt-taste` for composition/anti-slop judgement;
3. use `emil-design-eng` for interaction/motion quality;
4. use Impeccable for critique/audit/polish;
5. use React/web-design review skills for accessibility/performance;
6. test real target widths;
7. run browser/E2E checks;
8. visually inspect before completion.

## 27. Visual reference policy

Reference screenshots/images are art direction only.

They may inform:
- hierarchy;
- density;
- layout;
- interaction intent;
- visual character.

They do not define:
- product logic;
- curriculum facts;
- metrics;
- names;
- dates;
- school data;
- navigation that conflicts with PRD.

## 28. Final design test

Before a surface is considered complete, ask:

- Does the primary action dominate?
- Does this reduce teacher work?
- Is the interface quieter than it needs to be rather than louder?
- Did we use typography/layout before cards?
- Is provenance visible where trust matters?
- Does the role see only the resolution it needs?
- Is mobile genuinely usable, not merely responsive?
- Is the design still credible if every AI label is removed?
- Does this look like one product rather than a set of generated pages?

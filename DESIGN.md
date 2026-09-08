# Academic Track Engine — Product Design System

## 1. Design Objective

ATE should look and behave like serious, modern academic operations software.

The interface should communicate:
- competence;
- calm;
- trust;
- clarity;
- precision;
- institutional maturity;
- teacher empathy;
- restrained technical sophistication.

ATE should not visually advertise "AI" as the product.

AI should appear as a capability inside a coherent academic workflow.

## 2. Design Character

ATE should feel:

- calm;
- deliberate;
- contemporary;
- professional;
- institutional;
- operational;
- teacher-friendly;
- low-friction;
- trustworthy.

ATE should not feel:

- futuristic;
- gamified;
- playful;
- crypto-like;
- consumer-social;
- like a generic admin template;
- like a generated SaaS landing page;
- like ChatGPT wrapped in school colors;
- like a dashboard full of vanity metrics.

## 3. Surface Strategy

There are two primary interface modes.

### 3.1 Teacher Workspace

Mobile-first.

The teacher workspace should optimize for:
- next action;
- low information density;
- quick scanning;
- short interactions;
- thumb-friendly controls;
- minimal navigation burden.

The teacher should not be presented with management analytics.

### 3.2 Academic Leadership Workspace

Desktop-first.

HOD, DOS, and Principal surfaces may share an application shell but must not share identical information hierarchy.

HOD:
- department coordination.

DOS:
- academic operations and exceptions.

Principal:
- institutional health and decisions.

## 4. Visual Hierarchy

Use hierarchy in this order:

1. typography;
2. spacing;
3. alignment;
4. grouping;
5. border/surface contrast;
6. color;
7. iconography;
8. motion.

Do not reach for cards, colors, or animations before the information hierarchy is correct.

## 5. Layout System

### Desktop
Recommended content max width:
- operational workspaces: fluid within shell;
- dense tables: full available width;
- readable text panels: constrained.

Typical desktop shell:
- left navigation or stable top-level navigation;
- persistent school/workspace identity;
- role identity;
- content area;
- optional right contextual panel where justified.

### Mobile
Teacher mobile should use:
- single-column primary flow;
- bottom navigation where useful;
- persistent but compact school/identity context;
- large tap targets;
- no horizontal table layouts.

## 6. Spacing System

Use an 8-point-derived spacing system.

Primary values:
- 4px
- 8px
- 12px
- 16px
- 24px
- 32px
- 40px
- 48px
- 64px

Prefer semantic layout tokens over arbitrary values.

Avoid:
- `mt-[13px]`;
- `gap-[7px]`;
- one-off pixel tuning without a clear visual reason.

## 7. Typography

Use one high-quality sans-serif family.

Preferred:
- Geist
- Inter only if Geist is unavailable or implementation constraints justify it

Use a strict scale.

Suggested:

| Token | Size / Line-height | Use |
|---|---:|---|
| display | 32 / 40 | rare top-level hero-level operational title |
| h1 | 28 / 36 | page title |
| h2 | 20 / 28 | major section |
| h3 | 16 / 24 | card/panel heading |
| body | 14 / 20 | default UI text |
| body-sm | 13 / 18 | supporting content |
| meta | 12 / 16 | metadata, source labels |

Weights:
- 400 regular
- 500 medium
- 600 semibold

Avoid bold text as a substitute for hierarchy.

## 8. Color System

Use semantic tokens.

Recommended direction:

### Foundation
- background: cool off-white / very light blue-grey
- surface: white
- text primary: deep navy
- text secondary: desaturated slate
- border: subtle cool grey

### Brand / operational accent
Use restrained institutional green.

### Semantic states
- success: green
- information: blue
- attention: amber
- danger: red
- AI-specific distinction: optional restrained violet only when actual provenance distinction benefits the user

Do not use a purple-to-blue AI gradient.

Do not assign arbitrary colors to roles unless there is a product need.

## 9. CSS Token Direction

Implement semantic CSS variables.

Example naming:

```css
--ate-bg;
--ate-surface;
--ate-surface-subtle;
--ate-text;
--ate-text-secondary;
--ate-text-muted;
--ate-border;
--ate-border-subtle;

--ate-brand;
--ate-brand-subtle;

--ate-success;
--ate-success-subtle;
--ate-info;
--ate-info-subtle;
--ate-warning;
--ate-warning-subtle;
--ate-danger;
--ate-danger-subtle;

--ate-radius-sm;
--ate-radius-md;
--ate-radius-lg;
```

Components should consume semantic tokens, not hard-coded color utilities.

## 10. Radius

Use restrained rounding.

Suggested:
- small controls: 8px
- standard controls/panels: 10–12px
- larger contextual surfaces: 14–16px only where justified

Avoid universal oversized rounded rectangles.

## 11. Elevation

ATE should be mostly flat.

Prefer:
- borders;
- subtle background contrast;
- grouping;
- whitespace.

Use shadows sparingly.

Dialogs, floating sheets, and elevated overlays may use stronger elevation.

Do not put `shadow-lg` or `shadow-xl` on routine cards.

## 12. Card Discipline

Do not make every piece of information a card.

Use cards for meaningful bounded objects:
- next lesson;
- active academic exception;
- generated assessment artifact;
- critical decision panel.

Use plain rows/dividers for:
- today's lessons;
- Teaching Section lists;
- metadata;
- simple status lists.

Avoid nested cards unless hierarchy genuinely requires it.

## 13. Navigation

Navigation labels should be task/domain language, not generic admin labels.

Teacher examples:
- Home
- Classes
- Assessments
- Resources
- More

HOD examples:
- Department
- Teaching Sections
- Assessments
- Resources

DOS examples:
- Academic Operations
- Timetable
- Teaching Sections
- Academic Exceptions
- Recovery
- People

Principal examples:
- Academic Health
- Departments
- Reports
- School Profile

Actual navigation must follow product requirements and available scope, not screenshot text.

## 14. ATE Domain Components

Build reusable domain components rather than page-specific markup.

Expected examples:

- `TeachingSectionIdentity`
- `NextLessonPanel`
- `LessonStateBadge`
- `LessonReadinessSection`
- `CurriculumSourceBadge`
- `ProvenanceRow`
- `AcademicExceptionPanel`
- `AssessmentScopeSummary`
- `AssessmentQuestionCard`
- `CommonScopeMatrix`
- `RecoveryDecisionPanel`
- `TeachingProgressRow`
- `ResourceRecommendationCard`
- `RoleContextHeader`
- `UnconfirmedState`
- `ActionRequiredBanner`

These should sit above generic Radix/shadcn primitives.

## 15. Source and Provenance Language

ATE has four major provenance categories:

### Curriculum / NCDC
Official curriculum source.

### School
School-provided or school-approved operational information.

### ATE
System-generated interpretation or recommendation.

### External
Third-party resource.

Provide a consistent visual system for these categories.

Do not imply NCDC endorsement of ATE or external resources.

## 16. Status Language

Use specific operational language.

Prefer:
- Confirmed
- Unconfirmed
- Partially Delivered
- Missed / Cancelled
- Changed from Plan
- Needs Review
- Requires DOS Decision
- Can Be Absorbed
- Recovery Required

Avoid vague labels:
- Bad
- Poor
- Weak
- Failing
- Behind Teacher
- Low Performer

## 17. Empty States

Empty states should explain state, not sell the product.

Good:
> No academic exceptions require DOS action.

Bad:
> Great job! You're all caught up!

Tone should remain professional and calm.

## 18. Loading States

Use loading behavior appropriate to task duration.

Fast local operations:
- immediate optimistic or short pending state.

AI generation:
- show meaningful task state:
  - "Preparing lesson context"
  - "Generating draft"
  - "Validating structure"

Do not use fake long AI theatrics.

## 19. Motion

Motion is functional.

Use it to:
- preserve continuity;
- explain state transitions;
- reveal a contextual panel;
- confirm propagation;
- reduce abrupt layout changes.

Do not use motion to decorate:
- metric cards;
- every page load;
- every icon;
- basic navigation.

Prefer transitions over keyframes for dynamic interactive UI when appropriate.

Respect reduced-motion settings.

## 20. AI Interaction

Do not make AI the visual center of the product.

`Ask ATE` should normally be:
- a contextual side sheet/panel;
- aware of the current lesson/assessment context;
- visually subordinate to the underlying academic artifact.

Avoid:
- blank full-screen chat as default;
- generic assistant greetings;
- glowing AI orb;
- excessive sparkle icons;
- "magic" language.

## 21. Teacher Home Design Standard

Teacher Home should answer, in order:

1. What is my next lesson?
2. Where did this class stop?
3. What do I need to prepare?
4. What else do I teach today?
5. Is anything waiting for confirmation?

The next lesson should visually dominate.

Quick actions should remain obvious but secondary.

## 22. Lesson Readiness Design Standard

Lesson Readiness should show:
- class context;
- topic;
- previous state;
- structured lesson sections;
- source/provenance;
- primary actions.

It should read like a teacher tool, not an AI response.

No:
> Certainly! Here's a lesson plan...

## 23. Outcome Recording Design Standard

The outcome screen must be extremely low-friction.

Primary choices should be obvious and touch-friendly.

If `PARTIALLY_DELIVERED` is selected, reveal structured lesson segments.

Detailed notes remain optional.

## 24. Assessment Builder Design Standard

Assessment builder should visually communicate:
- assessment mode;
- selected class/streams;
- duration;
- total marks;
- scope eligibility;
- excluded material;
- teacher-review boundary.

The scope guard should be obvious before generation.

## 25. Leadership Design Standard

Leadership screens must be exception-oriented.

Do not use a wall of metrics.

Show:
- what is normal;
- what requires attention;
- why;
- what action is available;
- what remains uncertain.

The highest-resolution teacher data should not be shown by default at Principal level.

## 26. Responsive Quality Bar

Teacher flows must be tested at realistic Android phone widths.

At minimum inspect:
- 360px
- 390px
- 430px

Leadership flows should be inspected at:
- 1280px
- 1440px
- 1600px

Do not merely rely on Tailwind breakpoints without visual inspection.

## 27. Anti-Slop Rules

Avoid:

- decorative gradients;
- floating glassmorphism panels;
- every section as a rounded card;
- giant icon tiles above headings;
- generic metric dashboards;
- oversized titles;
- overly muted low-contrast text;
- random accent colors;
- arbitrary pill badges;
- decorative AI purple;
- unnecessary charts;
- fake analytics;
- excessive border radii;
- excessive drop shadows;
- bounce/elastic motion in institutional workflows;
- marketing slogans in operational UI;
- random copy invented from reference screenshots.

## 28. Visual Reference Policy

Images in `reference-ui/` provide art direction only.

Do not:
- pixel-copy them;
- hard-code text from them;
- infer product facts from them;
- replicate errors in them.

When an image conflicts with:
- `PRODUCT.md`;
- domain data;
- curriculum data;
- accepted decisions;

the authoritative repository source wins.

## 29. Final Design Test

Before a UI surface is considered complete, ask:

- Does the most important action dominate?
- Is the interface quieter than it needs to be, rather than louder?
- Did we use layout before cards?
- Is source/provenance visible where trust matters?
- Is teacher burden minimized?
- Does the role see only the resolution it needs?
- Would this still look credible if all AI labels were removed?
- Does it look like one product rather than generated pages?

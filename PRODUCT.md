# Academic Track Engine — Product Specification

## 1. Product Definition

Academic Track Engine (ATE) is a teacher-first academic operations system for secondary schools.

ATE helps teachers prepare, continue, adapt, and assess teaching from the actual state of each class while giving school academic leadership progressively aggregated visibility into academic implementation.

ATE is built around a simple operational loop:

**know where the class is → prepare the next lesson → teach → confirm what happened → carry forward unfinished work → act on meaningful exceptions**

ATE is not primarily:
- a chatbot;
- a lesson-plan generator;
- a generic content-generation tool;
- a school ERP;
- a student-information system;
- a national examination submission platform;
- a teacher surveillance platform.

Its differentiated value comes from retaining authorized academic context across time and using the same teacher-confirmed classroom facts to support teacher continuity, department coordination, academic recovery, and institutional visibility.

## 2. Product Objective

The initial product must prove that a school can maintain a current, useful representation of academic implementation without creating a second reporting workload for teachers.

The teacher should receive direct value from the same actions that create institutional visibility.

The system should reduce repeated reconstruction of context across:
- lesson preparation;
- parallel streams;
- unfinished lessons;
- assessment scope;
- recovery planning;
- department coordination.

## 3. Initial Supported Configuration

The initial supported academic configuration is intentionally narrow.

### Institution
Mount of Olives College, Kakiri

### Subject
Biology

### Levels
- Senior 1
- Senior 2

### Stream pattern
- East
- West
- North

### Primary roles
- Teacher
- Head of Department (HOD)
- Director of Studies (DOS)
- Principal / Head Teacher

These values are product configuration, not component constants.

The implementation must permit future configuration changes without rewriting presentation components.

## 4. Product Truth Model

ATE must explicitly separate four categories of information.

### 4.1 Curriculum Authority

Curriculum authority describes what the authorized curriculum source states should be learned, how the curriculum is structured, and what official guidance accompanies it.

For the initial Biology scope, curriculum authority is represented through structured data derived from the supplied NCDC Lower Secondary Biology syllabus and Lower Secondary Curriculum Framework.

Curriculum authority includes, where present:
- level;
- term;
- theme;
- topic;
- topic code;
- period allocation;
- competency;
- learning outcomes;
- suggested learning activities;
- sample assessment strategies;
- ICT support;
- source notes and restrictions;
- framework teaching principles;
- assessment principles;
- generic skills;
- cross-cutting issues.

ATE must preserve provenance.

AI does not become curriculum authority.

### 4.2 School Operational Truth

School operational truth includes:
- school structure;
- departments;
- levels;
- streams;
- academic term;
- bell schedule;
- timetable;
- teacher assignments;
- Teaching Sections;
- academic calendar;
- school/department resource inventory;
- approved textbook/resource mappings;
- recovery constraints.

ATE may extract or propose operational information. Authorized school users confirm it before activation.

### 4.3 Classroom Reality

Classroom reality is established by the teacher.

A scheduled lesson can result in:
- `DELIVERED_AS_PLANNED`;
- `PARTIALLY_DELIVERED`;
- `MISSED_OR_CANCELLED`;
- `CHANGED_FROM_PLAN`;
- `UNCONFIRMED`.

`UNCONFIRMED` is not equivalent to missed, absent, incomplete, or failed.

Where a lesson is partially delivered, the teacher identifies where teaching stopped using the lesson structure. Optional notes can add context.

### 4.4 AI Recommendations

AI may produce:
- Lesson Readiness drafts;
- lesson adaptations;
- assessment drafts;
- marking-guide drafts;
- contextual explanations;
- supporting resource recommendations;
- recovery options and explanations.

AI-generated output remains distinguishable from:
- NCDC curriculum authority;
- school facts;
- teacher-confirmed facts;
- approved human decisions.

## 5. Primary Domain Concept — Teaching Section

A Teaching Section is the primary unit of academic implementation.

A Teaching Section represents a specific teaching assignment:

**teacher × subject × level × stream × academic period**

Parallel streams are separate Teaching Sections because they can have:
- different scheduled periods;
- different classroom events;
- different lesson outcomes;
- different current positions;
- different resource constraints;
- different unfinished work.

The product must never assume that all streams of one level and subject progress identically.

## 6. User Value Proposition

### 6.1 Teacher

ATE should help the teacher:
- know the next class without reconstructing timetable context;
- know where that class actually stopped;
- prepare a curriculum-grounded lesson from current class state;
- reuse professional preparation across parallel streams;
- adapt lessons to a stream's actual position;
- adapt activities to realistic classroom resources;
- record lesson outcomes quickly;
- automatically carry unfinished work forward;
- generate assessments from the correct scope;
- discover relevant teaching resources without starting a new search from zero.

Teacher value must be visible before leadership value.

### 6.2 Head of Department

ATE should help the HOD:
- coordinate a subject or department;
- understand meaningful stream drift;
- identify uncertain teaching state;
- coordinate common assessment scope;
- review escalated academic questions;
- maintain department-approved resource mappings;
- support teachers without approving every routine lesson.

The HOD experience must not become teacher policing.

### 6.3 Director of Studies

ATE should help the DOS:
- establish and maintain school academic configuration;
- verify timetable extraction;
- identify academic exceptions requiring operational intervention;
- evaluate whether normal timetable capacity can absorb disruption;
- review and decide timetable-affecting recovery actions;
- distinguish a genuine academic exception from missing information.

The DOS should manage exceptions, not watch every lesson.

### 6.4 Principal / Head Teacher

ATE should help the Principal:
- understand school academic health at an institutional level;
- see unresolved or systemic issues;
- understand whether departments and DOS are resolving issues;
- identify resource or scheduling constraints requiring leadership action;
- assess whether ATE itself is imposing teacher workload.

The Principal should not receive routine teacher-level operational detail.

## 7. Role Escalation Model

Information rises only as far as the decision requires.

Example:

1. Teacher records a partially delivered lesson.
2. If the remaining work can reasonably continue in normal teaching, no leadership action is required.
3. HOD may see stream drift if coordination is relevant.
4. DOS receives an exception only if timetable or school-level operational intervention is required.
5. Principal sees the issue only if institutional authority, resources, policy, or persistent risk require attention.

The product must support progressive aggregation rather than universal visibility of every event.

## 8. School Setup

### 8.1 Workspace

The school is the institutional workspace.

Users have individual identities associated with the school workspace and roles.

The initial product may represent identity through configured application state rather than production authentication infrastructure, but the conceptual model must remain institutional: one school workspace, individual users, role-aware permissions.

### 8.2 Timetable Setup

The DOS workflow is:

1. upload timetable source;
2. ATE extracts/proposes timetable entries;
3. ATE surfaces confidence and uncertain entries;
4. DOS reviews/corrects entries;
5. DOS confirms and activates the timetable;
6. ATE derives Teaching Sections and scheduled periods.

Extraction does not silently become operational truth.

### 8.3 Teaching Assignment Confirmation

When a teacher joins the school workspace, ATE should display the Teaching Sections inferred from the activated school timetable.

The teacher can:
- confirm assignments;
- request correction.

Teachers should not have to manually reconstruct school information already established by the school.

## 9. Teacher Home

Teacher Home is mobile-first.

The primary question is:

**What do I need to do next?**

The home surface must prioritize:
- next lesson;
- current topic;
- previous confirmed lesson state;
- unfinished work;
- today's scheduled lessons;
- pending lesson outcome confirmation.

Primary actions:
- Prepare Lesson
- Create Assessment
- Record Outcome
- Ask ATE

Teacher Home must not become an analytics dashboard.

## 10. Lesson Readiness

Lesson Readiness is the default planning artifact.

It is not merely a long formal lesson plan.

The default artifact should include:

- Teaching Section context;
- topic and curriculum reference;
- current class position;
- unfinished work;
- learning intention;
- prior learning;
- lesson sequence with time allocation;
- learner activity;
- formative check;
- required materials/resources;
- realistic classroom adaptations;
- teacher watch-outs / likely misconceptions where appropriate;
- provenance / "Why this?" information.

A teacher may edit the draft before use.

A teacher may optionally expand the artifact into a more formal lesson-plan format later, but the core product optimizes for readiness and continuity.

## 11. Prepare Once, Adapt Across Streams

ATE should allow one teacher to reuse professional preparation across parallel streams.

A reusable lesson blueprint can be adapted for each Teaching Section based on:
- current position;
- previous outcome;
- unfinished work;
- time available;
- section-specific constraints.

ATE must not assume that "same subject and level" means "same next lesson."

## 12. Contextual AI — Ask ATE

ATE includes contextual conversational assistance.

Ask ATE is not the primary navigation model.

The conversation inherits the current product context, such as:
- Teaching Section;
- topic;
- lesson;
- previous outcome;
- class size;
- available resources;
- assessment scope.

A teacher should be able to ask:
- "Adapt this for a class of 60."
- "I only have four microscopes."
- "Give me another formative check."
- "Make this workable without internet."
- "Find a short video for this outcome."
- "Why did you recommend this activity?"

Conversation can reason and propose.

State-changing actions require explicit user confirmation.

## 13. Lesson Outcome Recording

After a scheduled lesson, the teacher can record:

- Delivered as planned
- Partially delivered
- Missed / cancelled
- Changed from plan

If partially delivered:
- show lesson segments;
- allow teacher to select the last completed segment or unfinished item;
- optionally add a short note.

Target interaction:
- normal outcome: seconds, not minutes;
- partial/missed outcome: still lightweight;
- detailed reflection: optional.

Do not require arbitrary completion percentages.

## 14. Curriculum Progress Representation

ATE must not collapse implementation into one simplistic coverage percentage.

The product should distinguish:
- planned position;
- teacher-confirmed addressed content;
- partially addressed content;
- unconfirmed state;
- learning evidence where available.

Use language such as:
- Teaching Progress
- Curriculum Implementation Progress
- Confirmed Addressed
- Partially Addressed
- Unconfirmed

Avoid implying learner mastery from teacher coverage.

## 15. Assessment Builder

Assessment generation is a first-class teacher workflow.

### 15.1 Modes

#### Formative Check
A short classroom check intended to expose understanding during learning.

#### Class Test
A formal teacher assessment constrained to content confirmed taught in the selected Teaching Section.

#### Revision / Practice
Teacher-selected review or practice across a broader chosen scope.

#### Diagnostic
May intentionally include content not yet formally taught to establish prior knowledge or misconceptions.

Diagnostic content must be clearly labelled as diagnostic rather than coverage-based testing.

#### Common Stream Test
Creates assessment scope from the intersection of confirmed taught content across selected Teaching Sections.

### 15.2 Configuration

Teacher may configure:
- class / selected streams;
- duration;
- total marks;
- difficulty mix;
- assessment mode.

### 15.3 Scope Guard

Before generation, ATE should show:
- confirmed taught content;
- partially taught content;
- not confirmed content;
- excluded content;
- reason for exclusion.

For Class Test mode, partially taught and not-confirmed material is excluded unless product policy later changes.

### 15.4 Generated Assessment

The generated draft should be structured into editable questions.

Each question should retain:
- marks;
- question type;
- difficulty;
- curriculum/learning-outcome basis;
- scope eligibility;
- marking-guide information.

Teacher can:
- edit;
- replace;
- delete;
- change difficulty;
- adjust marks where valid.

### 15.5 Export

The product must support:
- question paper preview;
- real PDF export;
- marking guide preview/export.

Generated assessment artifacts must carry a teacher-review-required state until explicitly finalized.

## 16. Resource Discovery

Resource discovery is curriculum-contextual.

ATE should support these resource categories:
- curriculum-suggested activity/practical;
- ATE adaptation;
- school resource;
- textbook reference;
- video;
- website/article;
- simulation or digital learning resource where appropriate.

Resource recommendations are supplementary, not curriculum authority.

### 16.1 Provenance Labels

Resources must visibly distinguish:
- NCDC / curriculum source;
- School;
- ATE recommendation;
- External.

### 16.2 Resource Agent Responsibility

The Resource Discovery subsystem receives structured context:
- subject;
- level;
- topic;
- learning outcome;
- lesson intention;
- period duration;
- class constraints;
- teacher request.

It can:
- formulate search queries;
- retrieve provider results;
- rank results by relevance;
- explain the recommendation.

Deterministic software retains:
- actual URL;
- provider metadata;
- review state;
- approval state;
- broken-link status;
- duplicate detection.

### 16.3 Textbook Integrity

ATE must never invent a book title, chapter, page range, edition, or ISBN.

Exact chapter/page references require a verified source such as:
- school-configured textbook map;
- authorized searchable copy;
- verified table of contents/index;
- provider metadata that actually contains the information.

If exact location is not verified, say so.

### 16.4 Department Resource Memory

Resources may progress through states such as:
- `DISCOVERED`
- `TEACHER_SAVED`
- `HOD_APPROVED`
- `SCHOOL_RECOMMENDED`
- `BROKEN_LINK`
- `WITHDRAWN`

Approved institutional resources should be prioritized over fresh web discovery when relevant.

## 17. HOD Workspace

The HOD workspace is desktop-first.

Primary concerns:
- Teaching Sections in the department;
- stream drift requiring coordination;
- unconfirmed sections;
- common assessment readiness;
- reusable department lesson blueprints;
- escalated subject issues;
- resource approval.

The HOD should not approve every routine lesson.

The HOD should not receive a teacher leaderboard.

## 18. DOS Workspace

The DOS workspace is desktop-first and exception-driven.

Primary sections:
- Timetable / Academic Setup
- Teaching Sections
- Academic Exceptions
- Recovery
- People / Assignments
- School Configuration

The main DOS question is:

**What requires operational intervention?**

Recovery suggestions must distinguish:
- what can be absorbed by normal teaching;
- what requires scheduling intervention;
- what remains unconfirmed.

ATE proposes. DOS decides where DOS authority is required.

## 19. Principal Workspace

The Principal workspace is institution-level and low-noise.

Primary information:
- aggregate academic state;
- department attention;
- unresolved DOS decisions;
- unconfirmed academic state;
- systemic scheduling/resource issues;
- teacher workload indicators related to ATE;
- major institutional decisions required.

The Principal surface should explicitly avoid routine teacher micromanagement.

## 20. Offline / Connectivity Direction

The long-term teacher workflow must tolerate unreliable connectivity.

The current initial implementation may use browser-local persistence, but the product model should preserve these future requirements:
- lesson context can be cached;
- lesson outcome can be recorded offline;
- synchronization can occur later;
- AI generation can degrade when network access is unavailable without disabling basic lesson-state workflows.

Do not implement a full offline sync engine unless current scope requires it.

## 21. Rights and Provenance

The supplied NCDC documents contain rights restrictions.

ATE must not imply:
- NCDC endorsement;
- Ministry endorsement;
- UNEB endorsement;
- institutional licensing;
- unrestricted reproduction rights.

Curriculum data models must preserve:
- authority;
- document title;
- publication/version;
- source location;
- rights metadata where available;
- extraction confidence.

The product should show curriculum provenance without reproducing unnecessary protected text.

## 22. Out of Scope for the Initial Product

Do not implement unless scope is explicitly changed:

- Continuous Assessment submission workflows;
- UNEB AMIS export;
- Activities of Integration workflow;
- Project Work submission workflow;
- candidate-class acceleration;
- student mastery profiles;
- attendance system;
- fees;
- payroll;
- admissions;
- boarding management;
- discipline management;
- accounting;
- general school ERP functionality;
- teacher performance ranking;
- autonomous timetable changes;
- production-scale multi-tenant infrastructure.

## 23. Success Standard

The product is successful when a teacher can experience:

> "ATE already knows my teaching context, helps me prepare from where this class actually is, lets me record what happened quickly, and uses that small confirmation to make my next work easier."

The HOD should experience:

> "I can coordinate the subject without chasing every teacher or forcing every stream into identical pace."

The DOS should experience:

> "I see academic exceptions that actually need operational action rather than another dashboard of raw activity."

The Principal should experience:

> "I have current academic assurance and visibility into institutional issues without turning the system into teacher surveillance."

## 24. Product Quality Bar

ATE should feel like credible institutional software that happens to use AI.

It should not feel like an AI demo with school terminology placed around it.

The strongest evidence of product quality is coherent state:
- a teacher action changes the teacher's next lesson;
- the same fact changes department state where relevant;
- the DOS receives an exception only when appropriate;
- the Principal sees only institutionally significant consequences;
- assessment scope reflects actual confirmed teaching state.

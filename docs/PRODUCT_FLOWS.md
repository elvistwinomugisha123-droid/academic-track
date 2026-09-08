# Product Flows — Academic Track Engine

## 1. Principle

ATE is a stateful academic workflow, not a set of independent pages.

Every flow should read and update shared domain state.

## 2. School Timetable Setup

Actor: DOS

```text
Open Academic Setup
  ↓
Upload timetable source
  ↓
ATE produces extraction proposal
  ↓
Display:
  confirmed-looking entries
  uncertain entries
  missing teacher mappings
  confidence
  ↓
DOS corrects entries
  ↓
DOS confirms
  ↓
Timetable becomes active operational truth
  ↓
Teaching Sections are created/updated
```

Rules:
- extraction never auto-activates;
- uncertain items remain explicit;
- teacher names and assignments come from data, not screenshot references.

## 3. Teacher Join / Assignment Confirmation

Actor: Teacher

```text
Open school invitation / configured join state
  ↓
See school identity
  ↓
See Teaching Sections derived from active timetable
  ↓
Confirm assignments
  OR
Request correction
  ↓
Teacher Home
```

Teacher does not manually recreate the timetable.

## 4. Teacher Home

Actor: Teacher

```text
Load current time / scheduled lessons
  ↓
Identify next Teaching Section
  ↓
Load last confirmed lesson outcome
  ↓
Load current curriculum position
  ↓
Show:
  next lesson
  where class stopped
  today's lessons
  pending confirmations
```

Primary action:
`Prepare Lesson`

Secondary:
- Create Assessment
- Record Outcome
- Ask ATE

## 5. Lesson Readiness

Actor: Teacher

```text
Select Prepare Lesson
  ↓
Gather deterministic context:
  Teaching Section
  scheduled period
  period duration
  current curriculum topic
  relevant learning outcomes
  previous confirmed outcome
  unfinished work
  school resources
  framework guidance
  ↓
AI generates structured Lesson Readiness
  ↓
Validate schema
  ↓
Teacher views/edits
  ↓
Teacher can:
  Use Lesson
  Adapt
  Ask ATE
  View provenance
```

If AI fails:
- preserve current state;
- show recoverable error or configured fallback;
- do not lose teacher workflow.

## 6. Ask ATE

Actor: Teacher

Contextual, not blank chat.

```text
Teacher is viewing a lesson
  ↓
Open Ask ATE
  ↓
Current context is inherited
  ↓
Teacher requests adaptation/explanation/resource
  ↓
AI responds
  ↓
If response proposes a state-changing action:
     require explicit confirmation
```

## 7. Multi-Stream Adaptation

Actor: Teacher

```text
Teacher has lesson blueprint
  ↓
Select another Teaching Section
  ↓
ATE compares:
  curriculum position
  previous outcome
  unfinished work
  available period
  resource constraints
  ↓
AI adapts only what differs
  ↓
Teacher reviews
```

## 8. Lesson Outcome

Actor: Teacher

```text
Scheduled lesson becomes due
  ↓
Teacher records:
  Delivered as planned
  Partial
  Missed / cancelled
  Changed from plan
```

### Delivered

```text
Select delivered
  ↓
Save
  ↓
Confirm relevant addressed state
  ↓
Close unfinished work where applicable
  ↓
Update next lesson context
```

### Partial

```text
Select partial
  ↓
Show lesson segments
  ↓
Teacher marks where they stopped
  ↓
Optional note
  ↓
Save
  ↓
Create/update unfinished work
  ↓
Update next lesson context
  ↓
Evaluate stream drift / recovery
```

### Missed / Cancelled

```text
Select missed/cancelled
  ↓
Optional reason
  ↓
Save
  ↓
No curriculum state is falsely advanced
  ↓
Evaluate whether normal future schedule can absorb work
```

### Unconfirmed

No teacher action.

System state remains:
`UNCONFIRMED`

No inference of absence.

## 9. Assessment Creation

Actor: Teacher / HOD depending mode

```text
Open Assessment Builder
  ↓
Choose class/streams
  ↓
Choose mode
  ↓
Configure duration/marks/difficulty
  ↓
ATE computes eligible scope
  ↓
Show included/excluded scope
  ↓
Generate
  ↓
Structured questions
  ↓
Teacher edits
  ↓
Preview
  ↓
Export PDF
  ↓
Export Marking Guide
```

## 10. Assessment Modes

### Formative Check
Scope:
- current lesson/current learning target;
- teacher-configurable.

### Class Test
Scope:
- confirmed-taught learning outcomes only.

### Revision / Practice
Scope:
- explicit teacher-selected curriculum range;
- can cover prior confirmed topics.

### Diagnostic
Scope:
- can include not-yet-taught content intentionally;
- must be clearly labelled diagnostic.

### Common Stream Test
Scope:
- intersection of confirmed-taught eligible outcomes across selected sections.

## 11. HOD Flow

Actor: HOD

```text
Open Department
  ↓
View Teaching Sections
  ↓
See:
  normal progress
  meaningful stream drift
  unconfirmed state
  common assessment readiness
  subject issues
  ↓
Drill into exception
  ↓
Coordinate where department action is needed
```

HOD does not approve every teacher lesson.

## 12. DOS Exception Flow

Actor: DOS

```text
Open Academic Exceptions
  ↓
See only:
  DOS actions
  monitoring items
  resolved history
  ↓
Open exception
  ↓
Inspect:
  cause
  confirmed evidence
  uncertainty
  whether normal schedule can absorb
  suggested recovery options
  ↓
Approve / Modify / Decline where DOS authority applies
```

## 13. Principal Flow

Actor: Principal

```text
Open Academic Health
  ↓
See:
  broad normal state
  department attention
  DOS decisions
  unconfirmed state
  systemic issue
  institutional decision required
```

Principal does not receive routine teacher operational events.

## 14. Resource Discovery Flow

Actor: Teacher

```text
Current lesson / learning outcome
  ↓
Request resources
  ↓
Build search context
  ↓
Retrieve:
  curriculum activity
  school-approved resource
  external candidates
  ↓
Rank / explain
  ↓
Display provenance
  ↓
Teacher previews
  ↓
Teacher saves
  ↓
HOD may approve for department
```

## 15. State Propagation Example

```text
S2 North lesson marked MISSED_OR_CANCELLED
  ↓
TeachingSection curriculum position does not advance
  ↓
Unfinished scheduled intention remains
  ↓
ATE evaluates remaining normal timetable
  ↓
If absorbable:
  teacher/HOD context only
  ↓
If not absorbable:
  DOS Academic Exception
  ↓
If systemic / institutional:
  Principal summary
```

This propagation should be deterministic.

## 16. Demo/Presentation Independence

The product flows must not depend on a fixed presentation script.

Users in the room should be able to:
- choose a different Biology topic;
- generate a different lesson;
- request a test;
- change assessment mode;
- select another stream;
- record a different lesson outcome.

The current configured content should support exploration rather than a single hard-coded happy path.

# Domain Model — Academic Track Engine

## 1. Purpose

This document defines core ATE entities, states, relationships, and invariants.

The domain model is more authoritative than UI labels.

## 2. Core Institutional Entities

### School

```ts
type School = {
  id: string;
  name: string;
  location?: string;
  departments: Department[];
  levels: AcademicLevel[];
  streams: Stream[];
  bellSchedule: BellSchedule;
}
```

### AcademicTerm

```ts
type AcademicTerm = {
  id: string;
  name: string;
  academicYear: number;
  startsOn?: string;
  endsOn?: string;
  status: "CONFIGURING" | "ACTIVE" | "CLOSED";
}
```

### Person

```ts
type Role = "TEACHER" | "HOD" | "DOS" | "PRINCIPAL";

type Person = {
  id: string;
  displayName: string;
  roles: Role[];
  departmentIds: string[];
}
```

## 3. Teaching Section

A Teaching Section represents an actual teaching assignment.

```ts
type TeachingSection = {
  id: string;
  teacherId: string;
  subjectId: string;
  levelId: string;
  streamId: string;
  academicTermId: string;
  timetableEntryIds: string[];
  currentTopicId?: string;
}
```

Conceptually:

**teacher × subject × level × stream × academic period**

Parallel streams are separate.

## 4. Timetable

### TimetableEntry

```ts
type TimetableEntry = {
  id: string;
  dayOfWeek: DayOfWeek;
  periodIndex: number;
  startsAt: string;
  endsAt: string;
  classRef: {
    levelId: string;
    streamId: string;
  };
  subjectId: string;
  teacherId?: string;
  roomId?: string;
  verificationStatus: "PROPOSED" | "NEEDS_REVIEW" | "CONFIRMED";
  confidence?: number;
}
```

A proposed extracted entry is not operational truth until confirmed.

## 5. Scheduled Lesson

A Scheduled Lesson is an occurrence derived from timetable + calendar.

```ts
type ScheduledLessonStatus =
  | "SCHEDULED"
  | "DUE"
  | "OUTCOME_RECORDED"
  | "CANCELLED_BY_SCHOOL";

type ScheduledLesson = {
  id: string;
  teachingSectionId: string;
  timetableEntryId: string;
  scheduledDate: string;
  status: ScheduledLessonStatus;
}
```

## 6. Curriculum Entities

The canonical curriculum data model is defined in `docs/CURRICULUM_DATA.md`.

Important references:

```ts
type CurriculumRef = {
  sourceId: string;
  topicId: string;
  learningOutcomeIds: string[];
}
```

## 7. Lesson Readiness

Lesson Readiness is a teacher-facing planning artifact.

```ts
type LessonReadiness = {
  id: string;
  teachingSectionId: string;
  scheduledLessonId?: string;
  curriculumRef: CurriculumRef;
  basedOnPreviousOutcomeIds: string[];
  learningIntention: string;
  priorLearning?: string;
  segments: LessonSegment[];
  formativeCheck?: LessonCheck;
  resourceRecommendations: ResourceRecommendationRef[];
  teacherWatchouts: string[];
  provenance: ProvenanceEntry[];
  status: "DRAFT" | "TEACHER_EDITED" | "USED";
}
```

### LessonSegment

```ts
type LessonSegment = {
  id: string;
  title: string;
  durationMinutes?: number;
  activity: string;
  sourceCategory: "CURRICULUM" | "SCHOOL" | "ATE" | "EXTERNAL";
}
```

## 8. Lesson Outcome

```ts
type LessonOutcomeType =
  | "DELIVERED_AS_PLANNED"
  | "PARTIALLY_DELIVERED"
  | "MISSED_OR_CANCELLED"
  | "CHANGED_FROM_PLAN"
  | "UNCONFIRMED";

type LessonOutcome = {
  id: string;
  scheduledLessonId: string;
  teachingSectionId: string;
  recordedBy: string;
  type: LessonOutcomeType;
  lastCompletedSegmentId?: string;
  unfinishedSegmentIds?: string[];
  addressedLearningOutcomeIds?: string[];
  partiallyAddressedLearningOutcomeIds?: string[];
  note?: string;
  recordedAt: string;
}
```

### Invariant

No record must be converted into `MISSED_OR_CANCELLED` merely because the teacher did not submit an outcome.

Absence of an outcome is `UNCONFIRMED`.

## 9. Learning Outcome Implementation State

```ts
type OutcomeImplementationStatus =
  | "NOT_YET_ADDRESSED"
  | "PARTIALLY_ADDRESSED"
  | "CONFIRMED_ADDRESSED"
  | "UNCONFIRMED";

type LearningOutcomeImplementation = {
  teachingSectionId: string;
  learningOutcomeId: string;
  status: OutcomeImplementationStatus;
  evidenceLessonOutcomeIds: string[];
}
```

This is not learner mastery.

## 10. Unfinished Work

```ts
type UnfinishedWork = {
  id: string;
  teachingSectionId: string;
  sourceLessonOutcomeId: string;
  curriculumTopicId: string;
  learningOutcomeIds: string[];
  lessonSegmentIds: string[];
  status: "OPEN" | "CARRIED_FORWARD" | "RESOLVED";
}
```

## 11. Assessment

```ts
type AssessmentMode =
  | "FORMATIVE_CHECK"
  | "CLASS_TEST"
  | "REVISION_PRACTICE"
  | "DIAGNOSTIC"
  | "COMMON_STREAM_TEST";

type Assessment = {
  id: string;
  mode: AssessmentMode;
  title: string;
  teachingSectionIds: string[];
  durationMinutes?: number;
  totalMarks?: number;
  allowedLearningOutcomeIds: string[];
  excludedLearningOutcomeIds: string[];
  questions: AssessmentQuestion[];
  status: "DRAFT" | "TEACHER_EDITED" | "FINALIZED";
  provenance: ProvenanceEntry[];
}
```

### Assessment Question

```ts
type AssessmentQuestion = {
  id: string;
  text: string;
  marks?: number;
  type: string;
  difficulty?: "LOW" | "MEDIUM" | "HIGH";
  learningOutcomeIds: string[];
  markingGuide: MarkingGuideItem[];
}
```

### Class Test invariant

`CLASS_TEST` can use only curriculum scope confirmed taught for the selected Teaching Section.

### Common Stream invariant

`COMMON_STREAM_TEST` scope is the intersection of eligible confirmed-taught learning outcomes across all selected Teaching Sections.

## 12. Recovery Case

```ts
type RecoveryCaseStatus =
  | "NOT_REQUIRED"
  | "TEACHER_MANAGED"
  | "HOD_REVIEW"
  | "DOS_DECISION_REQUIRED"
  | "APPROVED"
  | "DECLINED"
  | "RESOLVED";

type RecoveryCase = {
  id: string;
  teachingSectionId: string;
  unfinishedWorkIds: string[];
  status: RecoveryCaseStatus;
  reason: string;
  canNormalScheduleAbsorb: boolean;
  proposedOptions: RecoveryOption[];
  selectedOptionId?: string;
  decidedBy?: string;
}
```

A partial lesson does not automatically create a DOS case.

## 13. Academic Exception

An Academic Exception is a role-relevant derived state.

```ts
type ExceptionSeverity =
  | "MONITOR"
  | "DEPARTMENT_ATTENTION"
  | "DOS_ACTION"
  | "INSTITUTIONAL";

type AcademicException = {
  id: string;
  teachingSectionId?: string;
  severity: ExceptionSeverity;
  reasonCode: string;
  explanation: string;
  sourceEntityIds: string[];
  status: "OPEN" | "RESOLVED";
}
```

## 14. Resources

```ts
type ResourceType =
  | "CURRICULUM_ACTIVITY"
  | "PRACTICAL"
  | "TEXTBOOK"
  | "VIDEO"
  | "WEBSITE"
  | "SIMULATION"
  | "SCHOOL_RESOURCE";

type ResourceProvenance =
  | "CURRICULUM"
  | "SCHOOL"
  | "ATE"
  | "EXTERNAL";

type ResourceReviewState =
  | "DISCOVERED"
  | "TEACHER_SAVED"
  | "HOD_APPROVED"
  | "SCHOOL_RECOMMENDED"
  | "BROKEN_LINK"
  | "WITHDRAWN";

type LearningResource = {
  id: string;
  type: ResourceType;
  title: string;
  provenance: ResourceProvenance;
  provider?: string;
  url?: string;
  linkedLearningOutcomeIds: string[];
  durationMinutes?: number;
  reviewState: ResourceReviewState;
  verifiedCitation?: {
    bookTitle?: string;
    edition?: string;
    chapter?: string;
    pages?: string;
    isbn?: string;
  };
}
```

Exact book references must be verified.

## 15. Provenance

```ts
type ProvenanceEntry = {
  category: "CURRICULUM" | "SCHOOL" | "TEACHER" | "ATE" | "EXTERNAL";
  label: string;
  sourceId?: string;
  sourceLocation?: string;
}
```

## 16. Derived Role Views

Role views are derived, not independent truth.

### Teacher
Resolution:
- scheduled lessons;
- section state;
- lesson readiness;
- outcomes;
- assessments.

### HOD
Resolution:
- department Teaching Sections;
- stream drift;
- common assessment readiness;
- unresolved subject coordination.

### DOS
Resolution:
- operational exceptions;
- timetable;
- recovery;
- school academic configuration.

### Principal
Resolution:
- aggregate academic health;
- institutional exceptions;
- department-level state;
- major decisions.

## 17. Explicitly Rejected Domain Fields

Do not add:
- `teacher_speed_index`;
- teacher ranking score;
- AI usage performance score;
- arbitrary "teacher compliance percentage";
- inferred teacher absence from missing outcome.

If a future requirement proposes such fields, it requires an explicit product decision.

# Curriculum Data — Academic Track Engine

## 1. Purpose

ATE must consume curriculum as structured authority data, not as an opaque PDF pasted into every model request.

The canonical curriculum layer exists to preserve:
- official source structure;
- source provenance;
- curriculum terminology;
- restrictions;
- deterministic IDs;
- runtime retrieval.

## 2. Authority Boundary

Canonical curriculum data means:
> what the supplied official source supports.

Canonical data must not silently include:
- model knowledge;
- web information;
- teacher assumptions;
- ATE recommendations.

Derived metadata must be labelled as derived.

## 3. Canonical Hierarchy

```text
CurriculumSource
  Subject
    Level
      Term
        Theme
          Topic
            Competency
            LearningOutcome
            SuggestedLearningActivity
            SampleAssessmentStrategy
            ICTSupport
            Note / Restriction
```

Framework data is separate:

```text
CurriculumFramework
  KeyLearningOutcome
  Value
  GenericSkill
  CrossCuttingIssue
  TeachingLearningPrinciple
  InclusionPrinciple
  LearningEnvironmentPrinciple
  AssessmentPrinciple
  SubjectTimeAllocation
```

## 4. Stable IDs

IDs must be:
- deterministic;
- readable;
- stable across runtime;
- independent of PDF page number.

Example:
- `bio-s2-t2-3.2`
- `bio-s2-t2-3.2-lo-01`
- `bio-s2-t2-3.2-act-01`

## 5. Provenance

Every authoritative entity should retain:

```ts
type CurriculumSourceLocation = {
  authority: string;
  documentTitle: string;
  publicationYear?: number;
  documentVersion?: string;
  pdfPage?: number;
  printedPage?: number;
  sectionHeading?: string;
  rightsNoticePresent?: boolean;
}
```

Do not claim permission or endorsement based solely on possession of a source file.

## 6. Topic Schema Direction

```ts
type CurriculumTopic = {
  id: string;
  subject: string;
  level: string;
  term: number;
  theme: string;
  topicCode?: string;
  title: string;
  allocatedPeriods?: number;
  competency?: CurriculumTextEntity;
  learningOutcomes: CurriculumTextEntity[];
  suggestedLearningActivities: CurriculumTextEntity[];
  sampleAssessmentStrategies: CurriculumTextEntity[];
  ictSupport: CurriculumTextEntity[];
  notes: CurriculumTextEntity[];
  source: CurriculumSourceLocation;
}
```

## 7. Restrictions

Source restrictions must be preserved.

Examples:
- depth limitations;
- "no drawings required";
- "only";
- specified examples;
- required practical constraints;
- content exclusions.

Restrictions should be available to:
- lesson generation;
- assessment generation;
- resource discovery.

## 8. Runtime Context

Runtime AI context should use compact references.

Example:

```ts
type LessonGenerationContext = {
  topicId: string;
  competencyIds: string[];
  learningOutcomeIds: string[];
  suggestedActivityIds: string[];
  frameworkPrincipleIds: string[];
  contentRestrictionIds: string[];
}
```

Do not repeatedly send entire source documents where exact structured entities are already known.

## 9. Curriculum vs School State

Curriculum:
> what should be learned.

Teaching Section implementation:
> what a specific class has actually addressed.

Do not modify curriculum records to represent school progress.

## 10. Curriculum vs Mastery

A teacher confirming that an outcome was addressed does not mean learners mastered it.

ATE must not infer:
- attainment;
- mastery;
- competence;
- exam readiness;

from curriculum implementation alone.

## 11. AI Context Construction

For lesson generation:

```text
relevant topic
+ exact learning outcomes
+ selected suggested activities
+ source restrictions
+ framework pedagogy
+ Teaching Section state
+ period duration
+ classroom/resources
```

For assessment generation:

```text
assessment mode
+ eligible learning outcomes
+ sample assessment guidance
+ content restrictions
+ confirmed teaching state
```

## 12. Rights

The curriculum source files contain rights notices.

The application must:
- preserve attribution/provenance;
- avoid bulk reproduction where unnecessary;
- avoid implying NCDC endorsement;
- support rights metadata;
- keep official content separate from ATE-generated content.

## 13. Human Review

Structured extraction should produce a human-review queue for uncertain data.

Uncertain values must not be silently completed from model knowledge.

## 14. Current Data Contract

Expected `curriculum-data/` outputs:

```text
01_source_manifest.json
02_curriculum_framework.json
03_biology_subject.json
04_biology_topics.json
05_biology_entities.jsonl
06_curriculum_relationships.jsonl
07_ate_runtime_context.json
08_validation_report.md
09_human_review_queue.json
```

Runtime code should not assume every optional field is present.

## 15. Validation

Before curriculum data is treated as trusted:

- programme planner topics match detailed topics;
- period allocations verified;
- level/term assignments verified;
- topic numbering verified;
- learning outcomes not mixed with activities;
- assessment strategies not mixed with teaching content;
- ICT support retained separately;
- restrictions retained;
- provenance present;
- derived fields labelled;
- uncertain extraction queued.

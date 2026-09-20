# ATE Learner Materials / Teaching Pack

## Scope

Teaching Pack is a lesson-specific child-artifact workspace inside Lesson Workspace. It is not a top-level module and it does not replace Classroom Continuity.

The Formal Lesson Plan is the parent planning artifact. Board Notes, Learner Notes, Activity Sheets, Lesson Summaries and Homework are optional child artifacts derived from the saved parent version. A teacher creates only the materials that help the lesson.

## Pass 1 contract

- Teacher-authored structured fields are the source of truth; no external model is called.
- Every child stores the exact Formal Lesson Plan artifact version from which it was prepared.
- Artifact versions are append-only. Editing creates a new version and never overwrites history.
- A child is shown as `POTENTIALLY_STALE` when its parent version differs from the current Formal Lesson Plan version.
- Staleness never silently regenerates or overwrites a material. The teacher can review it or keep the current child version.
- Classroom Continuity records the lesson outcome and short unfinished-work note. It does not require teachers to record whether each material was completed.

## Deterministic recommendations

Recommendations use explainable Formal Lesson Plan signals:

- practical, investigative or observation language recommends an Activity Sheet;
- teaching prompts, examples, equations or visible concept work recommends Board Notes;
- an explicit retained-reference signal recommends Learner Notes;
- a conclusion/follow-up recommends Homework;
- without a strong signal, materials remain optional.

## Rights and provenance

Artifacts retain the canonical curriculum anchor, profile, source locator, provenance and rights state. Rights-limited curriculum source wording is not copied into teacher-authored artifacts. The teacher may still create and edit instructional work where permitted. Unknown or restricted rights never authorize external AI or content reproduction.

## Deferred

Contextual Ask ATE, grounded AI generation, regeneration, distribution, export, approvals, shared materials libraries and learner accounts belong to later passes.

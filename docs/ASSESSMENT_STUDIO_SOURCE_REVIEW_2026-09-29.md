# Assessment Studio source review — 29 September 2026

## Scope and provenance

The supplied Drive folder `1lsRzvgtMnZv7jFkv4iSjm9Zp7MvfWPKY` is titled **O level Syllabus books**. It contains ten distinct lower-secondary subject syllabuses (Biology appears twice) and one History and Political Education Senior 4 learner book. The syllabuses are Literature in English, CRE, Geography, Physics, Mathematics, Agriculture, Biology, English, Entrepreneurship, and Chemistry. The folder is not a complete set of lower-secondary subjects or advanced-secondary assessment guidelines.

Each inspected syllabus has assessment guidance and sample assessment strategies in the subject's learning-outcome tables. They do not all prescribe a common question-paper layout. The Biology assessment section explicitly distinguishes knowledge recall from observed skills and explanation of understanding; it describes formative feedback as changing subsequent teaching. Therefore one universal scenario-only paper template would misrepresent these sources.

Primary public sources for the next review pass:

- NCDC Lower Secondary Curriculum Framework: https://ncdc.go.ug/wp-content/uploads/2024/03/Curriculum_Framework.pdf
- UNEB lower-secondary sample papers and continuous-assessment tool: https://uneb.ac.ug/2024/03/26/nlsc_sample_papers/
- NCDC Advanced Secondary Assessment Framework 2026: https://ncdc.go.ug/wp-content/uploads/2026/07/ASSESSMENT-FRAMEWORK-FOR-ADVANCED-SECONDARY-CURRICULUM-2026_Web-file.pdf
- NCDC Advanced Secondary Biology subject guidelines: https://ncdc.go.ug/books/biology-assessment-guidelines/
- NCDC subject guidelines announcement: https://ncdc.go.ug/2026/07/27/ncdc-releases-assessment-guidelines-to-support-effective-implementation-of-the-advanced-secondary-curriculum/

These references are research inputs, not a claim that ATE may reproduce every page or present generated papers as official UNEB papers. Source rights, exact release, academic review, and school applicability must be recorded before activation.

## Product rules from this review

1. Resolve level, subject, purpose, release, school/class binding, taught scope and source rights before authoring. Lower and advanced secondary must have distinct profiles.
2. Show teachers readable approved outcomes, not canonical IDs. Scope must reflect confirmed classroom delivery, with a separately justified broader diagnostic/revision scope where a profile permits it.
3. Build a teacher-reviewed blueprint before drafting: intended evidence, allowed content, duration, marks, item types, accessible materials and any practical requirements. A classroom formative check may be oral or practical; do not force every task into a written scenario.
4. For application tasks, supply a plausible situation, relevant evidence, a clear action for the learner, level-appropriate demands and a marking instrument. Sample papers are exemplars, not reusable question banks.
5. Verify mark totals, unique question identity, allowed scope, rubric totals when a rubric is provided, profile/rights and review status deterministically. Subject accuracy, fairness, scenario quality and response feasibility still require qualified teacher review.

## Current implementation status

The TEST database has 51 active assessment profiles, all `TEST_SYNTHETIC`, and none active for the Biology subject profile in the demo school. The active Biology curriculum profile has verified records including topics, learning outcomes and assessment strategies, but this is not an activated, academically reviewed assessment profile. The Studio now blocks synthetic profiles, derives curriculum profile IDs from bindings, displays class names and readable scope titles, and requires verified readable records before an AI draft. The generation request uses bounded wording only when the assessment profile permits external AI. These controls do not make the feature ready for school papers by themselves.

## Activation order

1. Review the Biology Senior 1 curriculum position and correct the existing Senior 1 / Transport in Plants mismatch before using classroom delivery as scope.
2. Have a Biology teacher and an academic lead review a Senior 1 class-test profile against the applicable lower-secondary syllabus and UNEB samples. Record source rights, profile version, allowed purpose and school/class bindings.
3. Run a small evaluation set with real scenarios, marking guides, PDF/DOCX, phone readability, out-of-scope prompts and teacher correction. Activate only after review.
4. Repeat the subject-specific review for other lower-secondary subjects; process advanced-secondary framework and individual 2026 subject guides as a separate regime.

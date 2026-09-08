# Acceptance Criteria — Academic Track Engine Initial Release

## 1. Purpose

The initial release is acceptable only when the product behaves coherently across Teacher, HOD, DOS, and Principal views.

Visual polish alone is insufficient.

## 2. Foundation

- [ ] TypeScript strict mode enabled.
- [ ] Lint passes.
- [ ] Typecheck passes.
- [ ] No critical runtime console errors.
- [ ] Current school/subject/stream values come from configuration/domain state.
- [ ] Presentational components do not hard-code school-specific facts.
- [ ] Design tokens are centralized.
- [ ] Reusable ATE domain components exist.
- [ ] `/design-system` demonstrates the visual system.

## 3. Teacher Home

- [ ] Mobile-first.
- [ ] Shows next scheduled lesson.
- [ ] Shows Teaching Section identity.
- [ ] Shows current curriculum topic.
- [ ] Shows previous confirmed state.
- [ ] Shows unfinished work where applicable.
- [ ] Shows today's scheduled lessons.
- [ ] Shows pending confirmation without assuming absence.
- [ ] Primary action is Prepare Lesson.

## 4. Lesson Readiness

- [ ] Uses structured curriculum context.
- [ ] Uses previous confirmed lesson state.
- [ ] Respects period duration.
- [ ] Shows structured lesson segments.
- [ ] Shows resources.
- [ ] Shows provenance.
- [ ] Teacher can edit.
- [ ] Teacher can adapt for another stream.
- [ ] AI output is schema-validated.
- [ ] AI failure does not destroy core app state.

## 5. Lesson Outcome

- [ ] Supports Delivered as Planned.
- [ ] Supports Partially Delivered.
- [ ] Supports Missed / Cancelled.
- [ ] Supports Changed from Plan.
- [ ] Missing remains Unconfirmed.
- [ ] Partial reveals lesson segments.
- [ ] Teacher can identify stopping point.
- [ ] Optional note works.
- [ ] Saving updates Teaching Section state.
- [ ] Saving changes next lesson context.

## 6. Multi-Stream

- [ ] S2 East, S2 West, and S2 North can hold different states.
- [ ] One lesson blueprint can be reused/adapted.
- [ ] Stream divergence derives from state, not hard-coded text.

## 7. Assessment

- [ ] Supports Formative Check.
- [ ] Supports Class Test.
- [ ] Supports Revision / Practice.
- [ ] Supports Diagnostic.
- [ ] Supports Common Stream Test.
- [ ] Class Test excludes not-confirmed content.
- [ ] Diagnostic can include not-yet-taught content intentionally.
- [ ] Common Stream Test uses intersection scope.
- [ ] Assessment scope is shown before generation.
- [ ] Generated questions are editable.
- [ ] Question curriculum basis is retained.
- [ ] Marking guide is generated.
- [ ] PDF export produces a real file.
- [ ] Marking guide export produces a real file.

## 8. HOD

- [ ] HOD sees department Teaching Sections.
- [ ] HOD sees meaningful stream drift.
- [ ] HOD sees unconfirmed state separately.
- [ ] HOD sees common assessment readiness.
- [ ] HOD does not see teacher rankings.
- [ ] HOD does not have routine lesson approval workflow.

## 9. DOS

- [ ] DOS can view timetable setup/review.
- [ ] Extracted/proposed timetable is not auto-activated.
- [ ] DOS sees Academic Exceptions.
- [ ] DOS can distinguish monitoring vs action required.
- [ ] Recovery case shows why action is needed.
- [ ] System checks normal-schedule absorbability.
- [ ] DOS can Approve / Modify / Decline where appropriate.
- [ ] Deterministic conflict state does not come from LLM inference.

## 10. Principal

- [ ] Principal sees aggregate academic health.
- [ ] Principal sees department attention.
- [ ] Principal sees DOS decision count/state.
- [ ] Principal sees unconfirmed state.
- [ ] Principal does not see routine teacher-level activity by default.
- [ ] Principal does not see AI-use metrics as performance metrics.

## 11. Resources

- [ ] Curriculum-suggested resources are labelled as curriculum.
- [ ] School resources are labelled as school.
- [ ] ATE adaptations are labelled ATE.
- [ ] External resources are labelled external.
- [ ] External URL/title metadata is not invented.
- [ ] Exact textbook page/chapter is shown only if verified.
- [ ] Teacher can save a recommended resource.
- [ ] Department approval state can be represented.

## 12. Visual Quality

- [ ] Teacher views inspected at 360px.
- [ ] Teacher views inspected at 390px.
- [ ] Teacher views inspected at 430px.
- [ ] Leadership views inspected at 1280px.
- [ ] Leadership views inspected at 1440px.
- [ ] No horizontal overflow.
- [ ] Long teacher/class/topic names do not break layout.
- [ ] Loading states are coherent.
- [ ] Empty states are coherent.
- [ ] Error states are coherent.
- [ ] Focus states are visible.
- [ ] Interactive targets meet reasonable touch size.
- [ ] No excessive nested cards.
- [ ] No decorative AI gradients.
- [ ] No arbitrary page-specific style drift.

## 13. Demo Resilience / Operational Resilience

- [ ] App has a controlled reset mechanism for configured state.
- [ ] Refresh does not unexpectedly erase required state.
- [ ] AI endpoint failure has a usable fallback or clear recoverable state.
- [ ] The product can be shown without relying on one fragile scripted path.
- [ ] A teacher can request a different Biology lesson/test without breaking the UI.

## 14. Product Integrity

- [ ] NCDC/curriculum data is visibly distinguishable from AI content.
- [ ] ATE does not imply endorsement.
- [ ] Unconfirmed does not become teacher absence.
- [ ] Teaching progress does not become mastery.
- [ ] Teacher action does not automatically become punitive leadership scoring.

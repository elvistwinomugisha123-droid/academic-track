# Assessment Studio controlled-pilot status · 11 October 2026

## Live evidence

Source: read-only queries of ATE_Pilot (`pdvvspuokkordgppjwxg`) on 11–12 October 2026.

- Four curriculum subject profiles are `ACTIVE/PILOT_ACTIVE`: Lower Secondary Mathematics and Chemistry, Advanced Secondary Chemistry and Principal Mathematics.
- Two curriculum releases are active. They are syllabus releases, not assessment approval.
- `knowledge_assessment_profiles`: **0 rows**. `assessment_workspaces`: **0 rows**.
- 89 imported assessment candidate records exist, all remain `REVIEW_REQUIRED`. No assessment record verification decisions or assessment release memberships are present.
- The demo school is Mount of Olives College, Kakiri — DEMO. Its four Teaching Sections and two classroom events are demonstration data; they do not prove general pilot adoption or educational quality.
- The two S3 Chemistry streams are independent. East has a confirmed position in Formulae, Stoichiometry and Mole Concept and saved lesson-linked homework; West has no confirmed position. Neither has a teacher-confirmed delivered classroom event. The S5 and S6 demo events have no governed canonical ID on their preparations. Accordingly no current section has eligible delivered scope for a formal paper.

## Source and decision map

| Material | Rule supported here | Governance state |
| --- | --- | --- |
| NCDC Lower Secondary Mathematics and Chemistry syllabuses (2019) | Subject, level, topic, linked learning outcome and classroom task scope | Checksum-bound controlled-pilot curriculum membership exists. This does not authorize formal assessment purpose. |
| NCDC Advanced Secondary Chemistry and Principal Mathematics syllabuses (2025) | Subject, level, topic and linked learning outcome | Checksum-bound controlled-pilot curriculum membership exists. |
| NCDC Advanced Secondary assessment framework (2026) | Candidate written-task and scoring rules. The founder's recorded interpretation uses the written five-times maximum-score rule on PDF page 21. | Candidate guidance only. Adjacent tables and worked-example conflict still need academic review. |
| NCDC Advanced Secondary Chemistry and Principal Mathematics guidelines (2026) | Candidate subject assessment objectives and construct mappings | Candidate guidance only. Chemistry AO mapping follows the reviewed table on guideline PDF pages 9–10; page 26's differing labels remain in provenance. The full guidelines have not been approved for a runtime assessment profile. |
| UNEB Mathematics and Chemistry sample papers | Examples of item formats and demand, never a source of text or scenarios to copy | No reviewed sample-paper mapping or usable source-rights decision is present in this pilot database. |

The source decisions and checksum records are in `knowledge-tools/catalog/pilot-academic-decisions.json`, `pilot-verification-decisions.json`, and `pilot-operator-authorization.json`. The assessment corpus and review queue remain private and are not committed to Git.

## Runtime correction applied

Migration `0045_assessment_pilot_runtime_alignment.sql` was applied to the live pilot on 12 October 2026. It lets the assessment resolver recognize the existing checksum-bound `OPERATOR_AUTHORIZED_FOR_PILOT` source-rights decision and pilot curriculum membership, while still requiring the exact approved source checksum, formal-artifact permission, an active assessment release with a non-null effective start, matching subject/section bindings, and teacher-confirmed taught scope. It did not activate any profile, candidate, or unknown right.

The current lower-secondary release `401011db-f10a-5521-830b-a6460581fa68` is `ACTIVE`, but its `effective_from` is null in the live database. The active-release immutability trigger prevents adding a profile to it. The assessment profile foreign key requires its subject profile to belong to the same release; a separate assessment-only release therefore cannot reuse the current subject profile without an explicit schema and resolver change. Merely inserting a profile row would give the teacher a false choice and still fail at workspace creation.

## Exact publication gate

No assessment profile was activated. A narrow **Lower Secondary S3 Chemistry class test** is the first defensible candidate. The 2019 Chemistry syllabus supports classroom questions, assignments and tests but does not prescribe a universal class-test blueprint. Bankai can define an internal, teacher-reviewed blueprint and label it as an operator rule. Publication requires a recorded assessment-release effective date and an approved approach to release lineage: either create a superseding lower-secondary release with cloned, checksum-bound subject/profile memberships and updated school bindings, or explicitly support a separately versioned assessment release linked to the existing subject profile. The latter requires a reviewed schema, resolver and RLS change because the current foreign key requires identical release IDs. Do not retrofit the active syllabus release or silently take its activation timestamp as an academic effective date.

After that decision, publish only the Chemistry `CLASS_TEST` profile with `SUBJECT_SYLLABUS` source role and the existing current checksum-bound pilot rights decision. Keep the regime clearly `BANKAI_LOWER_SECONDARY_INTERNAL_CLASS_TEST`, with modest teacher-set duration, marks and item distribution constrained to delivered S3 Chemistry outcomes. Run the reviewer and export path on the DEMO school before any wider use. A demo teacher may confirm a real demonstration lesson outcome through the normal teacher UI, but scheduled or planned lessons alone are not eligible scope.

Advanced Secondary still has a separate unresolved scoring conflict in the 2026 framework between the written five-times maximum-score rule and adjacent tables/worked example. Its 89 imported assessment candidates remain `REVIEW_REQUIRED`; no wholesale verification or rights conversion is justified.

The current release and subject-profile IDs cannot be reused as an assessment release merely because they are active for curriculum. An unknown effective date is a closed gate.

## Educational reference cases, not runtime results

These are newly written practice examples anchored to verified pilot syllabus topics. They are neither UNEB copies nor evidence that AI produced good questions. A teacher still needs to review them against the exact taught outcome and class position.

- **S3 Mathematics, Business Mathematics — compound interest practice.** A savings account starts with UGX 200,000 and earns 10% interest per year, compounded annually. Find the balance after two years and the total interest. Expected: UGX 242,000 balance, UGX 42,000 interest. Four-mark guide: 1 mark for multiplier 1.10; 1 for two-year expression; 1 for UGX 242,000; 1 for UGX 42,000. The figures make the task answerable and the context supplies an actual use for the calculation.
- **S3 Chemistry, Chemical Reactions — formative rate comparison.** Equal masses of the same carbonate react separately with equal volumes of the same acid at the same concentration and temperature. One sample is powdered and the other is in large chips. Which produces gas faster at the start, and why? Expected: powder, because greater exposed surface area permits more frequent successful collisions. Three-mark guide: 1 for identifying powder; 1 for greater exposed surface area; 1 for the collision explanation. The controlled variables make the comparison fair. This is a lesson-linked check, not a formal Activity of Integration.

Neither example is eligible for a specific Teaching Section until that section's teacher-confirmed position and delivery evidence support it. S3 East and S3 West remain separate.

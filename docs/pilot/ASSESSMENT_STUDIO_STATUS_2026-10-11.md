# Assessment Studio controlled-pilot status · 12 October 2026

## 13 October authenticated completion addendum

The 12 October snapshot below predates the teacher walkthrough. The DEMO teacher used the UI to record a clearly labelled simulated delivered S3 East Chemistry lesson on the mole concept. East then gained one eligible taught curriculum area; West remained ineligible and a West workspace attempt returned a taught-evidence explanation. The teacher created the bound Bankai internal class test, chose a 10-mark, 20-minute two-question blueprint, reviewed an AI proposal, edited and regenerated a single question, approved versions, finalised version 6, reopened it, and exported the question paper and marking guide as protected PDF and DOCX files. The final question content and guides were checked for Chemistry correctness and five marks per question. The workspace is `ef9347ca-0946-4072-bad2-e157e7965420`, `FINAL`, version 6, `TEACHER` authored. This is a controlled DEMO simulation, not genuine pilot classroom evidence.

The authenticated S5 Principal Mathematics teacher flow saved a lesson-linked HOMEWORK artifact as version 2 after AI proposal review and teacher correction of instructions and follow-up. This is practice material, not an Advanced Secondary formal assessment. The live app-window test confirmed an active service worker, standalone display mode in a headful Chromium app window, a usable offline fallback, and authenticated 200 responses with valid PDF/DOCX signatures for both assessment exports. The 89 Advanced Secondary assessment candidates and the scoring conflict stated below remain gated.

## Live evidence

Source: read-only queries of ATE_Pilot (`pdvvspuokkordgppjwxg`) on 11–12 October 2026.

- Four curriculum subject profiles are `ACTIVE/PILOT_ACTIVE`: Lower Secondary Mathematics and Chemistry, Advanced Secondary Chemistry and Principal Mathematics.
- Two curriculum releases are active. They are syllabus releases, not assessment approval.
- As of 12 October, one Bankai internal S3 Chemistry class-test profile is active. `assessment_workspaces` still has **0 rows** pending teacher-confirmed DEMO delivery and an authenticated walkthrough.
- 89 imported Advanced Secondary assessment candidate records remain `REVIEW_REQUIRED`. No candidate verification decisions or memberships were activated for this internal class test.
- The demo school is Mount of Olives College, Kakiri — DEMO. Its four Teaching Sections and two classroom events are demonstration data; they do not prove general pilot adoption or educational quality.
- The two S3 Chemistry streams are independent. East has a confirmed position in Formulae, Stoichiometry and Mole Concept and saved lesson-linked homework; West has no confirmed position. Neither has a teacher-confirmed delivered classroom event. The S5 and S6 demo events have no governed canonical ID on their preparations. Accordingly no current section has eligible delivered scope for a formal paper.

## Source and decision map

| Material | Rule supported here | Governance state |
| --- | --- | --- |
| NCDC Lower Secondary Mathematics and Chemistry syllabuses (2019) | Subject, level, topic, linked learning outcome and classroom task scope | Checksum-bound controlled-pilot curriculum membership exists. Bankai separately owns the internal S3 Chemistry class-test rule and blueprint. |
| NCDC Advanced Secondary Chemistry and Principal Mathematics syllabuses (2025) | Subject, level, topic and linked learning outcome | Checksum-bound controlled-pilot curriculum membership exists. |
| NCDC Advanced Secondary assessment framework (2026) | Candidate written-task and scoring rules. The founder's recorded interpretation uses the written five-times maximum-score rule on PDF page 21. | Candidate guidance only. Adjacent tables and worked-example conflict still need academic review. |
| NCDC Advanced Secondary Chemistry and Principal Mathematics guidelines (2026) | Candidate subject assessment objectives and construct mappings | Candidate guidance only. Chemistry AO mapping follows the reviewed table on guideline PDF pages 9–10; page 26's differing labels remain in provenance. The full guidelines have not been approved for a runtime assessment profile. |
| UNEB Mathematics and Chemistry sample papers | Examples of item formats and demand, never a source of text or scenarios to copy | No reviewed sample-paper mapping or usable source-rights decision is present in this pilot database. |

The source decisions and checksum records are in `knowledge-tools/catalog/pilot-academic-decisions.json`, `pilot-verification-decisions.json`, and `pilot-operator-authorization.json`. The assessment corpus and review queue remain private and are not committed to Git.

## Runtime correction applied

Migration `0045_assessment_pilot_runtime_alignment.sql` was applied to the live pilot on 12 October 2026. It lets the assessment resolver recognize the existing checksum-bound `OPERATOR_AUTHORIZED_FOR_PILOT` source-rights decision and pilot curriculum membership, while still requiring the exact approved source checksum, formal-artifact permission, an active assessment release with a non-null effective start, matching subject/section bindings, and teacher-confirmed taught scope. It did not activate any profile, candidate, or unknown right.

The current lower-secondary syllabus release is `ACTIVE`, but its historical `effective_from` is null. Its active-release membership is immutable. Migration `0046` keeps that release intact and introduces a separate assessment-release FK, date and resolver, rather than treating the unknown syllabus date as the Bankai assessment date.

## Narrow Bankai class-test publication

Migrations `0046_bankai_lower_chemistry_class_test.sql` and `0047_assessment_release_read_policies.sql` add an independent, versioned assessment release linked to the existing active curriculum subject profile. The release has a source ID, exact checksum and existing latest pilot rights decision; source rights, formal artifact, AI and export permissions are checked again at runtime. Its `2026-10-12` effective start is **Bankai's controlled-pilot operational date**, not an NCDC publication or syllabus-effective date. The profile is `BANKAI_LOWER_SECONDARY_INTERNAL_CLASS_TEST`, purpose `CLASS_TEST`, and lets the teacher define the blueprint. It does not claim an NCDC prescribed class-test item distribution.

Live identifiers: assessment release `8ff006a7-47fe-45af-b509-ccd59ebdc6c8`; assessment profile `19a162af-c558-45e0-81d6-564530c7a124`. Only the DEMO school's S3 East and S3 West Chemistry Teaching Sections have active assessment bindings. Their taught scope remains independent; neither scheduled work nor the profile itself establishes delivered scope. The live SQL resolver returned `applicable: true`, pilot rights permitted, and one exact syllabus source for both bound sections on 12 October. This verifies profile resolution only; it is not a completed teacher paper.

The teacher must record a clearly labelled simulated DEMO lesson outcome through the normal UI before the S3 East class-test workspace can be created. S3 West must remain ineligible until its own delivery evidence exists. The protected reviewer/version/export path requires the authenticated walkthrough before the workflow can be claimed as passed.

Advanced Secondary still has a separate unresolved scoring conflict in the 2026 framework between the written five-times maximum-score rule and adjacent tables/worked example. Its 89 imported assessment candidates remain `REVIEW_REQUIRED`; no wholesale verification or rights conversion is justified.

The active syllabus release remains unchanged with its unknown historical effective start. Only the new Bankai assessment release supplies the internal class-test effective date.

## Educational reference cases, not runtime results

These are newly written practice examples anchored to verified pilot syllabus topics. They are neither UNEB copies nor evidence that AI produced good questions. A teacher still needs to review them against the exact taught outcome and class position.

- **S3 Mathematics, Business Mathematics — compound interest practice.** A savings account starts with UGX 200,000 and earns 10% interest per year, compounded annually. Find the balance after two years and the total interest. Expected: UGX 242,000 balance, UGX 42,000 interest. Four-mark guide: 1 mark for multiplier 1.10; 1 for two-year expression; 1 for UGX 242,000; 1 for UGX 42,000. The figures make the task answerable and the context supplies an actual use for the calculation.
- **S3 Chemistry, Chemical Reactions — formative rate comparison.** Equal masses of the same carbonate react separately with equal volumes of the same acid at the same concentration and temperature. One sample is powdered and the other is in large chips. Which produces gas faster at the start, and why? Expected: powder, because greater exposed surface area permits more frequent successful collisions. Three-mark guide: 1 for identifying powder; 1 for greater exposed surface area; 1 for the collision explanation. The controlled variables make the comparison fair. This is a lesson-linked check, not a formal Activity of Integration.

Neither example is eligible for a specific Teaching Section until that section's teacher-confirmed position and delivery evidence support it. S3 East and S3 West remain separate.

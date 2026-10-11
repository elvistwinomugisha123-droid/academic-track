# Assessment Studio controlled-pilot status · 11 October 2026

## Live evidence

Source: read-only queries of ATE_Pilot (`pdvvspuokkordgppjwxg`) on 11 October 2026.

- Four curriculum subject profiles are `ACTIVE/PILOT_ACTIVE`: Lower Secondary Mathematics and Chemistry, Advanced Secondary Chemistry and Principal Mathematics.
- Two curriculum releases are active. They are syllabus releases, not assessment approval.
- `knowledge_assessment_profiles`: **0 rows**. `assessment_workspaces`: **0 rows**.
- 89 imported assessment candidate records exist, all remain `REVIEW_REQUIRED`. No assessment record verification decisions or assessment release memberships are present.
- The demo school is Mount of Olives College, Kakiri — DEMO. Its four Teaching Sections and two classroom events are demonstration data; they do not prove general pilot adoption or educational quality.

## Source and decision map

| Material | Rule supported here | Governance state |
| --- | --- | --- |
| NCDC Lower Secondary Mathematics and Chemistry syllabuses (2019) | Subject, level, topic, linked learning outcome and classroom task scope | Checksum-bound controlled-pilot curriculum membership exists. This does not authorize formal assessment purpose. |
| NCDC Advanced Secondary Chemistry and Principal Mathematics syllabuses (2025) | Subject, level, topic and linked learning outcome | Checksum-bound controlled-pilot curriculum membership exists. |
| NCDC Advanced Secondary assessment framework (2026) | Candidate written-task and scoring rules. The founder's recorded interpretation uses the written five-times maximum-score rule on PDF page 21. | Candidate guidance only. Adjacent tables and worked-example conflict still need academic review. |
| NCDC Advanced Secondary Chemistry and Principal Mathematics guidelines (2026) | Candidate subject assessment objectives and construct mappings | Candidate guidance only. Chemistry AO mapping follows the reviewed table on guideline PDF pages 9–10; page 26's differing labels remain in provenance. The full guidelines have not been approved for a runtime assessment profile. |
| UNEB Mathematics and Chemistry sample papers | Examples of item formats and demand, never a source of text or scenarios to copy | No reviewed sample-paper mapping or usable source-rights decision is present in this pilot database. |

The source decisions and checksum records are in `knowledge-tools/catalog/pilot-academic-decisions.json`, `pilot-verification-decisions.json`, and `pilot-operator-authorization.json`. The assessment corpus and review queue remain private and are not committed to Git.

## Activation change that remains blocked

No database activation was made. The academic reviewer must first approve the exact lower-secondary or advanced-secondary assessment guidance records by subject, level and purpose, resolve the remaining open assessment review items, document applicable source rights for AI drafting, formal artifacts and exports, and approve effective dates. Then a reviewed migration may create the corresponding assessment release, subject-specific assessment profile, approved source memberships and school/Teaching Section bindings. The pilot operator must validate those rows and the runtime profile resolver before the status becomes `ACTIVE`. `TEST_SYNTHETIC` profiles remain excluded.

The current release and subject-profile IDs cannot be reused as an assessment release merely because they are active for curriculum. An unknown effective date is a closed gate.

## Educational reference cases, not runtime results

These are newly written practice examples anchored to verified pilot syllabus topics. They are neither UNEB copies nor evidence that AI produced good questions. A teacher still needs to review them against the exact taught outcome and class position.

- **S3 Mathematics, Business Mathematics — compound interest practice.** A savings account starts with UGX 200,000 and earns 10% interest per year, compounded annually. Find the balance after two years and the total interest. Expected: UGX 242,000 balance, UGX 42,000 interest. Four-mark guide: 1 mark for multiplier 1.10; 1 for two-year expression; 1 for UGX 242,000; 1 for UGX 42,000. The figures make the task answerable and the context supplies an actual use for the calculation.
- **S3 Chemistry, Chemical Reactions — formative rate comparison.** Equal masses of the same carbonate react separately with equal volumes of the same acid at the same concentration and temperature. One sample is powdered and the other is in large chips. Which produces gas faster at the start, and why? Expected: powder, because greater exposed surface area permits more frequent successful collisions. Three-mark guide: 1 for identifying powder; 1 for greater exposed surface area; 1 for the collision explanation. The controlled variables make the comparison fair. This is a lesson-linked check, not a formal Activity of Integration.

Neither example is eligible for a specific Teaching Section until that section's teacher-confirmed position and delivery evidence support it. S3 East and S3 West remain separate.

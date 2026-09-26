# ATE delivery status

Last updated: 26 September 2026, 10:54 EAT

This is the live handoff board for the ATE v1 production rebuild. A task is marked **Done** only when its current evidence is recorded. **In progress** means code or verification is actively changing. **User action** identifies a secure vendor-account step that cannot be placed in source control.

## Current release signal

| Area | State | Current evidence |
|---|---|---|
| Local quality gate | Done | Typecheck, lint, 29 test files / 106 tests, production build and high-severity dependency audit pass |
| Hosted CI gate | In progress | The previously green core suite was expanded to remove 12 skipped role tests; strict-locator and retry-isolation fixes are being verified |
| Production release | Not ready | TEST validation must finish; live AI evaluation, backup/restore proof and production deployment are still outstanding |

## Done

- Recovered and inventoried the supplied NCDC curriculum folders.
- Accounted for 47 supplied PDFs, 46 unique files and 3,421 unique pages.
- Extracted 3,421 page spans, 5,501 curriculum candidates and 3,883 assessment candidates.
- Produced 9,384 structured records/relationships with deterministic checksums and zero extraction-schema warnings/errors.
- Added the corpus registry, extraction pipeline, validation outputs and source inventory.
- Added TEST-only curriculum, assessment and multi-role fixtures.
- Hardened Supabase access, RLS execution behaviour and security regression tests.
- Centralised AI provider/model configuration behind the ATE AI Gateway.
- Added structured-output validation, manual-authoring fallback, payload/output limits and provider timeouts.
- Added a live AI evaluation set for citation grounding, invented-authority prevention and human-control preservation.
- Verified core Teacher, HOD, DOS and Principal walkthroughs against isolated TEST data.
- Added School Admin to the deterministic role matrix and removed manual credential dependencies from older suites.
- Fixed narrow-screen heading overflow and verified the main authenticated surfaces across phone, tablet and desktop widths.
- Implemented and tested PDF exports for lesson artifacts, question papers and marking guides.
- Implemented DOCX exports for lesson plans, every Teaching Pack artifact, question papers and marking guides.
- Added Vercel Web Analytics and Speed Insights instrumentation.
- Removed permission/expiry language from the curriculum inventory and replaced user-facing source-control language with neutral source-readiness wording.

## In progress now

1. Re-run the expanded browser matrix with all School Admin, Teacher, HOD, DOS and Principal checks enabled.
2. Eliminate strict-selector and retry-isolation failures revealed when previously skipped suites were activated.
3. Verify PDF and DOCX response types and non-empty files through authenticated browser requests.
4. Publish the updated monitoring, AI safety and full-role changes to the rebuild branch.

## Remaining engineering work

| Priority | Task | Completion condition |
|---|---|---|
| P0 | Complete subject-by-subject curriculum review | Topics, subtopics, outcomes, competencies, time allocations, assessment rules and irregular tables are reviewed for every supplied subject |
| P0 | Import the reviewed corpus into TEST | Import report, counts, checksums, provenance and rollback evidence pass against TEST |
| P0 | Configure all-subject releases | Every reviewed subject has the correct level/profile/release bindings and deterministic retrieval checks |
| P0 | Finish the expanded browser matrix | No skipped critical role workflows and one clean hosted run |
| P0 | Run the live AI evaluation | Configured model passes all grounding and safety cases with recorded results |
| P0 | Prove backup and recovery | Current backup status is confirmed and a TEST restore/recovery drill is documented |
| P0 | Production deployment | Production secrets, database, migrations, domain, monitoring and final smoke tests pass |
| P1 | Database performance follow-up | High-use foreign keys and queries are measured, then necessary indexes are added without speculative over-indexing |
| P1 | Final accessibility/polish pass | Keyboard, focus, contrast, responsive layout and document-output inspection pass on release candidate |

## Secure user actions

These are the only current actions that require the account owner:

1. Create an Anthropic API key and add it directly to the Vercel Preview environment as `ANTHROPIC_API_KEY`. Do not paste the key into chat or commit it.
2. Enable Supabase Auth leaked-password protection in the TEST dashboard, then repeat it for production before launch.
3. Confirm the intended production Vercel project/domain and production Supabase project before the final deployment. No production database has been modified.

## Definition of “ready”

ATE is ready for production only when all P0 items are complete, the hosted CI run is green, the live model evaluation passes, backup/recovery is proven, and the production smoke test has no critical errors. Until then, TEST remains the only approved validation environment.

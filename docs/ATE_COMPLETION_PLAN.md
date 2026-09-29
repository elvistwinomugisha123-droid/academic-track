# Academic Track Engine â€” Completion Plan

**Purpose:** define what remains to make ATE a credible, pilot-ready school academic-operations product, how the work should be sequenced, and which parts require local engineering versus external deployment actions.

**Status basis:** repository inspection, the current ATE delivery-status document, curriculum source inventory, curriculum data contract, and the September 2026 project handoff.

## 1. Where this work should be done

### The main engineering work can be done here

This shared Codex workspace is sufficient for:

- modifying the Next.js, TypeScript and database code;
- designing and implementing the onboarding wizard;
- implementing teacher invitations, assignments and confirmations;
- implementing school-programme and timetable import;
- improving curriculum extraction, normalization and release tooling;
- implementing the first-use curriculum-position flow;
- changing lesson preparation so AI generation is the default;
- writing migrations, validation rules and tests;
- running typecheck, lint, unit tests, builds and Playwright tests;
- inspecting the local application and fixing UX and error states;
- preparing deployment configuration and release documentation.

The repository is already present here under `academic-track/`. Moving to Codex Cloud is not required merely because the work is large.

### External/cloud actions are still required at release time

Some actions cannot safely be completed only through source code:

- adding or rotating Supabase and Anthropic secrets;
- applying migrations to the intended Supabase environment;
- configuring Vercel Preview/Production variables;
- configuring the production domain and deployment;
- confirming Supabase backups and performing a recovery drill;
- sending real invitation emails through the selected email provider;
- testing with a real schoolâ€™s approved operational data;
- accepting any vendor-dashboard or account-owner confirmation.

These can be performed from the same working session when the relevant connectors and credentials are available. Otherwise they are explicit owner actions at the deployment stage. Codex Cloud is useful for a connected remote repository, long-running hosted work or cloud deployment access, but it is not a prerequisite for the implementation itself.

## 2. The target school onboarding flow

The school should not create a timetable manually inside ATE. ATE should import, validate, govern and activate school data.

```text
School account
  â†’ academic year and term
  â†’ classes and streams
  â†’ subjects from curriculum catalogue
  â†’ teacher invitations
  â†’ teacher/subject/class/stream assignments
  â†’ school programme import
  â†’ timetable import
  â†’ validation and correction
  â†’ DOS verification
  â†’ activation
  â†’ teacher confirms curriculum position per section
  â†’ ATE prepares the next lesson
  â†’ teacher records what happened
  â†’ continuity and assessment scope advance
```

The governing rule is:

> Imported data is a draft. Verified data is operational. Activated data drives teacher work.

## 3. What is already present

The current codebase has a substantial foundation:

- authenticated school workspace and school tenancy;
- role model for Teacher, School Admin, HOD, DOS and Principal;
- academic periods, class levels, streams, subjects and Teaching Sections;
- timetable versions, verification and activation primitives;
- scheduled lesson generation after timetable activation;
- curriculum profiles, bindings and curriculum-position records;
- append-only curriculum-position history with role controls;
- Teacher Home and lesson-readiness foundations;
- classroom outcome and continuity foundations;
- Formal Lesson Plan and Teaching Pack artifact model;
- assessment eligibility, drafting, review and PDF/DOCX export foundations;
- HOD, DOS and Principal operational views;
- curriculum source registry, extraction tools and validation schemas;
- 47 supplied PDFs, 46 unique documents and page-addressable extraction outputs;
- Anthropic gateway, structured-output validation and AI evaluation tooling;
- security/RLS and role-isolation tests;
- local typecheck, lint, test and production-build gates.

This is a strong technical foundation. It is not yet the complete school onboarding product.

## 4. What is incomplete or not yet productized

### P0 â€” curriculum release and runtime truth

The supplied PDFs have been inventoried and mechanically extracted, but extraction is not the same as an approved runtime curriculum release.

Remaining work:

1. Reconcile the source inventory and subject/level classifications.
2. Validate extracted topics, subtopics, outcomes, competencies, activities, time allocations, restrictions and irregular tables against their source pages.
3. Preserve source provenance and rights metadata.
4. Import approved records into TEST.
5. Publish curriculum releases for every approved subject and level.
6. Bind school subjects and Teaching Sections to the correct release.
7. Add deterministic retrieval tests across all supported subjects.
8. Distinguish subjects with no supplied assessment guideline; never invent or silently substitute one.

The review gate must not mean retyping PDFs. It means checking that structured extraction did not attach a topic, outcome, activity or time allocation to the wrong record.

### P0 â€” first-use curriculum-position setup

When a Teaching Section has no history, the teacher should not see a blank lesson-plan form.

Required experience:

1. ATE identifies the section, subject, class, stream, term and applicable curriculum release.
2. ATE explains that this section has no confirmed starting position.
3. ATE displays the ordered syllabus topics/outcomes.
4. The teacher chooses one starting position, or selects a clear alternative such as:
   - class has not started the syllabus;
   - class is behind;
   - class is ahead;
   - teacher is not sure;
   - import an existing scheme of work.
5. ATE records the choice as a section-specific curriculum-position event.
6. ATE generates the first lesson from that governed context.

The teacher makes one academic decision per Teaching Section. Manual lesson fields are optional editing controls after generation, not the entry requirement.

### P0 â€” real school onboarding wizard

Replace technical database-oriented setup with a guided school workflow:

1. School identity and academic year.
2. Term dates, opening date and closing date.
3. Classes/levels and streams.
4. Subject selection from the curriculum catalogue.
5. Teacher directory and invitations.
6. Teacher-subject-class-stream assignment matrix.
7. School-programme import.
8. Timetable import.
9. Validation and correction.
10. Final review.
11. Activation.

The wizard should expose plain school language. Terms such as `curriculum profile`, `binding`, `runtime release` and `rights_state` remain internal implementation concepts.

### P0 â€” teacher invitation and assignment workflow

Required administrator capability:

- enter teacher name, email and role;
- create a pending invitation;
- send, resend and cancel invitations;
- view invitation status and expiry;
- accept the invitation securely;
- create or link the user membership;
- assign one teacher to multiple sections;
- show each assignment as awaiting confirmation, confirmed, rejected or needing correction.

The assignment matrix should resemble:

| Teacher | Subject | Class | Stream | Term | Status |
|---|---|---|---|---|---|
| Teacher name | Biology | Senior 1 | East | Term 1 | Awaiting confirmation |

The teacher must confirm that the assignment is correct before using the section. A mistyped email must not silently grant school access.

### P0 â€” school programme import

The programme is broader than the timetable. It may include term dates, teaching weeks, assemblies, breaks, examinations, holidays, co-curricular activities, meetings, public holidays, suspended lessons and catch-up periods.

First implementation target:

- Excel/CSV upload;
- column mapping;
- preview;
- date/time validation;
- target scope mapping;
- duplicate and overlap detection;
- correction before commit;
- draft, verify and activate states.

PDF/image import may be added later, but OCR must produce a reviewable draft and must never silently create authoritative school events.

### P0 â€” timetable import

The school uploads an existing general timetable. ATE does not ask the school to design it from scratch.

First implementation target: Excel/CSV import.

Expected columns, with flexible mapping:

- day/date;
- start time;
- end time;
- subject;
- class/level;
- stream;
- teacher;
- room.

Import behavior:

1. Upload file.
2. Map columns to ATE fields.
3. Match names to school records.
4. Show unmatched teachers, subjects, classes and streams.
5. Detect teacher conflicts, class conflicts, overlapping times, invalid durations and assignment mismatches.
6. Allow DOS correction or explicit resolution.
7. Save a draft timetable version.
8. Verify it.
9. Activate it.
10. Generate scheduled lesson occurrences.

PDF/image timetable extraction is not the first release because OCR errors can create false school records. It can be added only with the same preview, validation and approval gates.

## 5. Correct teacher experience after onboarding

For each assigned Teaching Section:

1. Teacher accepts the school invitation.
2. Teacher confirms the assigned subject, class and stream.
3. ATE asks where the class is in the curriculum.
4. Teacher chooses the current position once.
5. ATE shows the next scheduled lesson.
6. ATE assembles curriculum context, duration, prior evidence, unfinished work, resources and school constraints.
7. Anthropic drafts the lesson preparation and relevant teaching materials.
8. Teacher reviews and edits.
9. Teacher records what actually happened.
10. ATE carries unfinished work and the confirmed position forward.
11. Assessment generation uses only eligible taught content.

If curriculum context is missing, the product should show a setup action, not:

> Manual â€” no validation

and not a blank lesson-plan form.

## 6. Execution order

### Phase 1 â€” freeze the contract

- Freeze the onboarding state machine.
- Freeze curriculum release and approval states.
- Freeze import draft/validation/verification/activation states.
- Confirm role permissions and tenant boundaries.
- Record the user-facing wording for each incomplete state.

### Phase 2 â€” finish curriculum runtime

- Run registry and extraction against the supplied corpus.
- Produce review queues for uncertain or irregular records.
- Review and approve subject/level releases.
- Import approved records into TEST.
- Add counts, checksums, provenance and rollback evidence.
- Test deterministic retrieval for every approved release.

### Phase 3 â€” build school setup

- Add the onboarding wizard shell.
- Add catalogue-based subject selection.
- Add teacher directory and invitation lifecycle.
- Add assignment matrix and teacher confirmation.
- Add school-programme import.
- Add timetable Excel/CSV import.
- Add validation, correction, verification and activation states.

### Phase 4 â€” repair the first-use teacher flow

- Trigger the curriculum-position wizard for every new section.
- Remove the blank-form-first experience.
- Make AI generation the default after position confirmation.
- Keep manual fields as optional edits.
- Replace technical error messages with recovery actions.

### Phase 5 â€” end-to-end verification

Run one complete synthetic-school scenario:

1. Create school and term.
2. Import classes and streams.
3. Select subjects.
4. Invite teachers.
5. Accept an invitation.
6. Assign one teacher to multiple sections.
7. Confirm assignments.
8. Import programme.
9. Import timetable.
10. Resolve validation errors.
11. Verify and activate.
12. Confirm curriculum position per section.
13. Generate lesson preparation.
14. Record classroom outcome.
15. Verify carry-forward.
16. Generate an assessment from eligible content.
17. Verify HOD/DOS operational visibility.
18. Test tenant isolation and role permissions.

### Phase 6 â€” release hardening

- Run the full browser matrix at 360, 390, 430, 768 and 1440 pixels.
- Test backend failure, missing environment variable, unavailable AI, timeout and export failure states.
- Verify no raw JSON, developer language or dead controls appear in user-facing screens.
- Confirm PDF/DOCX output types and non-empty content.
- Run live AI evaluation with the configured model.
- Prove TEST backup/recovery.
- Rotate exposed credentials before production.
- Apply the verified migration chain to production.
- Configure Vercel and production secrets.
- Run a production smoke test before a controlled pilot.

## 7. Definition of done

ATE is pilot-ready only when all of the following are true:

- a school can be onboarded without database knowledge;
- teachers can be invited and securely linked to the school;
- assignments are explicit and teacher-confirmed;
- programme and timetable data can be imported and validated;
- activation creates the correct scheduled lessons;
- every new Teaching Section has a guided curriculum-position setup;
- lesson preparation is generated from governed curriculum context;
- blank manual planning is not the default path;
- classroom evidence advances continuity;
- assessments use eligible taught scope;
- HOD, DOS and Principal views respect role boundaries;
- tenant isolation and security tests pass;
- curriculum releases have provenance and validation evidence;
- the full browser and AI evaluation gates pass;
- backup/recovery and production smoke tests pass.

## 8. Honest delivery boundary

A complete all-subject curriculum review, polished onboarding wizard, invitation infrastructure, timetable/programme import, AI flow correction and production hardening are too much to guarantee honestly in one night without reducing quality.

The correct immediate objective is a pilot-ready vertical slice with the right architecture:

1. one fully approved curriculum release;
2. the onboarding state machine and first-use position flow;
3. teacher invitation and assignment confirmation;
4. timetable and programme import foundations;
5. grounded AI lesson generation;
6. one passing end-to-end school scenario.

Then expand the validated pattern across the remaining subjects and levels. Exposing every extracted record as authoritative before it has passed the release gate would create academic-trust risk.

# ATE Controlled Pilot Readiness Execution Plan
## Academic Track Engine — Engineering Carry-Forward and Codex Execution Contract

**Status date:** 1 October 2026  
**Pilot institution:** Mount of Olives College, Kakiri  
**Product:** Academic Track Engine (ATE)  
**Company:** Bankai Technologies  
**Current posture:** **HARDEN, COMPLETE THE REQUIRED PILOT SURFACE, THEN GO**  
**Primary engineering objective:** Make ATE dependable enough for a controlled real-school pilot with up to four teachers who may teach multiple subjects, levels, classes and streams.

---

# 1. Purpose of this document

This document is the execution source of truth for the remaining engineering work before the controlled pilot.

It is not a new product redesign. ATE already contains substantial foundations for:

- school tenancy and roles;
- Teaching Sections;
- timetable-driven scheduled lessons;
- curriculum bindings and current-position tracking;
- Teacher Home;
- Lesson Readiness;
- Formal Lesson Plan;
- Teaching Pack;
- Ask ATE;
- classroom outcome recording;
- continuity/carry-forward;
- Assessment Studio;
- HOD/DOS/Principal operational views;
- AI run records;
- artifact versioning;
- PDF/DOCX exports;
- Supabase/RLS foundations.

The remaining task is to convert these foundations into one reliable, curriculum-complete, installable, notification-enabled and leadership-visible product path that works with real pilot users.

This document supersedes earlier deferrals in three areas:

1. **Installable PWA is now a pilot requirement.**
2. **Push notifications are now a pilot requirement.**
3. **Advanced curriculum-coverage visualisations for HOD/DOS are now a pilot requirement.**

These three items must not be treated as post-pilot nice-to-haves.

---

# 2. Product thesis that must not change

ATE is a teacher-first academic continuity and curriculum implementation system.

The core loop remains:

> **Know where the class is → Prepare → Teach → Confirm what happened → Recover unfinished work → Prepare the next lesson from confirmed state → Assess only legitimately taught content.**

ATE is not a generic chatbot.

ATE must know and preserve:

- school;
- teacher;
- role;
- Teaching Section;
- subject;
- level;
- class;
- stream;
- timetable occurrence;
- curriculum release/profile;
- current confirmed curriculum position;
- prior classroom evidence;
- unfinished work;
- lesson preparation;
- saved artifacts;
- assessment eligibility;
- school programme disruptions.

AI may draft, adapt, explain and propose.

AI must not silently:

- invent curriculum truth;
- claim a lesson occurred;
- mark a curriculum point as taught;
- alter school facts;
- move a class forward in the syllabus;
- finalise consequential academic decisions;
- create official learner marks.

Teacher and authorised school staff remain the academic authority.

---

# 3. Pilot scope

The pilot should support approximately **2–4 willing teachers**.

Do not artificially restrict those teachers to one department or one subject.

A single teacher may teach:

- multiple subjects;
- O-Level and A-Level;
- multiple classes;
- multiple streams.

Example:

**Mr. Komakech**
- S5 Biology
- S6 Biology
- S2 East Biology
- S2 West Biology
- S3 Chemistry

Every one of these is a separate **Teaching Section** with independent:

- curriculum position;
- lesson history;
- unfinished work;
- preparation;
- continuity state;
- assessment eligibility.

The system must aggregate those Teaching Sections into the teacher's daily experience without merging their academic state.

---

# 4. Non-negotiable pilot requirements

The pilot must not begin until the following are true.

## 4.1 Curriculum breadth

All intended O-Level and A-Level subjects in the ATE-supported catalogue must be available for assignment.

Curriculum readiness does **not** mean database rows exist.

For each supported subject and level, ATE must prove:

1. the authoritative/source document is identified;
2. subject and level are correctly mapped;
3. curriculum version/release is identified;
4. topics and relevant subordinate records are structurally extracted;
5. learning outcomes are attached to the correct parent context;
6. ordering is preserved where the source defines ordering;
7. provenance/source location is preserved;
8. rights/use state is recorded;
9. the release/profile is published;
10. school subject and Teaching Section bindings resolve correctly;
11. the teacher can select a valid current position;
12. runtime retrieval works;
13. lesson generation works from that position;
14. at least one Teaching Pack artifact can be generated;
15. Ask ATE receives correct governed context;
16. assessment profile/runtime rules resolve where applicable.

A subject is **PILOT READY** only after this full chain passes.

## 4.2 Installable Progressive Web App

ATE must behave as an installable application on supported teacher phones.

Minimum PWA requirement:

- valid Web App Manifest;
- application name and short name;
- correct start URL and scope;
- standalone display mode;
- theme/background metadata;
- Bankai/ATE app icons in required sizes;
- service worker registration;
- safe update behaviour;
- installability validation;
- installed-app launch into authenticated ATE;
- deep links from notifications into the installed app;
- graceful behaviour when the device is temporarily offline or connection is degraded;
- no claim of full offline operation unless explicitly implemented and tested.

Target acceptance devices:

- Android + Chrome installed PWA;
- iPhone + Safari/Add to Home Screen installed web app.

The pilot does not require a native Android or iOS application.

## 4.3 Push notifications

Push notifications are part of the pilot product, not a future enhancement.

The first implementation should be narrow and useful rather than noisy.

Required notification classes:

### A. Morning teaching brief
One useful summary of the teacher's teaching day.

Example structure:

> Good morning, Mr. Komakech.  
> You have 4 lessons today.  
> First: S5 Biology at 8:00.  
> One section has unfinished work that needs recovery.

The exact delivery time must be configurable using school/user timezone and pilot preferences.

### B. Upcoming lesson alert
Optional/preference-controlled reminder before an upcoming lesson.

The notification should deep-link to the scheduled lesson.

### C. Recovery alert
If a Teaching Section has unresolved unfinished work before its next scheduled lesson, ATE should surface that fact before preparation.

### D. Required-record reminder
A past scheduled lesson that has ended but still has no classroom outcome may generate a bounded reminder.

Do not create excessive nudges.

Push architecture should include:

- device push subscription registration;
- secure server-side subscription storage;
- user notification preferences;
- notification type preferences;
- school timezone handling;
- delivery history/status;
- expired subscription cleanup;
- safe retry;
- no curriculum/private lesson content in notification bodies beyond what is necessary;
- notification deep links;
- support for more than one device per user where practical.

The initial pilot does not need marketing notifications, social notifications or generic engagement spam.

## 4.4 Advanced curriculum coverage visualisation

Coverage visualisation is required for teachers and academic leadership.

This must represent **curriculum implementation**, not learner mastery.

Do not label implementation as "mastery", "achievement", "competence" or test performance.

### Teacher view
Each Teaching Section should expose a clear Curriculum Journey showing:

- ordered curriculum structure where order is meaningful;
- current confirmed position;
- completed/confirmed previous positions where deterministically supported;
- partial/unrecovered work;
- recent lesson evidence;
- next scheduled lesson;
- position history.

### HOD view
HOD must be able to understand department academic position without opening every teacher's private work.

Required department coverage surfaces:

- subject → level → class/stream position;
- parallel-stream comparison;
- current confirmed position per Teaching Section;
- sections with unconfirmed position;
- unrecovered partial/missed lessons;
- stream drift;
- recent continuity exceptions;
- upcoming assessment-scope mismatch/risk where deterministically supported;
- coverage/implementation visualisation across the department.

### DOS view
DOS should receive school-wide academic operations visibility:

- department coverage status;
- classes/streams with stale or unknown position;
- unresolved continuity issues;
- timetable/programme disruptions;
- cross-stream divergence requiring coordination;
- high-level recovery workload;
- assessment readiness exceptions where applicable.

### Principal view
Principal remains high-level:

- meaningful institutional exceptions;
- department signals;
- major curriculum implementation risk;
- no routine access to private teacher drafts.

### Coverage calculation rule
Coverage must be computed from verified curriculum structure + teacher-confirmed implementation state.

Do not infer progress from:

- number of AI generations;
- number of lesson plans created;
- login frequency;
- time spent in the app;
- number of Ask ATE messages.

Do not create teacher league tables or performance rankings.

If percentage coverage is shown, the denominator and calculation must be explicit and academically defensible. Prefer position/status visualisation where a percentage would create false precision.

---

# 5. Current engineering reality

Treat the following as the working baseline until a new audit proves otherwise.

## 5.1 Repository

Repository:

`elvistwinomugisha123-droid/academic-track`

Intended pilot branch:

`rebuild/ate-v1-production`

The current architecture is Next.js + TypeScript with Supabase, Anthropic and Vercel.

Do not rewrite the application into a different framework.

## 5.2 Supabase

`ATE_Security_Test` is a destructive TEST environment containing large quantities of fixtures.

It must remain for:

- CI;
- integration tests;
- RLS/security attacks;
- fixture creation/destruction;
- migration experiments;
- Playwright/test data.

**Do not put Mount of Olives real pilot data in `ATE_Security_Test`.**

Create/use a dedicated clean pilot Supabase project.

Suggested naming:

`ATE_Mount_of_Olives_Pilot`

## 5.3 Vercel

`academic-track-v2` should be treated as the canonical ATE Vercel project unless engineering discovers a compelling reason otherwise.

The duplicate/legacy `academic-track` project must not become a second pilot deployment.

The pilot requires one canonical production target.

## 5.4 Known historical reliability concerns

Recent validation has previously surfaced failures around:

- environment configuration;
- `DATABASE_URL`;
- trusted Supabase service credentials;
- AI-generation run persistence;
- PDF generation/runtime packaging;
- preview vs production configuration.

Do not assume these are fixed because a build is READY.

Re-test the complete user journey on the final deployed environment.

## 5.5 Security closure

Existing tenancy/RLS/RBAC work is substantial, but final live proof is still required.

Audit:

- authenticated RPC access;
- SECURITY DEFINER functions;
- cross-school access;
- role boundaries;
- storage object access;
- export access;
- invitation acceptance;
- service-role isolation;
- server-only secrets.

Any real cross-tenant access defect is P0.

---

# 6. Severity model

## P0 — absolute launch blocker

Any defect involving:

- cross-tenant data exposure;
- unauthorised role access;
- data loss/corruption;
- wrong academic-authority behaviour;
- wrong curriculum subject/level/release used;
- silent curriculum advancement;
- real pilot data placed in destructive TEST;
- broken authentication boundary;
- exposed production secrets;
- irrecoverable pilot database state.

Pilot cannot start with any known P0.

## P1 — core pilot blocker

Any defect that makes an expected pilot workflow unusable or materially unreliable, including:

- teacher cannot accept invitation/sign in;
- teacher cannot see correct Teaching Sections;
- timetable creates wrong lessons;
- curriculum position cannot be set;
- supported curriculum subject cannot be used at runtime;
- lesson generation fails in normal conditions;
- saved work disappears;
- classroom outcome cannot be recorded;
- carry-forward is wrong;
- required export fails;
- installed PWA cannot be installed/launched reliably;
- required push notifications do not work on the supported pilot platform;
- HOD/DOS required coverage view is materially wrong or unusable;
- required leadership record is incorrect.

Pilot cannot start with any known P1.

## P2 — tolerable only with documented workaround

Examples:

- minor visual issue;
- rare non-core browser quirk;
- low-impact copy problem;
- optional secondary screen issue;
- non-critical notification cosmetic defect.

Every accepted P2 must have:

- documented limitation;
- owner;
- workaround where relevant;
- planned follow-up.

---

# 7. Workstreams

Engineering should execute the following workstreams. Several can run in parallel, but their gates must be passed in the order defined later.

---

# Workstream A — Complete curriculum corpus

## Objective

Make every intended O-Level and A-Level subject operationally available before unrestricted pilot teacher selection.

## A1. Build curriculum readiness inventory

Generate a machine-readable and human-readable matrix:

| Subject | Level | Source | Version | Extracted | Validated | Released | Bound | Runtime | Lesson AI | Pack AI | Assessment | Rights | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|

Do not use aggregate row counts as readiness evidence.

## A2. Inventory source corpus

For every supplied curriculum and assessment source:

- fingerprint/checksum source;
- record title;
- authority/source organisation;
- subject;
- level;
- release/version;
- source locator/page structure;
- rights/use metadata;
- extraction status.

## A3. Extract and normalise

Use the existing knowledge tooling.

Extract appropriate structured records such as:

- subject;
- topic;
- subtopic where source structure supports it;
- learning outcome;
- competency where explicitly represented;
- suggested activities where appropriate;
- time allocation where explicitly represented;
- assessment profile/rules where applicable.

Do not invent absent curriculum structure to make schemas uniform.

## A4. Validate structurally

Automated validators should detect at minimum:

- duplicate stable identities;
- orphan outcomes;
- missing parent relationships;
- impossible subject/level mappings;
- broken ordering;
- missing source provenance;
- missing release/profile association;
- dangling relationships;
- records outside release applicability;
- missing runtime bindings.

## A5. Human source review

Review irregular/high-risk extraction against the original source.

The goal is not retyping.

The goal is to ensure extraction did not associate:

- the wrong outcome with a topic;
- the wrong activity with an outcome;
- the wrong level with a topic;
- the wrong assessment rule with a release.

## A6. Publish releases and bindings

For every validated subject:

- publish governed release/profile;
- bind correct school subject;
- bind Teaching Sections;
- verify current-position options resolve.

## A7. Automated runtime smoke suite

For every subject/level in the supported catalogue:

1. create synthetic TEST Teaching Section;
2. bind correct release;
3. confirm valid curriculum position;
4. create scheduled lesson;
5. load Teacher Home/Teaching Section;
6. open Lesson Readiness;
7. generate Formal Lesson Plan;
8. save/reopen;
9. generate at least one Teaching Pack artifact;
10. Ask ATE a grounded question;
11. validate returned canonical context;
12. validate export rights/runtime behaviour;
13. validate assessment profile if available.

Produce a pass/fail report.

### Workstream A exit condition

**100% of subjects advertised as available to pilot teachers are PILOT READY in the curriculum matrix.**

---

# Workstream B — Clean pilot environment and security closure

## Objective

Create a safe dedicated environment for Mount of Olives and eliminate ambiguity between TEST and pilot.

## B1. Dedicated pilot Supabase

Create clean pilot project.

Apply only verified migration chain.

Never clone TEST fixtures into pilot.

## B2. Credential rotation

Rotate any previously exposed/uncertain:

- Supabase service credential;
- database password;
- Anthropic key if exposure is suspected;
- other server secrets.

Update:

- Vercel;
- GitHub/CI where required;
- local secure environment.

Verify old credentials fail where appropriate.

## B3. One canonical Vercel deployment

Use one canonical ATE project.

Configure final environment values.

Ensure deployment reports environment and commit safely through a protected/redacted health surface.

Do not expose secrets.

## B4. Pilot health check

Implement a command such as:

`npm run pilot:check`

It should verify at minimum:

- environment name;
- required environment variables;
- Supabase reachability;
- expected Supabase project/ref;
- migration version;
- Auth configuration;
- private storage configuration;
- Anthropic provider/model configuration;
- curriculum runtime availability;
- required subject bindings;
- notification configuration;
- PWA assets/manifest availability;
- deployment metadata;
- critical service reachability.

Output:

`READY` or `NOT READY`

with exact failing checks.

## B5. Security integration

Run and fix:

- existing security integration suite;
- live cross-tenant tests;
- role boundary tests;
- direct RPC abuse tests;
- SECURITY DEFINER authorization review;
- storage access tests;
- export authorization tests;
- invitation boundary tests.

### Workstream B exit condition

Dedicated pilot environment exists, passes health/security checks, and contains no destructive TEST fixtures.

---

# Workstream C — Real school onboarding and timetable

## Objective

Make Mount of Olives operational in ATE without forcing the school to recreate itself manually.

## C1. Pilot onboarding

Support:

- school;
- academic year/term;
- classes;
- streams;
- departments;
- selected subjects;
- teachers/staff;
- roles;
- Teaching Section assignments;
- school programme;
- timetable.

The pilot may use Bankai-assisted setup. Do not delay the pilot by overbuilding self-service administration.

## C2. Teacher invitation flow

Implement/prove:

- create invitation;
- email invitation;
- invitation status;
- resend;
- revoke/cancel;
- accept invitation;
- set/confirm account;
- create membership;
- apply role grants;
- require teacher to confirm assigned Teaching Sections.

## C3. Assignment matrix

Support a teacher assigned to:

- multiple subjects;
- O-Level and A-Level;
- multiple classes;
- multiple streams.

Each Teaching Section remains independent.

## C4. Flexible timetable import

Target workflow:

1. upload Excel/CSV;
2. preview;
3. map source columns to ATE fields;
4. match teacher/subject/class/stream names;
5. show unresolved mappings;
6. detect conflicts;
7. correct/resolve;
8. create draft timetable version;
9. verify;
10. activate;
11. generate scheduled lessons.

Required validation:

- invalid day/time;
- teacher overlap;
- class/stream overlap;
- unknown teacher;
- unknown subject;
- unknown class/stream;
- assignment mismatch;
- duplicate rows;
- invalid duration.

Test using the school's actual timetable, not only synthetic samples.

## C5. Programme events

Support relevant school programme facts that affect expected teaching:

- holidays;
- examinations;
- assemblies;
- school events;
- lesson suspensions;
- catch-up/recovery periods.

### Workstream C exit condition

The real Mount of Olives pilot structure can generate correct scheduled lessons for all selected pilot teachers.

---

# Workstream D — Teacher core loop and recovery

## Objective

Make the Mr. Komakech journey work end-to-end on a real phone.

## D1. Teacher Home

Teacher Home should answer immediately:

- What am I teaching today?
- What is my next lesson?
- Which lesson needs preparation?
- Which section has unfinished work?
- Which past lesson still needs a classroom record?

Do not replace this with generic analytics.

## D2. First-position confirmation

For every Teaching Section, teacher confirms where that class is currently teaching.

This is independent per class/stream.

Do not force a blank lesson-plan form before this.

## D3. Lesson preparation

From the scheduled lesson, automatically assemble:

- subject;
- level;
- class/stream;
- duration;
- current curriculum position;
- relevant governed curriculum context;
- previous outcome;
- unfinished work;
- practical teacher notes;
- school constraints available to ATE.

AI creates a proposal.

Teacher reviews and accepts/edits.

## D4. Formal Lesson Plan

Must support:

- generate;
- review;
- edit;
- accept;
- save;
- immutable/versioned history;
- reopen after refresh/sign-out/sign-in;
- PDF/DOCX/print where promised.

## D5. Teaching Pack

Required types remain:

- Board Notes;
- Learner Notes;
- Activity Sheet;
- Lesson Summary;
- Homework.

At least the artifacts shown to the pilot must generate, save, reopen and export reliably.

## D6. Ask ATE

Ask ATE must be lesson-contextual.

For pilot, improve its context so a lesson conversation can use the current saved Formal Lesson Plan when relevant, while maintaining the existing governed curriculum/class context.

ATE suggestions must not silently mutate saved work.

Use:

`Ask → proposal → teacher review → accept/reject`

for consequential artifact changes.

## D7. Fast lesson closeout

After a lesson, the teacher should be able to record in seconds:

- Delivered;
- Partially Delivered;
- Not Delivered;
- Changed.

If partial/not delivered/changed, capture the minimum factual continuation information.

## D8. Recovery UX

Turn existing carry-forward logic into an obvious active recovery experience.

Minimum pilot UX:

1. teacher records partial/not delivered/changed;
2. teacher records where work stopped or what remains;
3. ATE preserves that as classroom evidence;
4. next scheduled lesson clearly surfaces the unfinished work;
5. ATE proposes how the next preparation should incorporate recovery;
6. teacher confirms the academic position/proposal.

Do not silently mark curriculum content complete.

### Workstream D exit condition

The full teacher loop passes twice consecutively on real authenticated pilot-like accounts without developer/database intervention.

---

# Workstream E — PWA and push notifications

## Objective

Make ATE feel like an application on teachers' phones and proactively surface useful academic work.

## E1. PWA foundation

Implement and validate:

- `/manifest.webmanifest` or equivalent;
- icons;
- standalone display;
- correct app name;
- correct theme/background values;
- start URL;
- scope;
- service worker;
- update strategy;
- installability;
- authenticated launch;
- deep-link routing.

Do not cache authenticated/private application data indiscriminately.

## E2. Connectivity behaviour

PWA does not imply full offline sync.

Required pilot behaviour:

- detect network loss/degradation;
- preserve unsaved local form/draft state where practical;
- prevent duplicate submissions;
- show clear retry state;
- avoid destructive refresh loops;
- recover when connection returns.

## E3. Push subscription model

Add appropriate server-side persistence for:

- user;
- device/subscription;
- endpoint;
- cryptographic subscription keys;
- created/updated timestamps;
- last successful delivery;
- invalid/revoked state.

Support multiple devices if practical.

## E4. Notification preferences

Allow at minimum:

- notifications enabled/disabled;
- morning brief;
- upcoming lesson alerts;
- recovery alerts;
- missing-classroom-record reminders;
- preferred morning brief time if product UX permits;
- timezone-safe delivery.

## E5. Notification scheduler

Implement a reliable server-side scheduler suitable for the existing Vercel architecture.

The scheduler should:

- determine eligible users;
- evaluate notification conditions deterministically;
- create delivery record/idempotency key;
- send Web Push;
- record success/failure;
- remove permanently invalid subscriptions;
- retry only where safe;
- never send duplicate morning briefs for the same user/day.

## E6. Privacy-safe notification bodies

Do not expose private lesson content on locked screens.

Notification text should use only enough context to be useful:

- subject;
- class/stream where appropriate;
- time;
- existence of unfinished work;
- action needed.

## E7. Device acceptance

Test:

### Android
- install from Chrome;
- sign in;
- receive push;
- tap notification;
- deep link opens correct lesson;
- close/reopen app;
- app update behaviour.

### iPhone
- Add to Home Screen;
- launch standalone;
- sign in;
- enable supported push flow;
- receive push;
- deep-link behaviour;
- close/reopen.

### Workstream E exit condition

ATE installs and launches as a PWA and required push flows work on the supported pilot device platforms.

---

# Workstream F — Coverage, HOD and DOS operational intelligence

## Objective

Turn teacher-confirmed academic state into useful leadership visibility without extra reporting burden or surveillance.

## F1. Define deterministic coverage model

Create one documented coverage projection that consumes:

- governed curriculum sequence;
- current confirmed curriculum position;
- position history;
- classroom outcomes;
- unfinished work;
- scheduled lessons;
- programme disruptions.

It must not use AI-generated artifact count as academic progress.

## F2. Teacher Curriculum Journey

Create a clear visual journey for each Teaching Section.

Suggested states:

- confirmed earlier position;
- current;
- unresolved/partial;
- next/untaught;
- review required.

The exact visual form may be timeline, sequence map, stepped progress path or another accessible representation.

It must remain useful on mobile.

## F3. HOD Department Coverage

Create an HOD surface that can answer:

- Where is each class/stream in this subject?
- Which streams are diverging?
- Which sections have incomplete/unrecovered lessons?
- Which positions are stale/unconfirmed?
- Where is common-assessment readiness at risk?
- Which exceptions need action?

Include advanced charts only where the data semantics are valid.

Recommended visualisations:

- class/stream curriculum-position comparison;
- department curriculum implementation map;
- stream divergence/drift chart;
- continuity exception trend;
- assessment-scope readiness/status.

## F4. DOS Academic Coverage

Create school-wide academic operations views:

- department status matrix;
- curriculum-position completeness;
- continuity/recovery exceptions;
- programme disruption impact;
- class/stream divergence;
- sections requiring HOD/DOS intervention.

## F5. Principal summary

Provide high-level institutional signals only.

Do not expose private teacher drafting or chat.

## F6. AI narrative summary — optional only after deterministic facts

If an AI summary is included, AI may explain deterministic data.

Example:

> S5 West is currently behind S5 East because Friday's scheduled Biology lesson was recorded as partially delivered and the remaining work has not yet been recovered.

The facts must be computed first.

AI must not invent urgency scores or teacher-performance judgements.

### Workstream F exit condition

Using a controlled test dataset, leadership visuals exactly match underlying confirmed classroom/curriculum records and are understandable to HOD/DOS on phone and desktop.

---

# Workstream G — Exports, resilience, recovery, support and telemetry

## Objective

Remove operational surprises during the pilot.

## G1. Export verification

Test every export visible to pilot users:

- Formal Lesson Plan PDF;
- Formal Lesson Plan DOCX;
- Teaching Pack PDF;
- Teaching Pack DOCX;
- assessment Question Paper PDF/DOCX if exposed;
- Marking Guide PDF/DOCX if exposed.

If a visible export is broken, fix it or remove it from the pilot UI.

## G2. Error handling

No raw Next.js crash screens in normal pilot flows.

Provide recoverable states for:

- Supabase unavailable;
- AI unavailable;
- timeout;
- session expiry;
- export failure;
- stale version conflict;
- network interruption.

## G3. Idempotency and duplicate prevention

Protect at minimum:

- classroom outcome writes;
- artifact acceptance/save;
- invitation acceptance;
- timetable activation;
- notification delivery;
- assessment finalisation.

## G4. Backup and recovery

Before pilot data goes live:

- record deployed git commit;
- record Vercel deployment ID;
- record Supabase project ref;
- record migration version;
- confirm backup/recovery mechanism;
- create known-good support account/process;
- document rollback.

Recovery must protect:

- memberships;
- roles;
- Teaching Sections;
- curriculum positions;
- lesson preparations;
- artifacts/versions;
- classroom events;
- assessments.

## G5. Support diagnostics

Bankai must be able to diagnose quickly:

- cannot sign in;
- wrong/missing Teaching Section;
- lesson disappeared;
- wrong next lesson;
- AI failed;
- save failed;
- export failed;
- push not received;
- PWA not installing;
- wrong coverage state.

Provide safe lookup/diagnostic information without exposing secrets.

## G6. Telemetry

Track product events required to understand pilot operation:

- invitation sent/accepted;
- first sign-in;
- PWA installed where measurable;
- push subscription created;
- notification sent/opened where measurable;
- Teaching Section confirmed;
- current position confirmed;
- Lesson Readiness opened;
- lesson preparation generated/saved/reopened;
- Teaching Pack generated/saved/exported;
- Ask ATE used;
- classroom outcome recorded;
- carry-forward created;
- next lesson reopened using prior state;
- assessment created/submitted/finalised;
- HOD/DOS coverage view opened;
- app/runtime errors;
- AI latency/failure/tokens/cost;
- export failure.

Do not build teacher productivity rankings.

### Workstream G exit condition

Bankai can detect, diagnose and recover from expected pilot failures without direct database improvisation.

---

# 8. Pilot readiness gates

Workstreams describe work. Gates decide whether the pilot may proceed.

---

## Gate 0 — Scope and architecture freeze

### Must be true

- This document is accepted as the current plan.
- No broad ERP expansion.
- No learner accounts.
- No marks database.
- No AI marking dependency.
- No native mobile app before pilot.
- No major framework/database rewrite.
- PWA, push notifications and advanced coverage visualisation are explicitly included.
- Full intended O-Level/A-Level curriculum readiness is explicitly included.

### Exit
**PASS / FAIL**

---

## Gate 1 — Curriculum Ready

### Must pass

- complete subject inventory exists;
- all advertised subjects/levels have source/version/provenance;
- extraction complete;
- subject-by-subject validation complete;
- releases published;
- bindings resolve;
- runtime smoke suite passes;
- no supported subject silently falls back to ungrounded generation.

### Exit
**PASS only when 100% of advertised pilot curriculum scope is READY.**

---

## Gate 2 — Environment and Security Ready

### Must pass

- dedicated pilot Supabase;
- no pilot data in TEST;
- verified migrations;
- one canonical Vercel production deployment;
- secrets rotated/secured;
- health check green;
- cross-tenant tests green;
- role/RPC/storage/export boundaries green;
- Auth green;
- AI configuration green.

### Exit
**P0 = 0.**

---

## Gate 3 — School Setup Ready

### Must pass

- Mount of Olives structure loaded;
- academic period loaded;
- selected subjects loaded;
- pilot teachers invited;
- roles correct;
- Teaching Sections correct;
- real timetable imported;
- timetable conflicts resolved;
- timetable activated;
- scheduled lessons correct;
- programme disruptions represented where relevant.

### Exit
A school leader and Bankai can jointly verify that ATE represents the actual pilot setup.

---

## Gate 4 — Teacher Core Loop Ready

### Required acceptance scenario

Use a difficult multi-section test teacher equivalent to Mr. Komakech.

1. accept invite;
2. sign in;
3. see correct subjects/classes/streams;
4. see today's lessons;
5. confirm curriculum position for each relevant section;
6. open next lesson;
7. generate Formal Lesson Plan;
8. edit and save;
9. refresh/reopen;
10. sign out/in and reopen;
11. generate Teaching Pack;
12. use Ask ATE;
13. export required material;
14. record Delivered;
15. next lesson advances only after teacher confirmation;
16. record Partially Delivered on another lesson;
17. unfinished work carries forward;
18. next preparation reflects recovery;
19. parallel stream remains independent;
20. other subject remains independent.

### Exit
Scenario passes twice consecutively with no developer/database intervention.

---

## Gate 5 — PWA and Notifications Ready

### Must pass

- Android install;
- iPhone Add to Home Screen;
- standalone launch;
- auth persists appropriately;
- service worker/update behaviour acceptable;
- morning brief works;
- upcoming lesson/recovery push works as configured;
- notification deep link works;
- duplicate notification prevention works;
- invalid subscription handling works;
- privacy-safe notification content;
- notification preferences respected.

### Exit
No known P1 on supported pilot phone platforms.

---

## Gate 6 — Leadership Coverage Ready

### Must pass

- teacher Curriculum Journey matches confirmed source data;
- HOD department coverage matches Teaching Sections;
- parallel-stream drift is correct;
- partial/missed recovery state is visible;
- unconfirmed positions visible;
- DOS school-wide coverage/risk view works;
- Principal receives high-level signal only;
- no private teacher drafts exposed;
- no teacher ranking/performance metric;
- percentages, if any, are mathematically and academically defensible.

### Exit
A seeded scenario can be manually reconciled from raw records to every displayed chart/value.

---

## Gate 7 — Reliability, Recovery and Support Ready

### Must pass

- visible exports work;
- no raw crash screens in acceptance path;
- retries/idempotency tested;
- network-loss scenarios tested;
- backup/recovery documented;
- Vercel rollback documented;
- support diagnostics available;
- telemetry available;
- pilot runbooks complete.

### Exit
Bankai can operate the pilot without ad-hoc database surgery for normal failures.

---

## Gate 8 — Full Dress Rehearsal / GO-NO-GO

Run one full pilot rehearsal using:

- dedicated pilot-like environment;
- 2–4 pilot-like teachers;
- multiple subjects;
- both O-Level and A-Level where available;
- multiple Teaching Sections;
- imported real-style timetable;
- installed PWA;
- push notifications;
- preparation;
- Teaching Pack;
- Ask ATE;
- classroom outcomes;
- partial-delivery recovery;
- curriculum journey;
- HOD/DOS coverage;
- export;
- support/recovery exercise.

### Final GO rule

Pilot status is **GO** only when:

- Gate 1–7 = PASS;
- P0 = 0;
- P1 = 0;
- accepted P2 issues are documented with owners/workarounds;
- the exact deployed commit/environment is frozen and recorded.

Otherwise:

**NO-GO. Fix the blocking failure and repeat the affected acceptance test.**

---

# 9. Recommended execution order for speed

The fastest safe approach is parallel execution.

## Parallel Track 1 — Curriculum
Start immediately and run continuously until Gate 1.

- corpus inventory;
- extraction;
- validators;
- human review;
- releases;
- bindings;
- subject smoke suite.

## Parallel Track 2 — Environment/Security
Start immediately.

- pilot Supabase;
- migrations;
- secrets;
- Vercel production target;
- health check;
- security closure.

## Parallel Track 3 — Teacher/PWA
Start immediately from current teacher vertical slice.

- teacher-flow hardening;
- recovery UX;
- saved-plan context in Ask ATE;
- PWA;
- push subscriptions/scheduler/preferences;
- mobile acceptance.

## Parallel Track 4 — School Operations
As soon as Mount of Olives data is available.

- school setup;
- invitations;
- assignments;
- timetable import;
- programme events.

## Parallel Track 5 — Leadership Coverage
Build on deterministic continuity/curriculum projections.

- teacher curriculum journey;
- HOD coverage;
- DOS coverage;
- chart validation.

## Integration phase
After tracks converge:

- exports;
- failure states;
- telemetry;
- recovery;
- full dress rehearsal.

Do not wait for visual polish in one track before starting another independent track.

---

# 10. Codex execution rules

Codex must follow these rules while implementing this plan.

## 10.1 Inspect before changing

Before modifying a subsystem:

- inspect current implementation;
- identify reusable code;
- identify current tests;
- state what is already present;
- avoid duplicate architecture.

Do not rebuild working modules merely because a different implementation is easier.

## 10.2 Preserve architecture

Continue using:

- Next.js;
- TypeScript strict mode;
- Supabase;
- existing RLS/RBAC/tenant model;
- existing curriculum knowledge model;
- existing artifact/version model;
- Anthropic gateway;
- existing Teaching Section abstraction.

Do not introduce microservices or a second database.

## 10.3 No fake curriculum

Synthetic users/schools/lessons are valid in TEST.

Synthetic "official curriculum" is not valid where the product expects governed curriculum.

## 10.4 Deterministic truth before AI

Use deterministic software for:

- user/role permissions;
- timetable validation;
- curriculum identity;
- curriculum ordering;
- current confirmed position;
- classroom outcome state;
- carry-forward state;
- assessment eligibility;
- coverage calculations;
- notification eligibility.

Use AI for:

- drafting;
- adaptation;
- explanation;
- summarisation;
- suggestions.

## 10.5 Do not hide failing features

If a visible button fails in the pilot path:

- fix it; or
- remove it from the pilot surface.

Do not leave dead controls.

## 10.6 Validate after every workstream

Use existing repository commands where applicable, including:

- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run build`
- `npm run validate:product`
- `npm run validate:ui`
- `npm run test:security:integration`
- `npm run test:e2e`

Add focused tests for new PWA/push/coverage behaviour.

Passing commands are necessary but not sufficient. Browser/device acceptance is mandatory.

## 10.7 Commit discipline

Use small coherent commits by workstream.

Each commit should state:

- problem;
- change;
- tests;
- known limitation.

Do not combine curriculum migration, PWA work, leadership UI and unrelated cleanup in one giant commit.

## 10.8 No "done" without evidence

For every gate, produce an evidence file/report containing:

- test date;
- environment;
- git SHA;
- Supabase ref;
- relevant Vercel deployment;
- test account type;
- pass/fail;
- blocking defect IDs.

---

# 11. Required engineering artifacts

Create/maintain these files in the repository:

1. `docs/pilot/ATE_PILOT_READINESS_EXECUTION_PLAN.md`
2. `docs/pilot/CURRICULUM_READINESS_MATRIX.md` or generated equivalent
3. `docs/pilot/PILOT_GO_NO_GO.md`
4. `docs/pilot/PILOT_ACCEPTANCE_EVIDENCE.md`
5. `docs/pilot/PILOT_RECOVERY_RUNBOOK.md`
6. `docs/pilot/PILOT_OPERATIONS_RUNBOOK.md`
7. `docs/pilot/PILOT_ONBOARDING_RUNBOOK.md`
8. `docs/pilot/PWA_PUSH_ACCEPTANCE.md`
9. `docs/pilot/LEADERSHIP_COVERAGE_SEMANTICS.md`
10. `docs/pilot/KNOWN_PILOT_LIMITATIONS.md`

Where useful, generate machine-readable JSON alongside Markdown.

---

# 12. Required acceptance tests

At minimum, add/maintain automated coverage for:

## Curriculum
- subject/level/profile resolution;
- invalid mapping rejection;
- runtime position options;
- release applicability;
- subject smoke matrix.

## Teacher
- multiple Teaching Sections;
- multiple subjects;
- O/A-Level separation;
- position confirmation;
- generation/save/reopen;
- artifact versioning;
- partial-delivery carry-forward;
- stream independence.

## Timetable
- column mapping;
- name reconciliation;
- overlap validation;
- activation;
- scheduled lesson generation.

## Security
- cross-tenant denial;
- role denial;
- direct RPC checks;
- storage/export denial;
- invitation boundaries.

## PWA/push
- manifest validity;
- service-worker registration;
- push subscription persistence;
- notification preference logic;
- idempotent delivery;
- invalid subscription cleanup;
- deep-link target.

## Leadership
- current-position projection;
- coverage projection;
- stream drift;
- continuity exceptions;
- department scoping;
- principal privacy boundary.

---

# 13. Mobile acceptance matrix

Test at minimum:

- 360 px width;
- 390 px width;
- 430 px width;
- tablet/desktop leadership view.

Teacher workflows to test on mobile:

- invitation;
- sign-in;
- PWA install;
- push enablement;
- Teacher Home;
- Teaching Sections;
- current-position selection;
- lesson preparation;
- AI generation;
- lesson plan editing;
- Teaching Pack;
- Ask ATE;
- PDF/DOCX action;
- lesson closeout;
- partial-delivery recovery;
- notification deep link;
- app switching;
- network interruption;
- session expiry.

Leadership coverage must remain interpretable on phone but may use richer desktop layouts when available.

---

# 14. Definition of controlled-pilot ready

ATE is controlled-pilot ready when a real invited teacher can:

1. install ATE as a PWA;
2. receive the configured teaching notification;
3. sign in;
4. see the correct school and Teaching Sections;
5. see today's timetable-driven lessons;
6. confirm current curriculum position;
7. prepare a curriculum-grounded lesson;
8. generate and edit the Formal Lesson Plan;
9. generate useful Teaching Pack materials;
10. use lesson-contextual Ask ATE;
11. save, leave, return and reopen work;
12. export promised materials;
13. teach;
14. record what actually happened;
15. record partial/missed/changed work quickly;
16. see unfinished work recovered into the next lesson;
17. keep different subjects/classes/streams independent;
18. see the Teaching Section Curriculum Journey;
19. allow HOD/DOS to see accurate coverage/continuity exceptions without private-draft surveillance.

At the same time Bankai must be able to:

- diagnose failures;
- recover data;
- identify the deployed version;
- measure pilot operation;
- preserve tenant security;
- restore service;
- support the teacher without editing production records manually.

---

# 15. Explicitly deferred until after controlled pilot starts

Do not delay the pilot for:

- native Android application;
- native iOS application;
- full offline bidirectional sync;
- learner accounts;
- parent portal;
- marks database;
- AI marking;
- full ERP;
- billing;
- advanced Teacher Library/document-management system;
- generic social/chat features;
- teacher performance rankings;
- broad autonomous agents;
- complex restore UI;
- marketing/engagement notifications;
- automatic timetable generation.

These may be reconsidered after pilot evidence.

---

# 16. First Codex action

Before implementing new work, Codex should perform a focused current-state diff against this plan.

Output:

`docs/pilot/PILOT_GAP_AUDIT_2026-10-01.md`

For every requirement in this plan classify:

- `IMPLEMENTED_AND_PROVEN`
- `IMPLEMENTED_NOT_PROVEN`
- `PARTIAL`
- `MISSING`
- `BLOCKED_BY_EXTERNAL_ACTION`

For every `PARTIAL` or `MISSING` item, list:

- relevant files/modules;
- database objects;
- required code changes;
- tests to add;
- gate affected;
- severity;
- dependency;
- whether work can run in parallel.

Then execute the work in gate/critical-path order.

Do not spend the first cycle polishing already-working secondary UI.

---

# 17. Final instruction to Codex

The goal is not to create more features.

The goal is to make the existing ATE product — plus the explicitly required PWA, push-notification and coverage-visualisation additions — dependable enough that a real Mount of Olives teacher can use it in ordinary school work.

The final acceptance question is:

> **Can a multi-subject teacher wake up, receive a useful ATE notification, open the installed ATE app, understand today's lessons, prepare from the correct curriculum/class state, teach, record where the lesson actually ended, recover unfinished work into the next lesson, and allow the HOD/DOS to understand curriculum implementation risk — without developer intervention, incorrect academic assumptions, lost work or privacy violations?**

If the answer is not demonstrably yes, the pilot is not ready.

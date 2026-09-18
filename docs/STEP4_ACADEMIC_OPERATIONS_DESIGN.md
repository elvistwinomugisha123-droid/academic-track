# ATE v1 Step 4 — Academic Operations Core

Status: implementation design contract for `rebuild/ate-v1-production`.

Authority: the canonical 16 September 2026 ATE Product Bible, Technical Architecture & Engineering Specification, School Implementation & Administration Handbook, and Product Decision Record / ADR Register remain upstream authority. This document narrows those decisions into the Step 4 implementation contract and must not redefine product semantics.

## Objective

Establish the deterministic school academic structure required before classroom continuity, Academic Knowledge runtime binding, teacher lesson preparation, assessment, or leadership analytics.

The Step 4 backbone is:

`School → Academic Period → Class/Level → Stream → Subject → Teaching Section → Timetable Version → Timetable Slot → Scheduled Lesson`

School Programme events are a separate operational calendar input. They may explain or flag timetable conflicts but do not prove that a lesson was taught, missed, or cancelled.

The first-class operational identity remains:

`Teacher × Subject × Class/Level × Stream × Academic Period`

## Scope boundaries

Step 4 includes school academic structure, Teaching Sections, timetable versioning, timetable slots, scheduled lessons, programme events, assignment verification, RLS/authorization, deterministic validation, and audit for consequential transitions.

Step 4 does **not** include:

- classroom outcome/continuity events or current-position projections;
- curriculum-topic selection or teacher current curriculum position;
- governed curriculum/assessment profile runtime binding;
- Lesson Readiness, Formal Lesson Plan, Teaching Pack, Ask ATE;
- Assessment Studio;
- leadership dashboards or issue escalation;
- OCR/AI timetable interpretation as a dependency of correctness;
- learner rosters, attendance, marks, fees, admissions, discipline, or ERP scope.

A timetable import adapter may later populate Step 4 draft entities, but imported/extracted data remains proposed state until deterministic validation and authorised verification.

## Core implementation decisions

### 1. `class_levels`

School-owned structural record for a class/level such as Senior 1 or Senior 2.

Recommended fields:

- `id uuid pk`
- `school_id uuid not null`
- `code text not null` — e.g. `S2`
- `name text not null` — e.g. `Senior 2`
- `sort_order integer not null default 0`
- `status ACTIVE | INACTIVE`
- timestamps

Unique within school by normalized code; retain inactive historical structure rather than deleting it.

Use the term `Class/Level` in UI. Avoid a generic `classes` table because “class” is overloaded with streams/cohorts in school usage.

### 2. `streams`

A stream belongs to exactly one class/level and school.

Recommended fields:

- `id uuid pk`
- `school_id uuid not null`
- `class_level_id uuid not null`
- `code text`
- `name text not null` — e.g. `A`, `Blue`, `East`
- `status ACTIVE | INACTIVE`
- timestamps

Composite foreign keys must prevent a stream from referencing another tenant's class/level.

### 3. `school_subjects`

School-owned subject catalogue used for operational structure, not as curriculum authority.

Recommended fields:

- `id uuid pk`
- `school_id uuid not null`
- `department_id uuid null`
- `code text null`
- `name text not null`
- `status ACTIVE | INACTIVE`
- timestamps

A school subject is not an Academic Knowledge profile and must never be treated as official curriculum truth. Step 6 will bind operational subjects/sections to governed, versioned curriculum/assessment profiles after rights and profile checks.

This sequencing deliberately avoids a half-integrated Academic Knowledge foreign key in Step 4 while preserving the canonical Subject identity.

### 4. `teaching_sections`

The first-class operational unit.

Recommended fields:

- `id uuid pk`
- `school_id uuid not null`
- `academic_period_id uuid not null`
- `teacher_membership_id uuid not null`
- `school_subject_id uuid not null`
- `class_level_id uuid not null`
- `stream_id uuid not null`
- `assignment_state PROPOSED | CONFIRMED | FLAGGED`
- `operational_status ACTIVE | PAUSED | CLOSED`
- `confirmed_at timestamptz null`
- `flag_reason text null`
- `created_by uuid null`
- timestamps

Identity uniqueness is the combination of academic period, teacher membership, school subject, class/level and stream within a school.

Cross-tenant and cross-level constraints must be structural: membership, subject, class/level, stream and period must all belong to the same school; the stream must belong to the specified class/level.

Do not store mutable curriculum position here. Step 5 continuity will derive classroom position from events/projections; Step 6 will supply governed curriculum anchors.

Do not silently change the teacher on an active section. Because Teacher is part of the canonical identity, a teacher handover creates a successor Teaching Section and preserves the predecessor for history. Continuity handover is addressed in Step 5.

Department scope should be resolved from the section's school subject rather than duplicated as an independently mutable department field unless later evidence requires a separate section-level department override.

### 5. `timetable_versions`

A timetable is versioned because revisions must not rewrite historical schedule facts.

Recommended fields:

- `id uuid pk`
- `school_id uuid not null`
- `academic_period_id uuid not null`
- `version_number integer not null`
- `name text not null`
- `status DRAFT | VERIFIED | ACTIVE | RETIRED`
- `effective_from date not null`
- `source_file_id uuid null` referencing `school_files`
- `created_by uuid not null`
- `verified_by uuid null`, `verified_at timestamptz null`
- `activated_by uuid null`, `activated_at timestamptz null`
- `notes text null`
- timestamps

Exactly one timetable version may be ACTIVE for the same school + academic period + effective operating window. Activation must be transactional: retire/supersede the previous active future schedule and activate the new version without an ambiguous intermediate state.

An ACTIVE timetable version is not edited in place. Revision creates a new DRAFT version.

### 6. `timetable_slots`

A recurring weekly slot inside one timetable version.

Recommended fields:

- `id uuid pk`
- `school_id uuid not null`
- `timetable_version_id uuid not null`
- `teaching_section_id uuid not null`
- `day_of_week smallint not null` — ISO 1..7
- `starts_at time not null`
- `ends_at time not null`
- `room_label text null`
- timestamps

Require `ends_at > starts_at`.

Draft versions may temporarily contain conflicts during import/configuration. Activation must fail if unresolved overlaps exist for the same teacher or the same stream/class context. Conflict validation belongs to the activation transaction/domain service rather than rejecting draft rows one-by-one.

### 7. `scheduled_lessons`

Persistent expected lesson occurrences derived deterministically from an activated timetable version. This table represents schedule intent only.

Recommended fields:

- `id uuid pk`
- `school_id uuid not null`
- `academic_period_id uuid not null`
- `teaching_section_id uuid not null`
- `timetable_version_id uuid not null`
- `timetable_slot_id uuid not null`
- `scheduled_date date not null`
- `starts_at timestamptz not null`
- `ends_at timestamptz not null`
- `schedule_status SCHEDULED | CANCELLED | SUPERSEDED`
- `superseded_by_timetable_version_id uuid null`
- timestamps

Generate occurrences for the active timetable's effective range inside the academic period using the school's configured timezone. Full-period generation is acceptable at pilot scale and is simpler to reason about than lazy generation.

A timetable revision must not rewrite historical scheduled lessons. Future occurrences from the previous version may be marked `SUPERSEDED` and replaced by the new active version.

A scheduled lesson is never automatically marked taught or missed because time passed. Step 5 teacher-confirmed continuity owns classroom reality.

### 8. `school_programme_events`

Verified institutional calendar facts separate from the timetable and separate from curriculum/assessment rules.

Recommended fields:

- `id uuid pk`
- `school_id uuid not null`
- `academic_period_id uuid null`
- `event_type HOLIDAY | ASSEMBLY | SPORTS | TRIP | VISITATION | EXAMINATION | MOCK | OTHER`
- `title text not null`
- `starts_at timestamptz not null`
- `ends_at timestamptz not null`
- `status SCHEDULED | CANCELLED`
- `notes text null`
- `created_by uuid not null`
- timestamps

Use `programme_event_targets` when an event is not school-wide:

- `event_id uuid not null`
- `school_id uuid not null`
- nullable `class_level_id`, `stream_id`, `department_id`
- require exactly one target column per row

Zero target rows means school-wide. Multiple target rows allow one event to affect several levels/streams/departments without polymorphic unverified IDs.

Programme events may produce deterministic conflict indicators. They do not automatically create a classroom outcome or infer that a lesson was missed.

## Academic-period rule

Teaching Sections and timetable versions must use an operational teaching period (`TERM`, `SEMESTER`, or explicitly supported `CUSTOM`) rather than `YEAR` or `BREAK`. The domain service must also reject closed/cancelled periods for new active configuration.

Do not add a global “one CURRENT academic period per school” constraint because schools may legitimately have overlapping YEAR and TERM records.

## Authorization and RLS

Every new school-owned table has RLS enabled and fails closed cross-tenant.

Recommended access model:

- all active school members may read basic active school structure (`class_levels`, `streams`, `school_subjects`) and relevant programme information;
- a teacher reads Teaching Sections, timetable slots and scheduled lessons assigned to their membership;
- an HOD reads Teaching Sections/schedule in their active department scope;
- DOS reads school-wide academic operations and owns routine timetable/programme authority;
- Principal has school-wide assurance/read access but does not gain routine timetable mutation merely by title;
- SCHOOL_ADMIN may manage configuration/identity structure but is not automatically academic authority for teacher classroom truth;
- teachers may confirm or flag only their own proposed Teaching Section assignment through a narrow mutation boundary;
- no client-supplied `school_id`, role name, or teacher identity is trusted without server/RLS verification.

Use the existing active-membership and role helpers where appropriate; add a Teaching Section authorization helper only if it materially simplifies correct RLS and remains auth.uid-bound.

## Consequential mutation boundaries

Do not reintroduce a generic client-writable audit RPC.

Use narrow application/domain commands for consequential transitions, with authorization and audit in the same transactional boundary where practical. At minimum:

- `confirm_teaching_section_assignment(section_id, decision, reason?)`
- `verify_timetable_version(version_id)`
- `activate_timetable_version(version_id)`

Timetable activation must validate ownership, academic period state, section confirmation, slot integrity, teacher/stream overlap, effective date, active-version transition and scheduled-lesson generation before committing.

## Deterministic invariants

Implementation must guarantee:

- no cross-school foreign-key composition;
- a stream belongs to the stated class/level;
- a Teaching Section cannot reference a teacher membership from another school;
- a Teaching Section cannot be activated against a closed/cancelled academic period;
- an active timetable version is not edited in place;
- only one applicable active timetable version exists for a school/period/effective range;
- timetable activation rejects teacher and stream double-bookings;
- scheduled lesson occurrence times come from timetable version + slot + school timezone;
- timetable revisions preserve historical scheduled facts;
- programme events never imply delivered/missed classroom state;
- no Step 4 table introduces a mutable `current_topic` / `current_position` source of truth;
- no AI model is required to compute or validate any Step 4 institutional fact.

## Suggested module boundary

Keep Step 4 inside the modular monolith, for example:

```text
src/academic-operations/
  domain/
  application/
  repositories/
  validation/
  authz/
  schemas/
```

UI routes should call application/domain services rather than embedding timetable or authorization rules in React components.

## Implementation sequence

1. Add `0002_academic_operations.sql` with tables, constraints, indexes and RLS foundations. Do not alter `0000_academic_knowledge.sql`.
2. Add typed domain/Zod contracts and deterministic validators.
3. Add tenant-aware repositories and record/action authorization.
4. Add Teaching Section proposal/confirmation flow.
5. Add timetable draft/verify/activate lifecycle and overlap validator.
6. Add deterministic scheduled-lesson generation and timetable-revision behaviour.
7. Add school programme events/targets and conflict reads.
8. Add minimal setup/verification UI for DOS/SCHOOL_ADMIN and teacher section confirmation. Do not build Teacher Home yet.
9. Add integration tests against the isolated Supabase test project and standard quality gates.

## Required security/integration tests

At minimum prove:

- anonymous access denied;
- cross-tenant reads/writes denied for every new table;
- teacher cannot read another teacher's section/scheduled lessons solely by guessing IDs;
- HOD access is limited to active department scope;
- DOS can manage academic operations for own school only;
- Principal cannot perform routine timetable mutation unless separately granted a role that authorises it;
- SCHOOL_ADMIN cannot fabricate classroom outcome state (none exists in Step 4);
- teacher can confirm/flag only own proposed Teaching Section;
- active timetable version cannot be mutated in place;
- timetable activation fails on teacher overlap and stream overlap;
- successful activation creates the expected scheduled lessons only inside the academic-period/effective range;
- new timetable activation preserves historical occurrences and supersedes only applicable future occurrences;
- programme events do not change scheduled lessons into taught/missed outcomes;
- all Step 3 security integration tests remain green.

## Definition of done

Step 4 is complete only when a real authenticated school can be represented without demo state and the system can answer deterministically:

- Which class/levels and streams exist?
- Which subjects exist operationally and how are they departmentally organised?
- Which teacher is responsible for which subject/stream in this academic period?
- Which assignments has the teacher confirmed or flagged?
- Which timetable version is authoritative for a given date?
- What lessons are scheduled for a teacher/Teaching Section on a given date?
- Which school programme events overlap the schedule?

Step 4 is **not** complete merely because setup screens render. The schema, tenant constraints, RLS, version lifecycle, overlap rules, scheduled-lesson generation and negative security cases must be proven in integration tests.

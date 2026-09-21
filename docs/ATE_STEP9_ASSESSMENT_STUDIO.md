# ATE Step 9 — Assessment Studio

Step 9 adds the first production Assessment Studio vertical slice. It is a
teacher-owned authoring and quality-assurance workflow, not a generic question
generator.

## Workflow and authority

The workflow is:

`Purpose → Assessment Profile → Eligible Scope → Blueprint → Draft → Teacher Review → Finalise → Export`

Purpose is selected before rules are resolved. The active profile is stored with
the workspace, including release/profile identity and the profile snapshot used at
creation time. A missing verified profile is a controlled unavailable state; ATE
does not invent NCDC, UNEB or school rules from model memory.

Assessment Studio supports formative checks, class tests, diagnostics, revision
practice, common stream tests and internal exams where the active profile permits
them. Statutory Continuous Assessment submission, Activities of Integration,
Project Work, AMIS, learner accounts, learner marks, AI grading and mastery
inference remain outside Step 9.

## Scope semantics

Ordinary assessment scope is derived from confirmed classroom/curriculum evidence.
An authorised teacher may record a specific partial-delivery portion as eligible
only through explicit evidence; partial delivery does not make a whole curriculum
position eligible. ATE never infers achievement or mastery from coverage.

For `COMMON_STREAM_TEST`, the default is the intersection of confirmed eligible
canonical IDs across the participating Teaching Sections. Stream-only content is
excluded by default. Diagnostic, revision and internal-exam breadth is represented
as broader profile-permitted scope only when the active profile allows it and is
visibly distinguished from confirmed taught scope.

Scope evidence is relational in `assessment_scope_items`; assessment content is a
typed immutable version payload. This keeps institutional eligibility queryable and
auditable while allowing question editing and reordering without one table per
question.

## Blueprint and payload

`AssessmentBlueprintSchema` captures participating sections, scope IDs, expected
evidence, item/difficulty/marks distributions, total marks, duration, practical
requirements, accessibility constraints, subject constraints and teacher notes.

`AssessmentPayloadSchema` contains the blueprint plus teacher-editable questions.
Each question has a stable ID, text, marks, item type, difficulty, optional
cognitive demand/expected response/rubric, eligible canonical IDs and a marking
guide. Question IDs remain stable through reordering.

The deterministic validator checks schema, marks, duration, profile purpose,
section scope, canonical IDs, eligible scope, marking guides, distribution and
export rights. It returns actionable messages such as “Question q4 uses curriculum
content outside the confirmed eligible scope,” not an opaque quality score.

## Versions and finalisation

Assessment workspaces and versions are school-tenant scoped. Teacher saves append
new versions and use optimistic version checks. Version rows are append-only.
Finalisation freezes the workspace, records actor/time, stores a scope snapshot and
writes an audit event. A final workspace cannot be edited; a future revision must
be created as a new draft.

Routine teacher-owned assessments do not require invented leadership approval.
Profile-specific review states can be represented by `IN_REVIEW` without granting
leaders blanket access to private drafts.

## AI boundaries and rights

AI is optional. Manual authoring remains available if Anthropic is unavailable or
rights are not cleared. The `assessment-draft-v1` workflow receives only the
server-reconstructed profile, blueprint and eligible canonical IDs. It cannot decide
scope, change purpose/sections/marks/duration, claim official national approval or
write classroom truth.

AI output is parsed through Zod and the deterministic validator. A successful
proposal stores its exact JSON and SHA-256 output/context fingerprints in
`assessment_ai_generation_runs`. Accepting a proposal uses the server-stored JSON;
the browser does not get to replace AI-authored content while claiming its
authorship. Rejecting a proposal creates no assessment version.

External AI is blocked unless the governed source set is rights-cleared,
production-permitted and explicitly external-AI eligible. Protected source wording
does not leave the governed subsystem merely to make generation work.

## Exports and marking boundary

Only final workspaces export. The Question Paper PDF contains identity, duration,
marks, instructions, numbered questions and marks, without marking guidance. The
separate Marking Guide PDF contains expected responses/marking points and marks.
ATE prepares the instrument; teachers mark learner scripts. No learner marks
database or AI grading is created.

## Security model

The school is the tenant boundary. PostgreSQL RPCs enforce active membership,
assigned Teaching Section ownership, subject/period consistency, active assessment
profile applicability, eligible scope membership, optimistic version checks and
final-version immutability. RLS exposes only workspaces whose sections are assigned
to the authenticated teacher; leadership roles do not grant blanket access to
private teacher drafts.

Migration `0023_assessment_studio.sql` is forward-only and must be applied only to
the isolated TEST project `lwbkxhimqlfuzzxilaga` after local gates pass. Production
is not a deployment target for Step 9.

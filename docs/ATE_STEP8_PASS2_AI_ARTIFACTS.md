# Step 8 Pass 2 — AI-assisted lesson artifacts

Pass 2 adds bounded AI drafting inside the existing Lesson Workspace. The Formal Lesson Plan and Teaching Pack remain canonical structured artifacts with immutable versions; AI proposals are previews until the assigned teacher accepts them.

## Trust and rights

Every generation action reconstructs the assigned lesson, Teaching Section, curriculum anchor, rights state and current artifact versions on the server. The browser cannot choose school, curriculum, provenance, rights or AI authorship metadata. Curriculum source wording is excluded from the external-model context. A governed anchor with `external_ai_allowed = false` blocks the model call and leaves manual teacher editing available.

`formal_artifact_allowed = false` keeps generated content free of protected source wording and uses the neutral label `Current confirmed curriculum position`. Canonical/profile/source locator metadata remains in the governed context and artifact provenance.

## Proposal lifecycle

`server context → rights gate → structured model output → Zod validation → deterministic checks → teacher preview → accept/reject`

Accepted AI content is written through the server-only `accept_ai_lesson_artifact_version` database function as `change_source = AI`, attributed to the accepting teacher membership. The applied 0015 teacher RPC cannot be used to forge AI authorship. Rejection creates no artifact version.

Generation runs store operation, provider/model, prompt version, context fingerprint, token counts, latency, validation status and rights state. Raw prompts, protected source text and secrets are not persisted.

## Prompt versions

- `lesson-plan-v1`
- `teaching-pack-v1`
- `artifact-patch-v1`
- `ask-ate-v1`

Ask ATE is contextual to the selected artifact and produces a complete typed replacement preview. It never changes unrelated artifacts or saves automatically. Acceptance is rejected if the lesson, anchor, parent version or current artifact version changed while the proposal was open.

## Export

Saved lesson artifacts have a browser print view and a PDF route. Export renders the saved canonical version and never calls AI. Restricted artifacts are not exported.

# Step 4B — Academic Operations Backend Completion Notes

Step 4B completes the backend lifecycle and security foundation without adding UI or classroom continuity.

## Migration hardening

`0002_academic_operations.sql` now enforces the timetable lifecycle in PostgreSQL, requires verification metadata before activation, protects active timetable versions and slots, constrains supersession to the same school and academic period, normalizes structural uniqueness, protects tenant and Teaching Section identity, rejects forged actor fields, and removes authenticated DELETE privileges from institutional tables.

All consequential operations use command-controlled actor context and append audit events. SECURITY DEFINER helpers use an empty search path and are not client-callable unless explicitly required for RLS.

## Commands

- `confirm_teaching_section_assignment` permits only the assigned active teacher to confirm or flag a proposed section. Leadership roles cannot impersonate this action.
- `verify_timetable_version` is DOS-only and validates period, slots, confirmed sections, time ranges, tenant composition, and teacher/stream overlaps before stamping the authenticated actor.
- `activate_timetable_version` is DOS-only, retires the prior active version, supersedes only future schedule intent, activates the verified version, generates idempotent local-time occurrences, and audits atomically.
- `find_programme_event_overlaps` returns schedule/event overlap facts only. It never creates classroom outcomes.

## Tests and application boundary

Server-only RPC wrappers live under `src/academic-operations/application`. The isolated integration suite is wired into `vitest.security.config.ts` and uses only `TEST_SUPABASE_URL`, `TEST_SUPABASE_PUBLISHABLE_KEY`, and `TEST_SUPABASE_SERVICE_ROLE_KEY`. It was not run because the migration remains unapplied remotely.

The corrected migration was executed locally in an in-memory PGlite database with minimal auth/storage compatibility stubs. No Supabase, production, or remote SQL was contacted.

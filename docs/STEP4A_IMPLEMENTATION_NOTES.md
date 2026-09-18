# Step 4A — Academic Operations Data Model Notes

Step 4A establishes the relational and deterministic domain foundation for Academic Operations. It does not implement timetable activation, classroom continuity, curriculum binding, or UI workflows.

## Included

- `drizzle/0002_academic_operations.sql` adds tenant-safe class levels, streams, operational subjects, Teaching Sections, timetable versions/slots, scheduled lesson intent, programme events, and event targets.
- Composite foreign keys prevent cross-school references and ensure streams, sections, timetable records, and programme targets remain tenant-consistent.
- Database checks constrain lifecycle states, ISO weekdays, time ranges, target cardinality, and schedule-intent states.
- RLS is enabled on every new school-owned table. Teachers are scoped to assigned sections/schedules, HOD access is department-bound, DOS owns timetable/programme mutation, and Principal access is read/assurance-oriented.
- Active timetable versions and their slots are protected from in-place mutation. Scheduled lesson identity is append/history-oriented and contains no classroom outcome state.
- `src/academic-operations` contains Zod contracts, command schemas, authorization predicates, and deterministic validators/tests.

## Deferred by design

- Timetable verification/activation transactions and scheduled-lesson generation.
- Teaching Section confirmation commands with transactional audit.
- Classroom continuity events and teacher-confirmed outcomes.
- Curriculum/Academic Knowledge profile binding, lesson preparation, assessment, leadership surfaces, and UI.

The migration has been reviewed locally but has not been applied to Supabase, `ATE_Security_Test`, or any remote database.

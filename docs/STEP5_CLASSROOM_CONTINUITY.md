# Step 5: Classroom Continuity

Step 5 records the difference between timetable intent and classroom reality. A scheduled lesson means only that teaching was expected. A teacher's explicit confirmation creates the immutable evidence used to project operational continuity.

## Event semantics

`classroom_events` stores one of four compact outcomes: `DELIVERED`, `PARTIALLY_DELIVERED`, `NOT_DELIVERED`, or `CHANGED`. `UNCONFIRMED` is never stored. It is derived when a scheduled lesson has ended in the school's database clock and has no effective event. Programme overlap remains context and cannot create an event.

Events carry the school, scheduled lesson, Teaching Section, actor membership, optional reason/note, and server-derived evidence timestamps. The browser cannot choose `occurred_at`; the database clock records the event. The scheduled lesson remains unchanged as schedule intent.

## Authority and immutability

Only an active teacher membership assigned to the Teaching Section can call `confirm_classroom_outcome` or `correct_classroom_outcome`. Additive roles do not weaken this rule: a teacher who is also HOD can confirm their own lesson, while HOD, DOS, Principal and SCHOOL_ADMIN cannot confirm another teacher's lesson merely because of their role.

Authenticated clients have no table write privilege. The RPCs derive the actor from `auth.uid()`, verify active membership and the TEACHER grant, check tenant and assignment consistency, and append the event. RLS helper execution is explicitly granted only to `authenticated`; other private helpers remain private. Database triggers reject UPDATE and DELETE, including through the normal application service role. The old record remains available after correction.

## Correction model

A correction must name the current effective event. The command locks the scheduled lesson, verifies that the referenced event is still current, and appends a new event that supersedes it. Composite self-reference, one-root-per-lesson and one-successor-per-event constraints prevent cross-lesson links and competing chains. A superseded event cannot be corrected directly, so each lesson has one deterministic effective outcome.

## Projection and carry-forward

`get_classroom_continuity` is a deterministic read model. It returns schedule identity, the school's IANA timezone, local-day information, effective outcome, confirmation metadata, and two separate state concepts.

The lesson's own `lesson_state` is one of:

- `SCHEDULED` — the lesson is in the future and has no event;
- `UNCONFIRMED` — the scheduled end has passed with no event;
- `CLEAR` — delivered;
- `PARTIAL_CARRY_FORWARD` — this lesson was partially delivered;
- `NOT_DELIVERED_CARRY_FORWARD` — this lesson was not delivered;
- `CHANGED_REVIEW` — changed from the timetable.

The nullable `carry_forward_state` belongs to the next scheduled lesson and is derived from the immediately preceding effective event in the same Teaching Section. `previous_lesson_id` identifies that source lesson. `PARTIALLY_DELIVERED`, `NOT_DELIVERED`, and `CHANGED` produce the corresponding carry-forward state; delivered and unconfirmed do not.

The projection also returns `can_confirm` and `can_correct`. Both require an ended scheduled lesson, ownership of the Teaching Section, and an active TEACHER role. `can_confirm` requires no effective event; `can_correct` requires one. Leadership users who do not own the lesson receive neither capability, even when they have HOD, DOS, or Principal access.

Carry-forward is an operational prompt only. ATE does not infer curriculum position, learning, recovery plans, timetable changes, or teacher performance.

## UI and role views

Teachers use `/workspace/classroom` to see their lessons, record the outcome in seconds, and access a visually secondary correction path that becomes available from `can_correct` after confirmation. Source lessons say what happened to that lesson; the next lesson separately shows “Continuity from previous lesson.” Partially delivered, not delivered, and changed outcomes reveal only the extra context needed. HOD sees department-scoped exceptions; DOS and Principal see school-scoped operational exceptions. Routine scheduled/clear lessons are omitted from leadership views, which remain read-only.

Teacher-facing times and dates are formatted with the returned school timezone, never the browser's local timezone. Classroom navigation is shown only to TEACHER, HOD, DOS, or Principal roles; SCHOOL_ADMIN alone does not receive a meaningless destination.

The page is mobile-first at 360/390/430px and becomes a wider reading surface on desktop. It uses the existing ATE navy, clear blue, quiet borders, and restrained attention states. There are no rankings, completion scores, curriculum claims, or AI dependencies.

## Testing

The domain tests prove temporal projection and required context. The live Supabase suite should be run after `0006_classroom_continuity.sql` is externally applied to the isolated test project, covering anonymous/cross-tenant denial, authorized SELECT helper execution, assigned-teacher authority, additive Teacher+HOD authority, immutable events for authenticated and service-role application clients, one-root/one-successor chain constraints, correction chains, role-scoped reads, timezone-aware day state, source versus next-lesson carry-forward, programme-overlap non-inference, and the unchanged schedule-intent record.

`0006` is intentionally left unapplied by this implementation and production Supabase is not touched.

# Step 5: Classroom Continuity

Step 5 records the difference between timetable intent and classroom reality. A scheduled lesson means only that teaching was expected. A teacher's explicit confirmation creates the immutable evidence used to project operational continuity.

## Event semantics

`classroom_events` stores one of four compact outcomes: `DELIVERED`, `PARTIALLY_DELIVERED`, `NOT_DELIVERED`, or `CHANGED`. `UNCONFIRMED` is never stored. It is derived when a scheduled lesson has ended in the school's database clock and has no effective event. Programme overlap remains context and cannot create an event.

Events carry the school, scheduled lesson, Teaching Section, actor membership, optional reason/note, occurrence time, creation time, and an optional `supersedes_event_id`. The scheduled lesson remains unchanged as schedule intent.

## Authority and immutability

Only an active teacher membership assigned to the Teaching Section can call `confirm_classroom_outcome` or `correct_classroom_outcome`. Additive roles do not weaken this rule: a teacher who is also HOD can confirm their own lesson, while HOD, DOS, Principal and SCHOOL_ADMIN cannot confirm another teacher's lesson merely because of their role.

Authenticated clients have no table write privilege. The RPCs derive the actor from `auth.uid()`, verify active membership and the TEACHER grant, check tenant and assignment consistency, and append the event. Database triggers reject UPDATE and DELETE. The old record remains available after correction.

## Correction model

A correction must name the current effective event. The command locks the scheduled lesson, verifies that the referenced event is still current, and appends a new event that supersedes it. A superseded event cannot be corrected directly, so each lesson has one deterministic effective outcome.

## Projection and carry-forward

`get_classroom_continuity` is a deterministic read model. It returns schedule identity, local-day information from the school's timezone, effective outcome, confirmation metadata, and one of:

- `SCHEDULED` — the lesson is in the future and has no event;
- `UNCONFIRMED` — the scheduled end has passed with no event;
- `CLEAR` — delivered;
- `PARTIAL_CARRY_FORWARD` — partially delivered;
- `NOT_DELIVERED_CARRY_FORWARD` — not delivered;
- `CHANGED_REVIEW` — changed from the timetable.

Carry-forward is an operational prompt only. ATE does not infer curriculum position, learning, recovery plans, timetable changes, or teacher performance.

## UI and role views

Teachers use `/workspace/classroom` to see their lessons, record the outcome in seconds, and access a visually secondary correction path. Partially delivered, not delivered, and changed outcomes reveal only the extra context needed. HOD sees department-scoped exceptions; DOS and Principal see school-scoped operational continuity. Those leadership views are read-only.

The page is mobile-first at 360/390/430px and becomes a wider reading surface on desktop. It uses the existing ATE navy, clear blue, quiet borders, and restrained attention states. There are no rankings, completion scores, curriculum claims, or AI dependencies.

## Testing

The domain tests prove temporal projection and required context. The live Supabase suite should be run after `0006_classroom_continuity.sql` is externally applied to the isolated test project, covering anonymous/cross-tenant denial, assigned-teacher authority, additive Teacher+HOD authority, immutable events, competing outcomes, correction chains, role-scoped reads, timezone-aware day state, and the unchanged schedule-intent record.

`0006` is intentionally left unapplied by this implementation and production Supabase is not touched.

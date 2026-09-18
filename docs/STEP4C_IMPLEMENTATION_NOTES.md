# Step 4C — Academic Operations UI Notes

Step 4C adds the minimal authenticated operational workspace on top of the Step 4 backend. It does not implement Step 5 classroom continuity or curriculum runtime features.

## Backend prerequisite

`drizzle/0004_teacher_assignment_directory.sql` adds `public.list_assignable_teachers(uuid)`. It is a narrow authenticated RPC for DOS and SCHOOL_ADMIN assignment forms. It returns only `membership_id` and `display_name` for active memberships with an active TEACHER grant. The UI never queries the memberships table broadly.

## Surfaces and route

- `/workspace/academic-operations` — authenticated role-aware workspace containing Overview, Academic setup, Teaching Sections, Timetable and Programme surfaces.
- Academic setup — SCHOOL_ADMIN only for class levels, streams and school subjects with department association and lifecycle status controls.
- Teaching Sections — DOS/SCHOOL_ADMIN may propose assignments; teachers see their RLS-scoped sections and can confirm or flag their own proposed section through the existing command.
- Timetable — DOS/SCHOOL_ADMIN can create drafts, add slots, verify, activate and inspect generated scheduled lesson intent. Verified/active versions are not editable in the UI.
- Programme — DOS/SCHOOL_ADMIN can schedule and cancel school programme events. The UI describes overlaps as programme/schedule facts only.

## UX and authorization decisions

- The workspace is a single operational surface with progressive tabs rather than a collection of fragmented routes.
- Navigation is only exposed in an authenticated workspace context; backend RLS/RPC authorization remains authoritative.
- Identity fields are explicit in Teaching Section creation and are not editable after creation.
- Status uses text plus restrained colour so state is not colour-only.
- Empty states explain the next operational action.

## Responsive behaviour

The layout uses dense tables on desktop with horizontal table scrolling where necessary. Forms collapse to one column on narrow screens, and the teacher confirmation actions remain available in the Teaching Sections table at mobile widths.

## Verification and deferred work

The UI uses server actions and the authenticated Supabase server client. No service-role key is exposed. Step 5 classroom outcomes, continuity, current curriculum position, Teacher Home, Academic Knowledge binding, assessments, analytics and AI workflows remain deferred.

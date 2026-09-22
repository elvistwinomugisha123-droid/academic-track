# ATE product acceptance matrix

Validation target: isolated TEST Supabase project `lwbkxhimqlfuzzxilaga`. No production Supabase project was used.

`PASS_WITH_LIMITATION` means the workflow is proven but a stated external or optional-dependency scenario remains un-injected. `NOT_PROVEN` means the required live proof is not complete.

| Role | Route | Workflow | Evidence | Status |
|---|---|---|---|---|
| Public | `/sign-in` | Load form; show/hide password; required controls | Playwright passed; 390×844 and 1440×900 screenshots inspected; no overflow; Impeccable returned `[]` at both widths | PASS |
| Public | `/` | Welcome entry, skip link and navigation | Foundation suite passed at 360, 390, 430, 768, 1280, 1440 and 1600px | PASS |
| Teacher | `/workspace` | Sign in and open Teacher Home | Fresh TEST fixture walkthrough passed; authenticated screenshots captured at 360, 390, 430, 768, 1366 and 1440px; no overflow | PASS |
| Teacher | `/workspace/teacher/sections/[sectionId]` | Review Teaching Section and curriculum position | Fresh TEST walkthrough passed; route opened with curriculum context | PASS_WITH_LIMITATION |
| Teacher | `/workspace/teacher/lessons/[lessonId]` | Readiness, Lesson Plan, Teaching Pack and preparation save | Fresh walkthrough passed tabs and save; readiness screenshots captured at 390×844 and 1440×900; no overflow | PASS |
| Teacher | `/workspace/teacher/lessons/[lessonId]` | Classroom outcome and continuity mutation | Fresh ended unconfirmed lesson; browser recorded partial delivery and verified carry-forward feedback | PASS |
| Teacher | `/workspace/teacher/assessments` | Assessment Studio entry and governed scope setup | Fresh synthetic assessment fixture; real browser form completed | PASS |
| Teacher / DOS | `/workspace/teacher/assessments/[assessmentId]`, `/workspace/leadership/assessments/[assessmentId]` | Manual question authoring, save, review return, resubmission and approval/finalisation | Fresh synthetic fixture: teacher submitted; DOS opened read-only review, returned with a reason; teacher resubmitted; DOS approved and finalised | PASS |
| Teacher | `/api/teacher/assessments/[assessmentId]/pdf` | Question paper and marking guide export | Both authenticated routes returned HTTP 200, `application/pdf`, and non-empty bodies | PASS |
| Teacher | Ask ATE / lesson AI | AI unavailable or rights-blocked degradation preserves manual authoring | Browser proved visible rights-blocked/unavailable feedback; manual authoring remained available; provider-network outage was not injected | PASS_WITH_LIMITATION |
| HOD | `/workspace/leadership/hod` | Department Pulse, attention and role scope | Real TEST sign-in passed; authenticated 1440×900 screenshot inspected; no overflow | PASS |
| DOS | `/workspace/leadership/dos` | Academic Operations visibility | Real TEST sign-in passed; authenticated 1440×900 screenshot inspected; no overflow | PASS |
| DOS | `/workspace/academic-operations` | Programme create → refresh → cancel | Real browser scheduled an event, reloaded the view, located it and cancelled it | PASS |
| Principal | `/workspace/leadership/principal` | Academic Assurance and role limitations | Real TEST sign-in passed; verify/activate controls absent; authenticated 1440×900 screenshot inspected | PASS |
| Auth | `/workspace/*` | Direct URL without a session | Route-preserving redirect to sign-in passed | PASS |
| Auth | Authenticated shell | Sign out | Teacher walkthrough returned to sign-in after banner sign-out | PASS |
| Auth | `/session-expired`, `/access-denied`, `/no-membership`, `/not-found`, `/error` | Human-readable recovery states | Playwright visited session-expired, access-denied, no-membership and not-found states and verified the safe next action; route-level error boundary remains exercised only through source/runtime checks | PASS_WITH_LIMITATION |
| Leadership | `/workspace/leadership/assessments/[assessmentId]` | HOD/DOS review and approve/return | Fresh synthetic fixture proved submitted review, read-only content, return reason, resubmission and DOS approval | PASS |
| Teacher | Lesson artifact PDF routes | Formal lesson/teaching-pack export | Fresh teacher walkthrough saved Formal Lesson Plan, created Teaching Pack material, and verified HTTP 200 `application/pdf` with non-empty body | PASS |
| Dependency failure | Readiness / workspace routes | Database readiness and graceful degradation | Normal `npm run dev:check` passes against TEST; a controlled invalid TEST `DATABASE_URL` returned the expected connectivity/migration failure without a false PASS. Full in-browser database outage injection was not performed | PASS_WITH_LIMITATION |

## Gate evidence

- `npm run dev:check` — PASS: public Supabase config, isolated TEST target, Supabase connectivity, database connectivity, required tables and Auth configuration. AI key is `OPTIONAL UNAVAILABLE`.
- `npm run typecheck` — PASS in the final product gate.
- `npm run lint` — PASS in the final product gate.
- `npm test` — PASS in the final product gate: 26 files, 97 tests, 1 skipped.
- `npm run build` — PASS in the final product gate.
- `npm audit --audit-level=high` — PASS: 0 vulnerabilities in the final product gate.
- `git diff --check` — PASS with line-ending warnings only in the final product gate.
- `npm run validate:product` — PASS end-to-end.
- `npm run validate:ui` — NOT CLEAN on the latest full run: 10 passed, 5 failed after 14m. The remaining failures were caused by the isolated TEST Supabase REST/auth endpoints timing out (`TypeError: fetch failed` / password-token timeout), not by a production configuration change. The browser harness now uses fresh UI sign-in per flow and bounded read retries; rerun after TEST Supabase recovers.
- `npx impeccable detect --json src/` — PASS: `[]`.
- Running-app sign-in Impeccable scans — PASS: `[]` at 390×844 and 1440×900.
- Final direct URL-mode Impeccable scans — PASS: `[]` at a fresh production server on 390×900 and 1440×900, using the installed Playwright Chromium executable. The 390×844 invocation intermittently returned a detector-level `net::ERR_ABORTED`; Playwright’s required 390×844 visual/browser checks remained green.
- Authenticated visual evidence — Playwright passed overflow checks at 360, 390, 430, 768, 1366 and 1440px; core screenshots were visually inspected.

## Fixture

`npx tsx scripts/test-product-fixture.ts` creates a fresh TEST-only school and temporary role accounts. `npx tsx scripts/assessment-test-fixture.ts` creates a separate synthetic, export-enabled assessment school with unique identifiers per run. Credentials are written only to ignored local artifacts/terminal output and are not included here.

## Remaining exact blockers / limitations

1. The full 15-test browser suite is not repeatably green: the latest run was 10/15 because TEST Supabase REST/auth requests timed out. This needs one clean repeatable run after the TEST project is responsive before release sign-off.
2. Provider-network-outage injection and full in-browser database outage injection were not run. The deterministic readiness check fails closed under an invalid TEST `DATABASE_URL`, and visible AI-unavailable/rights-limited degradation paths are proven.

These are proof gaps, not known production application exceptions. Production Supabase was untouched.

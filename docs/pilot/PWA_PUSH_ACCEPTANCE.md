# PWA and Push acceptance

**Status date:** 3 October 2026

**Gate:** Gate 5 — PWA and Notifications Ready

**Current decision:** **BLOCKED_BY_EXTERNAL_ACTION**

## What existed before this workstream

- Authenticated Next.js workspace routes and middleware already redirected unauthenticated users to sign-in and returned them to the requested route.
- School timezone, timetable-driven scheduled lessons, teacher membership, classroom outcome history and carry-forward state already existed as deterministic inputs.
- Generic application error/session-expiry states and transient server-read retry existed.
- No web manifest, icon set, service worker, install/update flow, push subscription model, preferences, delivery history, scheduler, VAPID transport or physical-device evidence existed.

## Implemented foundation

### PWA

- Next.js web manifest with the ATE identity, `/workspace` authenticated start URL, root scope, standalone display, restrained ATE colours and scalable `any`/`maskable` SVG icons.
- A service worker that caches only the public offline page and public icons. It deliberately does not cache authenticated workspace responses or institutional data.
- Network-first navigation with an honest offline fallback. The fallback states that no school record was changed and does not claim offline sync.
- Client registration, online/offline status, waiting-worker detection and an explicit user-controlled update action.
- Notification-click routing restricted to internal `/workspace` deep links; middleware remains responsible for authentication and post-sign-in return.

### Push notifications

- Tenant-scoped preferences, multiple-device subscriptions and durable delivery history with RLS.
- Explicit opt-in master preference plus morning brief, upcoming lesson, recovery and missing-record preferences.
- School-timezone scheduling and stable per-device idempotency keys.
- A deterministic scheduler using scheduled lessons and teacher-confirmed classroom events only; no AI participates in eligibility.
- Privacy-bounded payloads containing only subject, class/stream, time-sensitive action and the existence of unfinished work.
- Missing-record reminders bounded to one reminder per lesson within 24 hours.
- At most one upcoming and one recovery alert per lesson/device, and one morning brief per local day/device.
- Standards-based VAPID Web Push transport, retryable failure handling and automatic expiry on HTTP 404/410.
- A protected Vercel cron endpoint scheduled every five minutes.

## Required pilot configuration

1. Apply `drizzle/0038_pwa_push_notifications.sql` to TEST first, run security tests, then apply the reviewed migration to the dedicated pilot project.
2. Run `npm run push:keys` once in a secure operator environment.
3. Store `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` and `CRON_SECRET` as server-only Vercel values.
4. Store the matching `NEXT_PUBLIC_VAPID_PUBLIC_KEY` as the browser-visible public key.
5. Set `VAPID_SUBJECT` to a monitored `mailto:` or HTTPS contact controlled by Bankai.
6. Deploy over the canonical HTTPS pilot URL and ensure Vercel cron is enabled.
7. Run `npm run pilot:check`; PWA/push checks pass configuration only after assets, schema, scheduler and values are all present.

Never reuse TEST credentials or place private VAPID/cron values in Git or `NEXT_PUBLIC_*` variables.

### Migration and recovery note

The migration is additive and does not rewrite existing academic records. Apply it
to TEST before pilot. If deployment must be rolled back after subscriptions or
delivery history exist, disable the cron and notification UI but retain the three
tables for audit/recovery; do not drop delivery history as an ordinary rollback.
Before any live subscription exists, the three new tables and their private helper
functions may be removed through a reviewed reverse migration.

## Automated evidence

| Area | Automated evidence | Status |
|---|---|---|
| Manifest | Name, short name, `/workspace` start URL, `/` scope, standalone mode, theme and icon sizes | IMPLEMENTED |
| Service worker | Public shell only, network-first navigation, honest offline fallback, safe update message | IMPLEMENTED; browser execution pending |
| Preferences | Master/per-type switches, morning time and lead window validation | IMPLEMENTED |
| Persistence | Multiple-device identity, tenant/user RLS and unique delivery idempotency | IMPLEMENTED; live RLS test pending |
| Scheduling | Kampala timezone, morning brief, upcoming, recovery and bounded missing-record logic | IMPLEMENTED |
| Deep links | Encoded lesson links and service-worker allow-list to `/workspace` | IMPLEMENTED |
| Delivery | Insert-before-send, duplicate suppression, bounded retry and expired subscription cleanup | IMPLEMENTED; live push pending |
| Privacy | No curriculum wording, teacher notes, learner data or private artifacts in payload constructors | IMPLEMENTED |

## Physical-device acceptance — not yet performed

These checks are **BLOCKED_BY_EXTERNAL_ACTION** until a configured HTTPS pilot deployment, VAPID keys, applied migration and real devices are available.

The repository uses text-based SVG manifest icons so the Codex PR transport contains
no binary files. Chromium installability accepts SVG manifest icons with
`sizes: "any"`. A production-quality iOS home-screen icon must be added separately
through normal Git as the binary file `public/icons/apple-touch-icon-180.png`,
exactly 180×180 px, and referenced from root metadata after it is visually approved.
That platform-specific asset and its real-device result remain
**BLOCKED_BY_EXTERNAL_ACTION**; no binary placeholder is fabricated here.

### Android / Chrome

- [ ] Install prompt and installed icon/name.
- [ ] Standalone launch and authenticated return to `/workspace`.
- [ ] Permission enablement and subscription persistence.
- [ ] Morning brief receipt.
- [ ] Upcoming/recovery/missing-record receipt according to preferences.
- [ ] Tap opens the exact lesson after authentication where necessary.
- [ ] Close/reopen behaviour.
- [ ] Waiting service-worker update and explicit update action.
- [ ] Temporary network loss, honest offline screen and recovery.

### iPhone / Safari

- [ ] Add to Home Screen and standalone launch.
- [ ] Authentication persistence/return behaviour.
- [ ] Push permission from installed web app.
- [ ] Notification receipt and deep link.
- [ ] Close/reopen and update behaviour.
- [ ] Temporary network loss and recovery.

Record OS/browser versions, device, deployment ID, commit, Supabase ref, local timezone, preference setup, delivery row ID and result without recording endpoint/key material.

## Repository validation record

The manifest/domain/push source files passed focused TypeScript compilation with
the repository's installed TypeScript package. Manifest, preference, timezone,
deep-link, idempotency, provider allow-list, migration-contract and icon assertions
were also exercised directly. `public/sw.js` passed `node --check`, and
`npm run pilot:check` now reports the PWA asset check as PASS while correctly
keeping notification configuration FAIL until schema and deployment values exist.

The full npm lint/test/build suite could not be executed with its locked binaries
in this Codex container because dependency restoration is still blocked by the
registry limitation recorded in `PILOT_ACCEPTANCE_EVIDENCE.md`. A direct Next.js
build reached compilation but stopped on pre-existing missing installed packages
(`@supabase/ssr`, Vercel analytics/speed-insights and `docx`). This is an agent
environment limitation, not Gate 5 acceptance evidence. No rendered application
screenshot or physical-device result is claimed.

## Gate 5 status

Gate 5 has moved from **MISSING** to **IMPLEMENTED_NOT_PROVEN / BLOCKED_BY_EXTERNAL_ACTION**. It is not PASS. Configuration, applied-schema security proof, live scheduler delivery and both physical-device matrices remain required before Gate 5 can pass.

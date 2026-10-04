# Pilot acceptance evidence

## Evidence record — readiness measurement foundation

**Date:** 3 October 2026

**Implementation commit:** `6ca54ae`

**Environment:** repository checkout only; no pilot Supabase, Vercel deployment, private source corpus, production Anthropic credential or physical device was available.

**Decision:** **NOT READY**

### Scope proven in this record

- The expected pilot source inventory has one versioned machine-readable contract with 30 subject/level rows. The inventory carries forward the filenames and classifications that were previously embedded in `build_source_registry.py`; it does not assert that those sources are available or authoritative.
- `knowledge-sources/derived/manifests/source-registry.json` is absent by design. It is gitignored and can only be generated honestly from the protected raw files, their computed checksums and PDF metadata. Git history contains no authoritative registry to restore.
- The committed historical Lower Secondary Biology workbench can prove source identity, extraction, structural-validation-artifact presence and page provenance. It also proves that 26 review items remain open and that permission, endorsement or licence was not inferred.
- The generated readiness matrix covers source identity, extraction, structural validation, provenance, rights, release, binding, runtime, lesson generation, Teaching Pack, Ask ATE and assessment-profile evidence independently for every catalogue row.
- The matrix fails closed: **0 READY, 0 NOT_READY, 30 BLOCKED_BY_EXTERNAL_SOURCE/ACTION** in this checkout. A repository file is never treated as proof of a live release, binding or runtime workflow.
- `npm run pilot:check` emits exact, secret-safe failures and exits non-zero unless every mandatory environment, project, database, schema, Auth, Anthropic, curriculum, binding, PWA, notification and deployment check passes.
- The health evaluator rejects the destructive TEST or any ambiguous Supabase project and does not trust `PILOT_*_CONFIGURED` assertions in place of actual PWA/notification probes.

### Commands and exact results

| Command | Result |
|---|---|
| `python -m py_compile knowledge-tools/build_source_registry.py` | PASS |
| `node node_modules/typescript/bin/tsc --noEmit --strict --skipLibCheck --esModuleInterop --module esnext --moduleResolution bundler --target es2022 --types node src/pilot-readiness/curriculum-matrix.ts src/pilot-readiness/health.ts scripts/curriculum-readiness.ts scripts/pilot-check.ts` | PASS |
| `node node_modules/tsx/dist/cli.mjs scripts/curriculum-readiness.ts` | PASS — generated JSON and Markdown; READY=0, NOT_READY=0, BLOCKED=30 |
| `node node_modules/tsx/dist/cli.mjs scripts/pilot-check.ts` | EXPECTED NOT READY — 12 mandatory checks failed with exact reasons because pilot configuration and the deferred PWA/push implementations are absent |
| Focused matrix assertions executed through `tsx` | PASS — 30 rows, absent-by-design registry, Lower Secondary Biology evidence and rights blocker confirmed |
| Focused health assertions executed through `tsx` | PASS — all-pass probes yield READY; missing configuration yields NOT_READY with exact reasons |
| `git diff --check` | PASS |
| `npm ci --ignore-scripts --prefer-offline --no-audit --no-fund` | ENVIRONMENT WARNING — dependency restoration could not complete because the registry returned HTTP 403 for an uncached Playwright package; the existing `node_modules` had been incomplete |
| `npm run typecheck` | ENVIRONMENT WARNING — after the failed dependency restoration, npm resolved the host TypeScript 6 binary rather than the locked TypeScript 5.9.3 and stopped on the host-only `baseUrl` deprecation; the focused locked-TypeScript command above passed |
| `npm run lint` | ENVIRONMENT WARNING — npm resolved host ESLint 10 instead of locked ESLint 8 and rejected the repository's ESLint 8 configuration |
| `npm test` | ENVIRONMENT WARNING — locked Vitest executable unavailable after dependency restoration failed |
| `npm run build` | ENVIRONMENT WARNING — locked Next.js executable unavailable after dependency restoration failed |

### Exact curriculum blockers

1. The protected raw corpus is absent; 29 of 30 catalogue rows have no committed extraction evidence. The Lower Secondary Biology row is the only row with a committed historical workbench.
2. The generated private source registry and derived corpus are therefore absent. They must be regenerated from the exact supplied files, not fabricated or reconstructed from filenames.
3. The Lower Secondary Biology workbench has 26 open human-review items.
4. Biology and framework source notices reserve rights; no current checksum-bound rights decision permits production, external AI, formal artifact or export use.
5. No pilot database evidence was available for active releases/profiles, school/Teaching Section bindings or PILOT_ACTIVE runtime records.
6. No per-subject successful governed Formal Lesson Plan, Teaching Pack or Ask ATE run was available from the target pilot environment.
7. Applicable assessment profiles could not be proven in the target pilot database.

### External actions required

- Supply the protected source corpus through the approved private workflow and confirm the intended advertised subject catalogue.
- Provide academic source review and checksum-bound rights/use decisions.
- Create/provide secure access to the dedicated pilot Supabase project and expected project ref; apply and attest the migration chain.
- Configure the canonical Vercel pilot deployment, deployment metadata and server-only Anthropic configuration.
- Supply the real school subjects and Teaching Section assignments so required bindings can be measured.
- PWA and notification work remain intentionally unimplemented in this slice; their health checks will remain red until those contracted workstreams are delivered.

### Gate impact

- **Gate 1 — Curriculum Ready: remains FAIL.** Measurement is now reproducible, but no subject is READY and the source/rights/runtime chain is blocked.
- **Gate 2 — Environment and Security Ready: remains FAIL.** The fail-closed health command now exists, but there is no pilot environment evidence and the mandatory check result is NOT READY.
- Gates 3–8 were not changed by this slice.

### Schema and migration impact

No database schema or migration was added. The health check reads the existing schema contract and does not mutate institutional state.

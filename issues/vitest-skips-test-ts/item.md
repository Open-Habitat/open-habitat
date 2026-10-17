---
created: 2026-10-16
updated: 2026-10-17
type: bug
status: fixed
priority: normal
provenance: other
provenance_detail: observed by implementation worker
source_ref: taskfleet:01m52z7w0pyq3yb65rtkvh88xe/observation:vitest-test-ts-include
originating_run: 01m52z7w0pyq3yb65rtkvh88xe
originating_run_kind: spinoff
closed: 2026-10-17
---

# Vitest never runs web *.test.ts files (six suites silently skipped)

## Description

`web/vite.config.ts` sets `test.include: ["src/**/*.test.tsx"]`, so vitest never collects the `*.test.ts` files. Six exist and none run in `npm run test`, `test:unit`, `test:component`, `scripts/test-web-fast.sh` or the clean gate:

- `web/src/app/bashFailure.test.ts`
- `web/src/app/processes.test.ts`
- `web/src/app/spinoffs.test.ts`
- `web/src/app/storageQuota.test.ts`
- `web/src/app/workspaceGit.test.ts`
- `web/src/components/agentPresentation.test.ts`

Observed 2026-10-16 in run `server-version-reload`: a new `bundleRelease.test.ts` printed "No test files found" until it was renamed to `.tsx`. Their assertions (quota validation, process and spinoff parsing, workspace git, bash-failure classification, agent presentation) are therefore unchecked and may already be failing.

Fix: widen the include to `src/**/*.test.{ts,tsx}`, run the suite, and fix or delete whatever has drifted.

## Comments

### 2026-10-17T10:30:00Z · @jari

Closed as fixed by 7802f6e3 (vitest runs `*.test.ts`), Jari's decision 2026-10-17.

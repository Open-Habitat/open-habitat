---
created: 2026-10-29
updated: 2026-10-29
type: chore
status: done
priority: normal
provenance: other
provenance_detail: worker observation
source_ref: taskfleet:01m63gzbxj4f9sdcbjqczrrf5q/observation:web-lint-import-order
originating_run: 01m63gzbxj4f9sdcbjqczrrf5q
originating_run_kind: spinoff
lane: gate-health
lane_seq: 120
preparation: ready
closed: 2026-10-29
---

# Web lint fails on main: unsorted file-offer schema imports

## Description

`npm run lint --prefix web` (part of `scripts/test-web-fast.sh` and `./scripts/test-focused.sh --area web`) fails on origin/main because Biome's import sorting rejects three files: `web/src/app/conversations.ts`, `web/src/app/history.ts` and `web/src/app/spinoffs.ts`. In each, the `file-offer.schema.json` import added by commit ea326a8e ("Agent file offer: the agent hands files to the person in the conversation") sits after `recap`/`process-event` instead of in alphabetical order.

Observed 2026-10-29 on Birch: `npx biome check src/app/conversations.ts src/app/history.ts src/app/spinoffs.ts` in `web/` reports errors; `npx biome check --write` on those files moves only the import line. Every worker's focused web check fails until the import is moved, or the worker silently fixes the files in an unrelated commit.

Fix: run `npx biome check --write src/app/conversations.ts src/app/history.ts src/app/spinoffs.ts` in `web/` and commit the three one-line moves.

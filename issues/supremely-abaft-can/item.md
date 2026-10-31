---
created: 2026-10-31
updated: 2026-10-31
type: bug
status: untriaged
priority: normal
provenance: other
provenance_detail: worker observation
source_ref: taskfleet:01m682p6ssrx933anc4ym4ke2y/observation:server-version-reload-ts2698
originating_run: 01m682p6ssrx933anc4ym4ke2y
originating_run_kind: spinoff
---

# Web typecheck fails on main: server-version-reload spec spreads a non-object

## Description

## Description

On main at 5e9162e8 ("web: after a version change the banner offers reload, not a dead Yhdistä") the web typecheck fails, so `./scripts/test-focused.sh --area web` stops before the unit tests:

```
tests/server-version-reload.spec.ts(179,15): error TS2698: Spread types may only be created from object types.
```

Line 179 spreads `await response.json()` from Playwright's `route.fetch()` response: `json: { ...(await response.json()), newer_release_fact: true }`. The return type does not count as an object type for a spread. Reproduced in a clean detached worktree of main with the locked `web/node_modules` (`npx tsc --noEmit -p web`). Found by the workspace-icon-polish worker, whose change does not touch this file.

## Acceptance Criteria

- [ ] `npx tsc --noEmit -p web` passes on main (for example by casting the parsed body to `Record<string, unknown>` before spreading).

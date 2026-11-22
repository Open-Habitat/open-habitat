---
created: 2026-11-22
updated: 2026-11-22
type: bug
status: untriaged
priority: normal
provenance: other
source_ref: taskfleet:01m824zkytj3q68kszkkqaskfs/observed:picker-after-rename
originating_run: 01m824zkytj3q68kszkkqaskfs
originating_run_kind: spinoff
---

# Workspace sound picker browser journey intermittently fails after rename

## Description

## Observed failure

The existing attention-sound browser journey intermittently fails to open the workspace sound picker immediately after renaming a workspace. It clicks `strip-sound`, then times out waiting for `strip-sound-picker` at `web/tests/attention-sound.spec.ts:116`.

Reproduced twice in six repeats against an unchanged archive of main commit `ae56fcc9945990dbb4c17db829e51239614c0378`, using two browser workers and 60 ms response jitter. The same failure occurred once in three repeats while implementing the independent Sounds settings status list. No workspace strip or rename behavior was changed.

## Impact and scope

This makes the focused attention-sound check unreliable. It may be a test synchronization gap around the first rename's durable workspace identity, or a picker lifetime defect; the cause has not been established. Do not assume a user-visible failure from this evidence alone.

## Reproduction

Install the documented fixture dependencies, then run from web under the normal scratch lease and a timeout:

`OH_BROWSER_WORKERS=2 OH_REPLY_DELAY_MS=60 npx playwright test tests/attention-sound.spec.ts --grep 'off, nothing shows' --repeat-each 6`

Investigate the rename response/event/route transition and picker lifetime before changing waits. No failing assertion was removed or relaxed.

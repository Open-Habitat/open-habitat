---
created: 2026-10-28
updated: 2026-10-28
type: bug
status: open
priority: low
provenance: other
provenance_detail: whole default browser suite run by a spinoff worker
source_ref: taskfleet:01m60r1fawvv8rgv07ztqxm9xm/site-ai-key-load-timeout
originating_run: 01m60r1fawvv8rgv07ztqxm9xm
originating_run_kind: spinoff
lane: gate-health
lane_seq: 104
preparation: ready
---

# site-ai-key admin journey exceeds its 30 s test timeout under suite load

## Description

Observed once in the whole default browser suite on Birch, 2026-10-28 (tree = main db3fbe08 plus test-only lab spec edits; `./scripts/test-focused.sh --area browser`, OH_PORT_BASE=15300, eight workers, load average 14–16 on 8 vCPUs while other workers ran): 425 passed, 1 failed.

`tests/site-ai-key.spec.ts:205` "an administrator gives the key to people who joined earlier, and a new key replaces the copies" hit the 30 s test timeout at line 292 (`expect(getByTestId('access-ai-given-43')).toContainText(...)`, received "", then "session closed" when the test timeout fired).

Alone it passes 3/3 (`--repeat-each 3`, 28.8 s total, about 10 s per case), so under suite load the journey simply runs out of its 30 s budget. The previous whole-suite run on the same tree passed this case. A fix would shorten the journey or split it, rather than raise the timeout.

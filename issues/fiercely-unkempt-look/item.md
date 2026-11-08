---
created: 2026-11-08
updated: 2026-11-08
type: bug
status: fixed
priority: normal
provenance: other
source_ref: taskfleet:01m6y0hs793yx5dwshtp42gnxa/observed:rail-running-after-done-48
originating_run: 01m6y0hs793yx5dwshtp42gnxa
originating_run_kind: spinoff
closed: 2026-11-08
---

# rail-running-after-done spec fails on main: finished conversation stays in Sinun

## Description

`web/tests/rail-running-after-done.spec.ts:17` fails on main (f98106995) every
time on Birch, 4 of 4 runs with `OH_BROWSER_WORKERS=2` and an otherwise idle
suite (named spec, `OH_PORT_BASE=13740` and `13840`):

```
> 48 |   await expect(yours.getByTestId(`agent-item-${id}`)).toHaveCount(0);
Expected: 0
Received: 1
```

The finished conversation leaves *Käynnissä* (line 47 passes) but its row
stays in the rail's *Sinun* group (`rail-yours`), which the spec expects it to
leave. Found while running touched specs for `offer-cards-and-assets-list`;
the failure is before any file offer in the spec, and it reproduces on a
clean main worktree, so it is not caused by that work. Either the rail's
grouping changed on purpose and the spec is stale, or a finished
conversation is wrongly kept in *Sinun*.

## Resolution

Fixed by `main-suite-red-r68b` (8.11.2026); closed on Jari's standing approval to close intake reports a landed fix covers.

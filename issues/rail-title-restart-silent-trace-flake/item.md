---
created: 2026-11-22
updated: 2026-11-22
type: bug
reporter: conductor
status: fixed
priority: normal
provenance: other
provenance_detail: clean gate
source_ref: gate:eb144fe72/rail-title-restart
lane: unlaned
preparation: ready
closed: 2026-11-22
---

# Gate flake: rail-title-restart misses the silent-stream trace under suite load

## Description

The clean gate on main eb144fe72 (22.11.2026, full ordinary suite 733
passed) failed one case: tests/rail-title-restart.spec.ts:54 "the rail converges
to the daemon's title and ball when the stream went silent across a restart",
at line 90: expected a trace entry {event: "stream", outcome: "silent"}, none
recorded. The same spec passes 3/3 alone on the same tree. Timing-sensitive
under whole-suite load; it blocks the gate receipt.
Gate logs: /var/tmp/agent-scratch/gate-20261122-1631/oh/.git/open-habitat-gate-failure/browser-ordinary.log

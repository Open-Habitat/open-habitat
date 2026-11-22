---
created: 2026-11-22
updated: 2026-11-22
type: improvement
reporter: jari
status: done
priority: normal
provenance: chat
source_ref: habitat:pi-current/2026-11-22-rail-graduate
lane: rail-space
lane_seq: 3
preparation: ready
closed: 2026-11-22
---

# Graduate the adaptive rail to the default

## Description

Jari (22.11.2026): graduate the adaptive rail (rail-adaptive-impl, experimental 'adaptive-rail') to the default rail: remove the switch and the old rail path, keep coverage.

## Acceptance Criteria

- [x] Desktop uses adaptive allocation without its experimental switch; phone and collapsed navigation stay supported.
- [x] Concurrent sound/instructions graduations remain intact; UI references regenerated.
- [x] Web checks and all touched rail/settings specs pass; evidence and review are in result.md.

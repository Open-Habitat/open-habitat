---
created: 2026-11-22
updated: 2026-11-22
type: improvement
reporter: jari
status: done
priority: normal
provenance: chat
source_ref: habitat:pi-current/2026-11-22-all-reasons
lane: attention-night
lane_seq: 3
preparation: ready
closed: 2026-11-22
---

# Sounds status line lists every active silencing reason

## Description

Implement Jari's choice B in attention-sound-night-visible round 2 (22.11.2026): the Sounds top status line lists every active silencing reason with its own permanent fix; no 'Kuuntelu toimii silti' on the off line.

## Acceptance Criteria

- [x] Every active reason has an independent permanent fix, covered by unit and browser checks.
- [x] The complete attention-sound browser spec passes 15 repetitions without retries; see result.md.

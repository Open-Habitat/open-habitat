---
created: 2026-11-22
updated: 2026-11-22
type: improvement
reporter: jari
status: done
priority: normal
provenance: chat
source_ref: habitat:pi-current/2026-11-22-graduate-sounds-instructions
lane: attention-night
lane_seq: 4
blocked_by: ['@attention-sound-status-all-reasons']
preparation: ready
closed: 2026-11-22
---

# Graduate attention sounds and agent instructions to ordinary features

## Description

Jari (22.11.2026): graduate the experimental features 'attention-sound' (Äänet) and 'agent-instructions' (Ohjeet agentille) to ordinary features: remove their switches, keep their behaviour and coverage.

## Acceptance Criteria

- [x] Both features work without experimental opt-in; their switches and gates are removed.
- [x] Sound choices, clock-night quiet, status fixes and concurrent instructions editing keep their behavior.
- [x] Defaults and review are recorded in result.md; web, focused browser repetitions and daemon checks pass.

## Tests Run

See [result.md](result.md) for commands, counts, synthetic evidence and remaining live checks.

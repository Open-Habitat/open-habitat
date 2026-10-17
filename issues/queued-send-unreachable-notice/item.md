---
created: 2026-10-17
updated: 2026-10-17
type: bug
reporter: jari
status: fixed
priority: high
lane: web
collision: [web/src/app/, web/src/components/]
preparation: ready
closed: 2026-10-17
---

# While a queued message waits for Pi, the view says Pi cannot be reached

Jari, 2026-10-17 ~06.50 local on pilot.206 (`d2e2850`): queued send works in an old conversation and in a new one, but while the message waited for Pi to start, a warning/status like "Pi:hin ei saada yhteyttä" showed below. Pi starting on send is the normal path now (ADR 0020, `proto-queued-send` Decisions: no state text anywhere while waiting; the dashed bubble is enough). Hide every Pi-unreachable / not-running notice while a held message waits for the start; show a failure only when the start actually failed (then the bubble's own "Ei lähtenyt" with retry).

## Acceptance Criteria
- [ ] No unreachable or not-running notice while a held message waits; a real start failure still shows (browser tests for both).

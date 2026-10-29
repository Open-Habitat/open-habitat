---
created: 2026-10-29
updated: 2026-10-29
type: bug
reporter: jari
status: open
priority: normal
lane: unlaned
lane_seq: 7
preparation: ready
---

# Recap fails with 'Malli ei vastannut ajoissa'

_Source: chat_

## Description

Jari 29.10. 18.23 (screenshot `attachments/recap-timeout.png`): the Tilannekatsaus card shows "Pyydä lyhyt katsaus ennen kuin jatkat." and in red "Katsausta ei voitu luoda. Malli ei vastannut ajoissa. Yritä uudelleen." (`model_timeout`, `internal/daemon/recap-extension.mjs`). Most likely on Birch (pilot.14) or the test server (main with the new recap settings); find out.

## Acceptance Criteria

- [ ] Cause found from native evidence (recap reports, Pi session of the background run, which model was picked and how long it took, the abort deadline): too short a deadline, a slow or reasoning background model, a provider stall, or the new response/context limits.
- [ ] Fixed so a normal conversation gets its recap; a real timeout retries once or says plainly what to do; the empty-state sentence is not shown next to an error.
- [ ] Regression test; KOKEILTAVAA line.

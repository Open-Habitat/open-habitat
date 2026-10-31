---
created: 2026-10-31
updated: 2026-10-31
type: feature
reporter: jari
status: done
priority: normal
lane: next-waiting-on-send
lane_seq: 1
preparation: ready
closed: 2026-10-31
---

# Next-waiting row appears on the person's send (direction Vuoron loppuun)

## Description

Jari 31.10. chose direction **Vuoron loppuun** from `proto-next-waiting-states` round 2 (`prototypes/tilakoneet-2.html`, `result.md` round 2 is the spec). The row appears when the host accepts the person's send in this conversation; while open it follows Sinun vuorosi minus this conversation live; it closes when this agent finishes or asks, the send fails, the person leaves or reloads. Jari did not answer the two round-2 questions; the conductor's recommendations apply: (a) a row closed because nobody else waited reopens if someone starts waiting during the same turn; (b) after *Avaa seuraava* the next conversation shows no row until the person sends there. The round replaces the remaining round-1 defects (read counts as handled; the round bar follows outside the round): remove what the new model no longer needs. Stays inside the experimental `next-waiting-row` feature.

## Acceptance Criteria

- [x] Behaviour as the round-2 Vuoron loppuun graph; browser specs for appear-on-send, live update, each close event, (a) and (b).
- [x] KOKEILTAVAA line.

## Comments

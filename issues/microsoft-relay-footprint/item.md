---
created: 2026-11-21
updated: 2026-11-21
type: improvement
reporter: conductor
status: done
priority: normal
related: ['@microsoft-single-process-per-person']
lane: microsoft
lane_seq: 2
preparation: ready
closed: 2026-11-21
commits:
- hash: 1ed6f8b6
  summary: keep Microsoft relays out of the product heap
---

# Minimal Microsoft relay binary instead of the whole product binary

## Goal

The Microsoft area relays (one per area per open conversation) run the whole product binary: about 22 MiB RSS / 11 MiB PSS each, 428 MiB RSS for twenty relays at four conversations, while the shared Microsoft process itself is 128 MiB (measured 21.11.2026, `microsoft-single-process-per-person` result). A minimal relay binary measured 4.8 MiB RSS and would save about 350 MiB RSS at four conversations. Jari's goal for this work is memory per person.

## Decisions

- Conductor 21.11.2026, within Jari's agreed memory goal: ship a minimal relay binary in the release (or trim the product binary's package initialisation if that reaches the same footprint more simply).

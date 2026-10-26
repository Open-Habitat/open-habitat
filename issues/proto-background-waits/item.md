---
created: 2026-10-25
updated: 2026-10-26
type: improvement
reporter: jari
status: open
priority: normal
lane: proto-waits
lane_seq: 1
preparation: pending
---

# Prototype how an agent's background waits on its workers are shown

## Description

Jari, 2026-10-25, on the first conductor session run inside Habitat on Birch:
"agentit näkyvät omina tageina mutta myös sun odotusprossit kanssa. Pitäisikö
... nämä taskfleet wait prosessit piilotetaan. Mutta toisaalta miten taas näemme
jos agentti ei käynnistä niitä." (The spinoff chip shows the worker runs, and
the terminal chip also counts the conductor's `taskfleet run wait` background
processes. Should those be hidden? But then how would we see when the agent
fails to start one?)

Also observed: the test-release watcher's `wait` exits 3 for
`skipped_no_product_change`, which the conversation shows in red as
"kaatui · koodi 3" although nothing failed.

Conductor's suggestion: do not hide the waits; show a wait on the run it
waits for (spinoff chip: "odotetaan" / "ei odotusta"), so a missing wait is
visible as such, and keep other background processes as terminals.

## Acceptance Criteria

- [ ] Prototype variants with notes, and Jari's verdict recorded.

## Decisions

### 2026-10-26T09:31:11Z · @jari

Jari 2026-10-26: as recommended — direction 3's dots on the worker chip with direction 2's neutral exit codes. Implementation: background-wait-chip-dots.

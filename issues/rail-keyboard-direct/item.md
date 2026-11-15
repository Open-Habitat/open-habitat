---
created: 2026-11-15
updated: 2026-11-15
type: feature
reporter: jari
status: done
priority: normal
provenance: chat
source_ref: chat:2026-11-15/rail-keyboard-direct
lane: rail-keyboard-impl
lane_seq: 1
collision: [web/src/app/NextWaitingDock.tsx]
preparation: ready
closed: 2026-11-15
---

# Alt+Up/Down moves through every conversation in the rail

## Description

Jari 15.11.2026, on prototype round 1 of `proto-rail-keyboard-navigation`
(`design-system/prototypes/rounds/2026-11-15-rail-keyboard/`): implement
direction 1 **Suoraan** — Alt/⌥+↑/↓ opens the previous/next conversation at
once, focus stays in the composer — stepping through **every** conversation
in the rail's visible order: Sinun vuorosi, Käynnissä and Hiljaiset.
Alt/⌥+Shift+↓/↑ goes to the next/previous conversation waiting for the
person (the existing "next waiting" key moves there, as in the round).

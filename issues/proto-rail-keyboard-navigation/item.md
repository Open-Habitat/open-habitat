---
created: 2026-11-15
updated: 2026-11-15
type: feature
reporter: jari
status: open
priority: normal
provenance: chat
source_ref: chat:2026-11-15/rail-keyboard-nav
lane: rail-keyboard-proto
lane_seq: 1
preparation: pending
---

# Keyboard shortcut to move between conversations in the rail

## Description

Jari 15.11.2026: there is no keyboard shortcut to move up and down the
conversations in the left rail and switch to the previous/next one. It cannot
be the browser's tab shortcuts, but something should exist. Jari wants
prototypes of what the shortcut actually is.

## Decisions

### 2026-11-15T16:22:40Z · @jari

Jari 15.11.2026: implement direction 1 Suoraan (Alt/⌥+Up/Down opens the previous/next conversation at once), but it steps through every conversation in the rail: Sinun vuorosi, Käynnissä and Hiljaiset too. Implementation is issue rail-keyboard-direct. The ⌘K/Ctrl+K switcher (direction 2) is wanted as well: next prototype round riffs on it, with a real full-text search across all agent conversations.

### 2026-11-15T17:24:56Z · @jari

Jari 15.11.2026 on round 2: direction 1 Lista. The way results are presented is still confusing (conversations at the top, message hits as separate lists below); riff in round 3 on how results are presented in the list.

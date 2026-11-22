---
created: 2026-11-22
updated: 2026-11-22
type: improvement
reporter: jari
status: open
priority: normal
provenance: chat
source_ref: habitat:pi-current/2026-11-22-rail-icons
lane: server-browser-entry
lane_seq: 2
blocked_by: ['@server-browser-entry-points']
preparation: pending
---

# Rail: Tuotokset and Oma selain share an icon, and only Oma selain is a bordered card

## Description

Jari (22.11.2026, rail screenshot): in the rail's top block, "Tuotokset" and
"Oma selain" use the same globe icon, so the two look like the same thing.
"Oma selain" is also drawn as a bordered card while Etusivu, Tuotokset and
"Agentin käytössä" are plain rows, so it stands out for no reason.

Next action: give each destination its own distinct icon and one consistent
row treatment. Where "Oma selain" lives and what it shows is being decided in
`server-browser-entry-points`; this follows that verdict, and the rail-space
and whole-UI rounds (`rail-space-small-screens`, `ui-structure-free-round`)
show their icon choice for it.

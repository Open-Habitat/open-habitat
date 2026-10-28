---
created: 2026-10-28
updated: 2026-10-28
type: bug
reporter: jari
status: open
priority: normal
provenance: chat
source_ref: chat:2026-10-28/terminal-panel-stays-after-exit
lane: terminal-panel
preparation: ready
---

# Terminal panel stays open after the shell exits with Ctrl-D

## Description

Jari 2026-10-28 (Birch, pilot.13): kun suljen terminaalin Ctrl-D:llä, se jää näkyviin, ja laatikko pitää sulkea erikseen. Kun pääteistunto päättyy (shell exit), paneelin pitää sulkeutua itse (tai tarjota selkeä tila ja sulkeminen yhdellä painalluksella), eikä jättää kuollutta päätettä auki.

## Acceptance Criteria

- [ ] Ctrl-D/exit sulkee paneelin; selaintesti

---
created: 2026-11-07
updated: 2026-11-07
type: bug
reporter: jari
status: open
priority: normal
preparation: ready
lane: new-reply-chip
lane_seq: 1
---

# Floating “Uusi vastaus (N)” count does not drop while scrolling down slowly

## Description

Jari 7.11.2026 (testipalvelin, pilot.612): keskustelun kelluva
*Uusi vastaus (13)* -siru ei päivity pienempään lukuun, kun keskustelua
vierittää hitaasti alaspäin. Luvun pitäisi pienentyä sitä mukaa kuin uudet
viestit tulevat näkyviin, ja siru poistua, kun viimeinenkin on nähty.

## Acceptance Criteria

- [ ] luku pienenee hitaassa vierityksessä ja siru poistuu lopussa; selaintesti, joka vierittää pienin askelin

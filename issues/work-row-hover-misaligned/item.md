---
created: 2026-10-29
updated: 2026-10-29
type: bug
reporter: jari
status: open
priority: normal
lane: ui-polish
lane_seq: 10
preparation: ready
---

# Collapsed work summary row hover is not aligned on the right

_Source: chat_

## Description

From KOKEILTAVAA.md (test server testing):

Suljetun työ-osion yhteenvetorivin hover-alue ei ole linjassa oikeasta reunasta (Jari 29.10., pilot.511): kun agentin vuoron työ-osio on suljettu ja rivillä lukee esim. *1 työkalu · 3 ajatusta*, hiiren alla näkyvän korostuksen oikea reuna ei ole samassa linjassa muun sisällön (työkalukorttien ja vastauksen) oikean reunan kanssa. Koodi: `web/src/components/AgentTurn.tsx`.

---
created: 2026-10-27
updated: 2026-10-27
type: feature
reporter: jari
status: open
priority: normal
provenance: chat
source_ref: chat:2026-10-27/worker-panel-rivi
lane: worker-panel
lane_seq: 1
collision: [web/src/components/BackgroundStrip.tsx]
preparation: ready
---

# Workerit panel: Rivi direction

## Description

Jari 2026-10-27. Toteutetaan proto-worker-panel-kierroksen suunta 1 Rivi (issues/proto-worker-panel/prototypes/worker-panel, NOTES.md, result.md): kaksirivinen rivi, tila sanoin toisella rivillä (agentti odottaa / agentti ei odota / laskeutui / ei mergetty · työ tallessa / epäonnistui), ajo (Pi/Claude · profiili), toisen repositorion nimi, odotetulla rivillä Lopeta odotus, yläreunan selite pois, rivin nimi avaa workerin näkymän (worker-view-conversation on laskeutunut). Työpöytä ja puhelin, vaalea ja tumma.

## Acceptance Criteria

- [ ] Paneeli vastaa Rivi-suuntaa; selite on poissa; selaintestit kattavat odotetun, odottamattoman ja päättyneen rivin

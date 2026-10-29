---
created: 2026-10-29
updated: 2026-10-29
type: bug
reporter: jari
status: open
priority: normal
lane: worker-presentation
lane_seq: 1
preparation: ready
---

# Unwaited-worker reminder shows raw English to the person

_Source: chat_

## Description

From KOKEILTAVAA.md (test server testing):

Vuoron lopun muistutus odottamattomista workereista näkyy ihmiselle englanninkielisenä *Laajennuksen viesti* -laatikkona (Jari 29.10., pilot.511, kuvakaappaus): agentille tarkoitettu teksti *[Open Habitat] A Taskfleet run you started is still working, and nothing is waiting for it …* piirtyy keskusteluun sellaisenaan. Uudelleenkäynnistyksen ilmoitus on jo muutettu niin, että ihminen näkee hiljaisen suomenkielisen merkinnän ja agentti saa tekstin. Muistutuksen pitäisi esittää samalla tavalla (`agent-wait-turn-end-reminder`, vrt. `restart-notice-presentation`).

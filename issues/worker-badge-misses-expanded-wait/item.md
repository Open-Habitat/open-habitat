---
created: 2026-11-07
updated: 2026-11-07
type: bug
reporter: jari
status: open
priority: normal
preparation: ready
lane: worker-badge-wait
lane_seq: 1
---

# Worker badge says not waited while the agent waits on expanded ids

## Description

Kirjattu testikoneelta (KOKEILTAVAA.md, testiopas 7.11.2026):

Workerin merkki näyttää *ei odoteta*, vaikka agentti odottaa (Jari 7.11., pilot.612): agentti käynnisti spinoffin ja odotti sitä tiedostosta laajennetulla tunnuksella (`taskfleet run wait $(tr '\n' ' ' < active.txt) --any`). Muistutus jäi oikein tulematta, mutta workerin merkki (Workerit-siru / paneelin rivi) näytti katkoviivamerkin, joka tarkoittaa workeria, jota kukaan ei odota. Kun odotus tunnistetaan muistutuksessa, saman tunnistuksen pitää näkyä merkissä: odotettu worker saa odotetun merkin. Jari pyytää samalla miettimään workerien merkistön uudelleen (`wait-reminder-misses-expanded-ids`, `worker-panel-rivi`).

## Acceptance Criteria

- [ ] havainto korjattu; testi rajapinnassa

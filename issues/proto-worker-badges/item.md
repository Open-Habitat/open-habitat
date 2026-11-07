---
created: 2026-11-07
updated: 2026-11-07
type: task
reporter: jari
status: open
priority: normal
preparation: ready
lane: worker-badges-proto
lane_seq: 1
---

# Prototype: the worker badge set (state and whether someone waits)

## Description

Jari 7.11.2026 (testikone, pilot.612): workerin merkki näytti katkoviivamerkin
(*ei odoteta*), vaikka agentti odotti workeria. Jari pyytää samalla miettimään
workerien merkistön uudelleen: mitä merkit (Workerit-siru, paneelin rivi,
sivupalkki) kertovat workerin tilasta ja siitä, odottaako joku sitä, ja miten
ne erottuvat toisistaan. Tunnistusvika korjataan erikseen
(`worker-badge-misses-expanded-wait`). Prototyyppikierros
`AGENTS-WORKFLOW.md`:n mukaan: nykytila ja kolme suuntaa merkistölle.

## Acceptance Criteria

- [ ] kierros 1: nykyinen merkistö, kolme suuntaa, näkymätarjous ja kysymykset Jarille

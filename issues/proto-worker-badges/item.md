---
created: 2026-11-07
updated: 2026-11-08
type: task
reporter: jari
status: done
priority: normal
preparation: pending
lane: worker-badges-proto
lane_seq: 1
closed: 2026-11-08
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

- [x] kierros 1: nykyinen merkistö, kolme suuntaa, näkymätarjous ja kysymykset Jarille

## Decision (Jari 2026-11-08, kierros 1)

**1 Pallot.** Kysymyksiin 2 ja 3 suosituksen mukaan (kapellimestari):
*ei odoteta* on merkin puuttuminen, ja *odottaa sinua* on kaikkialla
sivupalkin keltainen. Lisäksi Jarin toive: prototyypin merkistötaulukko
(mitä kukin merkki tarkoittaa) näkyy myös Selitystilassa (`explain-mode`).
Toteutus: `worker-badges-pallot`.

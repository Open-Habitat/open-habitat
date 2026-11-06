---
created: 2026-11-06
updated: 2026-11-06
type: feature
reporter: jari
status: open
priority: normal
related: ['@design-named-workers']
preparation: ready
provenance: chat
source_ref: chat:2026-11-06/named-workers-in-habitat
lane: named-workers
lane_seq: 2
blocked_by: ['@proto-named-workers']
---

# Named support workers in Habitat (experimental): show and wake, Taskfleet owns them

## Description

Jari 6.11.2026: nimetyt tukiworkerit Habitatiin kokeellisena
ominaisuutena. Suunnitelma ja päätökset: `design-named-workers`
(result.md ja Decision). Taskfleet omistaa nimetyn workerin (kierrokset,
kierrosraportti, jatko samasta istunnosta, `run land`, elinaika); Habitat
vain näyttää ja herättää.

Habitatin osa: daemon lukee Taskfleetin kierrosraportit ja tilat käyttäjänä
itsenään (`spinoffs_linux.go`, `spinoff_activity_linux.go`), näyttää tilat
*tekee kierrosta* / *odottaa* / *lopetettu* oikein (ei "Odottaa vastausta
päätteessä"), herättää pääkeskustelun kierrosraportista kuten nyt workerin
valmistumisesta (`wake_linux.go`), ja esittää workerin
`proto-named-workers`-prototyypin valitun suunnan mukaan (workerien pallo
tai sen viereinen siru). Henkilö ei kirjoita workerille suoraan. Ei uusia
valtuuksia: yhdistäminen ja purku pysyvät Taskfleetillä. Lisäksi
AGENTS-WORKFLOW.md:hen ja worktree-skilleihin ohje siitä, milloin
nimettyä workeria käytetään (luonnos `design-named-workers` result.md).

## Acceptance Criteria

- [ ] nimetty worker näkyy ja herättää pääkeskustelun kokeellisena ominaisuutena; testit daemonin luennasta ja herätyksestä synteettisellä Taskfleet-tilalla

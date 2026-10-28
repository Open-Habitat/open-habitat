---
created: 2026-10-28
updated: 2026-10-28
type: task
reporter: jari
status: open
priority: normal
lane: proto-ended-worker
preparation: pending
provenance: chat
source_ref: chat:2026-10-28/proto-ended-worker-lifecycle
---

# Prototype: what happens to an ended worker that was not merged

Jari 2026-10-28 (testikone, pilot.456, kuvakaappaus liitteenä): päättynyt worker (test-guide: worker-näkymän koe, 'ei mergetty · työ tallessa', Pi builtin) jää Workerit-paneelin Päättyneet-listaan, eikä siitä pääse eroon; yläpalkin worker-siru näyttää 0 ja huomiopisteen. Tämän tyyppisten workereiden ja worktreiden käsittely ja vaiheet prototyypataan. Prototyyppikierros (design-system/prototypes -menetelmä: 2–3 suuntaa yhdellä akselilla, tuotantokonteksti eli nykyinen Workerit-paneeli (suunta Rivi, worker-panel-rivi) ja worker-näkymä, työpöytä ja puhelin, vaalea ja tumma, synteettinen data, yksi offline-tiedosto): mitä henkilö voi tehdä päättyneelle workerille kussakin tilassa (merget­ty, ei mergetty mutta työ tallessa, epäonnistunut ilman työtä, peruttu, keskeytynyt mutta jatkettavissa), miten tallessa oleva työ tarkastetaan (muutokset, raportti, worktree editorissa), miten se viedään eteenpäin (pyydä agenttia mergeämään tai jatkamaan, uusi worker samasta haarasta) tai hylätään, ja miten rivi poistuu listasta (kuittaus, piilotus, automaattinen siivous merge-tilasta riippuen). Rajat: selain ei mergeä eikä hylkää Taskfleet-ajoa itse (root AGENTS.md ja Open Habitat -ympäristö: merge tehdään Gitillä tai agentilla, Taskfleet omistaa ajon tilan); prototyyppi näyttää, mikä toiminto on agentin pyyntö, mikä Taskfleetin oma komento ja mikä vain näkymän kuittaus, ja kirjaa result.md:hen host-faktat suunnittain (taskfleet run discard/salvage/merge, worktree-tila). Jari valitsee; toteutus on myöhempi issue.

## Decisions

### 2026-10-28T11:29:01Z · @jari

Jari 2026-10-28: ei kuittausta. Lista heijastaa todellista tilaa: kun agentti siivoaa worktreet ja haarat, rivi katoaa listasta. Rivillä voi olla painike worktreen poistamiseen tms. Keskeneräisellä on punainen pallo, mutta tyypillinen reaktio on sanoa agentille jotakin (pyyntö agentille, ei selaimen omaa toimintoa). Riffikierros 2 tältä pohjalta (lähinnä suunta 2 Ratkaisu ilman kuittausta).

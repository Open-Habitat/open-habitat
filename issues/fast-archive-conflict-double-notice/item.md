---
created: 2026-11-07
updated: 2026-11-07
type: bug
reporter: jari
status: open
priority: normal
preparation: ready
lane: archive-conflict
lane_seq: 1
---

# Fast archive right after a stop is refused as a conflict and the refusal shows twice

## Description

Kirjattu testikoneelta (KOKEILTAVAA.md, testiopas 7.11.2026):

Nopea arkistointi hylätään ja hylkäys näkyy kahdesti, ylempi ei poistu (Jari 7.11., pilot.612, työpöytä): Jari arkistoi monta keskustelua nopeasti peräkkäin. Yksi (*tseits*) hylättiin: daemon `POST /api/v1/workspaces` 409 klo 07:45:54.935Z, 2 s sen jälkeen kun saman keskustelun jono tyhjennettiin ja vuoro keskeytettiin (`clear_queue` 07:45:52.382Z, `abort` 07:45:52.610Z), ja seuraava arkistointi 31 ms myöhemmin onnistui. Näkyviin tuli kaksi ilmoitusta samasta asiasta: koko sovelluksen yläreunaan iso *Arkiston muutosta ei tehty · Arkistointia ei tehty: Tila muuttui toisaalla. Päivitä tiedot ennen uutta yritystä. Keskustelu palautettiin listaan.* ja otsakkeen alle *Arkistoitu tseits · …* *Palauta*- ja ✕-painikkeilla. Ylempi ei katoa mihinkään. Kahden pitää olla yksi ilmoitus, joka poistuu; ja arkistointi juuri pysäytetystä keskustelusta ei saisi kaatua *Tila muuttui toisaalla* -ristiriitaan, kun käyttäjä ei tehnyt mitään muualla (tekstit `web/src/text/refusals.ts:46`) (`sidebar-archive-on-hover`).

## Acceptance Criteria

- [ ] havainto korjattu; testi rajapinnassa

---
created: 2026-10-29
updated: 2026-10-30
type: feature
reporter: conductor
status: done
priority: normal
provenance: chat
source_ref: chat:2026-10-29/wake-stopped-conversation-on-run-settle
lane: conversation-wake
lane_seq: 1
preparation: ready
closed: 2026-10-30
---

# Wake a stopped conversation when a run it was waiting for settles

## Description

28.10. klo 19:26Z konduktorin Pi pysähtyi (ks. conversation-pi-ends-mid-reply). Sen taustaprosessit, myös `taskfleet run wait` ja testikoneen odotus, kuolivat Pi:n mukana. Spinoff `r31-gate-health-flakes-r31` valmistui ja merget­tiin 19:54Z. Habitat huomasi sen ja kertoi siitä seuraavassa catch-up-viestissä, mutta käynnisti Pi:n vasta Jarin viestistä 29.10. 04:18Z. Yön julkaisu jäi yhdeksäksi tunniksi.

Päätettävä (Jari): pitäisikö Habitatin herättää pysähtynyt keskustelu, kun sen omistama Taskfleet-ajo asettuu (tai kun keskustelun taustaprosessi katkesi Pi:n mukana), samaan tapaan kuin henkilön viesti herättää sen? Vaihtoehdot: (1) herätä aina, kun omistettu ajo asettuu; (2) herätä vain, jos keskustelu odotti ajoa (sillä oli wait käynnissä, kun Pi pysähtyi); (3) ei herätystä, vain ilmoitus henkilölle (nykyinen). Konduktorin suositus: (2), koska keskustelu itse ilmaisi odottavansa, eikä se herätä keskusteluja, jotka eivät odota mitään. Rajat: herätys on henkilön oman keskustelun jatkamista hänen omana käyttäjänään, ei uutta valtuutta.

## Acceptance Criteria

- [x] A Pi waiting on its own background process or working Taskfleet run is not stopped for idleness; a truly idle one still is
- [x] A stopped conversation whose cut-off wait has ended is woken once with a catch-up naming what settled; the person's stop and archive win (result.md)

## Decisions

### 2026-10-30T07:11:20Z · @jari

Jari 30.10.: Tehdään, no-brainer. Lisäksi Pi-prosesseja tapetaan liian herkästi (noin 10 minuutin joutilaisuus): prosessia, joka odottaa jotakin (taustaprosessi, Taskfleet-ajo), ei tarvitse tappaa lainkaan.

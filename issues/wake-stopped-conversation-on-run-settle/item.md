---
created: 2026-10-29
updated: 2026-10-29
type: feature
reporter: conductor
status: untriaged
priority: normal
provenance: chat
source_ref: chat:2026-10-29/wake-stopped-conversation-on-run-settle
---

# Wake a stopped conversation when a run it was waiting for settles

## Description

28.10. klo 19:26Z konduktorin Pi pysähtyi (ks. conversation-pi-ends-mid-reply). Sen taustaprosessit, myös `taskfleet run wait` ja testikoneen odotus, kuolivat Pi:n mukana. Spinoff `r31-gate-health-flakes-r31` valmistui ja merget­tiin 19:54Z. Habitat huomasi sen ja kertoi siitä seuraavassa catch-up-viestissä, mutta käynnisti Pi:n vasta Jarin viestistä 29.10. 04:18Z. Yön julkaisu jäi yhdeksäksi tunniksi.

Päätettävä (Jari): pitäisikö Habitatin herättää pysähtynyt keskustelu, kun sen omistama Taskfleet-ajo asettuu (tai kun keskustelun taustaprosessi katkesi Pi:n mukana), samaan tapaan kuin henkilön viesti herättää sen? Vaihtoehdot: (1) herätä aina, kun omistettu ajo asettuu; (2) herätä vain, jos keskustelu odotti ajoa (sillä oli wait käynnissä, kun Pi pysähtyi); (3) ei herätystä, vain ilmoitus henkilölle (nykyinen). Konduktorin suositus: (2), koska keskustelu itse ilmaisi odottavansa, eikä se herätä keskusteluja, jotka eivät odota mitään. Rajat: herätys on henkilön oman keskustelun jatkamista hänen omana käyttäjänään, ei uutta valtuutta.

---
created: 2026-10-28
updated: 2026-10-28
type: improvement
reporter: jari
status: done
priority: normal
provenance: chat
source_ref: chat:2026-10-28/idle-stop-rest-card
lane: agent-lifecycle
preparation: ready
closed: 2026-10-28
---

# Idle stop at 10 min interrupts an active person; the rest card says nothing useful

## Description

Jari 2026-10-28 klo 4.57 (Birch, pilot.13), kuva attachments/rest-card.png: kun ikkuna on auki ja kirjoitan tekstikenttään, käytän päätettä ja muuta, 10 minuutin joutoaika on liian lyhyt: Pi pysähtyy kesken viestittelyn, ja keskusteluun tulee kortti 'Agentti lepäsi klo 4.54–4.56 · Pi pysähtyi klo 4.54, kun se oli ollut 10 minuuttia jouten. Mikään työ ei katkennut. ✓ Viestisi herätti agentin klo 4.56. Agentti sai tämän selostuksen.' Jari: kortti on nollainformaatiota sekä hänelle että agentille; pitää miettiä, tarvitaanko sitä lainkaan.

Kaksi kysymystä: (1) joutopysäytyksen pitää ottaa huomioon ihmisen aktiivisuus keskustelussa (kirjoittaminen, pääte, editori, presence-signaali, jota recap-appears-while-typing jo lähettää) ja/tai pidempi raja; (2) lepokorttia ja agentin selostusta ei näytetä, kun mitään ei katkennut eikä valmistunut (wake-stopped-agent:in päätös 'lyhyt selostus aina' kumotaan tältä osin). Päätös Jarille ennen toteutusta.

## Decisions

### 2026-10-28T06:12:10Z · @jari

Jari 2026-10-28 klo 8.11 (testikone, pilot.462, kortti 'Agentti lepäsi klo 8.10–8.11 · Habitat käynnistyi uudelleen ... Mikään työ ei katkennut'): 'Näitä tällaisia tulee aivan liikaa.' Toteutettava (konduktorin tulkinta, Jari voi ohjata): (2) lepokorttia eikä agentin selostusta tule, kun mikään työ ei katkennut eikä mitään valmistunut levon aikana; tämä koskee sekä joutopysäytystä että Habitatin uudelleenkäynnistystä (päivitys). Kortti jää vain, kun jotain katkesi tai valmistui. (1) Joutopysäytys ei pysäytä Pi:tä, kun selain ilmoittaa ihmisen olevan läsnä keskustelussa (presence-signaali: kirjoittaminen, pääte, editori, näkyvä välilehti); 10 minuutin raja lasketaan viimeisestä läsnäolosta.

## Acceptance Criteria

- [x] A person the browser reports present is not stopped; the ten minutes count from the last report.
- [x] A rest (idle stop or Habitat restart) with nothing cut off and nothing settled shows no card and gives the agent no catch-up.
- [x] A cut turn, a cut-off process or a settled run still shows the card and is told to the agent.

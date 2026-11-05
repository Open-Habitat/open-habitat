---
created: 2026-11-05
updated: 2026-11-05
type: task
reporter: jari
status: open
priority: normal
preparation: pending
provenance: chat
source_ref: chat:2026-11-05/live-conversation-limit-setting
lane: live-limit-proto
lane_seq: 1
---

# Prototype: where the concurrent-conversations limit is set and how it looks

## Description

Jari 5.11.2026: samanaikaisten keskustelujen rajasta tehdään asetus;
prototypoi, missä se on ja miltä se näyttää. Toteutuksessa raja nostetaan
ensin korkeaksi (`live-conversation-limit-relax`); tämä prototyyppi
ratkaisee, kuka rajaa säätää ja missä.

Kysymyksiä suunnille: onko asetus henkilön oma (Asetukset › …), ylläpitäjän
koko asennukselle tai henkilöittäin (ylläpitäjän näkymä), vai molemmat;
näytetäänkö nykyinen käyttö (montako työskentelee nyt) ja mitä paikkaa
pitää (myös taustaprosessin vuoksi kiireinen keskustelu); miltä rajaan
törmääminen näyttää uutta keskustelua luotaessa (nykyinen kortti *The
conversation was not created* ja *Try again*) ja voiko sieltä suoraan
pysäyttää jonkin. Prototyyppikierros AGENTS-WORKFLOW.md:n mukaan
(`prototype-opus`, linkki, suunnat yhdellä rivillä, suositus, kysymykset).

## Acceptance Criteria

- [ ] kierros 1: vähintään kolme suuntaa, näkymätarjous ja kysymykset Jarille

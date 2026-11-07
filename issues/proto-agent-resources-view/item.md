---
created: 2026-11-06
updated: 2026-11-07
type: task
reporter: jari
status: done
priority: normal
related: ['@proto-browse-what-agent-sees-m365']
preparation: pending
provenance: chat
source_ref: chat:2026-11-06/proto-agent-resources-view
lane: resources-view-proto
lane_seq: 1
closed: 2026-11-07
---

# Prototype: browsable view of every resource and integration the agent can use

## Description

Jari 6.11.2026, prototyypistä `proto-browse-what-agent-sees-m365`
(kierros 1, suunta B Tiedostot): erillinen, selattava näkymä agentin
käytössä olevista resursseista on hyvä. Laajennetaan se näkymäksi, jossa
kaikki henkilön integraatiot (Microsoft 365: OneDrive, SharePoint, posti,
kalenteri, yhteystiedot; Google; Dropbox; GitHub/Gitea; omat koneet) näkyvät
ja ovat selattavissa tasoineen ja rajoineen, ja jonka kautta pääsee myös
integraatioiden asetuksiin ja yhdistämiseen. Lähtökohta: kierroksen 1 B
(`design-system/prototypes/rounds/2026-11-06-m365-selaus/`). Valtuus pysyy
daemonilla henkilön omana käyttäjänä; ei uutta tietovarastoa.
Prototyyppikierros AGENTS-WORKFLOW.md:n mukaan.

## Decision (Jari 2026-11-06, kierros 1)

Suunta **B Lajeittain**. Jari kysyi, prototypoidaanko jokainen laji
(tiedostot, posti, kalenteri, yhteystiedot, koodi, koneet) omalla
kierroksellaan. Kierros 2 suunnittelee kaikkien lajien osiot yhdessä
(yhtenäisyys), ja syvemmät kierrokset tehdään vain lajeille, jotka niitä
tarvitsevat.

## Decision (Jari 2026-11-06, kierros 2)

Kierros 2 lähti väärään suuntaan. Kierroksen 1 B Lajeittain -vasen palkki oli
jo ok; Jari halusi miettiä tarkemmin oikeaa sisältöä, eli miltä kunkin lajin
sisältö näyttää. Kierros 3 tehdään uudestaan: B:n vasen palkki ennallaan,
ja suunnat koskevat lajin sisältöä (mitä listassa on, miltä kohde näyttää,
mitä agentti näkee ja mitä ei).

## Acceptance Criteria

- [x] kierros 1: kolme suuntaa, näkymätarjous ja kysymykset Jarille
- [x] kierros 2: kaikkien lajien osiot yhdessä, kolme riffiä, mitkä lajit tarvitsevat oman kierroksen (hylätty suunta)
- [x] kierros 3 (uusittu): B:n lista ennallaan, kolme suuntaa lajin sisällöstä tiedostoissa, postissa ja koodissa
- [ ] Jarin valinta kierroksesta 3

## Decision (Jari 2026-11-07, kierros 3)

**C Vain rajat** on ok. Kysymykseen 3 (näkyykö agentin luoma luonnos
lähteessä vai vain keskustelussa) Jari: näkymä on mahdollisuus tutkia niitä
tiedostoja, joihin agentilla on pääsy. Tulkinta toteutukseen: muut lajit
kuten C, mutta Tiedostot-lajissa henkilö voi selata agentin saatavilla olevia
tiedostoja (peilikansio henkilön omana käyttäjänä, ei uutta lukureittiä), joten
agentin luoma tiedosto näkyy siellä luonnostaan. Toteutus: `agent-resources-view`.

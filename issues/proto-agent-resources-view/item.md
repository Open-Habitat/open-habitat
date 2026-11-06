---
created: 2026-11-06
updated: 2026-11-06
type: task
reporter: jari
status: open
priority: normal
related: ['@proto-browse-what-agent-sees-m365']
preparation: ready
provenance: chat
source_ref: chat:2026-11-06/proto-agent-resources-view
lane: resources-view-proto
lane_seq: 1
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
- [ ] kierros 2: kaikkien lajien osiot yhdessä, kolme riffiä, mitkä lajit tarvitsevat oman kierroksen

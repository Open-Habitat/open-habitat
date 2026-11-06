---
created: 2026-11-06
updated: 2026-11-06
type: feature
reporter: jari
status: done
priority: normal
preparation: ready
provenance: chat
source_ref: chat:2026-11-06/ai-sign-in-expired-window
lane: ai-sign-in
lane_seq: 1
closed: 2026-11-06
---

# Expired AI sign-in: warning by the composer, sign-in window, waiting messages send themselves

## Description

Jari 6.11.2026: toteutus prototyypistä `proto-ai-sign-in-expired`
(kierrokset 1–3; result.md, viimeisimmät
`design-system/prototypes/rounds/2026-11-06-tekoaly-kirjautuminen-riff/`
ja `2026-11-06-tekoaly-kirjautuminen-3/`). Varoitus kentän yllä
(GitHub-varoituksen malli), kirjautuminen **ikkunassa** keskustelun päällä,
epäonnistunut vuoro **lyhyenä rivinä**, odottavat viestit (myös muokattu
ja toisen saman palvelun keskustelun viesti) **lähtevät itse** heti
kirjautumisen jälkeen (R1). Lisäksi Clauden asetusrivi ei saa väittää
*Kirjautunut*, kun kirjautuminen on hylätty (kierroksen 1 host-tiedot).

## Acceptance Criteria

- [ ] vanhentunut kirjautuminen näkyy kuten prototyypissä, ikkuna korjaa sen paikan päällä ja odottavat viestit lähtevät; testit

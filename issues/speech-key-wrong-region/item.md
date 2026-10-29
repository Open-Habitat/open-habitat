---
created: 2026-10-29
updated: 2026-10-29
type: bug
reporter: jari
status: fixed
priority: normal
lane: unlaned
lane_seq: 1
collision: [internal/daemon/speech_linux.go, web/src/app/SpeechSettings.tsx]
preparation: ready
closed: 2026-10-29
---

# Dictation key saved in the wrong Soniox region reads as a rejected key

_Source: chat_

## Description

Jari 29.10. (Birch, pilot.14, kuvakaappaus `attachments/soniox-rejected.png`):
Soniox-avain, joka on oikea, antaa sanelussa "Soniox hylkäsi avaimen – Vaihda
avain asetuksissa".

Konduktorin diagnoosi 29.10. Jarin omalla tiedostolla
(`~/.config/soniox/key.json`: `region: eu`, `source: site`, `snx_proj_`-projektiavain):
väliaikaisen avaimen luonti `POST /v1/auth/temporary-api-key` onnistuu
US-osoitteessa (`api.soniox.com`, 201) ja hylätään EU-osoitteessa
(`api.eu.soniox.com`, 401 `unauthenticated`, "Incorrect API key provided").
Avain on siis USA-alueen avain, mutta se tallentui EU-alueelle: avainlomakkeen
aluevalitsin (`web/src/app/SpeechSettings.tsx`, sama site-avaimelle) on
oletuksena EU, eikä tallennus tarkista avainta Sonioxia vasten. Virheilmoitus
kertoo "hylkäsi avaimen", vaikka avain on kunnossa ja vain alue on väärä.

## Acceptance Criteria

- [ ] Avaimen tallennus (oma ja ylläpitäjän site-avain) tarkistaa avaimen Sonioxia vasten: alue, jossa avain toimii, tallentuu; jos se ei toimi valitulla alueella mutta toimii toisella, tallennetaan toimiva alue ja kerrotaan siitä, tai alue päätellään automaattisesti ilman valitsinta. Avain, joka ei toimi missään, hylätään tallennuksessa selkeällä tekstillä.
- [ ] Sanelun virhe erottaa väärän alueen (avain toimii toisella alueella) hylätystä avaimesta, tai väärä alue ei enää voi syntyä.
- [ ] Jo tallennetut väärän alueen avaimet (kuten Jarin site-kopio Birchlla) korjautuvat tai ohjaavat oikeaan korjaukseen.
- [ ] Testit fake-Sonioxilla molemmille alueille.

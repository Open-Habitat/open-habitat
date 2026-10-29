---
created: 2026-10-29
updated: 2026-10-29
type: bug
reporter: jari
status: fixed
priority: normal
preparation: ready
provenance: chat
source_ref: chat:2026-10-29/soniox-project-key-refused
lane: settings-sanelu
lane_seq: 3
closed: 2026-10-29
---

# Soniox project keys (snx_proj_… with dots) are refused by the key shape check

## Description

Jari 29.10. (testikone): nykyinen Soniox-avain ei kelpaa Asetukset › Sanelu -kenttään. Soniox-konsolin projektiavaimet ovat muotoa snx_proj_<43 merkkiä>.<86 merkkiä>.<6 merkkiä> (noin 146 merkkiä; merkit A-Za-z0-9_- ja pisteet erottimina). Avaimen muodon tarkistus hylkää pisteen: internal/daemon/speech_linux.go SonioxKeyShape ja internal/gateway/site_speech_key_linux.go sonioxKeyShape ovat ^[A-Za-z0-9_-]{16,256}$, samoin contracts/v1/speech.schema.json (key) ja contracts/v1/server-speech-key.schema.json. (Väliaikaisen istuntoavaimen api_key-kuvio sallii jo pisteen.) Oikea Jarin avain ei kuulu tähän issueen eikä repoon.

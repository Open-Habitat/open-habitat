---
created: 2026-10-28
updated: 2026-10-28
type: feature
reporter: jari
status: open
priority: normal
lane: speech-input
preparation: ready
provenance: chat
source_ref: chat:2026-10-28/speech-input-composer
---

# Speech input in the composer (Soniox, 10 min ceiling)

Toteuttaa sanelun viestikenttään. Speksi: issues/proto-speech-input/ (prototyyppi ja result.md; suunta Katto, mutta katto 10 min eikä 30: Jari 2026-10-28, tyypillinen sanelu enintään 3 min) ja arkkitehtuuri issues/research-soniox-speech-input/ (Jarin päätös D + P1: ylläpitäjän Soniox-avain palvelinasetuksissa kopioidaan koteihin AI-avaimen tapaan, henkilön oma avain edellä; daemon luo kertakäyttöisen väliaikaisen avaimen, max_session_duration_seconds 600, ja selain striimaa suoraan Sonioxille). Host-faktat, jotka puuttuvat, on lueteltu proto-speech-input/result.md:ssä (daemonin reitti, P1-poikkeus internal/AGENTS.md:n tokensääntöön, avainten tallennus ja asetussivu, sopimuksen virhekoodit, keepalive, uudelleenyhdistys).

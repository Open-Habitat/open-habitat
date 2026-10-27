---
created: 2026-10-27
updated: 2026-10-27
type: improvement
reporter: jari
status: done
priority: normal
provenance: chat
source_ref: chat:2026-10-27/recap-time-since-last-message
lane: recap
lane_seq: 3
preparation: ready
closed: 2026-10-27
---

# Recap timestamp: time since the last message, not since the recap was generated

## Description

Jari 2026-10-27: tilannekatsauksen aikaleiman pitää kertoa, kuinka kauan on kulunut keskustelun viimeisestä viestistä, ei siitä, kuinka kauan on kulunut katsauksen generoinnista. Koskee katsauskorttia keskustelussa, etusivulla ja Jatka-näkymässä; viimeinen viesti = keskustelun viimeisin natiivi viesti (ihmisen tai agentin), host-faktana.

## Acceptance Criteria

- [x] Aikaleima näyttää ajan viimeisestä viestistä kaikissa katsauksen paikoissa ja päivittyy ajan kuluessa; testi

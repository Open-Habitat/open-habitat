---
created: 2026-10-29
updated: 2026-10-29
type: improvement
reporter: jari
status: done
priority: normal
lane: ui-polish
lane_seq: 15
preparation: ready
closed: 2026-10-29
---

# Dictation missing-key banner says too much

_Source: chat_

## Description

From KOKEILTAVAA.md (test server testing):

Sanelun puuttuvan avaimen banneri sanoo liikaa (Jari 28.10., pilot.471): kun sanelua käyttää ilman Soniox-avainta, bannerin teksti *Lisää oma avain asetuksissa. Jos palvelimen ylläpitäjä lisää yhteisen avaimen, sanelu toimii ilman omaa.* on tarpeeton. Otsikko *Sanelu tarvitsee Soniox-avaimen* ja asetuspainike riittävät. Koodi: `speech_key_missing` (`web/src/components/composer/Dictation.tsx`).

---
created: 2026-10-26
updated: 2026-10-28
type: task
reporter: jari
status: open
priority: normal
provenance: chat
source_ref: chat:2026-10-26/proto-speech-input
lane: speech-input
lane_seq: 2
blocked_by: ['@research-soniox-speech-input']
preparation: pending
---

# Prototype: speech input in the composer

## Description

Jari 2026-10-26, keskustelusta toisen kehittäjän kanssa (ulkopuolinen käyttäjä, joka arvioi Habitatia omaan ja asiakkaidensa käyttöön). Prototyyppikierros research-soniox-speech-input-selvityksen pohjalta: miten puhesyöte näkyy viestikentässä (mikrofonipainike tai pidä-pohjassa, välitulokset kentässä, lopetus, virhe ja ei avainta -tilat), työpöytä ja puhelin. Jari valitsee; toteutus on myöhempi issue.

## Result

[result.md](result.md): kierros 28.10. akselilla *mikä päättää pitkän sanelun*. Suunnat ovat Katto (30 min, Sonioxin istuntokatto), Hiljaisuus (3 min hiljaisuus, takaraja 4 h) ja Jatkokysymys (25 min välein, vastaamatta 5 min, takaraja 4 h). Kaikissa ovat sama mikrofoni, välitulokset, tauot, lopetus, virheet ja ei avainta -tila. Suositus on Jatkokysymys. Prototyyppi on [prototypes/speech-input/index.html](prototypes/speech-input/index.html) ja opas [NOTES.md](prototypes/speech-input/NOTES.md). Odottaa Jarin valintaa.

## Decisions

### 2026-10-27T11:59:28Z · @jari

Jari 2026-10-27: D + P1 (ks. research-soniox-speech-input Decisions). Sanelu ei saa katketa minuuttiin; prototyypissä näytetään pitkä sanelu, tauot ja mitä tapahtuu katon lähestyessä.

---
created: 2026-11-06
updated: 2026-11-06
type: feature
reporter: jari
status: open
priority: normal
preparation: ready
provenance: chat
source_ref: chat:2026-11-06/rewind-conversation
lane: rewind
lane_seq: 1
---

# Return to an earlier message with file restore (experimental)

## Description

Jari 6.11.2026: toteutus prototyypistä `proto-rewind-conversation`
(kierrokset 1–3; result.md, viimeisin
`design-system/prototypes/rounds/2026-11-06-palaa-tahan-vahvistus/`).
*Palaa tähän* samassa keskustelussa Pi:n `/tree`-haarautumisen mukaan
(korvattu jatko riviksi), vahvistus **C Pieni arkki**, valittavana
keskustelu ja tiedostot (C Valitse mitä). Tiedostojen palautus daemonin
omana Pi-laajennuksena better-pi-rewindin (raine, MIT) talteenoton ja
palautuksen pohjalta lisenssimerkintöineen, tilannekuva ennen palautusta,
jotta korvattuun jatkoon voi palata tiedostoineen. Kokeellinen ominaisuus.
Ei uutta tietovarastoa: metatieto Pi:n istunnossa, kopiot henkilön omassa
kodissa.

## Acceptance Criteria

- [ ] palaaminen ja tiedostojen palautus toimivat kokeellisena ominaisuutena; testit synteettisellä Pi-istunnolla

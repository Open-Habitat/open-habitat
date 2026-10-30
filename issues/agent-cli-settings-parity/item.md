---
created: 2026-10-30
updated: 2026-10-30
type: improvement
reporter: jari
status: done
priority: normal
lane: agent-cli
lane_seq: 1
preparation: ready
closed: 2026-10-30
---

# Agent CLI covers browser settings, starting with the Gitea token

## Description


## Description

Jari 30.10.: `open-habitat agent` ei tarjoa kaikkia asetuksia, joita selain
tarjoaa. Toinen agentti totesi: "Habitatissa ei ole agentin komentoa
Gitea-tokenin tallentamiseen, mutta voin luoda tokenin Aldern Gitealla ja
viedä sen leikepöydällesi." Jarin mukaan tokenin asettamiselle ei ole estettä:
agentti voi tehdä sen CLI:llä niin, ettei token näy missään (vrt.
`open-habitat agent credential update --provider anthropic --secret-file -`).

## Acceptance Criteria

- [x] Gitea-yhteyden token asetetaan, vaihdetaan ja poistetaan agentin
      CLI:llä stdinistä / tiedostosta (`--secret-file -`), sama validointi ja
      tallennus kuin selaimen `/settings/code-hosts`-polulla; token ei näy
      argv:ssä, tulosteessa, lokeissa eikä historiassa.
- [x] Kartoitus: jokainen selaimen asetus (`/settings/*`) ja onko sille
      agentin komento; puuttuvat yksinkertaiset lisätty samalla mallilla,
      isommat listattu result.md:ssä. AI-first CLI -kaanon (`CONFORMANCE.md`).
- [x] Agentin ohje (`open-habitat skill print agent`) ja ympäristöohje
      päivitetty niin, että agentti löytää komennot.

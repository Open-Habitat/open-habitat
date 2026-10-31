---
created: 2026-10-31
updated: 2026-10-31
type: improvement
reporter: jari
status: done
priority: normal
lane: dictation
lane_seq: 1
preparation: ready
closed: 2026-10-31
---

# Dictation bar becomes the default; Esc cancels like ×; quick tooltip

## Description

## Description

Jarin havainnot 30.10. (testikone pilot.535, Mac):

1. **Sanelupalkki pois kokeellisista.** Palkki toimi kokonaan (painikkeiden paikat, punertava kuuntelupalkki, *Valmis*, ✕ palauttaa kentän ennalleen), ja Jari haluaa sen tavalliseksi ominaisuudeksi: poista *Sanelupalkki*-kokeiluvalinta ja vanha rivi (`composer-dictation-bar`).
2. **Esc sanelun aikana kuten ✕ (Jarin ehdotus).** Nyt Esc tekee saman kuin Enter ja *Valmis*, eli jättää sanotun kenttään (`web/src/components/composer/Dictation.tsx:250-256`, `engine.current?.stop()`). Ehdotus: Esc peruu kuten ✕ (`cancel()`, kenttä ennalleen), jolloin Enter = valmis ja Esc = peru. Varmista, ettei pitkän sanelun vahingossa painettu Esc hävitä tekstiä ilman tapaa palauttaa se.
3. ***Sanele*-painikkeen vihje tulee näkyviin vasta usean sekunnin viiveellä.** Pikanäppäimen nimeävä vihje on selaimen oma `title` (`Dictation.tsx:355`), jonka viivettä sovellus ei hallitse.

## Acceptance Criteria

- [x] Sanelupalkki on ainoa rivi kaikille; kokeellinen kortti ja vanha rivi koodeineen poistettu; puhelin ja kapea ikkuna, vaalea ja tumma tarkistettu.
- [x] Esc sanelun aikana peruu kuten ✕, ja peruttu sanelu on palautettavissa (esim. *Kumoa*-ilmoitus tai ⌘Z); valinta kirjattu Decisions for later review -kohtaan.
- [x] Saneluvihje (pikanäppäin) näkyy sovelluksen omana nopeana vihjeenä; selainspec.

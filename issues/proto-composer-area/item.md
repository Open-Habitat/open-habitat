---
created: 2026-10-19
updated: 2026-10-20
type: task
reporter: jari
status: done
priority: normal
related: ['@proto-composer-combined']
lane: unlaned
collision: [issues/proto-composer-area]
preparation: ready
closed: 2026-10-20
---

# Prototype: the whole composer area (buttons, Lähetä, Ohjaa/Työn jälkeen, Stop)

Jari, 2026-10-19, on `proto-composer-combined`: Alarivi is the base, "mutta miettiä nyt kokonaan tämän alueen kaikkineen painikkeineen": the whole composer area in one design — the field, the bottom row (Komennot, Tiedosto, model pill), **Lähetä**, **Ohjaa / Työn jälkeen** (steer vs. queue after the turn), **Stop**, the queued-message strip, the background-work marks (Merkit), `!` command mode, and how all of these behave idle, while Pi works, with a queued message, on a phone, light and dark. Start from the production composer (`web/src/components/`), the chosen composer in `design-system/prototypes/lib/composer.js`, and the rounds `2026-10-19-kentta-yhdessa` (Alarivi) and `2026-10-19-kentan-lisat`. This is pre-pilot polish: the result is the composer's specification.

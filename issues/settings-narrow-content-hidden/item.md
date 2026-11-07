---
created: 2026-11-07
updated: 2026-11-07
type: bug
reporter: jari
status: open
priority: normal
preparation: ready
lane: settings-polish
lane_seq: 2
---

# Below 1050 px settings show only the section list, not the selected section

## Description

Kirjattu testikoneelta (KOKEILTAVAA.md, testiopas 7.11.2026):

Asetusten taitekohdan alapuolella sisältö katoaa kokonaan (Jari 7.11., pilot.612, työpöytä, ikkuna kavennettu alle 1050 px): näkyviin jää vain asetusten osiolista koko leveydellä, ja valittu osio (*Account*) on korostettu koko sivun levyisenä rivinä; osion sisältöä ei näy. Kavennuksen pitäisi siirtää lista ja sisältö toistensa tilalle niin, että valitun osion sisältö näkyy ja listaan pääsee takaisin, eikä jättää valittua osiota näkymättömäksi. Rajat: `web/src/components/Settings.css` `@media (max-width: 1050px)` (rivit 248, 331, 359, 813) (`settings-breakpoint-1050`).

## Acceptance Criteria

- [ ] havainto korjattu; testi rajapinnassa

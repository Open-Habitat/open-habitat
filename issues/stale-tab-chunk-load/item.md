---
created: 2026-11-07
updated: 2026-11-07
type: bug
reporter: jari
status: fixed
priority: normal
preparation: ready
lane: stale-chunk
lane_seq: 1
closed: 2026-11-07
---

# A tab from an older release crashes on a lazily loaded part instead of offering reload

## Description

Kirjattu testikoneelta (KOKEILTAVAA.md, testiopas 7.11.2026):

Editori kaatui *Unexpected Application Error!* -sivuun versiopäivityksen jälkeen (Jari 1.11., kesken testauksen pilot.572 → pilot.584): Jari avasi juuri kloonatun tyhjän repon (`testi-repo`) editorin, ja sivu näytti vain `TypeError: Failed to fetch dynamically imported module: https://open-habitat-test.example.test/assets/BrowserDocument-IW2aJhzO.js`. Välilehti oli ladattu vanhalla versiolla, ja uudessa julkaisussa tiedoston nimi on `BrowserDocument-D2sYRlQj.js`, joten vanha osa puuttuu palvelimelta. Tyhjällä repolla ei ollut osuutta. Vanhan välilehden pitää laiskasti ladattavan osan puuttuessa näyttää *Palvelin on päivitetty · Lataa uudelleen* kuten yhteysbanneri (`reconnect-after-version-change`), ei React Routerin raakaa virhesivua (`stale-tab-chunk-load-after-upgrade`).

## Acceptance Criteria

- [x] havainto korjattu; testi rajapinnassa

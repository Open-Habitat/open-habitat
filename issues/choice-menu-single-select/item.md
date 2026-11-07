---
created: 2026-11-07
updated: 2026-11-07
type: bug
reporter: jari
status: open
priority: normal
preparation: ready
lane: settings-polish
lane_seq: 1
---

# Single-choice menus show checkboxes and no current choice

## Description

Kirjattu testikoneelta (KOKEILTAVAA.md, testiopas 7.11.2026):

Yhden valinnan valikot näytetään tarkistuslistana kaikkialla (Jari 7.11., pilot.612): näkymäkortin julkisuuden päivämäärävalikko (kortissa *7.12.*) avautuu ruutulistana, eikä nykyinen kesto ole valittuna; sama vika kuin Asetukset › Language -valikossa. Jarin linjaus: yhden asian valinnassa ei käytetä tarkistuslistaa missään, vaan yhden valinnan elementtiä, jossa nykyinen valinta näkyy korostettuna. Tarkista kaikki `web/src/components/ChoiceMenu.tsx`:n käyttäjät (`settings-selectors-menu`, `view-card-public-switch`).

Asetusten valikkovalitsin ei näytä valittua (Jari 7.11., pilot.612, Appearance › Language englanniksi): valikko avautuu tarkistuslistana (System, Suomi, English (US), English (UK) selitteineen), mutta yksikään ruutu ei ole valittuna, vaikka painikkeessa lukee *System*. Valittu vaihtoehto pitää näkyä valittuna (korostus tai merkki), eikä yhden valinnan valikko saa näyttää monivalinnan ruutuja. Komponentti `web/src/components/ChoiceMenu.tsx` (`settings-selectors-menu`).

## Acceptance Criteria

- [ ] havainto korjattu; testi rajapinnassa

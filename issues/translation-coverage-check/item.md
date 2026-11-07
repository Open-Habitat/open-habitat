---
created: 2026-11-07
updated: 2026-11-07
type: improvement
reporter: jari
status: open
priority: normal
preparation: ready
lane: translation-check
lane_seq: 1
---

# Machine check of translation coverage and quality, plus an extract for agent review

## Description

Kirjattu testikoneelta (KOKEILTAVAA.md, 7.11.2026):

Käännösten kattavuus ja laatu tarkistettavaksi koneellisesti (Jarin ehdotus 7.11., pilot.613): kieli toimii, mutta suomenkielisten jäänteiden etsimistä ei pidä jättää käsin klikkailtavaksi. Jari ehdottaa nopeaa ja vaivatonta tarkistusta käännösvaiheeseen tai testeihin: skripti, joka poimii kaikki kielikentät (suomi, US ja UK rinnakkain avaimittain) yhteen tiedostoon, jonka voi antaa erilliselle agentille tarkastettavaksi poikkeamien varalta (puuttuva tai kääntämätön teksti, eri merkitys, väärä aluekirjoitusasu), sekä ohjelmallinen tarkistus, että jokainen kenttä on asetettu oikeassa muodossa. Osa on jo olemassa: tekstit ovat `web/src/text/*`-luetteloissa (`catalog(fi, en, gb)` kohdassa `web/src/i18n/index.ts`, jossa tyyppi vaatii jokaisen avaimen), `web/src/i18n/catalogs.test.ts` hylkää ä/ö-kirjaimet englanninkielisistä ja toisen alueen kirjoitusasun, ja `web/src/i18n/finnishScan.ts` etsii suomea luetteloiden ulkopuolelta. Puuttuu poimintaskripti agenttitarkastusta varten, suomen sanat ilman ä/ö-kirjaimia englanninkielisissä (esim. *Tila*, *Palauta*), englanninkielisen tekstin suomi-osuuden vastaava tarkistus, sekä palvelimen (Go) ja Pi-laajennusten tuottamat käyttöliittymätekstit, joita luettelot eivät kata (`ui-english-coverage`).

## Acceptance Criteria

- [ ] havainto korjattu; testi rajapinnassa

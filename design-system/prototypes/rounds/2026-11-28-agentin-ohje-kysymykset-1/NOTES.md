# Ylläpitäjän kysymykset muistilappuun, kierros 1 · 28.11.2026

Issue `admin-onboarding-note-questions`. Akseli, suunnat ja kysymykset
Jarille ovat issuen `result.md`:ssä.

Akseli: **mitä ylläpitäjä muokkaa**. Valitsimessa **1 Lisäkysymykset**
(sivuston omat kysymykset listana; Habitatin kysymykset kiinteinä niiden
ympärillä) ja **2 Koko keskustelu** (koko keskustelu sellaisena kuin henkilö
sen näkee; Habitatin kysymykset voi piilottaa ja siirtää, omat
kirjoitetaan paikalleen). Henkilön puoli on molemmissa sama ja seuraa
ylläpitäjän listaa saman istunnon aikana.

## Rajaus

Tuotannon `OnboardingSettings` (Asetukset › Käyttöönotto) on muuttamaton;
kierros lisää reitin viimeisen rivin *Ohjeet agentille* ja sen paneelin
portaaleilla. Kun kierroksen rivi on valittuna, tuotannolle annetaan
vaihe, jota mikään rivi ei kanna, jottei tuotannon rivi näy valittuna.
Henkilön keskustelu on rakennettu tuotannon palasista kuten
`AgentNoteStep` (kuplat, painikkeet, `TextArea`, `InstructionsEditor`,
`OnboardingFrame`, tekstit `agentNote.ts`:stä) ja lisää siihen sivuston
kysymykset. Tuotannon koko esikatselu (*Näytä henkilön näkymä*) ei vielä
näytä muistilappuvaihetta. Vain suomeksi; nimet, tiimit ja repot ovat
synteettisiä.

URL: `?v=1|2&view=admin|person&s=` (ylläpitäjä: `lista`, `tyhja`,
`muokkaa`, `lisaa`; henkilö: `kaytto`, `uusi`) `&theme=light|dark`. Ilman
`?theme=`-valintaa teema tulee `initialTheme()`-funktiosta.

## Rakentaminen ja tarkistus

Repojuuresta, kun `web/node_modules` on asennettu lukkotiedostosta.
Linuxissa scratch-hakemistossa omalla TMPDIR:llä.

```sh
round=design-system/prototypes/rounds/2026-11-28-agentin-ohje-kysymykset-1
node "$round/build.mjs"   # dist/2026-11-28-agentin-ohje-kysymykset-1/offline.html
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright timeout 590 \
  node "$round/check.mjs" design-system/prototypes/dist/2026-11-28-agentin-ohje-kysymykset-1/offline.html <out> [--quick]
```

`check.mjs`:n alku kertoo, mitä se tarkistaa, välit mukaan lukien.

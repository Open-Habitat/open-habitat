# AI-palveluntarjoajat – kierros 1

Issue `ai-provider-registry`. Tutkimus on issuen `research.md`:ssä, päätökset
ja kysymykset `result.md`:n kohdassa "Kierros 1".

Kierros näyttää Habitatin jokaisen mallipinnan kiinnitetyn Pi 1.5.2:n
palveluilla: OpenAI, Anthropic, Google Gemini, xAI Grok, DeepSeek, GLM
(Z.ai), Kimi, MiniMax ja Qwen. Reitti on (palvelu, tapa, alue), ja tapoja on
kolme: tilaus kirjautumalla (ChatGPT, Claude, Kimi Code, SuperGrok), coding
plan, jonka avain liitetään (GLM, MiniMax, Qwen), ja käyttöpohjainen avain.
Suunnat eroavat vain ryhmittelyssä: *Maksutavan mukaan* jatkaa nykyistä
jakoa Tilaukset / API-avaimet, *Palvelun mukaan* kokoaa tilauksen, avaimen
ja alueen palvelun alle.

Tuotannon palat (asetusrivit ja -kortit, `LetterMark`, `StatusMark`, `Badge`,
`Segmented`, `ModelPicker`, `ModelChip`, `ComposerModelPicker`, dialogin
luokat ja käyttöönoton listan CSS) ovat muuttamattomia; kierros kokoaa ne,
koska tuotannon komponentit on kovakoodattu kolmelle avaintarjoajalle.
Keskustelunäkymä on kevyt sijainen tuotannon kentän valitsimen ympärillä.
Tekstit ovat `text.ts`:ssä suomeksi ja englanniksi. Henkilöt, avainten
loppuosat ja keskustelu ovat synteettisiä; mallit ja Pi:n tarjoaja-id:t ovat
Pi 1.5.2:n luettelosta.

URL: `?v=` suunta (1 Maksutavan mukaan, 2 Palvelun mukaan), `?s=` tilanne
(`asetukset`, `lisaa`, `tilaus`, `avain`, `valitsin`, `uusi`,
`kayttoonotto`, `kayttoonotto-cn`, `yllapito`), `?lang=en`, `?theme=dark`
(muuten `initialTheme()`). Tilanne säilyy suuntaa vaihdettaessa.
Laitekoodivaiheen katkoviivainen painike on kierroksen ohjaus.

## Rakentaminen ja tarkistus

```
npm ci --prefix web
node design-system/prototypes/rounds/2026-11-28-ai-palveluntarjoajat-1/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright timeout 590 \
  node design-system/prototypes/rounds/2026-11-28-ai-palveluntarjoajat-1/check.mjs \
  design-system/prototypes/dist/2026-11-28-ai-palveluntarjoajat-1/offline.html <kuvahakemisto>
```

`check.mjs`:n alku kertoo, mitä se tarkistaa, myös vierekkäisyyden: kaksi
näkyvää kontrollia eivät ole lähempänä kuin `--ah-control-gap`. Tuotannon
`Segmented`-segmentit ja käyttöönoton listan rivit ovat yksi kontrolli ja
koskettavat suunnitellusti, joten niiden parit ohitetaan. `--quick` ajaa vain
1440 vaalean suomeksi.

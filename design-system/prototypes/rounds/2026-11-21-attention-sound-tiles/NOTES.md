# Äänet laattoina – kierros 3

- **A Aaltomuoto**: laatassa äänen oma verhokäyrä samalla sekunnin
  aika-asteikolla; soidessa käyrä täyttyy vasemmalta oikealle ja toistopää
  kulkee sen yli.
- **B Renkaat**: jokainen lyönti on rengas pisteen ympärillä, ja pitkään
  soivalla lyönnillä on katkoviivainen sädekehä; soidessa renkaat leviävät
  kukin omalla hetkellään kuin vesi.
- **C Kuva ja taso**: äänen perheen kuva (kello, lasi, Habitatin kaaret ja
  aurinko), nimi ja yhden rivin kuvaus; soidessa tasomittari seuraa äänen
  voimakkuutta.

Issue `attention-sound`. Suunnat, suositus ja kysymykset ovat issuen
`result-tiles.md`:ssä.

Sivu on tuotannon kehys (`AppShell`, `WorkspaceRail`) ja `AccountSettings`,
kuten kierroksessa 2: osioluettelo (`shownSettingsSections`) saa ladattaessa
Äänet-osion Ulkoasun jälkeen, ja osion runko viedään portaalilla `.s-main`iin.
Rivit ovat tuotannon `s-card`/`s-row`-rivejä ja tuotannon `Segmented`,
`ChoiceMenu`, `Checkbox`, `ScaleSlider` ja `ControlButton`. Kierroksen omia
ovat laatat, niiden kuvat ja huomautusrivit.

Äänet ovat kierroksen 1 kaksitoista reseptiä paikkamerkkeinä: `round.tsx`
tuo ne suoraan tiedostosta `../2026-11-17-attention-sounds/synth.mjs`, joten
tunnisteet (`a1`…`c4`) ja soundit ovat samat. Jos kierros 1 poistuu ennen
tätä, kopioi `synth.mjs` tähän hakemistoon. Ladattaessa jokainen resepti
renderöidään `OfflineAudioContext`illa, ja laattojen kuvat luetaan siitä:
A:n verhokäyrä on huippu 72 lokerossa sekunnin matkalta, C:n mittari on
16 ms:n RMS suhteessa äänen omaan kovimpaan kehykseen, ja B:n renkaat ovat
reseptin lyöntien alkuhetket, voimakkuudet ja soimisajat. Jokainen soitto
kirjautuu `window.__rqPlays`-taulukkoon ja jokainen "Agentti valmis"
-simulaatio `window.__rqSim`-taulukkoon.

`?s=<tilanne>`, `?theme=dark|contrast`, `?motion=reduced` ja `?lang=en`
valitsevat alkutilan. Tilanteet: `oletus`, `yo` (laite yötilassa klo 23),
`aina-tumma` (laite tummana klo 13), `pois`, `mykistetty`, `estetty`,
`lukuvirhe`. Tiedot ovat keksittyjä (Aino Esimerkki, työtilat
`aurinkokello`, `kotisivu`).

Valitsimen nuolinäppäimet toimivat sivulla, mutta laattojen sisällä nuolet
kuuluvat radioryhmälle (`stopPropagation`), jottei suunta vaihdu kesken
valinnan.

## Rakentaminen ja tarkistus

```
npm ci --prefix web     # kerran, lukitiedoston mukaan
node design-system/prototypes/rounds/2026-11-21-attention-sound-tiles/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright timeout 1500 \
  node design-system/prototypes/rounds/2026-11-21-attention-sound-tiles/check.mjs \
  design-system/prototypes/dist/attention-sound-tiles/offline.html <kuvahakemisto>
```

Rakennus kirjoittaa `design-system/prototypes/dist/attention-sound-tiles/`:iin
`offline.html`:n (fontit upotettuina) ja `index.html`:n (ilman fontteja).
Tarkistus käy kolme suuntaa ja seitsemän tilannetta 1440 ja 390 px:n
leveydellä Päivä-, Yö- ja Korkea kontrasti -teemoissa ja käy sitten
1440 px:ssä jokaisen suunnan polut: laatan painallus, soiva tila,
nuolinäppäimet ja näkyvä fokus, Agentti valmis -säännöt, yö laitteen ja
kellon mukaan, kellovinkki, pois päältä, mykistys, selaimen äänilupa ja
lukuvirhe. Lisäksi vähennetty liike (laitteen asetuksena ja valitsimesta),
englanti ja yksi polku 390 px:ssä. `--quick` ajaa vain 1440 px Päivän.

## Yö: mistä rytmi tulee

Habitatin ulkoasu ei seuraa kelloa. `web/src/theme.ts` valitsee
Järjestelmä-teemalla tumman, kun laite kertoo `prefers-color-scheme: dark`,
ja Korkean kontrastin, kun laite pyytää `prefers-contrast: more`. Rytmi
on siis laitteen: macOS:n, iOS:n ja Androidin automaattinen ulkoasu vaihtaa
tummaan auringonlaskun aikaan. Hiljennä yöllä käyttää samaa signaalia
(`prefers-color-scheme: dark`), ei Habitatin teemavalintaa: käsin valittu
Yö-teema on ulkoasu, ei kellonaika. Selain ei kerro, onko laitteen tumma tila
automaattinen vai pysyvä. Siksi tarjolla on myös kello (22.00–7.00 laitteen
omaa aikaa), ja jos laite on tummana keskellä päivää (9–17), rivi ehdottaa
kelloa. Ehdotus on kirjattu issuen `result-tiles.md`:hen.

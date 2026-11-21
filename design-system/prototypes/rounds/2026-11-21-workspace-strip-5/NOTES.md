# Työtilan asetusnauha – kierros 5: Kuvake ja Nimi avaavat oikeat editorinsa

Jarin päätökset 21.11.: nauha on kierroksen 4 **A Yksi rivi**, ja Kuvake ja
Nimi avaavat oikeat editorinsa. Merkit ovat lopulliset: Tunnus puu ja Kuplat
nykyiset, Lasit *Lasin reuna*, Kulho *Huojunta*, Jääpuikot *Helähdys* ja muut
kierroksen 7 suositukset (`round.tsx`:n `FINAL`).

- **Kuvake** on tuotannon `WorkspaceIconPicker` sellaisenaan: Automaattinen,
  Kirjaintunnus, emojiruudukko, Oma emoji ja ”Ehdotuksia mallilta…”. Sen oma
  laukaisin on venytetty koko neliön päälle (`round.css`), joten neliön sana
  ja arvo ovat oikean painikkeen päällä ja ponnahdus ankkuroituu neliöön.
  Valinta tallentuu heti kuten tuotannossa. Neliö näyttää tuotannon
  `WorkspaceIcon`in ja sen, mistä kuvake tulee (Nimestä, Kirjaimet, Emoji).
  Sama kuvake päivittyy otsikkoon ja sivupalkkiin.
- **Nimi** muuttaa tuotannon näyttönimeä (tuotannon sanat: Muuta
  näyttönimeä, Näyttönimi, Tallenna). Kansio ei muutu, ja tyhjä nimi
  palauttaa kansion nimen.
- **Ääni** on kierrosten 2–4 valitsin ennallaan lopullisilla merkeillä.

Akseli: **miten Nimi muokataan**, ainoa kolmesta, jolla on aito vaihtoehto.

- **A Ponnahdus**: ponnahdusikkuna Nimen alle kuten Kuvakkeella ja Äänellä;
  kenttä, ohje, Peru ja Tallenna. Puhelimessa alalaidan arkki.
- **B Paikallaan**: nimi muuttuu kentäksi Nimen omassa ruudussa, ✕ ja ✓
  otsikkorivillä. Enter ja muualle klikkaus tallentavat, Esc peruu.

Otsikon oma kuvakepainike ja toimintorivin kynä on poistettu: nauha on ainoa
paikka, josta näitä muutetaan, ja otsikon kuvake on pelkkä kuva.

Issue `attention-sound`. Suositus ja kysymykset ovat issuen
`result-workspace-sounds-5.md`:ssä.

Kierros tuo kierroksen 5 `synth.mjs`:n (`../2026-11-21-attention-sounds-4/`)
sekä kierroksen 7 `emblems.tsx`:n, `text.ts`:n ja `round.css`:n
(`../2026-11-21-attention-sound-emblems-7/`). Jos jompikumpi poistuu ennen
tätä, kopioi tiedostot tähän hakemistoon. Nauhan A-asettelu ja äänivalitsin
on kopioitu kierroksesta 4, josta ei tuoda mitään.

Katselmointipalkki: Tilanne (`oma`, `oletus`, `kuvake`, `nimi`, `aani` ja
`pitka`), teema, kieli ja ”Agentti valmis”. `?s=`, `?theme=` ja `?lang=en`
valitsevat alkutilan. Tiedot ovat keksittyjä. `window.__rqHost()` palauttaa
tilan, `window.__rqPlays` ja `window.__rqSim` soitot.

## Rakentaminen ja tarkistus

```
npm ci --prefix web     # kerran, lukitiedoston mukaan
node design-system/prototypes/rounds/2026-11-21-workspace-strip-5/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright timeout 1700 \
  node design-system/prototypes/rounds/2026-11-21-workspace-strip-5/check.mjs \
  design-system/prototypes/dist/workspace-strip-5/offline.html <kuvahakemisto> [--quick]
```

Rakennus kirjoittaa `design-system/prototypes/dist/workspace-strip-5/`:een
`offline.html`:n (fontit upotettuina) ja `index.html`:n (ilman fontteja).
`check.mjs`:n alku kertoo, mitä se tarkistaa. `--quick` ajaa vain 1440 px:n
Päivä-teeman.

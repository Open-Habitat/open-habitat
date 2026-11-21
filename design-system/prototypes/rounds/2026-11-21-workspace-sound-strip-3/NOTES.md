# Työtilan ääni – kierros 3: asetusnauha, samankokoiset painikkeet

Jarin palaute kierrokseen 2 (21.11.): kokeillaan C Asetusnauhaa niin, että
nauhan kaikki painikkeet ovat samankokoisia. Sivupalkin rivin oikean reunan
nuotti jätetään pois. Merkit ovat kierroksen 7 suositellut.

Akseli: **nauhan muoto, kun kaikki painikkeet ovat samankokoisia.**

- **A Ruudut**: kolme samankokoista neliötä (152 × 152 px). Ylhäällä on sana,
  keskellä iso kuva ja alla arvo kahden rivin laatikossa. Puhelimessa kolme
  ruutua on rinnakkain, kapeampina ja matalampina (140 px).
- **B Leveät painikkeet**: kolme yhtä leveää saraketta otsikon levyisessä
  ruudukossa (enintään 840 px), korkeus 72 px. Kuva on vasemmalla ja sana arvon
  yllä. Puhelimessa painikkeet ovat allekkain (64 px).
- **C Yhtenäinen nauha**: yksi reunustettu nauha, joka on jaettu kolmeen yhtä
  leveään osaan. Osat ovat yhtä leveitä kuin levein sisältö, ja äänellä se
  tarkoittaa pisintä arvoa, jonka se voi saada (haamut). Puhelimessa nauha
  säilyttää kokonsa ja vierii sivulle.

Koko tulee aina ruudukosta eikä painikkeen omasta sanasta tai arvosta, joten
uusi arvo ei siirrä mitään. Kuvake ja Nimi eivät tee tässä kierroksessa
mitään. Nimeä uudelleen on siirretty toimintoriviltä nauhaan. Sivupalkin
riveillä ei ole äänipainiketta. Valitsin ja Asetusten rivit ovat kierroksen 2
mukaiset: kortin painallus valitsee ja soittaa, ja ▶ soittaa valitsematta.

Issue `attention-sound`. Suunnat, suositus ja kysymykset ovat issuen
`result-workspace-sounds-3.md`:ssä.

Sivu on tuotannon `AppShell`, `WorkspaceRail`, `WorkspaceNavRow` (ilman
`workspaceMenu`-paikan sisältöä) ja `AccountSettings`. Työtilan otsikko
käyttää tuotannon `WorkspacePage.css`-luokkia, ja keskustelulista on keksitty.
Valitsin on react-aria-componentsin `DialogTrigger`/`Popover`/`Dialog`.

Kierros tuo suoraan kierroksen 5 `synth.mjs`:n
(`../2026-11-21-attention-sounds-4/`) sekä kierroksen 7 `emblems.tsx`:n,
`text.ts`:n ja `round.css`:n (`../2026-11-21-attention-sound-emblems-7/`).
Jos jompikumpi kierros poistuu ennen tätä, kopioi tiedostot tähän
hakemistoon (myös `check.mjs` lukee `synth.mjs`:n). Kierroksesta 2 ei tuoda
mitään: sen valitsin ja Asetusten rivit on kopioitu tänne. Jokainen soitto
kirjautuu `window.__rqPlays`-taulukkoon ja jokainen ”Agentti valmis”
`window.__rqSim`-taulukkoon.

Katselmointipalkki: Tilanne (`oma` kotisivu omalla Pisaralla, `oletus`
aurinkokello oletuksella, `auki`, `pitkat` ja `pois` valitsin auki), Näkymä
(Työtila / Asetukset › Äänet), teema, kieli ja ”Agentti valmis” kahdelle
työtilalle. `?s=`, `?view=settings`, `?theme=` ja `?lang=en` valitsevat
alkutilan. Tiedot ovat keksittyjä.

## Rakentaminen ja tarkistus

```
npm ci --prefix web     # kerran, lukitiedoston mukaan
node design-system/prototypes/rounds/2026-11-21-workspace-sound-strip-3/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright timeout 1700 \
  node design-system/prototypes/rounds/2026-11-21-workspace-sound-strip-3/check.mjs \
  design-system/prototypes/dist/workspace-sound-strip-3/offline.html <kuvahakemisto> [--quick]
```

Rakennus kirjoittaa `design-system/prototypes/dist/workspace-sound-strip-3/`:een
`offline.html`:n (fontit upotettuina) ja `index.html`:n (ilman fontteja).
`check.mjs`:n alku kertoo, mitä se tarkistaa. Siihen kuuluu, että nauhan
kolmella painikkeella on sama laatikko puolen pikselin tarkkuudella, ettei
mikään arvo leikkaannu, ja ettei mikään painike, valitsin tai nimi siirry,
kun valinta käy läpi eripituisia arvoja suomeksi ja englanniksi. `--quick`
ajaa vain 1440 px:n Päivä-teeman.

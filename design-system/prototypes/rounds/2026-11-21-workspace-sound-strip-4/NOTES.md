# Työtilan ääni – kierros 4: asetusnauha, painikkeet sisältönsä kokoisina

Jarin palaute kierrokseen 3 (21.11.): B Leveät painikkeet on hyvä, mutta
kokeillaan painikkeita, joiden koko tulee siitä, mitä kukin tarvitsee.
Kuvake ja Ääni ovat neliöitä, joissa kuvake ja äänen merkki näkyvät isoina,
ja Nimi on matalampi ja leveämpi. Kaikki muu on kierroksen 3 mukaista:
sivupalkissa ei ole nuottia, merkit ovat kierroksen 7 suositellut, kortin
painallus valitsee ja soittaa, ▶ kuuntelee valitsematta, oletuskin näkyy.

Akseli: **sekanauhan järjestys ja mittasuhteet.**

- **A Yksi rivi**: Kuvake–Nimi–Ääni samalla rivillä, kaikki 128 px korkeita.
  Neliöissä sana on ylhäällä, kuva keskellä ja arvo alla kahden rivin
  laatikossa; Nimi on 300 px leveä ja näyttää nimen isona. Puhelimessa
  neliöt ovat 104 px ja Nimi saa loput leveydestä.
- **B Nimi ylhäällä**: Nimi on 60 px korkea palkki, joka on yhtä leveä kuin
  sen alla olevat kaksi 148 px:n neliötä yhdessä. Merkki on 76 px. Sama
  koko puhelimessa.
- **C Sanat ruutujen alla**: Nimi ensin, sitten Kuvake ja Ääni, yhdellä
  rivillä. Kehystetty laatikko on 104 px korkea, ja neliöissä on vain kuva
  (merkki 64 px); sana ja arvo ovat laatikon alla kiinteän korkuisessa
  kuvatekstissä. Puhelimessa neliöt ovat 96 px ja Nimi saa loput.

Painikkeen koko tulee sen lajista (neliö tai matala), ei arvosta, joten uusi
arvo ei siirrä mitään. Kuvake ja Nimi eivät tee tässä kierroksessa mitään.
Valitsin ja Asetusten rivit ovat kierroksen 3 (eli kierroksen 2) mukaiset.

Issue `attention-sound`. Suunnat, suositus ja kysymykset ovat issuen
`result-workspace-sounds-4.md`:ssä.

Sivu on tuotannon `AppShell`, `WorkspaceRail`, `WorkspaceNavRow` (ilman
`workspaceMenu`-paikan sisältöä) ja `AccountSettings`. Työtilan otsikko
käyttää tuotannon `WorkspacePage.css`-luokkia, ja keskustelulista on keksitty.
Valitsin on react-aria-componentsin `DialogTrigger`/`Popover`/`Dialog`.

Kierros tuo suoraan kierroksen 5 `synth.mjs`:n
(`../2026-11-21-attention-sounds-4/`) sekä kierroksen 7 `emblems.tsx`:n,
`text.ts`:n ja `round.css`:n (`../2026-11-21-attention-sound-emblems-7/`).
Jos jompikumpi kierros poistuu ennen tätä, kopioi tiedostot tähän
hakemistoon (myös `check.mjs` lukee `synth.mjs`:n). Kierroksesta 3 ei tuoda
mitään: tämä hakemisto on sen kopio, jonka nauha on tehty uudelleen. Jokainen
soitto kirjautuu `window.__rqPlays`-taulukkoon ja jokainen ”Agentti valmis”
`window.__rqSim`-taulukkoon.

Katselmointipalkki: Tilanne (`oma` kotisivu omalla Pisaralla, `oletus`
aurinkokello oletuksella, `auki`, `pitkat` ja `pois` valitsin auki), Näkymä
(Työtila / Asetukset › Äänet), teema, kieli ja ”Agentti valmis” kahdelle
työtilalle. `?s=`, `?view=settings`, `?theme=` ja `?lang=en` valitsevat
alkutilan. Tiedot ovat keksittyjä.

## Rakentaminen ja tarkistus

```
npm ci --prefix web     # kerran, lukitiedoston mukaan
node design-system/prototypes/rounds/2026-11-21-workspace-sound-strip-4/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright timeout 1700 \
  node design-system/prototypes/rounds/2026-11-21-workspace-sound-strip-4/check.mjs \
  design-system/prototypes/dist/workspace-sound-strip-4/offline.html <kuvahakemisto> [--quick]
```

Rakennus kirjoittaa `design-system/prototypes/dist/workspace-sound-strip-4/`:een
`offline.html`:n (fontit upotettuina) ja `index.html`:n (ilman fontteja).
`check.mjs`:n alku kertoo, mitä se tarkistaa: neliöt ovat keskenään samat ja
neliöitä, Nimi on leveämpi kuin korkea ja näyttää nimen yhdellä rivillä,
mikään arvo ei leikkaannu eikä valu painikkeen ulkopuolelle, ja mikään
painike, valitsin tai nimi ei siirry, kun valinta käy läpi eripituisia arvoja
suomeksi ja englanniksi, työpöydällä ja puhelimessa. `--quick` ajaa vain
1440 px:n Päivä-teeman.

# Työtilan ääni – kierros 2: ääni työtilan otsikossa

Jarin palaute ensimmäiseen kierrokseen (21.11.): Asetusten rivit ovat hyvät,
mutta kenttä hyppää, kun valinta vaihtuu. Työtilassa äänen pitää näkyä
selvästi ja olla ilmeisesti vaihdettavissa otsikossa, jossa on tilaa isoille
painikkeille. Merkki toimii isona eikä pienenä sanan vieressä. Painikkeen
kuvake on nuotti. Sivupalkissa ei ole pysyvää merkkiä, enintään nuotti rivin
päällä. Kortin painallus valitsee, ja jokaisella kortilla on oma
kuuntelupainike. Oletuskin näytetään (”Kalimba · oletus”).

- **A Valitsin otsikossa**: nimen vieressä iso valitsin, jossa on 44 px:n
  merkki, nuotti ja ”Ääni”, äänen nimi ja nuoli. Puhelimessa valitsin on
  omalla rivillään nimen alla.
- **B Kortti nimen alla**: nimen alla leveä kortti, jossa on 72 px:n merkki,
  ”Soi, kun agentti on valmis…”, nimi, oma vai oletus, Kuuntele ja
  Vaihda ääni.
- **C Asetusnauha**: otsikon alla rivi isoja asetuspainikkeita: Kuvake, Nimi
  ja Ääni. Nimeä uudelleen siirtyy toimintoriviltä nauhaan. Kuvake ja Nimi
  eivät tee tässä kierroksessa mitään.

Yhteistä kaikille: sama valitsin, sivupalkin nuotti, joka näkyy vain
osoittimen tai kohdistuksen ollessa rivillä (kosketusnäytöllä ei
lainkaan), ja kierroksen 1 Asetusten rivit. Valitsimessa kortin painallus
valitsee ja soittaa, ja ▶ kortin kulmassa soittaa valitsematta. Puhelimessa
kortit ovat kahden sarakkeen lista. Arvo on yhtä leveä kuin pisin arvo,
jonka se voi saada (`stableValue`). Siksi Asetusten painike, A:n valitsin
ja C:n nauha eivät liiku, eikä niihin ankkuroitu valitsin liiku. Merkit
ovat kierroksen 7 suositellut muunnelmat.

Issue `attention-sound`. Suunnat, suositus ja kysymykset ovat issuen
`result-workspace-sounds-2.md`:ssä.

Sivu on tuotannon `AppShell`, `WorkspaceRail`, `WorkspaceNavRow` (nuotti
`workspaceMenu`-paikassa) ja `AccountSettings`. Työtilan otsikko käyttää
tuotannon `WorkspacePage.css`-luokkia, ja keskustelulista on keksitty.
Valitsin on react-aria-componentsin `DialogTrigger`/`Popover`/`Dialog`.

Kierros tuo suoraan kierroksen 5 `synth.mjs`:n
(`../2026-11-21-attention-sounds-4/`) sekä kierroksen 7 `emblems.tsx`:n,
`text.ts`:n ja `round.css`:n (`../2026-11-21-attention-sound-emblems-7/`).
Jos jompikumpi kierros poistuu ennen tätä, kopioi tiedostot tähän
hakemistoon (myös `check.mjs` lukee `synth.mjs`:n). Jokainen soitto
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
node design-system/prototypes/rounds/2026-11-21-workspace-sound-picker-2/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright timeout 1500 \
  node design-system/prototypes/rounds/2026-11-21-workspace-sound-picker-2/check.mjs \
  design-system/prototypes/dist/workspace-sound-picker-2/offline.html <kuvahakemisto> [--quick]
```

Rakennus kirjoittaa `design-system/prototypes/dist/workspace-sound-picker-2/`:een
`offline.html`:n (fontit upotettuina) ja `index.html`:n (ilman fontteja).
`check.mjs`:n alku kertoo, mitä se tarkistaa. Siihen kuuluu, ettei mikään
siirry: painike, valitsin ja rivin nimi pysyvät puolen pikselin sisällä,
kun valinta käy läpi eripituisia arvoja. `--quick` ajaa vain 1440 px:n
Päivä-teeman.

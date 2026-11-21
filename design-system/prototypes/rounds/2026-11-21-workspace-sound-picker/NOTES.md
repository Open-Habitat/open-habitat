# Työtilan ääni – valitsin ja sen sisäänkäynnit

- **A Otsikossa**: työtilan otsikon toimintoriviin (Kopioi polku, Nimeä,
  Arkistoi) tulee äänipainike, jossa on työtilan äänen merkki. Oma ääni
  näkyy lisäksi pienenä merkkinä sivupalkin rivillä; oletusta seuraava
  työtila ei saa merkkiä.
- **B Nimen alla**: työtilan nimen ja polun alla on pilleri, jossa on merkki
  ja äänen nimi, ”Pisara” tai ”Kalimba · oletus”. Sitä painamalla valitsin
  aukeaa. Sivupalkki pysyy ennallaan.
- **C Asetuksissa**: vain Asetukset › Äänet › Työtilojen äänet. Rivin
  painike avaa valitsimen; työtilassa itsessään ei ole ääntä.

A:ssa ja B:ssä on myös Asetusten rivit, jotka avaavat saman valitsimen
(Jari 21.11.: ”todennäköisesti molemmat”).

Valitsin on sama kaikissa: otsikko ja työtilan nimi, ohje, ”Sama kuin
oletus” ensimmäisenä (oletusäänen merkki ja nimi, ”vaihtuu oletuksen
mukana”), sitten kierroksen 6 kymmenen B Väreilyn muoto -merkkiä 5 × 2
-ruudukossa. Painallus soittaa äänen henkilön pituudella (Lyhyet oletuksena)
ja valitsee sen; valitsin jää auki, joten muita voi kuunnella ennen
sulkemista. Nuolet, Home ja End siirtävät valintaa ja soittavat. Alalaita
kertoo pituuden ja linkittää Asetuksiin; Valmis ja Esc sulkevat ja
palauttavat kohdistuksen sisäänkäyntiin. Puhelimessa valitsin on
alareunan arkki kuten tuotannon työtilan kuvakevalitsin.

Issue `attention-sound`. Suunnat, suositus ja kysymykset ovat issuen
`result-workspace-sounds.md`:ssä.

Sivu on tuotannon `AppShell`, `WorkspaceRail` ja `WorkspaceNavRow`.
Työtilasivun otsikko käyttää tuotannon `WorkspacePage.css`-luokkia ja
`ControlButton`eja; keskustelulista on keksitty. Asetukset ovat tuotannon
`AccountSettings`, johon Äänet-osio lisätään kuten kierroksessa 6, ja sen
runko viedään portaalilla `.s-main`iin. Valitsin on react-aria-componentsin
`DialogTrigger`/`Popover`/`Dialog`, kuten tuotannon `WorkspaceIconPicker`.

Kierros tuo suoraan kierroksen 5 `synth.mjs`:n
(`../2026-11-21-attention-sounds-4/`) sekä kierroksen 6 `emblems.tsx`:n,
`text.ts`:n äänten nimet ja `round.css`:n
(`../2026-11-21-attention-sound-icons/`). Jos jompikumpi kierros poistuu
ennen tätä, kopioi tarvittavat tiedostot tähän hakemistoon (myös
`check.mjs` lukee `synth.mjs`:n). Jokainen soitto kirjautuu
`window.__rqPlays`-taulukkoon ja jokainen ”Agentti valmis”
`window.__rqSim`-taulukkoon.

Katselmointipalkki: Tilanne (`oma` kotisivu omalla Pisaralla, `oletus`
aurinkokello oletuksella, `valittu` valitsin kiinni, `pitkat`, `pois`),
Näkymä (Työtila / Asetukset › Äänet; suunnan oma näkymä on oletus), teema,
kieli ja ”Agentti valmis” kahdelle työtilalle. `?s=`, `?theme=` ja
`?lang=en` valitsevat alkutilan. Tiedot ovat keksittyjä (Aino Esimerkki,
työtilat `aurinkokello`, `kotisivu`, `muistiinpanot`).

## Rakentaminen ja tarkistus

```
npm ci --prefix web     # kerran, lukitiedoston mukaan
node design-system/prototypes/rounds/2026-11-21-workspace-sound-picker/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright timeout 1200 \
  node design-system/prototypes/rounds/2026-11-21-workspace-sound-picker/check.mjs \
  design-system/prototypes/dist/workspace-sound-picker/offline.html <kuvahakemisto> [--quick]
```

Rakennus kirjoittaa `design-system/prototypes/dist/workspace-sound-picker/`:iin
`offline.html`:n (fontit upotettuina) ja `index.html`:n (ilman fontteja).
`check.mjs`:n alku kertoo, mitä se tarkistaa; `--quick` ajaa vain 1440 px:n
Päivä-teeman.

# Laitteen mykistys tilivalikossa – attention-sound, kierros 5

- **A Rivi valikossa**: Äänet-rivi Teeman ja Agentin työn alla, `Soi | Hiljaa`; rivin alla laajuus ("Vain tämä laite") tai tila.
- **B Kaiutin**: kaiutinpainike tilipainikkeen vieressä sivupalkin alalaidassa; yksi painallus hiljentää tämän laitteen. Valikossa vain tila.
- **C Hiljennä hetkeksi**: valikossa `1 h` (kaikki laitteet tunniksi) ja `Tämä laite` (kunnes palautat); hiljaisena `Palauta`.

Issue `attention-sound`. Suunnat, suositus ja kysymykset ovat issuen
`result-mute-menu.md`:ssä.

Sivu on tuotannon kehys (`AppShell`, `WorkspaceRail`, `WorkspaceNavRow`).
Tilivalikko on tuotannon `AccountShelf` koottuna samoista osista (`Menu`,
`AccountIdentity`, `Segmented`, `ControlButton`, teeman ja työn näkyvyyden
tuotantofunktiot), koska `AccountShelf` ei ota lisärivejä. Kierroksen omia
ovat Äänet-rivi, tilarivi, B:n kaiutinpainike, merkki tilin kuvassa ja
kaiutinikoni (tuotannon `Icon`issa ei ole kaiutinta; toteutus lisää
`speaker`- ja `speakerOff`-ikonit). Pääalueella on katselmoinnin apu, joka
ei ole tuotetta: se näyttää, soiko ääni tällä laitteella ja puhelimessa,
ja "Agentti valmistuu" soittaa kierroksen 1 Oven yksinkertaistettuna, kun
tämä laite soisi. Soitot kirjautuvat `window.__smPlays`-taulukkoon.

Valikko avautuu itsestään (puhelimessa ensin laatikko), jotta suunnat
eroavat oletusnäkymässä. Avaus tehdään osoitinpainalluksena, koska
`el.click()` avaa valikon kuten näppäimistö ja piirtää kohdistusrenkaat.

`?s=<tilanne>`, `?theme=dark` ja `?lang=en` valitsevat alkutilan.
Tilanteet: `oletus`, `laite` (tämä laite hiljaa), `kaikkialla` (huomioääni
pois Asetuksista), `yo` (Hiljennä yöllä päällä ja laite on yötilassa, kello
23.10). Tiedot ovat keksittyjä (Aino Esimerkki).

## Rakentaminen ja tarkistus

```
npm ci --prefix web     # kerran, lukitiedoston mukaan
node design-system/prototypes/rounds/2026-11-21-sound-mute-menu/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright timeout 900 \
  node design-system/prototypes/rounds/2026-11-21-sound-mute-menu/check.mjs \
  design-system/prototypes/dist/sound-mute-menu/offline.html <kuvahakemisto>
```

Rakennus kirjoittaa `design-system/prototypes/dist/sound-mute-menu/`:iin
`offline.html`:n (fontit upotettuina) ja `index.html`:n (ilman fontteja).
Tarkistus käy kolme suuntaa ja neljä tilannetta 1440 ja 390 px:n
leveydellä vaaleana ja tummana (valikko auki, tilarivi, merkki vain
mykistetyllä laitteella, B:n kaiutin näkyvissä, A:n rivi pois käytöstä
vain kun ääni on pois kaikkialta, ei ylivuotoa), sitten 1440 px:ssä
jokaisen suunnan polun (mykistys ja palautus, puhelin soi yhä, yö pysyy
hiljaisena laitteen palautuksen jälkeen, pois kaikkialta lukitsee, C:n
tunti hiljentää kaikki laitteet, näppäimistö), yhden polun 390 px:ssä ja
englannin. `--quick` ajaa vain 1440 px vaalean.

## Havainnot rakentaessa

- Tuotannon tilipainikkeen kohdistusvihje ("Aino, Tilivalikko") aukeaa
  oikealle ja peittää B:n kaiutinpainikkeen, kun valikko suljetaan Escillä
  ja kohdistus palaa tilipainikkeeseen. B tarvitsisi vihjeelle toisen
  paikan tai kaiuttimen tilipainikkeen sisään.
- Puhelimessa sivupalkki on laatikossa, joten B:n "yksi painallus" on
  puhelimessa kaksi (avaa laatikko, paina kaiutinta), samoin kuin A:n
  kolme (laatikko, valikko, Hiljaa).

# Äänten merkit – kierros 6

- **A Esine renkaissa**: renkaiden keskellä äänen esine (kalimba, marimban
  laatat, pisara, kaksi lasia, kulho, jääpuikot …). Renkaat ovat äänen
  lyönnit, kuten kierroksen 3 B:ssä, ja leviävät soidessa.
- **B Väreilyn muoto**: ei kuvaa. Renkaiden oma muoto kertoo esineen:
  soikeat vesirenkaat pisaran alla, kuusikulmainen jää, kahden lasin
  renkaat limittäin, kuplat erillään, kulhon huojuva leveä rengas. Soidessa
  väreily leviää samassa muodossa ja kunkin lyönnin omasta kohdasta.
- **C Värähtelykuvio**: rengas taipuu äänen osasävelten mukaan,
  r(θ) = R(1 + Σ a·cos nθ): lasin (2,0)-soikio, kalimban kielen noin
  kuusinkertainen yläsävel kuutena aaltona, marimban neljä, jään terävä
  tähti. Soidessa kuvio leviää ja kiertyy hieman.

Issue `attention-sound`. Suunnat, suositus ja kysymykset ovat issuen
`result-icons.md`:ssä.

Sivu on tuotannon kehys (`AppShell`, `WorkspaceRail`) ja `AccountSettings`
kuten kierroksessa 3: Äänet-osio lisätään ladattaessa
`shownSettingsSections`-luetteloon Ulkoasun jälkeen, ja osion runko viedään
portaalilla `.s-main`iin. Rivit ovat tuotannon `s-card`/`s-row`-rivejä ja
tuotannon `Segmented`, `ChoiceMenu`, `IconButton`, `ScaleSlider` ja
`ControlButton`. Kierroksen omia ovat laatat, merkit (`emblems.tsx`) ja
huomautusrivit.

Äänet ovat kierroksen 5 kymmenen lopullista ääntä. `round.tsx` tuo ne
suoraan tiedostosta `../2026-11-21-attention-sounds-4/synth.mjs`, joten
reseptit ja molemmat pituudet ovat täsmälleen ne, jotka Jari kuuli. Jos
kierros 5 poistuu ennen tätä, kopioi `synth.mjs` tähän hakemistoon (myös
`check.mjs` lukee sen). Ääni renderöidään ensimmäisellä soitolla
(`renderSound`, 48 kHz stereo) ja soitetaan yhden gain-solmun kautta laitteen
voimakkuudella. Lyhyet/Pitkät valitsee, kumpi resepti soi. Merkin
lepokuva on äänen tunniste ja piirretään lyhyestä reseptistä, joten se ei
vaihdu pituuden mukana. Soidessa leviävät renkaat tulevat soitetun pituuden
lyönneistä: pitkissä Kuplissa on seitsemän lyöntiä, lyhyissä viisi.
Jokainen soitto kirjautuu `window.__rqPlays`-taulukkoon (ääni, pituus,
näytteet, voimakkuus) ja jokainen ”Agentti valmis” `window.__rqSim`-taulukkoon.

`?s=<tilanne>`, `?theme=dark|contrast`, `?motion=reduced` ja `?lang=en`
valitsevat alkutilan. Tilanteet: `oletus`, `pitkat`, `yo` (laite
yötilassa), `pois`, `mykistetty`. Tiedot ovat keksittyjä (Aino Esimerkki,
työtilat `aurinkokello`, `kotisivu`, `muistiinpanot`).

## Rakentaminen ja tarkistus

```
npm ci --prefix web     # kerran, lukitiedoston mukaan
node design-system/prototypes/rounds/2026-11-21-attention-sound-icons/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright timeout 1800 \
  node design-system/prototypes/rounds/2026-11-21-attention-sound-icons/check.mjs \
  design-system/prototypes/dist/attention-sound-icons/offline.html <kuvahakemisto> [--quick]
```

Rakennus kirjoittaa `design-system/prototypes/dist/attention-sound-icons/`:iin
`offline.html`:n (fontit upotettuina) ja `index.html`:n (ilman fontteja).

Tarkistus:

- Kierroshakemistossa ei ole ääni-, kuva- tai HTML-tiedostoja eikä mitään
  yli 100 kt:n kokoista.
- Kolme suuntaa ja viisi tilannetta 1440 ja 390 px:n leveydellä Päivä-, Yö-
  ja Korkea kontrasti -teemoissa.
- Kunkin suunnan kymmenen merkkiä rasteroidaan laskettuine tyyleineen, ja
  jokaista paria verrataan. Erottuvan musteen osuuden pitää olla yli 0,2
  koko merkissä. A:ssa vertaillaan lisäksi pelkät kuvat (yli 0,4), koska
  sen renkaat ovat tarkoituksella yhteiset.
- Molemmat pituudet: painallus soittaa lyhyen reseptin tarkan näytemäärän,
  Pitkät soittaa pitkän reseptin, ja leviävien renkaiden määrä on soitetun
  pituuden lyöntien määrä.
- Nuolinäppäimet, ”Agentti valmis” -säännöt, työtilan oma ääni ja sen
  rivin merkki, mykistys, yö, Äänet pois, vähennetty liike, englanti ja
  yksi puhelinpolku. Lopuksi konsolin pitää olla puhdas.

`--quick` ajaa vain 1440 px:n Päivä-teeman.

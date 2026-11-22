# Yöhiljaisuus näkyviin: Asetukset › Äänet

Issue `attention-sound-night-visible`. Jari 22.11.2026: ääni ei soinut,
koska Hiljennä yöllä seuraa laitteen tummaa tilaa, eikä mikään kertonut
sitä. Asetussivun pitää sanoa heti ylhäällä, että äänet ovat hiljaa, koska
on yö. Tuotannossa sen kertoo vain yörivin pieni "Nyt yö" -rivi sivun
puolivälissä ja laitekortin huomautus aivan lopussa.

Akseli: **missä sivu sanoo, että äänet ovat hiljaa yön takia, ja mikä on
yö**. Kaikissa suunnissa sisältö on muuten sama kuin tuotannon
Äänet-sivulla.

- **A Tilarivi**: sivun otsikon alla ensimmäisenä rivi "Äänet ovat nyt
  hiljaa: on yö", syy (laite on tummassa tilassa, Hiljennä yöllä on päällä,
  milloin soi taas) ja painikkeet *Soita silti* ja *Yön asetukset*, joka
  vie yöriville. Yö on edelleen laitteen tumma tila.
- **B Pääkytkin**: ei erillistä riviä. Äänet-rivi itse kertoo tilan: Yö-merkki
  nimen vieressä, "Päällä, mutta nyt hiljaa: on yö", kuu Päällä-valinnassa,
  syy ja *Soita silti* saman kortin sisällä. Hiljennä yöllä nousee samaan
  korttiin pääkytkimen alle, koska se on pääkytkimen ehto.
- **C Kello**: A:n tilarivi, mutta yö on kellonaika: Hiljennä yöllä
  Pois/Päällä ja sen alla Alkaa klo 22.00 – Päättyy klo 7.00 (muokattava).
  Rivi kertoo, milloin äänet soivat taas ("hiljaa klo 7.00 asti").
  Laitteen tumma tila ei vaikuta.

Kaikissa suunnissa, kun äänet ovat hiljaa yön takia: laattojen yllä
lukee, että kuuntelu (laatan painallus ja Testaa ääni) ohittaa
yöhiljaisuuden mutta agentin äänet pysyvät hiljaa, ja Testaa ääni
-painikkeen alla "Testi soi myös yöllä". *Soita silti* ohittaa
yöhiljaisuuden tältä laitteelta tämän yön; sivu ja tilivalikko näyttävät
silloin "soi tämän yön" ja *Hiljennä taas*.

Tilivalikko on työpöydällä auki sivupalkin päällä, ja sen Äänet-rivi
lukee saman tilan: A pelkkä tilarivi ("Hiljaa yön takia: laite on
tummassa tilassa"), B Yö-merkki ja *Soita silti*, C "Yö: hiljaa klo 7.00
asti" ja *Soita silti tänä yönä*.

Katselmointipalkissa ovat Tilanne, teema, kieli, laite ja Alusta.
Tilanteet: *Klo 23.40, laite tummassa tilassa* (oletus: yö kaikissa),
*Klo 14.10, laite tummassa tilassa koko päivän* (A ja B ovat hiljaa
keskellä päivää, C soi) ja *Klo 14.10, laite vaaleassa tilassa* (kaikki
soivat, tilariviä ei ole). Oletusnäkymässä työpöytä ja 390 px:n puhelin
ovat rinnakkain; alle 1180 px:n ikkunassa vain työpöytä.

Osoitevalinnat: `?v=1..3`, `?theme=dark`, `?lang=en`,
`?scenario=night|darkday|day`, `?device=both|desktop|phone`.
Puhelinkehys on sama sivu valinnoilla `?bare=1&d=0..2`.

Sivu on tuotannon asetuskehys (Settings.css:n luokat, osioluettelo
`settingsIndex`istä), tuotannon kontrollit (`Segmented`, `ChoiceMenu`,
`ControlButton`, `IconButton`, `ScaleSlider`), merkit (`SoundEmblem`),
SoundSettings.css ja oikeat äänet (`attentionSound.playSound`). Sivun
runko on kopio `SoundSettings.tsx`:stä suunnan muutoksin paikallisella
tilalla; verkkoa ei käytetä. Sisältö on synteettistä.

## Rakentaminen ja tarkistus

```
npm ci --prefix web     # kerran, lukitiedoston mukaan
node design-system/prototypes/rounds/2026-11-22-night-quiet/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright timeout 900 \
  node design-system/prototypes/rounds/2026-11-22-night-quiet/check.mjs \
  design-system/prototypes/dist/night-quiet/offline.html <kuvahakemisto>
```

Linuxissa komennot ajetaan scratch-leasen alla yksityisellä `TMPDIR`:llä
ja `umask 077`:llä. Rakennus kirjoittaa hakemistoon
`design-system/prototypes/dist/night-quiet/` tiedostot `offline.html`
(fontit upotettuina) ja `index.html` (ilman fontteja). `check.mjs`:n
alussa kerrotaan, mitä se tarkistaa.

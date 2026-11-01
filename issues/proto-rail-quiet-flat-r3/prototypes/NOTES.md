# Hiljaisten yksi valikko rajaa ja järjestää: opas (kierros 3)

Avaa `hiljaiset-r3.html`. Se on yksi offline-sivu, ja ylhäällä on
valitsin (näppäimet 1–4 tai ←/→). Sivu alkaa kuvakkeet päällä viidellä
työtilalla (22 keskustelua, joista 17 Hiljaisissa). Valikko on valmiiksi
auki, joten jokaisen suunnan muoto näkyy heti. Vasemmalla olevassa
kortissa **Taitettuna** näkyy saman suunnan taitettu osio, kun avoinna on
Hiljaisten *Verbien taivutus*. Kaikki suunnat eroavat siis jo
oletusnäkymässä:

- **Lähtökohta**: kierroksen 2 suunta 1. Otsikon päässä *Uusin ensin ⌄*,
  ja valikossa on vain kolme järjestystä, ei rajausta.
- **1 · Pudotusvalikko**: otsikon päässä *Kaikki ⌄*. Valikossa ensin
  Järjestys, sitten Työtila nimineen ja määrineen. Yksi valinta sulkee
  valikon, ja puhelimessa valikko on alalehti. Taitettuna näkyy vain avoin
  rivi korostettuna.
- **2 · Kuvakeruudukko**: otsikon päässä kolmen kuvakkeen pino. Ikkunassa
  järjestys on kolmena lohkona ja työtilat kuvakeruutuina. Valinta näkyy
  heti, ja ikkuna jää auki (*Valmis*). Taitettuna näkyvät avoin rivi ja
  rivi piilotettujen työtilojen kuvakkeita määrineen; kuvakkeen napautus
  avaa osion rajattuna siihen.
- **3 · Sarakeotsikko**: otsikon päässä on kaksi taulukon sarakemerkkiä
  (järjestys ja suppilo), jotka syttyvät käytössä. Valikossa on neljä
  järjestystä, haku ja työtilat valintaruutuineen: nimi näyttää vain sen,
  ruutu lisää tai poistaa yhden. Taitettuna merkit jäävät otsikkoon.

Sama luettelo on sivun yläosassa jokaisessa näkymässä.

Kaikille kolmelle yhteistä: valinta toimii heti ilman OK-painiketta.
Työtila ja järjestys seuraavat sinua kaikille laitteille, ja otsikon
laskuri kertoo rajauksen (*4/17*). Taitto muistetaan laitteella. Avoin
keskustelu ei katoa, kun taitto tai rajaus piilottaisi sen: se jää
näkyviin, ja vasemmalla on aksenttiviiva.

## Mistä muoto tuli

Excelissä, Google Sheetsissä ja Numbersissa sarakeotsikon valikko alkaa
järjestyksellä, joka toimii yhdellä painalluksella. Rajaus sen sijaan on
hidas: Excelissä ja Sheetsissä tyhjennetään ruudut, valitaan yksi ja
painetaan OK, ja Numbersissa *Quick Filter* on vielä oma askeleensa. Tästä
otin kolme asiaa:

1. Järjestys on valikossa ylinnä ja toimii yhdellä painalluksella.
2. Työtilan **nimi** tarkoittaa suoraan *vain tämä*, eikä OK:ta ole.
   Suunnassa 3 Excelin ruudut ovat mukana monivalintaa varten.
3. Otsikko näyttää, mikä on käytössä, kuten Excelin suppilo: suunnassa 1
   painikkeen teksti, suunnassa 2 kuvake ja suunnassa 3 syttyvät merkit.

## Kokeile näin

1. Selaa 1 → 2 → 3 ja katso avointa valikkoa sekä vasenta korttia
   *Taitettuna*.
2. Valitse kussakin *vain open-habitat* ja sitten *Uusin ensin*.
   Tapahtumarivi laskee painallukset valikon avauksesta. Suunnassa 2
   ikkuna jää auki.
3. Vaihda oikealta **Puhelin**: rajaus on sama, koska se on tilin asetus.
   Suunnassa 1 valikko on puhelimessa alalehti.
4. Avaa Hiljaisista *Verbien taivutus*, rajaa toiseen työtilaan ja taita
   osio: avoin rivi jää näkyviin. Suunnassa 2 napauta taitetun osion
   kuvaketta.
5. **Suunta 3**: rajaa yhteen työtilaan ja lisää toinen ruudusta.
   Suppilossa näkyy 2.
6. **Paljon** (kymmenen työtilaa): katso, miten pitkäksi kukin valikko
   kasvaa.

Suosittelen suuntaa **1**, ja taitetuksi tilaksi sen omaa (avoin rivi
korostettuna). Perustelut, hostin tiedot ja kysymykset ovat issuen
`result.md`:ssä. Kuvat ovat hakemistossa `kuvat/` laitteen skaalauksella 2.

Sivu rakennetaan komennolla `python3 build.py` tiedostosta `page.src.html`.
Kuvat otetaan komennolla
`node shots.mjs <polku>/hiljaiset-r3.html <hakemisto>`, joka myös klikkaa
jokaisen säätimen ja tapahtuman jokaisessa näkymässä, ja ne muunnetaan
AVIF-kuviksi komennolla `scripts/screenshots-to-avif.py`.

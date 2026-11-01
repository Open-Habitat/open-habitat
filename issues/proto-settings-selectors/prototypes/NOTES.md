# Asetusten valitsimet: opas

Avaa `valitsimet.html`. Se on yksi offline-sivu, ja ylhäällä on valitsin
(näppäimet 1–4 tai ←/→). Sivulla on vierekkäin asetussivu työpöydällä ja
puhelimessa: Ulkoasu (Teema, Kieli, Viimeisimmät keskustelut), Tilannekatsauksen
laajuus Omilla luvuilla (kolme askellinta yksikköineen) sekä Agentin työ ja
Editori. Oikealla ylhäällä vaihdat kielen (alkaa englanniksi, kuten näit sen),
asetusalueen leveyden ja teeman. Sivun alla oleva *Mitattu*-taulukko kertoo
jokaisen valitsimen koon ja sen, rivittyykö se.

Oletuksena asetusalue on 760 px leveä, mikä vastaa noin 1040 px ikkunaa
sivupalkin kanssa. Siinä mainin Kieli rivittyy kuten näit: *English (UK)*
jää yksin toiselle riville. 1000 px leveydellä se mahtuu.

- **Lähtökohta**: kuten mainissa. Segmentit 26 px, Kieli rivittyy kapeassa,
  askeltimen luku on oikeassa reunassa ja − / + ovat pieniä. Puhelimessa
  Teema venyy koko leveäksi ja Kieli ei.
- **1 · Yksi sarake**: kortin valitsimet ovat yhtä leveitä ja 32 px
  korkeita, segmentit tasalevyisiä, ja askellin venyy samaan leveyteen luku
  ja yksikkö keskellä. Jos sarake ei mahdu otsikon viereen, koko kortti
  siirtyy otsikoiden alle kerralla; liian kapea segmentti menee 2 × 2.
- **2 · Valikko monelle**: segmentti vain 2–3 lyhyelle vaihtoehdolle.
  Kieli ja Katsauksen laajuus ovat pudotusvalikko, jossa vaihtoehdon alla on
  selitys (puhelimessa alalehti). Askellin on tiivis [− 12 +] ja yksikkö sen
  perässä. Valikko on valmiiksi auki, jotta sen muoto näkyy heti.
- **3 · Luettelo**: valitsin on aina otsikon alla koko rivin levyisenä.
  Kieli ja Laajuus ovat valintaluettelo selityksineen, askellin on kenttä
  yksikköineen ja erilliset − / +.

Sama luettelo on sivun yläosassa jokaisessa näkymässä.

Suuntien 1–3 yhteinen sääntö: luku kertoo aina, mitä se laskee, myös
*5 keskustelua*, ja asetusrivin segmentit ovat `row`-kokoa (32 px, puhelimessa
40 px) eivätkä koskaan rivity niin, että yksi jää yksin.

## Kokeile näin

1. Selaa 0 → 1 → 2 → 3 englanniksi ja katso Kieli-riviä molemmissa
   kehyksissä sekä alla olevaa *Mitattu*-taulukkoa.
2. Vaihda **Suomi**: *Järjestelmä* on pisin nimi. Lähtökohdassa myös Teema
   rivittyy.
3. Vaihda leveydeksi **1000**: suunta 1 näyttää vasta nyt sarakkeen otsikon
   vieressä.
4. Paina askeltimia ja kirjoita lukuun 77 Katsauksen pituuteen (askel 5,
   tulos 75), ja kokeile ↑ / ↓ kentässä.
5. Suunnassa 2 avaa puhelimessa Katsauksen laajuus: alalehti.

Suosittelen suuntaa **2**. Perustelut ja kysymykset ovat issuen
`result.md`:ssä. Kuvat ovat hakemistossa `kuvat/` laitteen skaalauksella 2.

Sivu rakennetaan komennolla `python3 build.py` tiedostosta `page.src.html`.
Kuvat otetaan komennolla `node shots.mjs <polku>/valitsimet.html <hakemisto>`,
joka myös klikkaa jokaisen valitsimen jokaisessa suunnassa, ja ne muunnetaan
AVIF-kuviksi komennolla `scripts/screenshots-to-avif.py`.

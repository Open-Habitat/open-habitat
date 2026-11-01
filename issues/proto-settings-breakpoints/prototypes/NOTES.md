# Asetusten taitekohdat: opas

Avaa `taitekohdat.html`. Se on yksi offline-sivu, ja ylhäällä on
valitsin (näppäimet 1–4 tai ←/→). Kehys on Open Habitat ikkunana:
vasemmalla sovelluksen sivupalkki, oikealla Asetukset Tili-osio auki.
Kehyksen leveyttä muutetaan vetämällä sen oikeaa reunaa, valmiista
leveyksistä tai napsauttamalla käyrää. Taitekohdat ovat liukusäätimiä
ja numerokenttiä, ja niiden muutos näkyy kehyksessä ja käyrässä heti.

Sivu alkaa 1000 px:n ikkunasta sivupalkki auki. Jokainen suunta näyttää
sen eri tavalla, ja oikean reunan käyrä kertoo saman koko leveysalueelta:

- **Nykyinen**: tuotanto nyt. Lista väistyy vasta, kun *ikkuna* on alle
  760 px. 1000 px:n ikkunassa sisältöä on 338 px, ja pahimmillaan
  (810 px) vain 163 px, jolloin sähköposti katkeaa ja Muokkaa
  Git-identiteettiä -painike leikkautuu.
- **1 · Ikkuna**: sama mekanismi, raja nostettu 1140 px:iin.
  1000 px:ssä näkyy pino (osio ja ← Asetukset). Lista väistyy myös
  silloin, kun sivupalkki on kapea ja tilaa olisi (kuva 04).
- **2 · Asetusalue**: rajaa ei mitata ikkunasta vaan asetusten
  omasta alueesta sivupalkin oikealla puolella (770 px). 1000 px:ssä
  näkyy pino, mutta kapean sivupalkin kanssa lista nimineen. Listan
  vieressä sisältöä on aina vähintään 480 px.
- **3 · Kuvakkeet**: kuten 2, mutta kun asetusalue on
  520–770 px, osiolista näkyy pelkkinä kuvakkeina. 1000 px:ssä lista on
  kuvakkeina ja sisältöä on 528 px.

Sama luettelo on sivun yläosassa.

## Mitä mitataan

Käyrä on mitattu kehyksen kopiosta 10 px:n välein tämän suunnan
taitekohdilla: yhtenäinen viiva sivupalkki auki, katkoviiva kapea
sivupalkki. Väri kertoo asettelun: turkoosi lista nimin, oranssi
kuvakelista, harmaa pino. Punainen katkoviiva on 480 px. Sitä
leveämmässä sarakkeessa nimi ja sähköposti pysyvät ehjinä ja kuvaukset
ovat noin 60 merkin rivejä. Muokkaa Git-identiteettiä -painike siirtyy
nimen alle jo noin 510 px:ssä, ja se on siisti. Käyrän alla on kaksi
lukua: kapein sisältö listan vieressä ja leveys, jonka alla tulee pino.

Kaksi asiaa näkyy käyrästä kaikissa suunnissa. Sivupalkki tulee
takaisin 800 px:n kohdalla ja vie heti 296 px, ja siksi nykyisen
sisältö putoaa juuri siinä 163 px:iin. Lisäksi asetukset eivät levene
loputtomiin: sovelluksen pääalue on enintään 960 px, ja reunus kasvaa
ikkunan mukana, joten sisältö kapenee hieman yli 1250 px:n ikkunoissa.

## Kokeile näin

1. Selaa Nykyinen → 1 → 2 → 3 oletusleveydellä ja katso kehystä ja käyrää.
2. Vedä kehyksen reunaa hitaasti 1300:sta 700:aan. Nykyisessä sisältö
   kapenee ensin, ja vasta 760 px:n kohdalla tulee pino. Suunnassa 2
   pino tulee noin 1170 px:ssä.
3. Vaihda **Kapea 52 px**. Suunta 1 näyttää yhä pinoa 1100 px:ssä,
   suunta 2 listaa jo 900 px:stä alkaen.
4. Pinossa ← Asetukset vie osiolistaan, ja osion nimi avaa sen taas.
5. Vaihda **English** ja **Tumma**, ja avaa Ulkoasu tai Kokeelliset
   ominaisuudet: pitkät englanninkieliset kuvaukset.
6. Säädä suunnan rajaa liukusäätimellä ja katso, miten käyrän
   kapein kohta muuttuu. *Rivin ohjain otsikon alle* -raja (400) ja
   *sovelluksen sivupalkki pois* -raja (800) ovat kaikille suunnille
   yhteiset.

Suosittelen suuntaa **2** 770 px:n rajalla. Perustelut, hostin tiedot
ja kysymykset ovat issuen `result.md`:ssä. Kuvat ovat hakemistossa
`kuvat/` laitteen skaalauksella 2.

Sivu rakennetaan komennolla `python3 build.py` tiedostosta
`page.src.html`. Kuvat otetaan komennolla
`node shots.mjs <polku>/taitekohdat.html <hakemisto>`, joka myös klikkaa
jokaisen säätimen, kehyksen navigaation ja reunan jokaisessa suunnassa.
Ne muunnetaan AVIF-kuviksi komennolla `scripts/screenshots-to-avif.py`.

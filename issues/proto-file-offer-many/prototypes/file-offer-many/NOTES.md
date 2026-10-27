# Agentin tiedosto ihmiselle · Kierros 3: monta tiedostoa

Kierroksella 1 valitsit Kortin. Kierroksella 2 suosittelin yksittäisen
tiedoston kortiksi Kurkistusta, ja se on tässä oletuksena: juliste näkyy
kortissa pysähtyneenä kuvana. Tämä kierros katsoo, miten sama kortti
kantaa paljon tiedostoja.

Keskustelussa *Kumppanipaketti ja somekuvat* (työtila `kevatkampanja`)
agentti tarjoaa neljä kertaa:

1. klo 13.06: yksi tiedosto, `juliste-a2.png`
2. klo 13.19: *Kumppanipaketti*, kansio `kumppanipaketti/`, jossa on
   32 tiedostoa. Neljässä etappikansiossa on 5–6 valokuvaa ja reitin
   GPX-tiedosto, kansiossa `logot/` on kolme logoa, ja juuressa ovat
   `LUE-MINUT.md`, kaksi PDF:ää ja `tekijanoikeudet.txt`.
3. klo 13.33: *Somekuvat*, 12 kuvaa ilman alikansioita
4. klo 13.47: *Kumppanipaketti* uudelleen samasta kansiosta. Kaksi kuvaa
   on vaihtunut ja yksi logo on tullut lisää, eli tiedostoja on 33.

Nimet ja luvut on keksitty, ja kuvat piirretään sivulla.

Kaikissa suunnissa on sama korjatun paketin käsittely. Uudemman kortin
yläosa sanoo *Korvaa klo 13.19 tarjotun version: 2 muuttunutta, 1 uusi*,
ja vanhan kortin yläosa *Uudempi versio klo 13.47*. Siitä pääsee toiseen
korttiin, ja muuttuneilla tiedostoilla on merkki *muuttunut* tai *uusi*.
Myös esikatselu on kaikissa sama kuin aiemmin. Kuvat selataan ‹ ›
-painikkeilla tai nuolinäppäimillä saman tarjouksen sisällä (”3 / 24”),
ja ikkuna kertoo kansion.

Kierros vertailee yhtä asiaa: **mikä jäsentää paljon tiedostoja.**
Vaihtoehdot ovat tiedoston tyyppi, agentin tekemä kansio ja koko
keskustelun yhteinen hylly.

## Kolme suuntaa

| Suunta | Miltä paketti näyttää | Miten tiedoston löytää myöhemmin | Vahvuus | Hinta |
| --- | --- | --- | --- | --- |
| 1 Ryhmät | Kortissa on rivi kuvia (viisi ja *+16*) ja sen alla ryhmät: Valokuvat 21, Logot 4, Reitit 4, Asiakirjat 4. Ryhmä aukeaa paikallaan, ja jokaisella rivillä näkyy kansio harmaana. Lisäksi on *Lataa kaikki (.zip)* ja *Selaa kuvia (21)*. | Yläpalkin *Tiedostot*-painike suodattaa keskustelusta pelkät tiedostokortit ja antaa hakukentän. Haku ”nauvo-satama” jättää näkyviin kaksi korttia ja kummastakin yhden rivin. | Kortti on aina saman kokoinen tiedostomäärästä riippumatta, ja tyyppi on usein se, mitä ihminen hakee: ”ne kuvat”. Keskustelun järjestys säilyy myös suodatettuna. | Kansiorakenne litistyy: etappi 2:n kuvat eivät ole yhdessä paikassa, vaan kansio näkyy vain rivin harmaana tekstinä. Suodatus on uusi tila koko keskustelulle. |
| 2 Kansio | Kortti on paketin kansio. Juuressa ovat kansiot, ja jokaisella on tiedostomäärä, koko ja kolme pikkukuvaa. Kansiota painamalla avautuu kuvaruudukko, ja polusta pääsee takaisin. Kansion voi ladata zipinä erikseen (*Lataa kansio*). | Kortissa on hakukenttä *Etsi paketista*. Haku koskee vain yhtä tarjousta. Korvattu versio pienenee yhdeksi riviksi (*korvattu klo 13.47 uudemmalla versiolla*), ja sen voi avata. | Agentin tekemä rakenne säilyy sellaisenaan, kuten pyysit: kumppani löytää etappinsa. Lanka pysyy lyhyimpänä, koska vanha versio taittuu pois. | Etsiessä pitää ensin tietää, missä tarjouksessa tiedosto on. Litteä tarjous (Somekuvat) on pelkkä ruudukko. Kortissa on oma navigaatio, joka on uusi vuorovaikutusmalli keskustelun sisällä. |
| 3 Hylly | Kortti on tiivis kooste: kuvanauha, kansioiden nimet tiedostomäärineen sekä *Lataa kaikki (.zip)* ja *Näytä tiedostot*. | Yläpalkin tiedostopainikkeessa (46) avautuu paneeli, joka on puhelimessa koko ruudun kokoinen. Paneelissa ovat kaikki keskustelun tarjoukset uusimmasta alkaen kansioittain, haku kaikista tarjouksista, valitun tiedoston esikatselu sekä *Aiemmat versiot* omana osionaan. | Löytäminen on helpointa: yksi haku koko keskustelusta, ja vanha versio on tallessa mutta ei tiellä. Lanka pysyy rauhallisena. | Tiedosto ei näy kortissa, joten näkeminen vaatii aina toisen paikan. Se on uusi paneeli yläpalkissa, ja hosti tarvitsee keskustelukohtaisen tarjouslistan. |

Yksittäinen tiedosto (juliste) on kaikissa sama Kurkistus-kortti.

## Kokeile

Avaa tiedosto selaimessa:

```
issues/proto-file-offer-many/prototypes/file-offer-many/index.html
```

Sivu toimii yhdestä tiedostosta ilman verkkoa. Suuntaa vaihdetaan
alareunan valitsimella tai näppäimillä **1–3** ja **←/→**. Yläreunasta voi
vaihtaa teeman ja puhelinleveyden.

Tehtävä on sama kaikissa: **löydä klo 13.19 paketista `nauvo-satama.jpg`,
ja lataa sitten etappi 2:n kuvat kumppanille.**

1. **Ryhmät**: paina yläpalkin *Tiedostot* ja kirjoita ”nauvo”. Avaa
   uudemman paketin Valokuvat-ryhmä ja selaa kuvia nuolilla.
2. **Kansio**: avaa uudemmasta paketista `etappi-2-nauvo-korppoo/` ja
   paina *Lataa kansio*. Hae ”lautta”, ja avaa vanha versio *Näytä tämä
   versio*.
3. **Hylly**: paina yläpalkin tiedostopainiketta (46) ja hae ”nauvo”.
   Valitse rivi, niin esikatselu näkyy paneelin yläosassa. Avaa
   *Somekuvat*-kortin *Näytä tiedostot*.

## Kysymykset sinulle

- Kumpi on tärkeämpää: että paketin rakenne näkyy keskustelussa (Kansio)
  vai että kaikki tiedostot löytyvät yhdestä paikasta (Hylly)? Suosittelen
  Kansiota ja sen päälle myöhemmin Hyllyn paneelia, kun keskusteluissa on
  oikeasti kymmeniä tarjouksia.
- Kun agentti tarjoaa saman kansion uudelleen, saako vanha versio
  pienentyä yhdeksi riviksi, vai pitääkö sen näkyä kokonaan siellä, missä
  se tarjottiin?
- Riittääkö *Lataa kaikki* zipinä koko paketille, vai tarvitaanko myös
  kansiokohtainen zip (Kansiossa *Lataa kansio*)?

Kuvat ovat hakemistossa `evidence/` (laitteen skaalaus 2). Jokaisesta
suunnasta on koko keskustelu työpöydällä ja puhelimessa, vaaleana ja
tummana. Lisäksi on kuvia vuorovaikutuksista: `-ryhmat-auki`, `-suodatus`,
`-kansiossa`, `-haku-ja-aiempi`, `-paneeli`, `-paneeli-haku` ja `-galleria`.

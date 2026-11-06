# Selitystila, kierros 7: painallus toimii ja keskustelun tila

Avaa `selitystila-tila.html`. Se on yksi offline-sivu eikä käytä verkkoa.
Näkymät ovat tuotannon oikeita näkymiä synteettisestä labrasta, ja kortit
ovat kierroksen 6 tyylillä 1 (Mitä · tiedä · kokeile), jonka valitsit.

Yläreunassa on yksi rivi siitä, mikä muuttui kaikissa, ja yksi rivi kustakin
riffistä. Valitsimesta (näppäimet 1–3) vaihdat riffiä.

**Kaikissa riffeissä:**

- **Kiinnitys napsauttamalla on poistettu.** Kun osoitat kohtaa, saat sen
  kortin. Napsautus tekee saman kuin aina, ja selitystila pysyy päällä:
  *6 työkalua · 1 epäonnistui* (tuotannon ”1 ajatus ja 3 työkalua”) avautuu,
  komentorivi avautuu, Pääte ja Git aukeavat, ja niiden kohdat selittyvät
  heti. Kortin alarivi kertoo, mitä napsautus tekee (*Napsautus: avaa työ.*).
- **Pysyvät teot odottavat.** Arkistointi, poisto, uloskirjautuminen, tyhjän
  keskustelun sulkeminen, lähettäminen, pysäyttäminen, päätteen sulkeminen
  ja tallennus eivät tee selitystilassa mitään. Kortti sanoo sen, jotta
  mitään ei tapahdu vahingossa.
- **Puhelimessa** ensimmäinen napautus näyttää kortin, ja siinä on teko
  painikkeena (*Avaa työ*). Toinen napautus samaan kohtaan tekee sen.
- **Keskustelun tila.** Kun selitystila on keskustelussa etkä osoita mitään,
  kortti kertoo, missä keskustelu on (*Tilanne nyt*): mitä tapahtuu, mitä
  kannattaa tietää ja *Voit nyt*: kaksi tai kolme tekoa. Rivi sytyttää
  kohdan, jota se tarkoittaa, ja napsautus tekee sen. Tiloja on kuusi: ei
  vielä alkanut, työskentelee, odottaa sinua, pysäytit vuoron, vuoro
  epäonnistui, sekä odottaa sinua ja työ jatkuu taustalla.

**Riffit: miten tilan selitykseen pääsee muulloin kuin keskustelun alussa**

1. **Tilapisteestä** (suositus). Yläpalkin tilapiste kertoo jo nyt tilan
   sanoin, kun sitä napauttaa. Sen alle tulee rivi *Mitä nyt? Selitä
   tilanne*. Uutta painiketta ei tule; selitys löytyy sieltä, mistä tila
   näkyy.
2. **Selitä-painike.** Pysyvä ?-painike yläpalkissa ja ?-näppäin. Aina
   näkyvissä jokaisessa keskustelussa, mutta vie yhden paikan rivillä;
   puhelimella otsikko lyhenee.
3. **Tilanne tarjoaa.** Kun keskustelu on tilassa, jota et ole vielä nähnyt,
   vuoron alle tulee hiljainen rivi, esimerkiksi *Vuoro epäonnistui. Mitä
   nyt kannattaa tehdä? · Selitä tilanne*. Kukin vihje näkyy kolme kertaa ja
   katoaa sitten.

Kaikissa riffeissä *Tilivalikko › Selitä tämä näkymä* ja aloitussivun nauha
säilyvät kierroksen 6 mukaisina, ja molemmat avaavat tilan tilakortista.

## Kokeile näin

1. Avautuessa riffi 1 on näkymässä *Odottaa sinua* ja tilapisteen rivi
   on auki. Paina *Mitä nyt? Selitä tilanne*.
2. Tilakortti tulee. Vie osoitin riville *Avaa agentin työ*: *6 työkalua*
   syttyy. Napsauta riviä tai itse kohtaa: työ avautuu, ja olet yhä
   selitystilassa.
3. Osoita komentoriviä *bash ls* ja napsauta: tuloste avautuu. Osoita
   *Kopioi koodi*.
4. Osoita yläpalkin Arkistoi-painiketta ja napsauta: mitään ei tapahdu, ja
   kortti kertoo miksi.
5. Vaihda *Näkymä*-listasta *Työskentelee*, *Pysäytit vuoron*, *Vuoro
   epäonnistui* ja *worker jatkaa taustalla*, ja katso tilakortti.
6. Vaihda valitsimesta 2 (? yläpalkissa) ja 3 (vihjerivi vuoron alla)
   näissä samoissa näkymissä.
7. Vaihda *Puhelin 390*: napauta kohtaa kerran ja toisen kerran. Tilakortin
   × sulkee sen, ja napautus tyhjään tuo sen takaisin.
8. *Kaikki kortit* -sivulla on nyt myös kuuden tilan tekstit suomeksi ja
   englanniksi.

## Rajat

- Tila tunnistetaan prototyypissä kaapatusta näkymästä. Toteutus johtaisi sen
  siitä, mitä yläpalkin tilapiste jo näyttää.
- *Pysäytit vuoron* on kaapattu labran pitkästä ajosta, joka pysäytettiin
  kesken: siinä ei ole vastausta, vain taitettu työ.
- Vihjeen ”kolme kertaa per tila” on prototyypissä vain teksti: vihje
  näkyy aina riffissä 3.
- Kortti S02 (Yhteys) osui kierroksella 6 jokaiseen tilamerkkiin, myös vuoron
  *Agentti työskentelee* -merkkiin. Se on nyt rajattu sivupalkin
  yhteysmerkkiin.

Kuvat ovat issuen `evidence/`-hakemistossa etuliitteellä `r7-`. Suositus ja
kysymykset ovat issuen `result.md`:ssä.

## Rakentaminen ja tarkistus

Lähde: `design-system/prototypes/rounds/2026-11-06-selitystila-tila/`. Kortit
tulevat kierroksen 6 tiedostosta `cards.mjs`, ja kierroksen omat tekstit
(tilat, muutetut ja uudet kortit) ovat tiedostossa `state.mjs`.

```
OH_PORT_BASE=6374 scripts/lab.sh start && PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
  node design-system/prototypes/rounds/2026-11-06-selitystila-tila/capture.mjs
node design-system/prototypes/rounds/2026-11-06-selitystila-tila/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
  node design-system/prototypes/rounds/2026-11-06-selitystila-tila/shoot.mjs issues/proto-explain-mode-r6/evidence
python3 scripts/screenshots-to-avif.py issues/proto-explain-mode-r6/evidence
```

Tarkistus käy läpi jokaisen riffin, näkymän ja leveyden (riffi 1 myös
tummana). Se osoittaa tai napauttaa jokaista kohtaa ja varmistaa, että tilakortti
näkyy ja pysyy näkymässä. Lisäksi se painaa: työ ja komentorivi avautuvat
selitystilassa, Arkistoi odottaa, tilakortin rivi tekee tekonsa, jokaisen
riffin sisäänkäynti avaa tilakortin, puhelimen ensimmäinen napautus vain
selittää, ja Esc, Lopeta, nauha sekä Kaikki kortit toimivat. Tulos: 6137
selitystä 212 näkymäyhdistelmässä ja 88 tilakorttia. Avoimen listan
peittämiä kohtia oli 1456, tavoittamattomia 0 ja näkymän ulkopuolelle
meneviä kortteja 0. Tilakortti ei peittänyt ankkuriaan, ja konsoli pysyi
puhtaana.

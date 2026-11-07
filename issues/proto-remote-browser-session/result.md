# Tulokset

## Kierros 4 (7.11.2026): pyyntö ikkunalle

Kierros: `design-system/prototypes/rounds/2026-11-07-palvelinselain-pyynto/`
(NOTES.md kertoo tarinan ja ohjaimet). Jari päätti kierroksen 3 jälkeen:
siru on kentän yllä. Riffataan sitä, mitä sirusta aukeaa, kun agentilla on
monta ikkunaa ja yksi niistä tarvitsee henkilöä: pyynnön pitää kuulua sille
ikkunalle, ja tarkempi katselu ei saa ottaa ohjausta agentilta. Akseli on
se, missä pyyntö on ja kuinka laajalle ohjauksen ottaminen ulottuu. Kaikissa
riffeissä pysyvät siru ja palkki kentän yllä, nuoli ja klikkausten jälki sekä
selain sivupalkin ylimpänä tekstirivinä. Oletusnäkymä on hetki, jolloin
Netvisor-ikkuna pyytää vahvistuskoodia kolmesta ikkunasta.

- **1 Alla – pyyntö ikkunan alla**: pyyntö on sen ikkunan kuvan alla, joka tarvitsee sinua; painallus avaa arkin katseltavaksi, ja ohjaus otetaan arkissa erikseen koko selaimelle.
- **2 Esiin – ikkuna esiin**: sinua tarvitseva ikkuna nousee palkissa isoksi ja pyyntö on sen vieressä; kuvaa voi katsoa isompana, ja *Ota ohjaus ja syötä koodi* on yksi nimetty painallus.
- **3 Ikkunalle – ohjaus ikkunalle**: pyyntö on ikkunan kuvassa, ja ohjaus otetaan vain siihen ikkunaan; agentti jatkaa muissa ikkunoissa, ja jokainen ikkuna kertoo, kuka sitä ohjaa.

Kuvat: `evidence/r4-<riffi>-<vaihe>-<leveys>-<teema>.avif`, riffit
`1-ikkunan-alla`, `2-ikkuna-esiin` ja `3-ohjaus-ikkunalle`. Vaiheet:
`0-oletus` (pyyntö, myös tummana), `1-katselet` (kuvasta avattu arkki
katselutilassa, agentti jatkaa), `2-otit` (ohjaus otettu arkissa), `3-pyynto`
(pyynnön painikkeesta avattu arkki: riffissä 1 katselu, riffeissä 2 ja 3
ohjaus), `4-vahvistettu` (koodi hyväksytty, takaisin antaminen odottaa),
`5-ohjaat` (arkki suljettu, palkki sanoo *Sinä ohjaat*), `6-jatkaa`
(annettu takaisin, agentti jatkaa), `7-isompi` (vain riffi 2: pieni kuva
isona palkissa) ja `8-rivi` (sivupalkin rivi; puhelimessa valikko auki).

### Mitä kukin riffi päättää

| | 1 Alla | 2 Esiin | 3 Ikkunalle |
|---|---|---|---|
| Pyynnön paikka | teksti ja *Syötä koodi* ikkunan kuvan alla | kortti ison kuvan vieressä | merkki kuvassa, *Ota tämä ikkuna* kuvan alla |
| Pyynnön painike | avaa arkin katseltavaksi | ottaa ohjauksen ja avaa arkin (*Katso ensin* vain katsoo) | ottaa ikkunan ja avaa arkin |
| Painalluksia koodiin | kaksi (katso, ota ohjaus) | yksi | yksi |
| Ohjauksen laajuus | koko selain, agentti odottaa | koko selain, agentti odottaa | yksi ikkuna, agentti jatkaa muissa |
| Katselu arkissa | otsikon pilleri ja alapalkki | nauha ruudun yllä | nauha ja välilehtien *agentti/sinä/odottaa sinua* |
| Isompi kuva palkissa | ei, kuva avaa arkin | pieni kuva nousee isoksi, *Seuraa agenttia* palauttaa | ei, kuva avaa arkin |
| Hinta | yksi painallus lisää kiireessä | palkki on korkea, puhelimessa varsinkin | isännälle uusi ikkunakohtainen ohjaus (alla), ja agentti toimii henkilön vieressä |

Yhteistä: vain sinua tarvitseva ikkuna kantaa pyynnön, ja palkin alarivi
kertoo, mitä agentti tekee, toistamatta pyyntöä. Siru nimeää ikkunan
(*Netvisor odottaa sinua*). Kuva, *Katso isona* ja sivupalkin rivi
avaavat arkin aina katseluun: etäsivu ei ota syötettä, ja agentti jatkaa.
Ohjaus otetaan vain nimetyllä painikkeella. Arkin sulkeminen ei palauta
ohjausta, vaan siru ja rivi sanovat *Sinä ohjaat*, kunnes henkilö painaa
*Anna takaisin agentille*.

### Suositus

**2 Esiin.** Se vastaa suorimmin Jarin kahteen huomioon. Pyyntö on kortti
juuri sen ikkunan kuvan vieressä, joten sitä ei voi lukea muiden ikkunoiden
asiaksi. Painike sanoo, mitä se tekee (*Ota ohjaus ja syötä koodi*), ja
*Katso ensin* on erikseen. Siksi katselu ja ohjaus eivät sekoitu, vaikka
koodiin pääsee yhdellä painalluksella. Isompi kuva palkissa antaa tarkemman
katselun avaamatta arkkia, ja arkin nauha kertoo tilan kuvan päällä, jossa
silmä joka tapauksessa on.

- **1** on varmin erottelu, mutta MFA-koodilla on kiire, ja painallus, joka
  vain avaa näkymän, jossa pitää painaa uudelleen, tuntuu esteeltä.
- **3** on houkutteleva (agentti ei seiso turhaan), mutta se vaatii isännältä
  ikkunakohtaisen ohjauksen, jota tutkimus ei kattanut. Lisäksi henkilö ja
  agentti toimisivat samassa selaimessa yhtä aikaa, mikä on vaikeampi
  selittää. Ehdotan sen ikkunakohtaisia välilehtimerkintöjä (*agentti tässä*,
  *sinä ohjaat*) riffiin 2 ilman ikkunakohtaista ohjausta.

### Host-tiedot

- **Katselu ei maksa agentille mitään.** noVNC:llä on katselutila
  (`viewOnly`), jossa se ei lähetä hiiri- eikä näppäintapahtumia. Arkki
  avautuu siinä, ja selainisäntä ei muuta mitään. Agentin CDP-asiakas jatkaa.
  Isompi kuva palkissa on sama pienikuva suurempana.
- **Ohjauksen ottaminen on isännän olemassa oleva kytkin.** Tutkimuksen
  selainisäntä "kieltäytyy uusista asiakkaista, kun henkilö on ottanut
  ohjauksen" ja daemon välittää "ota ohjaus" -kytkimen. Riffeissä 1 ja 2
  kytkin pysäyttää agentin syötteen koko selaimeen ja noVNC vaihtaa
  `viewOnly`-tilasta pois. *Anna takaisin agentille* kääntää molemmat.
  Pyynnön ratkeaminen (koodi hyväksytty) ei palauta ohjausta itsestään,
  koska isäntä ei tiedä, onko henkilö valmis.
- **Pyyntö kuuluu ikkunalle**: agentti kertoo tavallisessa vastauksessaan,
  mikä ikkuna tarvitsee henkilöä. Näkymä tarvitsee siitä ikkunan
  tunnisteen (CDP-kohde), jotta pyyntö voidaan kiinnittää oikeaan kuvaan.
  Prototyyppi olettaa, että Habitatin selaintaito antaa agentille tavan
  merkitä pyyntö kohteeseen (esim. `selain pyydä --kohde <id>`), ja isäntä
  julkaisee sen tilassaan kuten osoittimen. Tämä on uusi pieni rajapinta,
  ei uusi varasto, ja se täytyy vahvistaa toteutuksessa.
- **Riffi 3 vaatisi ikkunakohtaisen ohjauksen**: isännän pitäisi hylätä
  agentin `Input.*`-viestit vain henkilön ikkunan CDP-istunnossa ja
  päästää muut läpi. X:n syöte (henkilön hiiri ja näppäimistö noVNC:stä)
  menee kuitenkin X:n fokusikkunaan, eikä X tiedä CDP-ohjauksesta. Agentin
  `Target.activateTarget` tai uusi ikkuna voisi siis viedä fokuksen kesken
  henkilön kirjoittamisen. Tämä pitää kokeilla ennen kuin riffi 3 valitaan.
- Kierrosten 2 ja 3 oletukset pätevät yhä: osoitin agentin CDP-syötteestä,
  ikkunat CDP-kohteista ja taustaikkunoiden kuvat isännän omasta
  CDP-istunnosta.

### Kysymykset Jarille

1. **Missä pyyntö on: kuvan alla, ison kuvan vieressä vai kuvassa?**
   `r4-1-ikkunan-alla-0-oletus-1440-light`,
   `r4-2-ikkuna-esiin-0-oletus-1440-light`,
   `r4-3-ohjaus-ikkunalle-0-oletus-1440-light`. Suositus 2.
2. **Pyynnön painike: avaako se vain katseltavaksi (1) vai ottaako se
   ohjauksen, kun painike sanoo sen (2 ja 3)?**
   `r4-1-ikkunan-alla-3-pyynto-1440-light`,
   `r4-2-ikkuna-esiin-3-pyynto-1440-light`. Suositus 2.
3. **Koko selain vai yksi ikkuna: odottaako agentti, kun otat ohjauksen,
   vai jatkaako se muissa ikkunoissa?**
   `r4-2-ikkuna-esiin-2-otit-1440-light`,
   `r4-3-ohjaus-ikkunalle-2-otit-1440-light`. Suositus koko selain (2);
   ikkunakohtainen ohjaus vaatii ensin isäntäkokeen.

### Näyttäminen

```
node design-system/prototypes/rounds/2026-11-07-palvelinselain-pyynto/build.mjs
open-habitat agent view offer --current \
  --source design-system/prototypes/dist/palvelinselain-pyynto/offline.html \
  --title "Oma palvelinselain – kierros 4: pyyntö ikkunalle" \
  --idempotency-key "$(uuidgen)" --json
```

### Tarkistus

`check.mjs`: 329 tarkistuspistettä, konsoli puhdas. Jokainen riffi ajettiin
1440 ja 390 px vaaleana koko tarinan läpi. Oletuksessa tarkistettiin, että
pyyntöjä on yksi, se on Netvisor-ikkunan osa ja palkin alarivi ei toista
sitä, siru nimeää ikkunan, kukaan ei ottanut ohjausta pyytämällä ja agentti
odottaa (riffissä 3 jatkaa muissa ikkunoissa). Lisäksi tarkistettiin, että
kuvasta avattu arkki on katselutilassa, agentti etenee katselun aikana ja
osoitin näkyy arkissa. Ohjauksen ottaminen tarkistettiin koko selaimelle tai
riffissä 3 yhdelle ikkunalle, samoin agentin odottaminen tai jatkaminen ja
takaisin antaminen. Pyynnön oma painike tarkistettiin (riffissä 1 katselu),
samoin koodin syöttäminen ohjatessa, pyynnön katoaminen, takaisin antaminen
palkista ja agentin jatkaminen. Riffissä 2 tarkistettiin isompi kuva ja
*Seuraa agenttia*. Tarkistettiin myös odottavan keskustelun *Siirrä tälle* -painike,
sivupalkin rivistä katseluun avautuva arkki sekä valmis ja vapaa. Oletukset
ajettiin myös tummana. Kuvat ovat kertoimella 2 (AVIF). Kyse on synteettisestä
komponenttilabrasta, jota ei ole ajettu hostia vasten. Kierros ei muuttanut
tuotantokoodia.

### Päätökset myöhempää katselmointia varten

- **Oletusnäkymä on pyyntö**, ei agentin työ, koska kierros koskee pyyntöä.
  *Agentti työssä* on kohtauspainikkeen takana.
- **Koodin hyväksyminen ei palauta ohjausta**: henkilö antaa selaimen
  takaisin itse, koska hän voi haluta tehdä muutakin.
- **Arkin sulkeminen ei palauta ohjausta.** Siru ja rivi muistuttavat
  ohjauksesta, ja palkissa on *Anna takaisin agentille*. Vaihtoehto olisi
  kysyä sulkiessa; se olisi taas yksi este.
- **Ohjatessa ruudun ympärillä on tekstinvärinen kehys** koko ruudun
  ympärillä, ei värillinen reunaviiva. Tila on aina myös sanoina.

## Kierros 3 (7.11.2026): siru ja palkki

Kierros: `design-system/prototypes/rounds/2026-11-07-palvelinselain-siru/`
(NOTES.md kertoo tarinan ja ohjaimet). Jari päätti kierroksen 2 jälkeen:
keskustelussa on siru, josta aukeaa palkki pienine kuvineen. Siru ja palkki
kantavat agentin kaikki ikkunat, agentin osoitin ja klikkaukset näkyvät, ja
selain on yksi rivi sivupalkissa. Kierroksen akseli on sirun paikka ja se,
mihin palkki aukeaa. Osoittimen muoto ja sivupalkin rivi vaihtelevat
riffeittäin, jotta niistäkin voi valita. Tarina: *Lokakuun ostolaskut* työskentelee kolmessa
ikkunassa (Netvisor, kustannuspaikat, AWS:n lasku), ja *Rekrytointi: myyjä*
odottaa vuoroaan. Kesken työn Netvisor pyytää koodia, ja lopuksi agentti
sulkee ylimääräiset ikkunansa ja selain siirtyy odottavalle.

- **1 Siru vuorossa**: siru agentin vuoron lopussa avaa palkin keskusteluun; osoitin on nimetty piste, ja selain on sivupalkin ylin rivi.
- **2 Siru kentän yllä**: siru kirjoituskentän yllä kaikissa keskusteluissa avaa palkin kentän päälle; osoitin on nuoli, jonka perässä näkyvät viimeiset klikkaukset, ja sivupalkin rivillä on pieni kuva.
- **3 Siru otsikossa**: siru otsikkorivillä avaa palkin otsikon alle, ja ikkuna, jossa agentti toimii, on siinä isona; osoittimessa lukee keskustelun nimi, ja selain on sivupalkin alin rivi.

Kuvat: `evidence/r3-<riffi>-<vaihe>-<leveys>-<teema>.avif`, riffit
`1-vuorossa`, `2-kentan-ylla` ja `3-otsikossa`. Vaiheet: `0-oletus` (myös
tummana), `1-siru` (palkki kiinni), `2-toinen` (odottava keskustelu ja
*Siirrä tälle*), `3-arkki` (kuvasta avattu arkki ikkunoineen ja
osoittimineen), `4-pyytaa` (koodi kesken työn), `5-valmis` (valmis, toinen
keskustelu käyttää), `6-vapaa` (molemmat valmiit) ja `7-rivi` (sivupalkin
rivi; puhelimessa valikko auki).

### Mitä kukin riffi päättää

| | 1 Siru vuorossa | 2 Siru kentän yllä | 3 Siru otsikossa |
|---|---|---|---|
| Sirun paikka | historiassa sen keskustelun lopussa, jonka työtä se kuvaa | kentän yllä kaikissa keskusteluissa | otsikkorivillä kaikissa keskusteluissa |
| Palkki | aukeaa historiaan ja vierittyy sen mukana | aukeaa kentän päälle eikä vierity pois | aukeaa otsikon alle; agentin ikkuna isona, muut pieninä |
| Mitä näyttää | keskustelun oman työn; valmiina viimeisen sivun | yhteisen selaimen sellaisena kuin se on nyt | yhteisen selaimen sellaisena kuin se on nyt |
| Osoitin | piste ja *Agentti* | nuoli ja kahden edellisen klikkauksen jälki | nuoli ja keskustelun nimi |
| Sivupalkin rivi | ylin, kuvake ja teksti | ylin, pieni elävä kuva | alin, tilivalikon yllä |
| Hinta | vierittyy pois ja näkyy vain kahdessa asianomaisessa keskustelussa | vie kentän yltä tilaa jokaisessa keskustelussa | puhelimessa otsikko lyhenee ja palkki vie puolet näytöstä |

Yhteistä: siru kertoo ikkunoiden määrän ja kuka selainta käyttää ja avaa ja
sulkee palkin. Palkissa jokainen ikkuna on pieni kuva, ja ikkunan, jossa
agentti toimii, alla lukee *agentti tässä*. Viimeisin klikkaus jää renkaaksi.
Kuvan painaminen avaa arkin siihen ikkunaan. Arkissa ikkunat ovat
välilehtinä, ja mukana on *Seuraa agenttia*. Etänäyttö skaalataan tasaisesti,
joten osoitin osuu samaan kohtaan kuvassa ja arkissa. Sivupalkin rivi
*Oma selain* kertoo, kuka käyttää ja montako ikkunaa on auki, ja avaa arkin.

### Suositus

**1 Siru vuorossa, osoittimena riffin 2 nuoli ja klikkausten jälki,
sivupalkin rivi ylimpänä tekstinä (riffi 1).**

- **Paikka 1**: Jari valitsi Pyydettäessä-suunnan, koska se antaa tilaa.
  Kiinni oleva siru on yksi rivi siinä keskustelussa, jonka työtä se kuvaa,
  eikä vie tilaa muilta keskusteluilta. Kun sivupalkissa on nyt selaimen
  rivi, yhteistä tilaa ei tarvitse toistaa jokaisen keskustelun kentän
  yllä (2) tai otsikossa (3). Valmiin työn siru jää historiaan viimeisine
  sivuineen, mikä vastaa kierroksen 2 suositusta jähmettyneestä kuvasta.
  **2** pitää selaimen näkyvissä vieritettäessä, mutta vie tilaa kaikista
  keskusteluista. **3** on aina näkyvissä ja näyttää agentin ikkunan isona,
  mutta puhelimen otsikkorivi ei kanna sirua.
- **Osoitin 2**: nuoli luetaan heti osoittimeksi, ja klikkausten jälki
  kertoo pysäytyskuvastakin, mitä agentti juuri painoi. Nimilappua ei
  tarvita, koska selainta ohjaa yksi kerrallaan ja siru ja rivi kertovat,
  kuka. Riffin 1 piste ja nimi peittävät pientä kuvaa eniten.
- **Rivi 1**: ylin rivi on lähellä keskusteluja, joita se koskee. Pieni kuva
  (2) on 51 × 32 px, joten siitä ei tunnista mitään. Alin rivi (3) jää
  tilivalikon viereen, kauas keskusteluista.

### Host-tiedot

**Osoitin piirretään agentin syötetapahtumista, ei X:n osoittimesta.** CDP:n
`Input.dispatchMouseEvent` toimitetaan Chromen sisällä suoraan sivulle, eikä
se kulje X-palvelimen kautta, joten X:n osoitin ei liiku. Myöskään noVNC ei
näytä etäosoittimen paikkaa, vaan se piirtää osoittimen katsojan omaan
hiiren kohtaan. Pelkkä etäkuva ei siis näyttäisi agentin osoitinta
koskaan. Playwrightin `click()` ja `hover()` lähettävät
`mouseMoved`/`mousePressed`/`mouseReleased`-tapahtumat sivun
koordinaateissa (CSS-pikseleinä). Selainisäntä omistaa CDP-putken ja välittää
jo jokaisen viestin, joten se voi lukea nämä viestejä muuttamatta ja
julkaista tilassaan viimeisimmän kohdan: ikkuna (CDP-istunnosta kohteeseen),
x, y ja klikkaus. Daemon välittää tämän katsojalle, eikä mitään tallenneta.
Näkymä muuntaa sivun koordinaatit kuvaan ikkunan sijainnin ja selaimen
yläpalkin korkeuden avulla (`Browser.getWindowForTarget`), ja tasainen
skaalaus pitää kuvan ja arkin samoina. Vaihtoehto, jossa agentti liikuttaisi
oikeaa X-osoitinta (`xdotool` jokaisen CDP-klikkauksen rinnalla), tekisi
saman työn kahdesti, kilpailisi henkilön oman osoittimen kanssa ja jäisi
silti näkymättä noVNC:ssä. Rajat:

- Toimi, jossa ei ole hiiritapahtumaa, ei näy osoittimena: `fill()`
  (`Input.insertText`), näppäimet ja skriptin `element.click()`
  (`Runtime.evaluate`). Niistä jää vain toimen teksti.
- Varakeinossa (computer use, `xdotool`) X:n osoitin liikkuu oikeasti.
  Isäntä voi lukea sen paikan X:ltä (`XQueryPointer`) ja julkaista sen samalla
  tavalla.

**Ikkunat**: isäntä näkee CDP:n `Target.targetCreated`/`targetDestroyed`
-tapahtumat (tyyppi `page`) ja tietää, minkä asiakkaan pyynnöstä ikkuna
avattiin (`Target.createTarget` tai sivun `window.open`, `openerId`). Siitä
saadaan ikkunoiden lista nimineen ja osoitteineen ilman uutta varastoa.

Prototyypin oletukset, jotka toteutuksen pitää vahvistaa:

- **Taustaikkunoiden kuvat.** X-näyttö näyttää vain päällimmäisen ikkunan,
  joten noVNC-kuvassa ei näy muiden ikkunoiden sisältöä. Pienet kuvat
  tulisivat isännän omasta CDP-istunnosta (`Page.captureScreenshot` harvalla
  välillä tai `Page.startScreencast` katsottaessa). Täytyy kokeilla, piirtääkö
  Chrome peitetyt ikkunat X11:llä ajan tasalle; taustavälilehdet se jättää
  piirtämättä.
- **Arkin välilehti.** Arkki näyttää noVNC:llä päällimmäisen ikkunan.
  Toisen ikkunan valinta joko nostaa sen päällimmäiseksi
  (`Target.activateTarget`) tai näyttää sen screencast-kuvana, kunnes
  henkilö ottaa ohjauksen. Ikkunan nostaminen agentin työn aikana saattaa
  muuttaa sivun fokusta. Prototyyppi ei ota tähän kantaa.
- **Agentti sulkee ikkunansa.** Tarinassa agentti sulkee lopuksi
  avaamansa ylimääräiset ikkunat (taidon ohje). Edellisen keskustelun
  auki jättämät ikkunat näkyisivät seuraavalle. Prototyyppi ei näytä tätä.
- Kierroksen 2 oletukset pätevät yhä: keskustelun nimi isännälle
  (nimilappu, ei valtuus), odottajan tieto daemonille ja *Siirrä tälle*
  ohjauksen ottamisen muunnelmana.

### Kysymykset Jarille

1. **Sirun paikka: 1, 2 vai 3?** `r3-1-vuorossa-0-oletus-1440-light`,
   `r3-2-kentan-ylla-0-oletus-1440-light`,
   `r3-3-otsikossa-0-oletus-1440-light`. Suositus 1.
2. **Osoittimen muoto: piste ja nimi, nuoli ja klikkausten jälki vai nuoli ja
   keskustelun nimi?** `r3-1-vuorossa-3-arkki-1440-light`,
   `r3-2-kentan-ylla-3-arkki-1440-light`,
   `r3-3-otsikossa-3-arkki-1440-light`. Suositus nuoli ja jälki (2).
3. **Sivupalkin rivi: ylin tekstirivi, rivi pienellä kuvalla vai alin
   rivi?** `r3-1-vuorossa-7-rivi-390-light`,
   `r3-2-kentan-ylla-7-rivi-390-light`, `r3-3-otsikossa-7-rivi-390-light`.
   Suositus ylin tekstirivi (1).

### Näyttäminen

```
node design-system/prototypes/rounds/2026-11-07-palvelinselain-siru/build.mjs
open-habitat agent view offer --current \
  --source design-system/prototypes/dist/palvelinselain-siru/offline.html \
  --title "Oma palvelinselain – kierros 3: siru ja palkki" \
  --idempotency-key "$(uuidgen)" --json
```

### Tarkistus

`check.mjs`: 321 tarkistuspistettä, konsoli puhdas. Jokainen riffi ajettiin
1440 ja 390 px vaaleana koko tarinan läpi. Oletuksessa tarkistettiin kolme
ikkunaa, yksi agentin ikkuna, sirun paikka, liikkuva osoitin ja klikkauksen
merkki. Lisäksi ajettiin palkin sulkeminen ja avaaminen, odottava keskustelu
ja *Siirrä tälle*, kuvasta avattu arkki (kolme välilehteä, osoitin, vain
katseltava, ikkunan valinta), ohjauksen ottaminen (agentti pysähtyy eikä
osoitinta näy) ja takaisin antaminen, koodi kesken työn arkissa, valmis ja
vapaa sekä sivupalkin rivistä avattu arkki. Oletukset ajettiin myös tummana.
Kuvat ovat kertoimella 2 (AVIF). Kyse on synteettisestä komponenttilabrasta,
jota ei ole ajettu hostia vasten. Kierros ei muuttanut tuotantokoodia.

### Päätökset myöhempää katselmointia varten

- **Riffit vaihtelevat kolmea asiaa yhtä aikaa** (paikka, osoitin ja rivi),
  jotta kaikki kolme Jarin pyytämää asiaa ovat valittavissa yhdellä
  kierroksella. Osat ovat riippumattomia ja yhdisteltävissä.
- **Palkki on oletuksena auki**, jotta ikkunat ja osoitin näkyvät
  oletusnäkymässä. Vaihe `1-siru` näyttää sirun yksin.
- **Riffeissä 2 ja 3 siru näyttää selaimen sellaisena kuin se on nyt**,
  myös valmiissa keskustelussa. Riffissä 1 siru kuuluu keskustelun omaan
  työhön.

## Kierros 2 (7.11.2026): pienoiskuva

Kierros: `design-system/prototypes/rounds/2026-11-07-palvelinselain-kuva/`
(NOTES.md kertoo tarinan ja ohjaimet). Jari valitsi kierroksella 1 suunnan
3 Pyydettäessä. Kierroksen akseli on agentin selaintyön pienoiskuva, kun
arkki on kiinni. Tarina on kaikissa sama: *Lokakuun ostolaskut* lataa
laskuja Ainon selaimella, ja *Rekrytointi: myyjä* haluaa samaa selainta ja
odottaa vuoroaan. Kesken työn Netvisor pyytää koodia, ja lopuksi selain
siirtyy odottavalle keskustelulle.

- **1 Kuva keskustelussa**: iso elävä kuva keskustelun lopussa; kun agentti odottaa sinua, kuva on itse pyyntö, ja toisen keskustelun kuva kertoo, kuka selainta käyttää.
- **2 Palkki kentän yllä**: kapea palkki pienellä kuvalla kirjoituskentän yllä kaikissa keskusteluissa; se nimeää keskustelun, joka selainta käyttää, ja sen, joka odottaa.
- **3 Kelluva ikkuna**: pieni ikkuna keskustelun nurkassa seuraa sinua keskustelusta toiseen; otsikko on selainta käyttävä keskustelu, ja valmiina ikkuna kutistuu napiksi.

Kuvat: `evidence/r2-<riffi>-<vaihe>-<leveys>-<teema>.avif`, riffit `1-kuva`,
`2-palkki` ja `3-kelluva`. Vaiheet: `0-oletus` (myös tummana), `1-toinen`
(odottava keskustelu), `2-siirretty` (selain annettu odottavalle),
`3-otit` (ohjaus otettu), `4-pyytaa` (koodi kesken työn), `5-koodi` (arkissa
koodi hyväksytty), `6-valmis` (valmis, toinen keskustelu käyttää) ja
`7-vapaa` (molemmat valmiit).

### Mitä kukin riffi päättää

| | 1 Kuva keskustelussa | 2 Palkki kentän yllä | 3 Kelluva ikkuna |
|---|---|---|---|
| Missä | historian lopussa, vain sen keskustelun, jota asia koskee | kentän yllä kaikissa keskusteluissa | nurkassa kaikissa keskusteluissa, pysyy vierittäessä |
| Koko | 352 × 220 px, puhelimessa koko leveys | 80 × 50 px | 238 × 149 px, puhelimessa 170 × 106 |
| Mitä näkyy | sivu luettavana, agentin osoitin, nykyinen toimi | että selain on käytössä, toimi tekstinä | sivu tunnistettavana, toimi |
| Arkin avaus | kuva tai *Näytä isona* | kuva tai *Näytä* | kuva |
| Odottaa sinua | kuva ja pyyntö ovat sama kortti: *Syötä koodi* | palkista tulee pyyntö | ikkunasta tulee pyyntö, eikä sitä voi pienentää |
| Valmis | kuva jähmettyy pieneksi: *Valmis klo 10.19 · 7 tointa* | palkki poistuu, ja keskusteluun jää rivi | ikkuna kutistuu napiksi *Selain vapaa* |
| Kuka käyttää | odottavan keskustelun kortti: haalistettu kuva, *X käyttää*, *Siirrä tälle*; käyttävässä rivi *Y odottaa vuoroaan* | palkki nimeää käyttäjän ja odottajan joka keskustelussa | otsikko on käyttävä keskustelu (linkki), alla odottaja |
| Hinta | näkyy vain siinä keskustelussa, jota asia koskee; vierittyy pois | kuva liian pieni sisällön lukemiseen | peittää osan keskustelusta, puhelimessa noin puolet |

Yhteistä: sivupalkki kertoo sanoin, mitä kukin keskustelu tekee (*Käyttää
selainta*, *Odottaa selainta*, *Odottaa sinua*). Kuvan painaminen avaa
kierroksen 1 arkin. *Siirrä tälle* antaa selaimen odottavalle keskustelulle,
ja keskeytetty jatkaa, kun selain vapautuu.

### Suositus

**1 Kuva keskustelussa.** Jari valitsi Pyydettäessä-suunnan, koska selain
saa siinä eniten tilaa. Sama periaate puoltaa kuvaa, joka ei vie tilaa muilta
keskusteluilta ja joka on niin iso, että sivun voi lukea avaamatta arkkia.
Kuva on siinä keskustelussa, jossa tehtävä annettiin, ja agentin pyyntö ja
kuva ovat sama kortti, joten henkilö näkee yhdellä silmäyksellä, mitä
Netvisor pyytää. Kilpailutilanteen henkilö kohtaa siinä keskustelussa, joka
odottaa, ja sivupalkki kertoo saman muissa.

- **2** näyttää yhteisen selaimen samassa paikassa kaikkialla, mikä vastaa
  totuutta (yksi selain henkilöllä), mutta 80 px:n kuvasta ei tunnista
  sivua. Palkki on käytännössä tilarivi, ja sen tiedot ovat jo sivupalkissa.
- **3** on näistä ainoa, joka pysyy näkyvissä vierittäessä, mutta se peittää
  keskustelua ja puhelimessa puolet leveydestä, eli juuri sitä tilaa, jonka
  takia suunta 3 valittiin.

### Host-tiedot

Tutkimuksen `research-remote-browser-session` päätöksestä:

- **Yksi selain henkilöllä**: oma systemd-käyttäjäyksikkö, ja kaikki
  henkilön keskustelut käyttävät samaa kirjautunutta profiilia.
- **Yksi ohjaa kerrallaan**: selainisäntä hyväksyy yhden CDP-asiakkaan
  ja kieltäytyy muista. Toisen keskustelun `selain`-kutsu epäonnistuu
  tavallisena työkalurivinä "selain on toisen keskustelun käytössä".
- **Ota ohjaus**: kytkin katkaisee nykyisen asiakkaan ja kieltäytyy
  uusista, kunnes henkilö antaa selaimen takaisin.
- **24 h joutokäynti**: selain sammuu 24 tuntia viimeisen katselijan tai
  agentin jälkeen, ja istunto palautetaan.

Prototyypin oletukset, jotka toteutuksen pitää vahvistaa:

- **Kuka käyttää, nimellä**: isäntä kertoo, minkä keskustelun asiakas
  ohjaa. Joko taito antaa liittyessään keskustelun tunnisteen (saman UID:n
  prosessi, pelkkä nimilappu eikä valtuus), tai daemon päättelee sen
  asiakkaan prosessista. Ilman tätä näkymä voi sanoa vain "toinen
  keskustelu".
- **Odottaminen ja vuoro**: odottavan agentin taito odottaa, että selain
  vapautuu (isännän tila tai uusintayritys), ja jatkaa itse. Sivupalkin
  *Odottaa selainta* vaatii, että daemon tietää odottajan. Vapautuminen ei
  saa jäädä tilan lukemisen varaan.
- ***Siirrä tälle*** on ohjauksen ottamisen muunnelma: isäntä katkaisee
  nykyisen asiakkaan ja päästää valitun sisään. Keskeytetyn agentin taito
  selittää, että henkilö antoi selaimen toiselle keskustelulle.
- **Kuva** tulee samasta noVNC-yhteydestä katseluna ja harvemmalla
  päivitysvälillä. Mitään ei tallenneta. Valmiin työn jähmettynyt kuva elää
  vain sivun muistissa, ja uudelleenlatauksen jälkeen kortissa on pelkkä
  teksti.
- *Selain vapaa · kirjautunut* olettaa, että selain on päällä. 24 tunnin
  pysäytyksen jälkeen teksti olisi *Selain suljettu*; prototyyppi ei näytä
  sitä.

### Kysymykset Jarille

1. **1, 2 vai 3?** `r2-1-kuva-0-oletus-1440-light`,
   `r2-2-palkki-0-oletus-1440-light`, `r2-3-kelluva-0-oletus-1440-light`.
   Suositus 1.
2. **Saako henkilö siirtää selaimen kesken toisen keskustelun työn
   (*Siirrä tälle*), vai odottaako keskustelu aina vuoroaan?**
   `r2-1-kuva-1-toinen-1440-light`. Suosittelen siirtoa: henkilö tietää,
   kumpi on kiireellisempi, ja keskeytetty jatkaa itse.
3. **Mitä valmiista työstä jää näkyviin: jähmettynyt kuva (1), rivi (2) vai
   nappi (3)?** `r2-1-kuva-7-vapaa-1440-light`,
   `r2-2-palkki-7-vapaa-1440-light`, `r2-3-kelluva-7-vapaa-1440-light`.
   Suosittelen jähmettynyttä kuvaa: viimeinen sivu näyttää, mihin agentti
   jäi.

### Näyttäminen

```
node design-system/prototypes/rounds/2026-11-07-palvelinselain-kuva/build.mjs
open-habitat agent view offer --current \
  --source design-system/prototypes/dist/palvelinselain-kuva/offline.html \
  --title "Oma palvelinselain – kierros 2: pienoiskuva" \
  --idempotency-key "$(uuidgen)" --json
```

### Tarkistus

`check.mjs`: 204 tarkistuspistettä, konsoli puhdas. Jokainen riffi ajettiin
1440 ja 390 px vaaleana koko tarinan läpi: oletus, odottava keskustelu,
selaimen siirto, kuvasta avattu arkki vain katseltavana, ohjauksen
ottaminen ja agentin pysähtyminen, koodi kesken työn arkissa, valmis ja
vapaa. Oletukset ajettiin myös tummana. Kuvat ovat kertoimella 2 (AVIF).
Kyse on synteettisestä komponenttilabrasta, jota ei ole ajettu hostia
vasten. Kierros ei muuttanut tuotantokoodia.

### Päätökset myöhempää katselmointia varten

- **Toinen keskustelu odottaa jo oletusnäkymässä.** Kilpailutilanne näkyy
  heti eikä vaadi erillistä kohtausta.
- **Valitsimen nimet ovat lyhyet** (1 Kuva, 2 Palkki, 3 Ikkuna), koska
  pitkät nimet eivät mahdu puhelimen valitsimeen. Yläpalkin rivit kertovat
  koko nimen.
- **Kierroksen 1 pyyntökortti on riffeissä yhdistetty kuvaan.** Koodin
  pyyntö on riffissä 1 kuvan kortti ja riffeissä 2 ja 3 palkki tai ikkuna.
  Agentin oma viesti jää keskusteluun kaikissa.

## Kierros 1 (6.11.2026)

Kierros: `design-system/prototypes/rounds/2026-11-06-palvelinselain/`
(NOTES.md kertoo tarinan, ohjaimet ja mikä on yhteistä). Akseli: missä
henkilön palvelinselain asuu Habitatissa. Sisältö on kaikissa sama: agentti
pyytää Ainoa kirjautumaan Netvisoriin, Aino luovuttaa selaimen, agentti
lataa laskut, Netvisor pyytää koodia uudelleen kesken työn, Aino syöttää sen
ja antaa selaimen takaisin, ja ohjauksen voi ottaa milloin tahansa.

- **1 Rinnakkain**: selain avautuu keskustelun viereen kuten editori; yläpalkin Selain-painike, ohjaus ja agentin nykyinen toimi paneelin alalaidassa.
- **2 Oma näkymä**: selain on sivupalkissa omana kohtanaan ja avautuu koko näkymäksi; vieressä Agentin toimet -loki kaikista keskusteluista.
- **3 Pyydettäessä**: selainta ei näy ennen kuin sitä tarvitaan; se avautuu arkkina keskustelun päälle, ja agentin työ näkyy keskustelussa pienenä elävänä kuvana.

Kuvat: `evidence/r1-<suunta>-<vaihe>-<leveys>-<teema>.avif`. Suunnat
`1-rinnakkain`, `2-oma-nakyma`, `3-pyydettaessa`. Vaiheet: `0-oletus`
(myös tummana), `1-suljettu` (sisäänkäynti), `2-koodi`, `3-kirjautunut`,
`4-agentti`, `5-otit` (ohjaus otettu takaisin), `6-pyytaa` (MFA kesken työn),
`7-vahvistettu`, `8-valmis`; suunnassa 2 myös `9-keskustelu`.

### Mitä kukin suunta päättää

| | 1 Rinnakkain | 2 Oma näkymä | 3 Pyydettäessä |
|---|---|---|---|
| Avaaminen | yläpalkin maapallo tai agentin pyyntökortti | sivupalkin *Oma selain* tai kortti | vain agentin kortti tai elävä kuva |
| Etänäkymä | paneeli keskustelun vieressä, puhelimessa peittää sen | koko pääalue, keskustelu taustalla | modaali arkki, puhelimessa alhaalta |
| Luovutus | *Valmis, agentti jatkaa* paneelin alalaidassa (ja kortissa) | sama näkymän alalaidassa | sama arkissa; arkki sulkeutuu |
| Mitä agentti tekee | elävä paneeli, osoitin, toimi alalaidassa; rivit keskustelussa | sama näkymässä + loki kaikista keskusteluista | pienoiskuva keskustelussa + rivit |
| Ohjaus takaisin | *Ota ohjaus* paneelissa | *Ota ohjaus* näkymässä | *Ota ohjaus* pienoiskuvan vieressä |
| MFA kesken työn | kortti keskustelussa, sivu näkyy paneelissa | kortti keskustelussa; rivi sivupalkissa *Odottaa sinua* | kortti *Syötä koodi* avaa arkin |

Yhteistä: ohjaus on yhdellä kerrallaan ja sanotaan sanoin. Agentin
käyttäessä selainta etänäkymä on vain katseltava. *Valmis* on käytössä
vasta, kun sivu näyttää kirjautuneen tilan. Agentti päättelee kirjautumisen
itse sivulta, ja sulkeminen ei kirjaa ulos.

### Suositus

**1 Rinnakkain.** Selain on samassa paikassa ja samalla eleellä kuin editori
ja agentin näkymät, joten Habitat ei saa uutta navigointikäsitettä. Henkilö
näkee agentin työn livenä sen keskustelun vieressä, jossa hän antoi tehtävän,
ja *Ota ohjaus* on aina samassa kohdassa. Puhelimessa paneeli toimii kuten
muutkin näkymät.

- **2** tekee selaimesta henkilön oman paikan, mikä on totta (yksi selain
  per henkilö), mutta sen loki kokoaa kaikkien keskustelujen selaintoimet.
  Se on joko uusi tietovarasto tai kaikkien Pi-sessioiden luku ristiin.
  Toimet ovat jo keskusteluissaan, joten loki on toinen paikka samalle
  totuudelle. Sivupalkin tilarivi on hyvä, ja sen voi lainata ykköseen.
- **3** on kevyin, mutta selainta ei voi avata itse ilman agenttia
  (esimerkiksi kirjautuakseen etukäteen), ja modaali arkki peittää
  keskustelun juuri silloin, kun agentin pyyntöä pitäisi lukea. Pienoiskuva
  keskustelussa on silti hyvä tapa näyttää työ paneelin ollessa kiinni.

### Host-tiedot (oletuksia)

Rinnakkainen selvitys `research-remote-browser-session` ei ollut vielä
mainissa, joten nämä ovat uskottavia oletuksia. Raportin pitää vahvistaa tai
kumota ne.

- **Selain** on henkilön oma Chromium omassa user-palvelussaan
  virtuaalinäytöllä (Xvnc/KasmVNC tai headless Wayland). Profiili on
  henkilön kodissa (0700), joten evästeet ovat hänen tunnuksiaan. Selain
  käynnistyy pyydettäessä ja jää päälle näkymän sulkemisen jälkeen.
- **Etänäkymä** kulkee kuten editori ja shell: gateway todentaa selaimen ja
  välittää yhteyden henkilön daemonille per-käyttäjän Unix-socketin kautta.
  TCP-portteja ei ole. Näkymän koko seuraa katsojaa (puhelimessa kapea).
- **Agentin pääsy** käyttää Chrome DevTools Protocolia
  `--remote-debugging-pipe`-putken kautta. Putken omistaa henkilön oma
  apuri, eikä localhost-porttia ole. Pi saa natiivin työkalun (laajennus tai
  CLI-taito), jonka jokainen kutsu on tavallinen työkalurivi `selain`
  keskustelussa. "Mitä agentti teki" on siis natiivi historia, ei uusi
  varasto.
- **Ohjaus** on daemonin muistissa oleva tieto siitä, kenellä selain on
  (henkilö tai agentti). Kun henkilö ohjaa, agentin työkalu odottaa ja
  vastaa "henkilö ohjaa". Kun agentti ohjaa, etänäkymän syöte pudotetaan
  (vain katselu). Yksi tila, ei tallennusta.
- **Kirjautumisen tunnistaminen**: daemon ei lue evästeitä. *Valmis* on
  tavallinen viesti/vastaus agentille, ja agentti varmistaa kirjautumisen
  itse sivun sisällöstä. Valmis-painikkeen harmaus (vain kirjautuneena) on
  prototyypin yksinkertaistus. Hostissa painike on aina käytössä, ja agentti
  kertoo, jos kirjautuminen puuttuu.
- **MFA kesken työn**: agentin työkalulla on "pyydä henkilöä" -kutsu. Se
  näkyy keskustelussa pyyntökorttina (kuten Pi:n natiivi kysymys), siirtää
  ohjauksen henkilölle ja palaa, kun henkilö antaa selaimen takaisin.

### Kysymykset Jarille

1. **1, 2 vai 3?** `r1-1-rinnakkain-4-agentti-1440-light`,
   `r1-2-oma-nakyma-4-agentti-1440-light`,
   `r1-3-pyydettaessa-4-agentti-1440-light`. Suositus 1.
2. **Näytetäänkö agentin selaintyö keskustelussa pienoiskuvana silloin, kun
   paneeli on kiinni?** `r1-3-pyydettaessa-4-agentti-1440-light`. Ehdotan sitä
   ykköseen paneelin rinnalle; ilman sitä ainoa merkki on piste yläpalkin
   painikkeessa.
3. **Tarvitaanko kaikkien keskustelujen selainloki?**
   `r1-2-oma-nakyma-8-valmis-1440-light`. Suosittelen ei: toimet ovat jo
   keskusteluissaan, ja loki olisi toinen paikka samalle tiedolle.

### Näyttäminen

```
node design-system/prototypes/rounds/2026-11-06-palvelinselain/build.mjs
open-habitat agent view offer --current \
  --source design-system/prototypes/dist/palvelinselain/offline.html \
  --title "Oma palvelinselain – kierros 1" \
  --idempotency-key "$(uuidgen)" --json
```

### Tarkistus

`check.mjs`: 194 tarkistuspistettä, konsoli puhdas. Kaikki suunnat ajettiin
1440 ja 390 px vaaleana koko tarinan läpi (avaaminen, kirjautuminen
koodeineen, luovutus, vain katseltava näkymä agentin työn aikana, ohjauksen
ottaminen ja agentin pysähtyminen sen ajaksi, MFA kesken työn, valmis).
Oletukset ajettiin myös tummana. Kuvat ovat kertoimella 2 (AVIF). Kyse on
synteettisestä komponenttilabrasta, jota ei ole ajettu hostia vasten.
Kierros ei muuttanut tuotantokoodia.

### Päätökset myöhempää katselmointia varten

- **Netvisor esimerkkinä.** Valittu, koska Contosoin tutkimus käsittelee sitä.
  Sivu on yleinen mock eikä jäljittele palvelun ulkoasua.
- **Etäsivu on aina vaalea.** Etäselain näyttää sivuston sellaisenaan, joten
  tumma teema koskee vain Habitatin kehystä.
- **Agentin osoitin nimettynä pisteenä.** Henkilö näkee, mihin agentti
  osoittaa. Tämä edellyttää, että työkalu kertoo kohteen koordinaatit; ilman
  niitä osoitin jää pois.
- **Puhelimessa suunnan 2 loki on välilehtenä.** Selain ja loki eivät mahdu
  rinnakkain.

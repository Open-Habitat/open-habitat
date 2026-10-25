# Taustaodotukset · Kierros 1

Kapellimestari on käynnistänyt kaksi workeria ja odottaa niistä toista
taustalla. Lisäksi se odottaa julkaisuvahtia ja pitää kehityspalvelinta
käynnissä. Kierros vertailee kahta asiaa: missä odotus näkyy (omana
prosessinaan vai sen workerin kohdalla, jota se odottaa) ja miltä
taustaprosessin päättyminen näyttää keskustelussa. Kaikki nimet, tunnisteet
ja ajat ovat keksittyjä.

## Mistä havainto tuli

Ensimmäisen Birch-illan kapellimestari käynnisti odotuksensa muodossa
`cd ~/src/open-habitat && taskfleet run wait <id> --check-in 45m --output json`.
Daemon tunnistaa odotuksen vain kapeasta kieliopista, ja tämä muoto jää sen
ulkopuolelle kahdesta syystä: `&&` ja `--check-in`. Siksi odotukset näkyivät
päätesirussa tavallisina prosesseina, eikä workerisiru tiennyt niistä.
`--check-in` palauttaa tarkoituksella koodin 4 (”tilannekuva, käynnistä
uudelleen”), ja keskustelu näytti sen muodossa ”kaatui · koodi 4”.
Julkaisuvahdin koodi 3 tarkoittaa ”ohitettu, ei tuotemuutosta” ja näkyi
samalla tavalla. Vika on kirjattu erikseen issueksi
`taskfleet-wait-grammar-misses-real-waits`. Suunnat 2–4 olettavat sen korjatuksi.

## Neljä suuntaa

| Suunta | Mitä se näyttää | Vahvuus | Hinta |
| --- | --- | --- | --- |
| 1 Nyt | Tämänhetkinen tuotanto sellaisena kuin Jari sen näki. Odotukset ovat päätesirussa (3 käynnissä), workerisirussa on pelkkä luku eikä kelloa. Merkinnät sanovat ”kaatui · koodi 3/4”, ja paneelin päättyneet rivit ovat punaisia (”Virhe · koodi 3”). | Vertailukohta. | Puuttuvaa odotusta ei voi nähdä, ja odotettu lopputulos näyttää viaalta. |
| 2 Sanoin | Workerisiru sanoo asian sanoin: ”2 · 1 ei odotusta” tai ”2 · odotetaan”. Paneelin rivi kertoo ”odotetaan · 18 min” kellon ja Lopeta odotus -painikkeen kanssa tai ”ei odotusta · 6 min”. Odotukset puuttuvat päätesirusta. **Päättyminen:** nollasta poikkeava koodi näkyy neutraalisti muodossa ”päättyi · koodi 3”. Taskfleet-odotuksen koodi 4 on ”välitarkistus” ja koodi 2 ”odotus aikakatkaistiin”. Punainen on varattu signaalille ja käynnistysvirheelle. | Selvin luettava. Ei vaadi uusia host-faktoja kieliopin korjauksen lisäksi. | Siru levenee: puhelimessa mahtuu juuri ja juuri. Myös oikea testivirhe (koodi 1) näkyy harmaana, joten agentin seuraava viesti kertoo, mitä tapahtui. |
| 3 Pisteet | Siru näyttää yhden merkin jokaista työskentelevää workeria kohden. ◉ (sama merkki kuin *Odottaa taustatyötä*) tarkoittaa, että workeria odotetaan, ja katkoviivainen ○, ettei odotusta ole. Merkit korvaavat luvun. Paneelissa merkintöjen selite ja rivillä sanat ”odotetaan” tai ”ei odotusta”. **Päättyminen:** agentti kertoo käynnistäessään, mitkä koodit ovat odotettuja ja mitä ne tarkoittavat. Tällöin koodi 3 näkyy neutraalisti muodossa ”ohitettu: ei tuotemuutosta · koodi 3”. Ilmoittamaton nollasta poikkeava koodi on punainen ”epäonnistui”. | Pysyy kapeana myös puhelimessa ja käyttää jo sovittua merkkikieltä. Oikea virhe erottuu odotetusta. | Merkit on opittava (selite paneelissa). Ilmoitettua odotettua lopputulosta ei ole olemassa (ks. host-faktat), ja ilman sitä jokainen nollasta poikkeava koodi olisi punainen, eli julkaisuvahdin ongelma palaisi. |
| 4 Sisäkkäin | Siru on ennallaan (luku ja kello). Kun työskentelevältä workerilta puuttuu odotus, kellon paikalla on katkoviivarengas. Paneelissa odotus on workerin rivin alla omana rivinään (”Odotus käynnissä 2 min · agentti jatkaa, kun tämä valmistuu” ja Lopeta) tai ”Ei odotusta · agentti ei herää, kun tämä valmistuu”. **Päättyminen:** odotuksen päättyminen kerrotaan workerin nimellä (”Kastelun ajastus · välitarkistus · työskentelee yhä”), eikä odotusprosessin nimeä näytetä. Muut prosessit näkyvät kuten suunnassa 2. | Odotus ja worker ovat yksi asia. Pienin muutos suljettuun siruun. | Suljetussa sirussa puuttuva odotus näkyy vain pienenä renkaana. Paneeli on kaksi kertaa korkeampi. Merkinnän voi yhdistää workeriin vain, kun odotus on tunnistettu. |

Kaikissa suunnissa *Odottaa taustatyötä* -tila yläpalkissa ja sivupalkissa
pysyy ennallaan (`background-wait-state`). Muut taustaprosessit, kuten
`dev-palvelin` ja `julkaisuvahti`, ovat päätteitä. Julkaisuvahti on
ulkoinen odotus, eikä se liity mihinkään workeriin, joten sen kello on
päätesirussa.

## Kokeile

Avaa tiedosto selaimessa:

```
issues/proto-background-waits/prototypes/background-waits/index.html
```

Sivu toimii yhdestä tiedostosta ilman verkkoa. Valitsin on ylhäällä,
koska vertailtavat asiat ovat alhaalla. Suuntaa vaihdetaan näppäimillä
**1–4** tai **←/→**, ja valinta säilyy osoitteen `?v=`-parametrissa.
Yläpalkin **Tilanne** vaihtaa kolmen tilanteen välillä: toista workeria ei
odoteta (oletus), kaikkia odotetaan tai agentti työskentelee (silloin
kelloja ei näytetä). **Tumma/Vaalea** vaihtaa teeman.

1. Katso ensin suljettuja siruja: näkyykö, että Lomakkeen saavutettavuutta
   ei odoteta?
2. Avaa workerisiru. Valitse tilanne *Kaikkia workereita odotetaan* ja paina
   jonkin rivin ■ (Lopeta odotus). Rivi muuttuu muotoon ”ei odotusta”.
3. Avaa päätesiru ja sen *päättyneet*. Suunnissa 2–4 odotukset eivät ole
   päätteinä.
4. Paina keskustelun merkintää (esimerkiksi julkaisuvahti). Se kertoo, mistä
   lukutapa tulee.

Kuvat ovat hakemistossa `evidence/`: jokainen suunta työpöydällä (1440 px) ja
puhelimessa (390 px), vaaleana ja tummana, suljettuna ja workeripaneeli
auki; prosessipaneeli vaaleana.

## Rakentaminen ja tarkistus

```sh
node issues/proto-background-waits/prototypes/background-waits/build.mjs
PLAYWRIGHT_BROWSERS_PATH="$HOME/.cache/ms-playwright" node issues/proto-background-waits/prototypes/background-waits/check.mjs
```

`check.mjs` rakentaa sivun, käy jokaisen suunnan läpi kummallakin leveydellä
ja kummassakin teemassa ja ottaa kuvat. Se tarkistaa paneelit, päättyneet
rivit, merkinnät, odotuksen lopettamisen, Escapen palauttaman kohdistuksen,
vaakavierityksen puuttumisen ja valitsimen. Sivu ei saa kirjoittaa konsoliin
virheitä eikä tehdä verkkopyyntöjä.

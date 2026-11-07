# Oma palvelinselain – kierros 4: pyyntö ikkunalle

Issue `proto-remote-browser-session`. Jari päätti 7.11.2026 kierroksen 3
jälkeen: siru on **kentän yllä** (kierroksen 3 riffi 2). Kun agentilla on
monta selainikkunaa ja yksi niistä tarvitsee henkilöä (palaute,
kirjautuminen, MFA), pyyntö luki kierroksessa 3 kaikkien ikkunoiden alla. Sen
pitää kuulua sille yhdelle ikkunalle. Lisäksi **tarkempi katselu ei ota
ohjausta**: isompi kuva tai arkki on pelkkää katselua, ja agentti ohjaa,
kunnes henkilö ottaa ohjauksen nimetyllä teolla. Kierros näyttää sekä
katselun että otetun ohjauksen ja sen, miten ohjaus annetaan takaisin.

Kaikissa riffeissä pysyvät kierroksen 3 valinnat: siru ja palkki kentän
yllä, agentin osoitin nuolena ja kahden edellisen klikkauksen jälki
(kierroksen 3 riffi 2) ja selain sivupalkin ylimpänä tekstirivinä
(kierroksen 3 riffi 1). Rakennettu tuotannon komponenteista kuten kierros 3.
Etäsivut ovat mockeja, kaikki on synteettistä.

## Riffit

- **1 Alla – pyyntö ikkunan alla**: pyyntö on sen ikkunan kuvan alla, joka tarvitsee sinua; painallus avaa arkin katseltavaksi, ja ohjaus otetaan arkissa erikseen koko selaimelle.
- **2 Esiin – ikkuna esiin**: sinua tarvitseva ikkuna nousee palkissa isoksi ja pyyntö on sen vieressä; kuvaa voi katsoa isompana, ja *Ota ohjaus ja syötä koodi* on yksi nimetty painallus.
- **3 Ikkunalle – ohjaus ikkunalle**: pyyntö on ikkunan kuvassa, ja ohjaus otetaan vain siihen ikkunaan; agentti jatkaa muissa ikkunoissa, ja jokainen ikkuna kertoo, kuka sitä ohjaa.

## Sama kaikissa

- Tarina kuten kierroksessa 3: *Lokakuun ostolaskut* työskentelee kolmessa
  ikkunassa (Netvisor, kustannuspaikat, AWS-lasku), ja *Rekrytointi: myyjä*
  odottaa vuoroaan. **Oletusnäkymä on hetki, jolloin Netvisor-ikkuna pyytää
  vahvistuskoodia**, koska kierros koskee juuri sitä.
- **Pyyntö kuuluu ikkunalle**: vain Netvisor-ikkunassa on pyyntö, sen kuva on
  kehystetty tekstin väriin ja kuvateksti sanoo *odottaa sinua*. Palkin
  alarivi ei toista pyyntöä, vaan kertoo, mitä agentti tekee
  (*Agentti on pysähtynyt ja odottaa sinua* tai riffissä 3 mitä se tekee
  muissa ikkunoissa). Siru nimeää ikkunan: *Netvisor odottaa sinua*, ja sen
  pienistä laatikoista odottava on täytetty.
- **Katselu**: kuvan, *Katso isona* -painikkeen tai sivupalkin rivin
  painaminen avaa arkin katselutilaan. Arkki sanoo *Katselet*, etäsivu ei
  ota syötettä (klikkaus kertoo, että pitää ottaa ohjaus), ja agentin osoitin
  jatkaa liikettään. Agentti ei pysähdy.
- **Ohjauksen ottaminen** on aina oma nimetty painike (*Ota ohjaus*,
  *Ota ohjaus ja syötä koodi*, *Ota tämä ikkuna*). Ohjatessa etäsivu ottaa
  syötteen, ruudun ympärillä on tekstinvärinen kehys, agentin osoitin
  katoaa siitä ikkunasta ja keskusteluun tulee rivi *Otit … klo …*.
- **Takaisin antaminen**: *Anna takaisin agentille* (riffissä 3
  *Anna ikkuna takaisin* tai kuvan alla *Anna takaisin*) arkissa tai
  palkissa. Arkin sulkeminen ei anna ohjausta takaisin: siru ja sivupalkin
  rivi sanovat *Sinä ohjaat*, kunnes annat sen. Koodin vahvistamisen jälkeen
  pyyntö katoaa, ja painike jää odottamaan.

## Mitä riffit päättävät

- **1** pitää palkin kierroksen 3 rivinä. Pyyntö on teksti ja painike
  *Syötä koodi* sen ikkunan kuvan alla. Painallus vain avaa arkin siihen
  ikkunaan katseltavaksi; koodikenttä on harmaa, ja arkin alapalkki sanoo
  *Netvisor pyytää koodia; ota ohjaus, niin voit syöttää sen.* Ohjaus
  otetaan arkissa erikseen, ja se koskee koko selainta: agentti odottaa
  kaikissa ikkunoissa. Arkin tila näkyy otsikon pillerissä ja alapalkissa.
  Kaksi painallusta, mutta katselu ja ottaminen eivät voi sekoittua.
- **2** nostaa sinua tarvitsevan ikkunan palkissa isoksi kuvaksi ja panee
  pyynnön sen viereen korttina: mitä tapahtui, mitä ohjauksen ottaminen
  tarkoittaa, *Ota ohjaus ja syötä koodi* ja *Katso ensin*. Työn aikana iso
  kuva on agentin ikkuna; pienen kuvan painaminen näyttää sen isona palkissa
  (isompi esikatselu, yhä katselua), ja *Seuraa agenttia* palauttaa. Arkissa
  tila on nauhana ruudun yllä: *Katselet …* ja *Ota ohjaus*, tai
  *Sinä ohjaat …* ja *Anna takaisin agentille*. Ohjaus koskee koko selainta.
- **3** ottaa ohjauksen vain yhteen ikkunaan. Pyyntö on merkkinä ikkunan
  kuvassa (*Odottaa sinua*) ja painikkeena *Ota tämä ikkuna*. Agentti
  jatkaa sillä välin muissa ikkunoissa (vertaa AWS-laskua
  kustannuspaikkoihin), ja sen osoitin liikkuu niissä. Jokaisen ikkunan
  kuvateksti ja arkin välilehti kertovat, kuka sitä ohjaa (*agentti tässä*,
  *sinä ohjaat*, *odottaa sinua*). Takaisin annetaan ikkuna kerrallaan.

## Ohjaimet

Yläpalkissa ovat teema, keskustelu ja kolme kohtausta: **Odottaa sinua**
(oletus: Netvisor pyytää koodia), **Agentti työssä** (agentti työskentelee
kolmessa ikkunassa) ja **Valmis** (ostolaskut valmis, selain siirtyi
rekrytoinnille). Agentti etenee noin 2,4 sekunnin välein. Koodikenttään
kelpaa mikä tahansa kuusi numeroa. Valitsin alhaalla vaihtaa riffiä.

## Rakentaminen ja tarkistus

```
node design-system/prototypes/rounds/2026-11-07-palvelinselain-pyynto/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright timeout 900 \
  node design-system/prototypes/rounds/2026-11-07-palvelinselain-pyynto/check.mjs \
  design-system/prototypes/dist/palvelinselain-pyynto/offline.html <kuvahakemisto>
```

`build.mjs` tarvitsee `web/node_modules`-hakemiston committoidusta lukosta.
`check.mjs` käy jokaisen riffin tarinan läpi 1440 ja 390 px vaaleana,
oletukset myös tummana, ja kirjoittaa kuvat kertoimella 2.

# Ryhmät tiiviinä · Kierros 3

Avaa `index.html` selaimessa. Se toimii ilman verkkoa ja on yksi tiedosto.
Suunnat vaihtuvat näppäimillä 1–3 tai ←/→. Yläreunan *Tilanne* vaihtaa
ison rupeaman ja hiljaisen illan välillä. *Selite* näyttää pallojen
merkitykset, ja *Alusta* palauttaa alkutilan. Puhelimessa nämä kolme
ovat alareunassa, koska suunnanvalitsin vie yläreunan.

## Mistä on kyse

Valitsit kierrokselta 1 Ryhmät-suunnan ja kysyit, mahtuuko worker
tiiviisti yhdelle riville, kun pelkkä pallo kertoo tilan. Tällä kierroksella
jokainen rivi on yksirivinen: pallo, nimi ja enintään yksi lyhyt tieto.
Rupeamassa on nyt kymmenen workeria.

## Pallot

| Pallo | Tila | Mistä host sen tietää |
|---|---|---|
| sinivihreä, sykkii | Työskentelee, myös kun agentti odottaa taustatyötä | on jo snapshotissa |
| oranssi | Sinun vuorosi: kysymys tai lukematon vastaus | on jo snapshotissa |
| vihreä | Valmis: vuoro on päättynyt, ja agentti odottaa viestiä | on jo snapshotissa |
| punainen | Epäonnistui: workerin ajo epäonnistui, Pi kaatui tai vuoro päättyi virheeseen | lähteet ovat olemassa, mutta snapshotissa ei ole tätä tilaa rivitasolla |

Taustatyön odottaminen on tässä työskentelyä, koska agentti jatkaa itse
eikä sinulta odoteta mitään. Työskentelevän pallon ympärillä on vaalea
rengas. Ilman sitä sinivihreä ja vihreä erottuvat huonosti
pysäytyskuvassa, kuten ruutukaappauksessa, ja silloin kun liike on
käyttöjärjestelmässä pois päältä.

## Mikä on kaikissa suunnissa samaa

- Sinun vuorosi on ylimpänä, ja Käynnissä on ryhmitelty työtiloittain
  kuten kierroksen 1 Ryhmät-suunnassa.
- Yli tunnin hiljaisena olleet valmiit rivit taittuvat ryhmän loppuun, ja
  kokonaan hiljaiset työtilat painuvat *Hiljaiset*-viivan alle.
  Epäonnistunut rivi ei taitu koskaan.
- Avattu keskustelu ei taitu piiloon.
- Puhelimessa rivi on 40 px korkea, jotta sen osuu peukalolla. Tiheys
  vaihtelee siis vain työpöydällä.
- Vihjeessä on aina kaikki: nimi, työtila, tila, syy ja aika.
- Yläpalkin tilasiru käyttää samaa palloa kuin rivi.
- Workerin haara-ikoni puuttuu riviltä. Se ei mahdu yhteen riviin pallon
  lisäksi, eikä se kerro tilasta mitään.

## Suunnat

1. **Nimi.** Rivillä on vain pallo ja nimi, ja rivin korkeus on 22 px.
   Aika näkyy vain vihjeessä. Tämä on tiivein suunta: kymmenen workeria
   vie suunnilleen saman tilan kuin viisi nykyistä kaksirivistä riviä.
2. **Aika.** Rivin lopussa on aika viimeisestä muutoksesta, ja rivin
   korkeus on 24 px. Aika toimii jokaisessa tilassa samalla tavalla.
3. **Tieto.** Rivin lopussa on se tieto, jota juuri sen tilan kohdalla
   kysyisit seuraavaksi. Rivin korkeus on 26 px. Työskentelevällä rivillä
   tieto on aika, ja taustatyötä odottavalla se, mitä odotetaan
   (*6 workeria*, *kalibrointi.sh*). Sinun vuorollasi tieto on *kysyy* tai
   *vastasi*, mikä palauttaa oranssin pallon kadottaman eron. Valmiilla
   rivillä se on aika ja epäonnistuneella syy (*epäonnistui*, *kaatui*).

## Mitä kannattaa kokeilla

- Katso Rupeama-tilannetta sekunnin ajan ja peitä sitten ruutu. Muistatko,
  montako kasvimaan workeria työskentelee, mikä on epäonnistunut ja mikä
  odottaa sinua? Tee sama kaikissa kolmessa suunnassa.
- Vaihda tummaan teemaan ja katso, erottuvatko vihreä ja sinivihreä.
- Avaa *1 hiljainen* kasvimaan ryhmästä ja avaa *Mobiilinäkymän otsikko*.
  Rivi jää ryhmään nykyisenä.
- Puhelimessa: avaa valikko ja vieritä kasvimaan ryhmän läpi.

## Kysymykset sinulle

1. Mikä suunta? Suosittelen suuntaa 3 (Tieto). Pallo kertoo tilan, mutta
   tieto kertoo sen, mitä tilasta seuraa. Tämä koskee erityisesti kysymystä
   ja vastausta sekä epäonnistumisen syytä. Rivi on silti yksirivinen.
2. Riittääkö oranssi pallo Sinun vuorosi -osiossa, kun kysymyksen ja
   vastauksen ero näkyy vain suunnassa 3?
3. Lasketaanko taustatyön odottaminen työskentelyksi kuten tässä, vai
   tarvitseeko se oman pallon (viides tila)?
4. Saako punainen pallo tulla myös silloin, kun vuoro päättyi
   rajapintavirheeseen ja agentti on muuten kunnossa? Tässä tulee.

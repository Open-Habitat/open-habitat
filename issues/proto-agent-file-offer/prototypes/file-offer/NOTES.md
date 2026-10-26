# Agentin tiedosto ihmiselle · Kierros 1

Keskustelussa *Q3-myyntiraportti* (työtila `kvartaaliraportti`) agentti
tuottaa tiedostoja ja antaa ne ihmiselle kolmessa vaiheessa:

1. klo 13.06 PDF-luonnos `q3-luonnos.pdf`, jonka agentti myöhemmin
   poistaa. Tämä näyttää poistetun tiedoston tilan.
2. klo 13.31 kolmen tiedoston paketti: kaavio `myynti-q3.png`, taulukko
   `myynti-q3.xlsx` (kolme välilehteä) ja raportti `q3-raportti.pdf`
   (8 sivua).
3. klo 13.36 korjattu kaavio `myynti-q3-vertailu.png`, joka on yksi kuva.

Kaikki nimet ja luvut ovat keksittyjä. Agentin työ (komento
`open-habitat agent file offer …`) on taitettuna säikeen sisällä, kuten
tuotannossa.

Kierros vertailee yhtä asiaa: **missä agentin tiedosto näkyy keskustelussa
ja kuinka paljon tilaa se vie.**

## Kolme suuntaa

| Suunta | Mitä se näyttää | Vahvuus | Hinta |
| --- | --- | --- | --- |
| 1 Kortti | Vastauksen jälkeen tulee oma kortti samassa muodossa kuin HTML-näkymän tarjous: *Agentti tarjoaa ladattavaksi*, otsikko ja rivi ”3 tiedostoa · 1,4 Mt · Vain sinulle”. Kuva näkyy kortissa esikatseluna. Tiedostot ovat riveinä, ja jokaisella rivillä on tyyppi, nimi, koko ja latausnuoli. Paketille on lisäksi *Lataa kaikki (.zip)*. Yksittäisessä kuvassa on *Lataa* ja *Näytä isona*. Poistettu tarjous jää korttina näkyviin, mutta nimi on yliviivattu, kortissa lukee ”Poistettu klo 13.31”, eikä siinä ole painikkeita. | Sama kuvio kuin HTML-näkymällä, joten agentin tarjoukset näyttävät samanlaisilta. Kaikki tilat (useampi tiedosto, poistettu, kuva) mahtuvat korttiin. | Vie eniten tilaa. Kolmen tiedoston paketti on noin 420 px korkea työpöydällä. |
| 2 Vastauksessa | Tiedostot kuuluvat agentin vastaukseen. Kuva näkyy tekstin alla täysleveänä (enintään 320 px korkea), ja sen alla ovat nimi, koko ja latausnuoli. Muut tiedostot ovat siruina kuten omissa liitteissäsi: tyyppi, nimi, koko ja latausnuoli. Poistettu tiedosto on katkoviivainen siru, jossa lukee ”poistettu”. | Kevein. Kuva näkyy heti siinä, missä agentti puhuu siitä, ja ihmisen ja agentin liitteet näyttävät samalta. | Ei otsikkoa eikä *Lataa kaikki* -painiketta. Vastauksen ja tiedoston raja hämärtyy, ja poistettu tiedosto näkyy vain pienenä sirun merkintänä. |
| 3 Hylly | Langassa on vain yksi rivi: ”Pi jakoi 3 tiedostoa myynti-q3.png, …” ja *Näytä*. Yläpalkissa on *Tiedostot*-painike, jossa on lukumäärä (4). Se avaa oikealle paneelin, puhelimessa koko ruudun. Paneelissa on valitun tiedoston esikatselu, tiedot, *Lataa* ja *Avaa isona*. Sen alla ovat kaikki keskustelun tiedostot tarjouksittain uusin ensin, paketille *.zip*, ja lopussa *Poistetut*. | Kaikki keskustelun tiedostot ovat yhdessä paikassa. Toimii, kun tiedostoja on kymmeniä tai keskustelu on pitkä. Lanka pysyy tiiviinä. | Kuva ei näy langassa, sillä siitä on vain pikkukuva. Yksi painallus lisää ennen kuin tiedoston näkee. Lisäksi tulee uusi paneeli yläpalkkiin. |

Esikatselu on kaikissa suunnissa sama kuin tuotannon liitteiden
esikatseluikkuna: kuva sovitettuna, PDF sivuina ja Excel taulukkona
välilehtineen. Lisäksi näkyvät tiedot (tyyppi, koko, tarjottu klo) ja
*Lataa*. Prototyypissä lataus näyttää vain ilmoituksen ”Lataus alkoi: …”.

## Kokeile

Avaa tiedosto selaimessa:

```
issues/proto-agent-file-offer/prototypes/file-offer/index.html
```

Sivu toimii yhdestä tiedostosta ilman verkkoa. Suuntaa vaihdetaan
alareunan valitsimella tai näppäimillä **1–3** ja **←/→**. Sivun yläreunasta
voi vaihtaa teeman ja puhelinleveyden (390 px).

1. **Kortti**: avaa paketista `myynti-q3.xlsx` nimeä painamalla ja vaihda
   välilehteä. Paina *Lataa kaikki (.zip)*. Riittääkö poistetun luonnoksen
   kortti kertomaan, mitä tapahtui?
2. **Vastauksessa**: tunnistaako agentin kuvan heti omaksi tiedostokseen
   vai vain kuvaksi tekstissä? Avaa `q3-raportti.pdf`-siru.
3. **Hylly**: avaa yläpalkin *Tiedostot*, valitse Excel ja sitten poistettu
   luonnos. Escape sulkee paneelin. Kokeile myös langan rivin *Näytä*-painiketta.

Kysymykset Jarille:

- Näytetäänkö agentin tuottama kuva suoraan keskustelussa (Kortti ja
  Vastauksessa) vai riittääkö pikkukuva (Hylly)?
- Tarvitaanko *Lataa kaikki (.zip)*? Ilman sitä host ei tarvitse
  pakkaamista lainkaan.
- Saako ihminen poistaa tarjotun tiedoston itse, vai poistaako vain agentti
  (`agent file remove`)? Prototyypissä vain agentti poistaa.

Kuvat ovat hakemistossa `evidence/` (laitteen skaalaus 2): jokainen suunta
työpöydällä ja puhelimessa, vaaleana ja tummana, sekä esikatselu ja
Hyllyn paneeli.

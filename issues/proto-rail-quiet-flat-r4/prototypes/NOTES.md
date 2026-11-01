# Hiljaisten kuvakeruudukko ja avoin keskustelu: opas (kierros 4)

Avaa `hiljaiset-r4.html`. Se on yksi offline-sivu, ja ylhäällä on
valitsin (näppäimet 1–3 tai ←/→). Tällä kierroksella on vain
käyttöliittymä: tilakone ja tapahtumat on jätetty pois. Avoinna on
Hiljaisten *Verbien taivutus* (deutschpad), joten avoimen keskustelun rivi
näkyy listassa heti. Vasemmalla on kolme korttia, jotka piirtävät osion
kiinteissä tiloissa: **Ikkuna auki**, **Yksi työtila valittuna** ja
**Taitettuna**. Jokaisen suunnan ero näkyy siis oletusnäkymässä ilman
klikkausta:

- **1 · Ruudut**: kierroksen 3 ruudukko hiottuna. Otsikon päässä on
  kuvakepino, ja ikkunassa järjestys on lohkoina ja työtilat isoina
  ruutuina nimin ja määrin. Avoimen rivin vasemmassa reunassa on
  aksenttiviiva. Taitettuna näkyvät avoin rivi ja sen alla kuvakepillerit.
- **2 · Nauha**: kuvakerivi on aina otsikon alla, osio auki tai taitettuna,
  ja otsikon päässä on vain järjestys sanana. Ikkuna on sama ruudukko.
  Avoimen rivin ympärillä on rengas. Taitettuna näkyvät nauha ja avoin rivi.
- **3 · Tiivis**: kapea ikkuna, jossa järjestys on sanoina ja työtilat
  pelkkinä kuvakkeina määrämerkein. Valinta lukee nimellä niiden alla.
  Otsikon päässä on valinnan nimi. Avoimen rivin viiva on työtilan värinen.
  Taitettuna kuvakkeet ovat otsikkorivillä ja avoin rivi sen alla.

Sama luettelo on sivun yläosassa jokaisessa näkymässä.

Kaikille kolmelle yhteistä:

- **Korjattu epäjohdonmukaisuus**: kun yksi työtila on valittu,
  järjestyksenä ei tarjota *Työtilan mukaan*. Vaihtoehdot ovat silloin
  Uusin ja Nimi. Jos tilille oli tallennettu *Työtilan mukaan*, se palaa,
  kun valitset taas Kaikki.
- Järjestys ja työtila ovat tilin asetuksia ja seuraavat sinua kaikille
  laitteille. Taitto muistetaan laitteella.
- Valinta näkyy listassa heti. Ikkuna sulkeutuu Valmis-painikkeella,
  Escillä tai klikkauksella muualle.
- Avoin keskustelu ei katoa. Jos rajaus piilottaisi sen, se jää listan
  loppuun, ja taitettuna se on otsikon alla. Kuvakerivissä sen työtila on
  merkitty.

## Kokeile näin

1. Selaa 1 → 2 → 3 ja katso vasemmat kortit: ikkunan muoto, kahden
   järjestyksen ikkuna yhdelle työtilalle ja taitettu osio.
2. Avaa ikkuna otsikon oikeasta päästä ja valitse *deutschpad*. Lohkoista
   tai listasta katoaa *Työtila*. Valitse sitten *Kaikki*.
3. Taita Hiljaiset ja napauta kuvaketta. Osio aukeaa rajattuna siihen
   työtilaan.
4. Suunnassa 2 napauta nauhan kuvaketta kahdesti: ensimmäinen rajaa,
   toinen palauttaa kaikki.
5. Vaihda **Puhelin**: rajaus ja järjestys ovat samat, mutta taitto on
   laitteen oma. Kokeile myös **Tumma**.
6. **Paljon** (kymmenen työtilaa): katso, miten ikkuna kasvaa (suunnissa
   1 ja 2 noin 410 px, suunnassa 3 noin 240 px).

Suosittelen suuntaa **1 · Ruudut**. Perustelut, hostin tiedot ja
kysymykset ovat issuen `result.md`:ssä. Kuvat ovat hakemistossa `kuvat/`
laitteen skaalauksella 2.

Sivu rakennetaan komennolla `python3 build.py` tiedostosta `page.src.html`.
Kuvat otetaan komennolla `node shots.mjs <polku>/hiljaiset-r4.html
<hakemisto>`. Sama ajo klikkaa säätimet jokaisessa suunnassa (työpöytä,
puhelin, tumma Paljon-näkymä). Kuvat muunnetaan AVIF-muotoon komennolla
`scripts/screenshots-to-avif.py`.

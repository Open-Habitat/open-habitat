# Yläpalkin ensiopastus: milloin selitys näytetään

Avaa `ensiopastus.html`. Se on yksi offline-sivu eikä käytä verkkoa.
Valitsimessa on neljä vaihtoehtoa (näppäimet 1–4 tai ←/→):

- **Pohja · Kerran tällä laitteella** on kierroksen 1 suunta 3 sellaisenaan.
- **1 · Kerran tilille, uudet erikseen**, **2 · Vasta kun kysytään** ja
  **3 · Ensimmäisellä painalluksella** ovat riffit.

Rivi on kaikissa sama kuin mainissa: kuusi kuvaketta ja ⋯. Riffit eroavat
vain siinä, **milloin** selitys tulee näkyviin ja mikä sen lopettaa.

Tärkein valinta on ylin rivi, **Tilanne**:

- *Ensimmäinen keskustelu*: ihminen avaa ensimmäistä kertaa minkään
  keskustelun.
- *Seuraava keskustelu*: hän on käyttänyt Habitatia jo ennen.
- *Toinen laite*: sama tili, mutta laite on uusi. Työpöydällä tämä
  tarkoittaa, että hän on aiemmin käyttänyt vain puhelinta, ja puhelimessa
  päinvastoin.
- *Julkaisu toi painikkeen*: uusi julkaisu on lisännyt yläpalkkiin
  painikkeen **Näkymät** (silmä). Painike on keksitty esimerkki, jotta näkee,
  mitä kukin riffi tekee uudelle painikkeelle.

Lisäksi voit vaihtaa teemaa, laitetta, ikkunan leveyttä ja otsikon pituutta.
Esittelytekstin alla on laatikko, jossa lukee, milloin selitys tulee, mikä
sen lopettaa ja mitä pitää muistaa ja missä. Sivun lopussa on taulukko,
joka näyttää kaikki riffit ja tilanteet rinnakkain.

## Riffit

- **Pohja.** Kun keskustelu avataan ensimmäistä kertaa tällä selaimella,
  kortti selittää kaikki painikkeet. Selaimen muisti estää sitä tulemasta
  uudelleen. Siinä on kaksi aukkoa: uudella laitteella kortti tulee
  uudestaan, ja julkaisun tuoma uusi painike jää selittämättä.
- **1 · Kerran tilille, uudet erikseen.** Tili muistaa, mitkä painikkeet
  on jo selitetty. Ensimmäisellä kerralla kortti kertoo kaikki. Kun uusi
  painike tulee, pieni kortti osoittaa juuri sitä. Kun puhelinta käyttänyt
  siirtyy työpöydälle, kortti kertoo vain ne neljä painiketta, joita
  puhelimessa ei ollut. Puhelimessa ne olivat ⋯-valikossa nimineen.
- **2 · Vasta kun kysytään.** Mikään ei avaudu itsestään. Vihje kertoo
  nimen ja yhden rivin siitä, mitä painike tekee. Puhelimessa sama tulee
  pitkällä painalluksella. Koko kortti on ⋯-valikon ylimpänä.
- **3 · Ensimmäisellä painalluksella.** Etukäteen ei näy mitään. Kun
  painiketta painaa ensimmäisen kerran, toiminto tapahtuu ja alle tulee
  rivi siitä, mitä juuri tapahtui. Arkistoi kysyy ensimmäisellä kerralla
  ennen kuin tekee mitään.

Kaikissa on ⋯ › *Mitä painikkeet tekevät?*, joka avaa koko kortin.

## Kokeile näin

1. **Pohja**: katso *Ensimmäinen keskustelu* ja vaihda sitten *Toinen
   laite* ja *Julkaisu toi painikkeen*. Ensin kortti tulee turhaan
   uudestaan, ja sitten uusi silmäpainike tulee ilman selitystä.
2. **1**: samat kolme tilannetta. Kokeile *Toinen laite* työpöydällä ja
   *Julkaisu toi painikkeen*. Paina uutta painiketta: kortti katoaa, koska
   painaminen riittää.
3. **2**: vie hiiri kuvakkeen päälle. Vaihda puhelimeen ja pidä hiiren nappia
   pohjassa kuvakkeen päällä.
4. **3**: valitse *Ensimmäinen keskustelu* ja paina Päätettä kaksi kertaa.
   Paina sitten Arkistoi.

Suosittelen riffiä **1 · Kerran tilille, uudet erikseen**, ja lisäksi
riffin 2 selitysriviä vihjeeseen. Perustelut, se mitä kukin riffi vaatii
palvelimelta ja kolme kysymystä ovat issuen `result.md`:ssä. Kuvat ovat
hakemistossa `kuvat/`, ja ne on otettu laitteen skaalauksella 2.

Sivu rakennetaan komennolla `python3 build.py`. Se upottaa tokenit ja
fontit tiedostosta `page.src.html`. Kuvat ja konsolitarkistus tehdään
komennolla `NODE_PATH=<repo>/web/node_modules node shoot.mjs kuvat`.
Tarkistus painaa jokaista painiketta jokaisessa riffissä, teemassa,
laitteessa, leveydessä ja tilanteessa, yhteensä 1184 painallusta, ja
konsoli pysyy puhtaana.

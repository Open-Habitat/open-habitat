# Näkymäkortti, kierros 3: opas

Avaa `nakymakortti-r3.html`. Se on yksi offline-sivu eikä käytä verkkoa.
Ylhäällä on valitsin (näppäimet 1–4 tai ←/→):

- **Lähtö · kierroksen 2 riffi B** on valitsemasi kortti sellaisenaan:
  kytkin *Julkinen* otsikkorivillä ja päivämäärä sen sisällä tekstinä.
- **A · Kestot valikossa**, **B · Kalenteri** ja **C · Kestot kortissa** ovat
  riffit siitä, miten voimassaolo näkyy ja miten sitä muutetaan.

Yläosan valinnoilla vaihdat teeman, laitteen, sen salliiko sivusto linkit,
otsikon ja **Enimmäisajan** (7, 90 tai 365 päivää; testipalvelimella 90). Sivun
alareunan harmaa rivi kertoo, mitä hostille lähtisi ja mihin hetkeen asti
linkki toimii.

## Mikä on kaikissa samaa

- Osoitemalli on kierroksen 2 vaihtoehto 1: osoite syntyy, kun näkymä
  tehdään julkiseksi, ja kuolee, kun se tehdään taas yksityiseksi.
- Kytkin tekee näkymästä julkisen yhdellä painalluksella 30 päiväksi (tai
  sivuston enimmäisajaksi, jos se on lyhyempi).
- Lause "poistaminen ei peru sitä, mitä on jo avattu tai kopioitu" on poistettu
  kokonaan.
- Riffeissä päivämäärä on oma painikkeensa kytkimen vasemmalla puolella.
  Kytkin pysyy aina samalla paikalla, ja päivämäärä ilmestyy sen viereen, kun
  näkymä on julkinen.
- Uusi voimassaolo lasketaan aina tästä hetkestä, ja se tulee voimaan heti.
  Osoite pysyy samana. Aikaa voi myös lyhentää.
- Puhelimessa riffien päivämäärä ja kytkin ovat omalla rivillään otsikon
  alla, jotta otsikko saa koko leveyden. Lähdössä ne ovat otsikkorivillä kuten
  kierroksella 2, ja otsikko jää kapeaksi.

## Akseli: mitä päivämäärän painaminen avaa

1. **A · Kestot valikossa.** Pieni valikko: *1 päivä, 7 päivää, 30 päivää* ja
   sivuston enimmäisaika, kunkin vieressä päivä, johon asti linkki silloin
   toimii. Sama valikoima kuin nykyisessä linkki-ikkunassa. Kaksi painallusta.
2. **B · Kalenteri.** Kuukausikalenteri, josta kelpaa mikä tahansa päivä
   huomisesta enimmäisaikaan. Valittu päivä on korostettu, ja päivät siihen
   asti näkyvät vaaleina. Linkki toimii valittuna päivänä samaan kellonaikaan
   asti kuin nyt on.
3. **C · Kestot kortissa.** Samat kestot kuin A:ssa, mutta kortin omana
   rivinä eikä keskustelun päälle aukeavana valikkona. Puhelimessa kestot
   täyttävät rivin.

## Kokeile näin

1. **A**: paina ensimmäisen kortin *28.11. asti* ja valitse *7 päivää*.
   Päivämäärä vaihtuu ja alareunaan tulee tarkka hetki.
2. **B**: avaa kalenteri, siirry seuraavaan kuuhun ja valitse päivä. Vaihda
   Enimmäisajaksi 7 pv: vain viikko eteenpäin kelpaa.
3. **C**: tee toisesta kortista julkinen ja paina sen päivämäärää.
4. Kytke julkinen pois ja takaisin päälle: voimassaolo palaa oletukseen, ja
   osoite on uusi.

Suosittelen **A · Kestot valikossa**. Perustelut, hostin tiedot ja kysymykset
ovat issuen `result.md`:ssä. Kuvat ovat hakemistossa `kuvat/` laitteen
skaalauksella 2.

Sivu rakennetaan komennolla `python3 build.py`. Kuvat ja konsolitarkistus:
`NODE_PATH=<repo>/web/node_modules node shoot.mjs kuvat`, sen jälkeen
`python3 scripts/screenshots-to-avif.py <hakemisto>/kuvat`.

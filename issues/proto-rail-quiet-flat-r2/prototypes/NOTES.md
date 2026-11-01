# Hiljaiset taittuu ja järjestyy: opas (kierros 2)

Avaa `hiljaiset-r2.html`. Se on yksi offline-sivu. Ylhäällä on valitsin
(näppäimet 1–4 tai ←/→). Sivu alkaa kuvakkeet päällä ja viidellä
työtilalla (22 keskustelua, joista 17 Hiljaisissa), ja jokainen suunta
näyttää eronsa heti, ilman kytkimiä:

- **Kierros 1**: lähtökohta. Hiljaiset yhtenä listana uusin ensin, ei taittoa
  eikä järjestystä.
- **1 · Valikko otsikossa**: otsikon oikeassa päässä hiljainen painike
  *Uusin ensin ⌄*; valikossa Uusin ensin, Työtilan mukaan, Nimen mukaan. Lista
  pysyy yhtenä.
- **2 · Työtiloittain**: oletuksena työtilaryhmät kuvakkeineen, ja jokainen
  ryhmä taittuu erikseen; otsikon alla kytkin Työtiloittain | Uusin ensin.
- **3 · Työtilapiirit**: otsikon alla rivi työtilakuvakkeita (Kaikki, oh,
  hb …); kuvake rajaa listan yhteen työtilaan. Järjestys on aina uusin ensin.

Sama luettelo on sivun yläosassa jokaisessa näkymässä. Suunnissa 1–3
Hiljaiset-otsikko taittaa osion, taitto muistetaan laitteella, ja taitetun
otsikon alla näkyy vain avoin keskustelu, jos se on Hiljaisissa.

Oikeasta yläkulmasta vaihdat teeman, laitteen, raiteen leveyden, **määrän**
(*Viisi työtilaa* tai *Paljon*: kymmenen työtilaa ja 50 keskustelua) ja
kuvakkeet. Ilman kuvakkeita rivi kertoo työtilan nimen lopussa kuten
kierroksen 1 suunnassa 1.

## Miten sivua käytetään

- Vasemmalla on **Hiljaiset-osion** tilakone (ei enää keskustelun: keskustelun
  tilat ovat kierroksen 1, eivätkä ne muutu). Korostettu laatikko on osion
  tila tällä laitteella.
- **Työpöytä/Puhelin** on tässä kaksi eri laitetta, joilla on omat muistinsa.
  Taita osio työpöydällä ja vaihda puhelimeen: näet, mikä seuraa sinua (tilin
  asetus) ja mikä jää laitteelle.
- **Lataa sivu uudelleen** näyttää, mikä on vain välilehden muistissa.
- Raiteen rivit, otsikot, valikko, kytkin ja piirit toimivat klikkaamalla
  (puhelimessa ☰).

## Kokeile näin

1. Selaa 1 → 2 → 3 ja katso raidetta: missä Työtilat alkaa ja miltä
   viiden työtilan ja 17 keskustelun lista tuntuu.
2. **1**: avaa *Uusin ensin ⌄* ja valitse *Työtilan mukaan*. Taita
   Hiljaiset, vaihda **Puhelin**: osio on puhelimessa auki, mutta järjestys
   on sama.
3. **2**: taita deutschpad ja workspace. Hiljaiset ja Työtilat mahtuvat
   yhdelle ruudulle. Lataa sivu: taitot pysyvät.
4. **3**: valitse taskfleet-piiri. Lataa sivu: rajaus unohtuu (hinta A).
5. **Viikon takainen** (Selain ja tarina): etsi *Workerin muistiraja*
   kussakin suunnassa. Tapahtumarivi kertoo, millä rivillä se on.
6. **Paljon**: kymmenellä työtilalla suunnan 3 piirit vievät kaksi riviä,
   ja suunnan 2 ryhmiä on kymmenen.

Suosittelen suuntaa **1**: oletus on täsmälleen sinun kuvauksesi, ainoa uusi
asia näkyvissä on yksi hiljainen painike, ja Työtilan mukaan tuo työtilat
yhteen silloin, kun sitä tarvitset. Perustelut, hostin tiedot ja kysymykset
ovat issuen `result.md`:ssä. Kuvat ovat hakemistossa `kuvat/` laitteen
skaalauksella 2.

Sivu rakennetaan komennolla `python3 build.py` tiedostosta `page.src.html`.
Kuvat tehdään komennolla `node shots.mjs <polku>/hiljaiset-r2.html <hakemisto>`
ja muunnetaan AVIFeiksi komennolla `scripts/screenshots-to-avif.py`.

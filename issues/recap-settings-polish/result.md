# Tulos

**Viive.** *Hiljaisuus ennen katsausta* ulottuu nyt tuntiin: 1 min – 9 min
entisin askelin ja sen jälkeen 10, 12, 15, 20, 25, 30, 40 ja 60 min.
Asteikon merkit ovat 1, 3, 10 ja 60. Daemon ja sopimus hyväksyvät 60–3600 s.

Pi:n joutopysäytys kymmenen minuutin jälkeen pysäytti ennen myös katsauksen
ajastimen. Nyt pysäytys antaa vielä odottavan katsauksen eteenpäin: kun se
erääntyy (myöhemmin, jos ihminen on yhä keskustelussa), daemon käynnistää
levänneelle keskustelulle Pi:n pelkkää katsausta varten ja pysäyttää sen
taas, samaan tapaan kuin uudelleenkäynnistyksen jälkeen. Lepo säilyy, eikä
agenttia herätetä. Katsaus tehdään vain, jos natiivihistoria sitä yhä vaatii
(ei arkistoitu, ei uutta katsausta, viimeisin viesti agentin).
`web/tests/recap-resting.spec.ts` (uusi tapaus) ja Go-testit
`TestIdleStopHandsOn…` todentavat tämän.

**Laajuus.** Kun neljä tasoa eivät mahdu otsikon viereen, ne siirtyvät sen
alle tasaleveäksi riviksi. Hyvin kapeassa tilassa (puhelin) ne asettuvat
kahteen kahden riviin, eivätkä koskaan kolmeen ja yksinäiseen Omaan.
Spec tarkistaa leveydet 1280–320 px ja asetukset keskustelun päällä.

**Kortin asetuslinkki.** Ratas avaa asetukset sovelluksen sisällä keskustelun
päälle kuten muualta, ja X palauttaa saman keskustelun luonnoksineen (spec).
Ctrl/⌘-klikkaus avaa yhä uuden välilehden.

Katselmointi: riippumaton `/llm-review` (GPT-6 Astra etsijänä, Claude Fable
5.1 varmistajana) ja `/assess-findings`. Neljä löydöstä korjattiin: läsnäolo
pysäytetyllä keskustelulla siirtää katsausta, ajastimen ja pysäytyksen
kilpatilanne, arkistointi juuri ennen katsausta ja ihmisen viesti tai
komento katsauksen käynnistyksen aikana.

## Decisions for later review

- **Yläraja 60 min.** Vaihtoehdot: 30 min tai rajaton. Tunti kattaa Jarin
  esimerkit (10, 15, 20, 30, 60), ja pidempi hiljaisuus on käytännössä uusi
  käyntikerta, jolloin katsaus tulee joka tapauksessa.
- **Katsaus tehdään levänneelle Pi:lle eikä Pi:tä pidetä hereillä.**
  Vaihtoehto: ajastin estäisi joutopysäytyksen. Se pitäisi jokaisen
  keskustelun Pi:n muistissa jopa tunnin ja veisi paikkoja; levänneen Pi:n
  käynnistys katsausta varten oli jo olemassa uudelleenkäynnistyksen jälkeen.
- **Tilaa varten pysäytetty Pi (makeRoom) menettää yhä odottavan
  katsauksensa**, kuten ennenkin. Se pysäytetään juuri siksi, että paikkoja
  ei ole; katsaus tulee seuraavan vuoron jälkeen.
- **Kaksi kertaa kaksi puhelimella.** Neljä tasaleveää saraketta ei mahdu
  noin 350 px leveään korttiin (*Perusteellinen*), joten kapeimmillaan
  tasot asettuvat kahteen riviin.

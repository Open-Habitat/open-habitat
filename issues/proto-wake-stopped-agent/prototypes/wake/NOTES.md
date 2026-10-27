# Pysähtyneen agentin herätys · kierros 1

Avaa `index.html` selaimessa. Rakennus ja tarkistus:
`node design-system/prototypes/rounds/2026-10-27-agentin-heratys/verify.mjs`
(Playwright `web/node_modules`ista). Kuvat ovat `evidence/`-hakemistossa
laitteen skaalauksella 2.

## Tilanne, joka on kaikissa suunnissa sama

Eilen klo 19.45 pyysit pääagenttia käynnistämään kuusi spinoffia ja
odottamaan niitä. Ensimmäinen valmistui klo 20.10. Agentti kertoi siitä,
mutta ei virittänyt uutta odotusta, ja daemon pysäytti tyhjän Pi:n klo 20.20.
Tämä on Birchn yön tapaus (`pi-stop-cause-overnight`). Yön aikana neljä
workeria päättyi: kaksi yhdistettiin, yksi epäonnistui ja yhtä ei voitu
yhdistää. Yksi on yhä käynnissä. Avaat keskustelun aamulla klo 7.21.

Kaikissa suunnissa:

- **Sivupalkki ja yläpalkki kertovat levosta.** Rivillä on kuu ja niiden
  töiden määrä, jotka ovat päättyneet levon aikana (4). Yläpalkin merkki on
  ”Lepää”. Nykyään keskustelu näyttää vain ”Odottaa”, eikä pysähtynyttä
  erota mitenkään.
- **Kiinnikuromisen sisältö näkyy ennen herätystä:** milloin ja miksi Pi
  pysähtyi (”10 minuuttia jouten, mikään työ ei katkennut”), mitkä työt
  päättyivät sillä välin ja mikä on yhä käynnissä. Nykyään saat tiedon vasta
  viestisi jälkeen, ”Agentti käynnistettiin uudelleen” -merkinnässä.
- **Herätä, kun valmistuu** on kytkin yhä käynnissä olevan workerin
  rivillä. Kun kytket sen päälle, agentti herää kerran, kun juuri tämä työ
  päättyy, vaikka et olisi paikalla. Sivupalkin **Hakuindeksi valmistuu**
  -painike näyttää, mitä silloin tapahtuu. Tätä laukaisinta ei pyydetty, vaan
  kierros löysi sen. Se on sinun käynnistämäsi, yhteen työhön rajattu
  versio alkuperäisen issuen automaattisesta herätyksestä.
- **Herätyksen jälkeen** kortti tai rivi vaihtuu langan merkinnäksi. Se on
  nykyinen ”Agentti käynnistettiin uudelleen”, mutta kertoo nyt syyn:
  ”Viestisi herätti agentin”, ”Herätit agentin”, ”Agentti heräsi, kun avasit
  keskustelun” tai ”Hakuindeksin valmistuminen herätti agentin, kuten
  pyysit”. Sen jälkeen herätetty vuoro lukee päättyneet työt, virittää
  odotuksen käynnissä olevalle ja kertoo tilanteen.
- Viestin kirjoittaminen herättää aina, kuten nykyään.

Kokeile jokaisessa suunnassa ainakin herätystä ja kytkintä. **R** tai ↻
aloittaa suunnan alusta.

## 1 Kirjoittaessa

Tila on kentän yllä yhtenä rivinä: ”Agentti lepää klo 20.20 alkaen · 4
päättynyttä työtä sillä välin. Kirjoita, niin se herää.” Kohdasta **Mitä
tapahtui** avautuu lista. Ensimmäinen kirjoittamasi merkki käynnistää Pi:n
(”Agentti käynnistyy…”, sitten ”Agentti on hereillä”). Kun painat Lähetä,
vastaus alkaa heti ilman käynnistysviivettä. Päättyneet työt kulkevat
agentille viestisi mukana, kuten nykyään.

Herätyspainiketta ei ole. Kierros jatkuu vasta, kun sanot jotain.

## 2 Painike

Langan lopussa on kortti **Agentti lepää**, jossa ovat syy, lista ja
**Herätä ja jatka**. Painallus käynnistää Pi:n, ja agentti aloittaa vuoron
ilman viestiäsi. Voit myös kirjoittaa viestin. Kirjoittaminen ei käynnistä
Pi:tä etukäteen.

## 3 Avatessa

Keskustelun avaaminen herättää agentin itse, jos sen omia töitä on
päättynyt levon aikana. Kortissa näkyy kuuden sekunnin lähtölaskenta:
”Agentti herää käsittelemään päättyneet työt · 6 s” ja **Älä herätä**. Jos
perut, kortti muuttuu Painike-suunnan kaltaiseksi (**Herätä nyt**). Jos
keskustelussa ei ole uutta, avaaminen ei herätä, ja keskustelu herää
viestistä. Avaaminen ei myöskään herätä keskustelua, jonka pysäytit itse
Stop-painikkeella. Vedos näyttää vain uutta sisältävän keskustelun.

## Mitä katsoa

- Riittääkö sinulle, että kierros jatkuu vasta kun kirjoitat (1)? Vai
  haluatko sen jatkuvan yhdellä painalluksella (2) tai pelkästään
  avaamalla (3)?
- Onko lähtölaskenta (3) oikea tapa estää yllätys, vai pitäisikö avaamisen
  herättää heti?
- Kuuluuko **Herätä, kun valmistuu** -kytkin mukaan? Se on ainoa
  laukaisin, joka jatkaa kierrosta, kun et ole paikalla.
- Onko kuu ja luku oikea merkki sivupalkissa? Riittääkö yläpalkin ”Lepää”?

## Mitä vedos ei näytä

Muita keskusteluja ei voi avata. Herätetyn vuoron jälkeen keskustelu ei jatku
pidemmälle. Kapasiteettiraja näkyy vain suosituksessa (`result.md`): kun
neljä Pi:tä on jo käynnissä eikä yksikään ole jouten, herätys kieltäytyy ja
kertoo syyn.

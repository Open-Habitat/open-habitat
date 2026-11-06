# Kierros 1: palvelimen asetukset kaikki näkyvissä

Kierros: `design-system/prototypes/rounds/2026-11-06-palvelimen-asetukset/`
(NOTES.md kertoo vaiheet). Akseli: missä palvelimen osiot ovat ja kuinka
moni niistä näkyy kerralla. Oletusnäkymä on hetki, jolloin ylläpitäjä on
juuri valinnut tilivalikosta *Palvelimen ylläpito*.

- **Nyt**: henkilön 13 osiota ja palvelimen 7 samassa listassa. Palvelin-osio avautuu, lista on alussa, ja integraatiot ovat taitteen alla.
- **A Yleiskuva**: palvelin on listassa yksi rivi heti haun alla. Sen sivu luettelee kaikki seitsemän osiota ja kunkin tilan, ja osio avautuu riviltä ja palaa yleiskuvaan.
- **B Oma alue**: Palvelimen ylläpito on oma alueensa, jonka lyhyt lista sisältää vain palvelimen seitsemän osiota. Omat asetukset ovat yläreunan linkin takana.
- **C Ryhmät**: vasen lista on kuusi ryhmää. Oikealla näkyvät ryhmän kaikki osiot peräkkäin, ja pikalinkit vievät osioon.

Tämä päivä toistettiin tuotannon komponentilla: 1440 × 900 -ikkunassa
Palvelinintegraatiot-rivin alareuna on 766 px ja Levytilan 956 px
asetuskerroksen yläreunasta. Käyttöönotto, Käyttäjät ja pääsy sekä
Levytila ovat siis aina taitteen alla. Integraatiot jäävät alle, kun
selaimen palkit vievät 900 px korkeasta näytöstä osansa, kuten Ainon
koneella. Puhelimessa palvelinosiot ovat 20 rivin listan lopussa.

Kuvat: `evidence/<suunta>-<vaihe>-<leveys>-<teema>.avif`. Esimerkiksi
`nyt-0-oletus-1440-light` on tämä päivä, `nyt-1-lista-vieritetty-1440-light`
vieritetty lista, `a-yleiskuva-0-oletus-1440-light`,
`b-oma-alue-0-oletus-390-light`, `c-ryhmat-1-integraatiot-1440-dark`, ja
`*-1-integraatiot-*` on integraatioiden avaus kussakin suunnassa.

## Mitä kukin päättää

| | Vasen lista palvelimessa | Oikealla | Integraatioihin | Takaisin | Puhelin |
|---|---|---|---|---|---|
| Nyt | 20 riviä, palvelin lopussa | yksi osio | vieritä lista, klikkaa | Palvelin-rivi | 20 rivin lista |
| A | 14 riviä, palvelin ylimpänä | 7 osion yleiskuva tiloineen | rivi yleiskuvassa | *‹ Palvelimen ylläpito* | yleiskuva ensin |
| B | vain 7 palvelinosiota | yksi osio | listan rivi | *‹ Omat asetukset* | välilehtirivi |
| C | 6 ryhmää | ryhmän kaikki osiot peräkkäin | pikalinkki | pikalinkki tai *Ryhmän alkuun* | pikalinkkirivi |

A ja B jättävät henkilön omat asetukset ennalleen. C muuttaa myös ne
ryhmiksi ja pitkiksi sivuiksi.

## Suositus

**A Yleiskuva.** Se korjaa juuri sen, mitä Aino ja Jari kohtasivat:
palvelin on listan ensimmäinen rivi, ja yksi näkymä kertoo kaikki seitsemän
osiota ja sen, mikä on kesken. Käyttöönotossa yleiskuva on myös tarkistuslista
(*Microsoft 365 ei asetettu*). Puhelimessa yleiskuva on luonteva ensimmäinen
näkymä, ja henkilön omat asetukset pysyvät ennallaan. B on selkein jako,
mutta se lisää uuden paikan, josta pitää tietää poistua, eikä kerro tilaa;
seitsemän riviä näkyvät joka tapauksessa. C näyttää eniten kerralla, mutta
seitsemän osiota peräkkäin on pitkä sivu, joka lukee kaiken kerralla ja
muuttaa myös henkilön omat asetukset ilman, että siihen on pyydetty syytä.

## Mitä host-tietoja näkymä olettaa

Ei uusia rajapintoja, palveluita eikä sopimusmuutoksia. A:n yleiskuva lukee
samat vastaukset, jotka osiot jo lukevat, ja tiivistää ne riviksi selaimessa:

- Yleiset: `GET /api/v1/server` (nimi, versio) ja `/server/administration`
  (oletuskieli).
- Integraatiot: `GET /api/v1/server/integrations` (`apps[]`, mitkä
  palveluntarjoajat ovat käytössä) verrattuna sovelluslistaan (`google`,
  `microsoft`, `dropbox`). *Kesken* tarkoittaa, että jollakin on tunnukset
  puuttumassa.
- AI-avain: `GET /api/v1/server/onboarding/ai-key/copies` (`site_key`,
  annetut kopiot, `waiting`).
- Saneluavain: `GET /api/v1/server/speech-key` (`site_key` puuttuu tai on
  asetettu).
- Käyttöönotto: `GET /api/v1/server/onboarding` (oletustyötilat, AI-tarjous).
- Käyttäjät ja pääsy: `GET /api/v1/server/access` (`entries[]`, tila ja
  ylläpitäjät).
- Levytila: `GET /api/v1/server/storage` (`filesystem`, `limits`).

Kierroksella rivit ovat kiinteää tekstiä samasta sijaisdatasta, jota osiot
näyttävät. Toteutuksessa luku, joka epäonnistuu, näyttää rivillä *Tila ei
tiedossa*, ei arvausta.

## Kysymykset Jarille

1. Mikä suunta? Vertaa `nyt-0-oletus-1440-light`,
   `a-yleiskuva-0-oletus-1440-light`, `b-oma-alue-0-oletus-1440-light` ja
   `c-ryhmat-0-oletus-1440-light`. Suositus A.
2. Onko A:ssa palvelin listan ylin rivi heti haun alla
   (`a-yleiskuva-0-oletus-1440-light`), vai pidetäänkö se listan lopussa
   kuten nyt, nyt vain yhtenä rivinä?
3. Saavatko yleiskuvan rivit merkin *Kesken* tai *Kunnossa*
   (`a-yleiskuva-0-oletus-390-light`), vai riittääkö pelkkä tilarivi?

## Tarkistus

`check.mjs`: 134 tarkistuspistettä, konsoli puhdas. Nyt ja kaikki suunnat
1440 × 900 ja 390 × 844 px vaaleana ja tummana: oletusnäkymä,
integraatioihin ja takaisin suunnan omaa reittiä, ja A:ssa ja C:ssä
henkilön oma osio tai ryhmä. Kuvat kertoimella 2 hakemistossa `evidence/`
(AVIF). Synteettinen komponenttilabra, ei host-pohjainen hyväksymistesti.
Hakukenttää ei kokeiltu, eikä Safaria tai iOS:ää.

## Päätökset myöhempää katselmointia varten

- Yleiskuva kootaan selaimessa olemassa olevista luvuista eikä uudesta
  yhteenvetorajapinnasta. Vaihtoehto oli yksi `/server/overview`, mutta se
  olisi toinen paikka, jossa sama tila kerrotaan, ja seitsemän pientä
  lukua riittävät.
- Osioiden nimet A:n ja B:n listassa ovat lyhyempiä (*Yleiset*,
  *Integraatiot*), koska otsikko kertoo jo, että ollaan palvelimessa.
  Osion oma otsikko on vielä tuotannon (*Palvelin*,
  *Palvelinintegraatiot*), ja toteutuksessa ne kannattaa yhtenäistää.
- C:n henkilön ryhmät (Tili ja laitteet, Tekoäly, Yhteydet, Ulkoasu ja
  editori, Tallennustila) ovat kierroksen ehdotus, eivät aiemmin sovittuja.

## Näkymätarjous

```sh
cd ~/src/open-habitat && node design-system/prototypes/rounds/2026-11-06-palvelimen-asetukset/build.mjs /var/tmp/oh-proto/palvelimen-asetukset \
  && scp /var/tmp/oh-proto/palvelimen-asetukset/offline.html alder:/var/tmp/palvelimen-asetukset.html \
  && ssh alder tw browser-open /var/tmp/palvelimen-asetukset.html
```

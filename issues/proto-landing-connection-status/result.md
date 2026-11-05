# Kierros 1: aloitussivu, kun yhteyttä ei saada

Kierros: `design-system/prototypes/rounds/2026-11-05-aloitussivun-yhteys/`
(NOTES.md kertoo ohjaimet ja vuorovaikutukset). Akseli: miten
epäonnistunut ensimmäinen luku sanotaan ja miten automaattinen uusi luku
näkyy. Yläpalkin *Tilanne* vaihtaa syyn: yhteys ei toimi vaikka laite on
verkossa (VPN, oletus), laite on offline, palvelin vastasi virheellä,
kirjautuminen ei täsmää kolmesti. *Palauta yhteys* tuo verkon takaisin.

- **Nyt**: "Palvelin ei vastannut" joka tilanteessa; palaa itse vain, kun selain ilmoittaa verkon palanneen.
- **A Neutraali**: "Yhteyttä ei saatu" ilman väitettä palvelimesta; offline vain vihjeenä; uusi yritys hiljaa taustalla.
- **B Laskuri**: sama tila, ja seuraava yritys näkyy laskurina palkissa; Yritä nyt ohittaa odotuksen.
- **C Tarkista**: kertoo, mitä voit itse tarkistaa (verkko, VPN); uusi yritys taustalla yhdellä rivillä.

Kuvat: `evidence/<suunta>-<tilanne>-<vaihe>-<leveys>-<teema>.avif`, esim.
`nyt-verkko-0-oletus-390-light` (Villen puhelin tänään),
`b-laskuri-verkko-0-oletus-1440-light`, `c-tarkista-offline-0-oletus-390-light`,
`a-neutraali-kirjautuminen-0-oletus-1440-dark`, `nyt-verkko-1-yhteys-palasi`
(VPN palasi, Nyt ei huomaa), `*-verkko-2-palautunut`, `*-verkko-3-lopetettu`.

## Mitä kukin päättää

| | Otsikko (VPN / offline) | Offline | Uusi yritys | Virhevastaus | Ristiriita |
|---|---|---|---|---|---|
| Nyt | Työtiloja ei saatu näkyviin · Palvelin ei vastannut | ei mainita | vain `online`-tapahtumasta | sama teksti | sama teksti, Yritä uudelleen |
| A | Yhteyttä ei saatu | vihjerivi | taustalla, rivi "Sivu yrittää myös itse uudelleen" | Työtiloja ei saatu luettua | Kirjaudu uudelleen / Yritä uudelleen, ei automaattia |
| B | Yhteyttä ei saatu | vihjerivi, laskuri pysähtyy | palkki täyttyy, "Yritetään uudelleen 8 s kuluttua", *Yritä nyt* | sama laskurilla | sama kuin A |
| C | Yhteyttä ei saatu · Yhteys voi katketa matkalla, vaikka palvelin olisi kunnossa | listan ensimmäinen kohta | taustalla, sykkivä piste ja rivi | "Vika ei ole sinun yhteydessäsi", ei listaa | sama kuin A |

Kaikissa suunnissa: vain luvut uusitaan (5, 10, 20, 40, 60 s, sitten
minuutin välein, 15 minuutin jälkeen ei enää itse), offline-tilassa
odotetaan `online`-tapahtumaa, epäonnistunut palkki on neutraali harmaa
eikä virheen punainen, ja onnistunut yritys näyttää *Hei Aino. Haetaan
työtilojasi…* ja sitten sovelluksen.

## Suositus

**B Laskuri.** Villen tapauksessa (VPN, laite verkossa) ongelma ei ollut
vain sana vaan se, ettei sivu tehnyt mitään eikä kertonut odottavansa.
B näyttää, että sivu on elossa ja milloin se yrittää, joten nappia ei
tarvitse painaa varmuuden vuoksi, ja *Yritä nyt* on rehellinen nimi
napille, joka vain ohittaa odotuksen. A korjaa väärän väitteen mutta jättää
taustayrityksen yhden harmaan rivin varaan, jolloin sivu näyttää yhä
pysähtyneeltä. C:n lista auttaa VPN-käyttäjää, mutta se on pitkä ja
kohdistaa epäilyn ihmisen omaan laitteeseen myös silloin, kun vika on
välissä tai palvelimessa; selain ei pysty erottamaan näitä. C:n
virhevastauslause "Vika ei ole sinun yhteydessäsi. Jos tämä jatkuu, kerro
palvelimen ylläpitäjälle." kannattaa ottaa B:hen, koska siinä tilanteessa
se on totta.

## Mitä host-tietoja näkymä olettaa

Ei uusia palveluita, mittauksia eikä sopimusmuutoksia. Selain tietää jo:

- **Offline-vihje**: `navigator.onLine === false` ja `online`-tapahtuma.
  Vihje, ei todiste; `true` ei kerro VPN-, DNS-, TLS- tai välityspalvelimen
  reitistä mitään. Tuotanto kuuntelee `online`-tapahtumaa jo
  `daemon_unavailable`-tilassa (`App.tsx`).
- **Ei käyttökelpoista vastausta**: fetchin hylkäys tai selaimen oma
  aikaraja (60 s ensimmäisellä kerralla, 20 s Pin tarkistuksen jälkeen).
  Syy jää tuntemattomaksi, joten teksti on "Yhteyttä ei saatu".
- **Jokin vastasi**: HTTP-virhe tai kelvoton/liian suuri/skeematon runko
  istunto- tai snapshot-luvussa. Vastaaja voi olla myös välityspalvelin,
  joten teksti sanoo "yhteys palvelimeen toimi", ei "palvelin kaatui".
  Tämä vaatii, että `fail()` saa erottelun (`SnapshotFailure` ja status ovat
  jo olemassa `reconnectDiagnostic`-kutsussa) myös ensimmäisellä
  latauksella, ja istuntoluvun vastaavan erottelun.
- **Ristiriita**: `identityMismatches > 2` → oma tila, ei automaattista
  uusintaa; identiteettiaita pysyy ennallaan. *Kirjaudu uudelleen* on
  nykyinen `/auth/github/start`-kulku.
- **Automaattinen uusinta**: `refresh()` ajastimella vain
  `daemon_unavailable`-tilassa ennen ensimmäistä snapshotia; pysähtyy
  kirjautumiseen, Pi-porttiin ja onnistumiseen. Nykyinen
  sukupolvi/`active`-aita pitää päällekkäiset luvut erillään.
- Kierros ei simuloi välilehden paluuta (`visibilitychange`/`pageshow`);
  puhelin pysäyttää ajastimet taustalla, joten toteutuksessa paluu
  välilehteen kannattaa käsitellä kuten `online`: yritä heti.

## Kysymykset Jarille

1. Mikä suunta (vertaa `nyt-verkko-0-oletus-390-light`,
   `a-neutraali-…`, `b-laskuri-…`, `c-tarkista-verkko-0-oletus-390-light`)?
   Suositus B.
2. Ristiriidassa ensisijainen teko on *Kirjaudu uudelleen*
   (`a-neutraali-kirjautuminen-0-oletus-1440-dark`). Riittääkö pelkkä
   *Yritä uudelleen*, kuten nyt?
3. Lopettaako sivu yrittämisen itse 15 minuutin jälkeen
   (`b-laskuri-verkko-3-lopetettu-1440-light`), vai yrittääkö se minuutin
   välein niin kauan kuin välilehti on auki?

## Tarkistus

`check.mjs`: 222 tarkistuspistettä, konsoli puhdas. Nyt ja kaikki suunnat
neljässä tilanteessa 1440 ja 390 px vaaleana palautumiseen asti,
oletusnäkymät verkko- ja ristiriitatilanteessa 1440 ja 390 px tummana.
Kuvat kertoimella 2 hakemistossa `evidence/` (AVIF). Synteettinen
komponenttilabra, ei host-pohjainen hyväksymistesti; Safari/iOS:ää ja
oikeaa VPN:ää ei kokeiltu.

## Päätökset myöhempää katselmointia varten

- Uusintasarja 5–60 s ja 15 minuutin raja on valittu kierrokselle;
  vaihtoehto oli jatkaa minuutin välein loputtomiin. Kysymys 3.
- Virhevastaus on oma tilansa kaikissa suunnissa, koska analyysin mukaan
  se on ainoa tapaus, jossa selain tietää yhteyden toimineen.
- Offline-tilassa ajastin ei pyöri; `online`-tapahtuma käynnistää
  yrityksen, kuten tuotannossa jo.

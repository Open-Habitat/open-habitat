# GitHub-yhteyden varoitus, kierros 2

Avaa `index.html` selaimessa. Se on yksi offline-tiedosto, kirjoitettu käsin
eikä rakennettu tuotantokomponenteista. Lähde on
`design-system/prototypes/rounds/2026-10-28-github-yhteys-2/`. Tiedosto
rakennetaan ja tarkistetaan komennolla
`node design-system/prototypes/rounds/2026-10-28-github-yhteys-2/verify.mjs`
(Playwright `web/node_modules`ista). Kuvat ovat `evidence/`-hakemistossa
laitteen skaalauksella 2 AVIF-muodossa. Kierros 1 on vertailua varten vieressä
(`../github-connection/`).

## Mitä muuttui kierroksesta 1

Sanoit, että kierroksen 1 suunnat näyttivät samalta ja että varoitus
tarvitaan. Kysyit myös, tarvitaanko painallusta lainkaan. Siksi tällä
kierroksella varoitus on yleinen ja näkyy myös keskustelussa. Lisäksi palvelin
yrittää ensin korjata tilanteen itse ja näyttää varoituksen vasta, kun se ei
onnistu.

Koodista selvisi, mitä palvelin voi korjata itse (tarkemmin `result.md`):

- **GitHubin katko**: palvelin voi korjata sen itse. Se odottaa ja yrittää
  uudelleen, eikä sinun tarvitse tehdä mitään. Jo nyt se tarkistaa tilan
  30 sekunnin välein. Katkoa se ei kuitenkaan erota muista epäselvistä
  tiloista.
- **Vanhentunut tai peruttu tunnus**: palvelin ei voi korjata sitä itse.
  GitHubin uusimistunnusta ei säilytetä, eikä gh osaisi käyttää sitä.
  Tarvitaan yksi painallus. GitHub palauttaa yleensä takaisin kysymättä
  mitään, jos olet kirjautuneena GitHubiin ja sovellus on yhä hyväksytty.
- **Ei yhdistetty ja organisaation esto**: nämä tarvitsevat aina ihmisen.
  Organisaation estossa ihminen on organisaation omistaja.

## Sivun ohjaimet

- **Alareunan valitsin**: kolme suuntaa ja vertailuna **Nykyinen**
  (tuotanto nyt). Näppäimet 1–4 ja nuolet vaihtavat suuntaa. **↻** tai `R`
  aloittaa tapahtumat alusta.
- **Näkymä**: Keskustelu, Uusi työtila tai Koodipalvelut.
- **Tilanne** alkaa, kun sivu avautuu. Aika kulkee nopeutettuna, ja
  sekunti simuloitua aikaa vastaa 50 ms:a. Oikeassa yläkulmassa näkyvät
  simuloitu aika, se mitä palvelin juuri tekee ja tunnistaako palvelin syyn
  jo nyt.
  - **Lyhyt katko**: GitHub ei vastaa minuuttiin, ja kolmas yritys onnistuu.
  - **Pitkä katko**: palvelin yrittää 0, 30, 60 ja 120 sekunnin kohdalla ja
    näyttää sitten varoituksen. **GitHub palaa** -painike simuloi katkon
    päättymistä, jolloin varoitus poistuu itsestään.
  - **Vanhentunut tai peruttu**: palvelin tarkistaa vielä kerran
    10 sekunnin kuluttua ja pyytää sitten yhdistämään uudelleen.
  - **Ei yhdistetty**
  - **Organisaatio estää**: keskustelu on silloin northwindin työtilassa.
  - **Kunnossa**
- **Ikkuna**: Oma, 1280 tai Puhelin. **Teema**: Tumma tai Vaalea.

## Suunnat (akseli: missä varoitus on keskustelussa ja miten palvelimen oma yritys näkyy)

1. **Hiljaa, yläreunaan**: palvelin yrittää näkymättömästi. Vasta kun se
   luovuttaa, sovelluksen yläreunaan tulee banneri. Se on samassa kohdassa
   kuin Yhteys katkesi -ilmoitus ja näkyy kaikissa näkymissä, myös
   keskustelussa. Lyhyestä katkosta et näe mitään.
2. **Näkyvä yritys, kentän yllä**: keskustelussa ilmoitus on suoraan
   kirjoituskentän yllä, samassa paikassa kuin nykyinen
   "Kielimallikirjautuminen ei ole kunnossa". Palvelimen yritys näkyy
   yhden rivin tilana "GitHub ei vastannut · yritetään uudelleen… (2/4)".
   Epäonnistunut yritys muuttuu varoitukseksi, onnistunut näyttää hetken
   "GitHub-yhteys palasi". Muissa näkymissä yläreunan banneri näyttää saman.
3. **Otsakkeessa ja langassa**: keskustelun otsakkeessa Git-tilan vieressä
   on GitHub-siru, joka näyttää yrityksen pyörivänä merkkinä ja
   epäonnistumisen punaisena tai harmaana pisteenä. Sirusta aukeaa selitys
   ja korjaus. Kun palvelin luovuttaa, agentin epäonnistuneen komennon alle
   tulee lisäksi Open Habitatin oma huomautus korjausnappeineen. Muissa
   näkymissä on banneri kuten suunnassa 1.

Kaikissa suunnissa yhteistä:

- Uusi työtila -sivun repolista kertoo, että se yrittää uudelleen.
- Koodipalvelut näyttää uudet tilat Yritetään uudelleen ja GitHub ei vastaa.
- Pitkän katkon varoituksessa ei ole korjausnappia, vain Tarkista nyt.
- Organisaation esto näkyy vain kyseisen organisaation työtiloissa.

## Kokeile näin

1. Valitse **Keskustelu** ja **Pitkä katko**, ja katso suunnat 1, 2 ja 3
   alusta loppuun (↻). Paina lopuksi **GitHub palaa**.
2. Valitse **Lyhyt katko** ja käy suunnat läpi. Suunnassa 1 et näe mitään,
   suunnassa 2 näet yrityksen ja paluun, suunnassa 3 sirun.
3. Valitse **Vanhentunut tai peruttu** ja paina **Yhdistä uudelleen**
   jokaisessa suunnassa. Suunnassa 3 avaa myös siru. Matka GitHubiin on
   simuloitu.
4. Vaihda **Puhelin** ja **Vaalea**. Suunnassa 3 siru on puhelimen
   yläpalkissa, ja selitys aukeaa alhaalta.
5. Vertaa **Nykyiseen**. Keskustelussa ei näy mitään, ja Koodipalvelut
   sanoo katkosta vain "Tilaa ei tiedetä".

## Mitä sinun pitäisi päättää

- Mikä suunta (1, 2 vai 3)? Suosittelen suuntaa 2 (perustelu tiedostossa
  `result.md`).
- Riittääkö yksi painallus vanhentuneeseen tunnukseen? Vaihtoehto on
  automaattinen siirtyminen GitHubiin sovelluksen avautuessa. Suosittelen
  painallusta, koska palvelin ei voi tietää etukäteen, kysyykö GitHub
  jotain.
- Kahden minuutin odotus ennen katkon varoitusta: onko se sopiva?

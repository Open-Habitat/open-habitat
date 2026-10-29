# Kello yläpalkissa

Avaa `index.html` selaimessa. Se on yksi offline-tiedosto, joka on kirjoitettu
käsin (`page.html`). Sitä ei ole rakennettu tuotantokomponenteista.
`build.mjs` upottaa tokenit ja fontit `design-system/`-hakemistosta, ja
`verify.mjs` rakentaa tiedoston ja tarkistaa sen:
`PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright node issues/proto-notification-bell/prototypes/kello/verify.mjs`
(worktreessä ilman `web/node_modules`ia lisää
`OH_WEB_PACKAGE=<toinen checkout>/web/package.json`). Kuvat ovat
`evidence/`-hakemistossa AVIF-muodossa laitteen skaalauksella 2.

## Mistä on kyse

Sanoit 28.10., että yläpalkissa voisi olla kello, joka ilmestyy, kun on
jotain kerrottavaa, ja avautuu siihen, mistä on kyse. Nyt nämä asiat ovat
nauhoina koko sovelluksen yläpuolella: tallennustila, uusi versio ja
GitHub-yhteys. Niitä voi olla monta päällekkäin, ja puhelimessa ne vievät
puolet näytöstä (katso **Nykyinen**).

Kierroksen akseli: **miten ilmoitus tulee esiin ja miten se kuitataan.**
Kaikissa suunnissa kellon takana on sama sisältö:

- **Tallennustila** lähes täynnä (yli 90 %) tai täynnä. Tekstit ja painikkeet ovat
  tuotannon omat.
- **Uusi versio** saatavilla: *Lataa uudelleen* ja *Myöhemmin*, kuten nyt.
- **GitHub-yhteys** vanhentunut tai peruttu: *Yhdistä uudelleen*.
- Vain ylläpitäjälle: **palvelimen kiintiöt ylittävät levyn**.

Kellon ulkopuolelle jäävät:

- **yhteysnauha**: kun yhteys on poikki, kellonkaan tieto ei ole tuore
- **kumoa-ilmoitukset**: ne ovat kiireellisiä ja jo yläpalkin rivillä
- **keskustelun omat ilmoitukset** (Pi käynnistyi uudelleen, agentin ilmoitus,
  laajennuksen ilmoitus): ne kuuluvat siihen kohtaan keskustelua, jossa ne
  tapahtuivat.

## Sivun ohjaimet

- **Alareunan valitsin**: kolme suuntaa ja vertailuna **Nykyinen**. Näppäimet
  1–4 ja nuolet vaihtavat, R aloittaa alusta.
- **Tilanne**: *Ei mitään*, *Tila lähes täynnä*, *Tila täynnä* tai *Useita*
  (tila lähes täynnä, uusi versio ja GitHub poikki).
- **Tapahtuu**: *Uusi versio julkaistaan*, *Tila täyttyy* (lähes täynnä
  muuttuu täydeksi) ja *Tilaa vapautuu*. Näillä näet, miten saapuminen ja
  ratkeaminen näkyvät.
- **Näkymä**: Keskustelu tai työtilan sivu. Työpöydällä työtilan sivulla ei ole
  yläpalkkia, joten kello on sivun otsakkeessa toimintojen vieressä.
- **Rooli**: Ylläpitäjä näkee lisäksi palvelimen ilmoituksen omana ryhmänään.
- **Ikkuna**: Oma, 1280 tai Puhelin. **Teema**: Vaalea tai Tumma.
- Toiminnot eivät oikeasti avaa asetuksia, vaan kertovat ilmoituksella, mitä
  tapahtuisi. *Tarkista vapautettu tila* simuloi, että olet tyhjentänyt
  roskakorin.

## Suunnat

1. **Tila**: kello näyttää sen, mikä on nyt voimassa.
   - Kello on näkyvissä vain silloin, kun jokin asia on voimassa. Luku kertoo,
     montako asiaa on.
   - Vakava asia (tila täynnä, GitHub poikki) näkyy kellossa sanoina
     punaisella pohjalla, esimerkiksi *Tila täynnä*.
   - Uuden asian saapuessa kello heilahtaa kerran.
   - Kuittausta ei ole: asia poistuu, kun se ratkeaa. Esimerkiksi kun vapautat
     tilaa, ilmoitus ja lopulta kello katoavat. Ainoa poikkeus on uuden
     version *Myöhemmin*, joka toimii kuten nyt.
2. **Saapuneet**: kello on aina näkyvissä, ja se toimii saapuneiden
   kansiona.
   - Luku on lukemattomien määrä. Avaaminen merkitsee asiat luetuiksi, ja
     uudet näkyvät kerran *Uusi*-merkillä.
   - × kuittaa asian. Se palaa, jos tilanne muuttuu (lähes täynnä → täynnä).
   - Ratkenneet jäävät listaan ajan kanssa, kunnes tyhjennät ne.
3. **Nosto**: uusi asia nousee hetkeksi riviksi yläpalkin alle ja taittuu
   kelloon.
   - Riviksi nousee vain tärkein asia. Muut menevät suoraan kelloon (*+2
     kellossa*).
   - Varoitus ja tieto taittuvat itse kahdeksan sekunnin jälkeen. Laskuri
     pysähtyy, kun osoitin tai kohdistus on rivillä.
   - Vakava asia pysyy rivinä, kunnes se ratkeaa tai painat *Kelloon*.
   - Kun kelloon on taittunut jotain, mitä et ole vielä avannut, kellossa on
     piste.
4. **Nykyinen**: tämänhetkiset nauhat koko sovelluksen yläpuolella. Mukana
   vertailun vuoksi.

## Mitä kannattaa katsoa

- Valitse **Useita**, katso puhelimessa kaikki neljä suuntaa ja vertaa
  Nykyiseen. Kuinka paljon keskustelua jää näkyviin?
- Valitse **Tila lähes täynnä** ja paina **Tila täyttyy**. Huomaatko
  muutoksen kussakin suunnassa? Tila täynnä tarkoittaa, että tallennus voi
  epäonnistua.
- Avaa kello, paina *Tarkista vapautettu tila* ja sulje kello. Mitä jää
  jäljelle? Tilassa ei mitään, Saapuneissa ratkennut rivi.
- Saapuneissa kuittaa tallennustila ×:llä ja paina **Tila täyttyy**.

## Kysymyksiä sinulle

- Kuuluuko GitHub-varoitus kelloon? Keskustelussa se näkyy nyt myös
  kirjoituskentän yllä, koska agentin push epäonnistuu juuri siellä.
  Prototyypissä se on molemmissa paikoissa.
- Kun tila on täynnä, keskustelu piilottaa nyt omat virheilmoituksensa, koska
  yläreunan nauha kertoo syyn. Kellon kanssa syyn täytyy näkyä avaamatta
  mitään. Tila (sanat kellossa) ja Nosto (rivi pysyy) täyttävät tämän,
  Saapuneet ei: siinä täysi levy näkyy vain punaisena lukuna.
- Kellon kuvaketta käytetään jo taustatyön palkissa merkitsemään, että
  agentti odottaa prosessia. Haittaako kaksoismerkitys?

Suositus ja perustelut ovat issuen `result.md`-tiedostossa.

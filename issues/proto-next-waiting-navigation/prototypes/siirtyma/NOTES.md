# Seuraava odottava: siirtyminen ja paluu

Avaa `index.html` selaimessa. Se on yksi offline-tiedosto, jonka lähde on
käsin kirjoitettu `page.html`. Sivua ei ole rakennettu tuotantokomponenteista.
`build.mjs` upottaa tokenit ja fontit `design-system/`-hakemistosta, ja
`verify.mjs` rakentaa tiedoston ja tarkistaa sen:
`PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright node issues/proto-next-waiting-navigation/prototypes/siirtyma/verify.mjs`
(worktreessä ilman `web/node_modules`ia lisää
`OH_WEB_PACKAGE=<toinen checkout>/web/package.json`). Kuvat ovat
`evidence/`-hakemistossa AVIF-muodossa laitteen skaalauksella 2.

## Mistä on kyse

Sanoit 29.10., että *Sillä aikaa* -rivi toimi, mutta siirtyminen tarjottuun
keskusteluun ja takaisin (Alt+↓ / Alt+↑) ei ole vielä oikein mietitty.
Tuotannossa löytyi kolme kohtaa, jotka selittävät tunteen (katso
**Nykyinen**):

- **Alt+↑ ei näy missään.** Kohteessa mikään ei kerro, että pääset takaisin,
  eikä sitä, mihin pääset. Alt+↑ kelaa askeleen taaksepäin, joten kahden
  siirtymän jälkeen se ei vie sinne, missä agentti työskenteli.
- **Luettu vastaus pysäyttää kävelyn.** Rivi ilmestyy vain, kun keskustelun
  agentti työskentelee. Jos avaat keskustelun, jossa on vain uusi vastaus, ja
  luet sen, riviä ei tule eikä Alt+↓ tee mitään.
- **Puhelimessa paluuta ei ole lainkaan**, koska näppäimiä ei ole.

Akseli: **miten siirryt odottavaan ja miten palaat.** Kaikissa suunnissa
on sama tarina:

- Olet keskustelussa *Kirjautumisen virheilmoitukset* ja agentti työskentelee.
- Sinua odottavat:
  - *Varmuuskopion ajastus*, joka kysyy
  - *Tiedostopuun lajittelu*, jossa on uusi vastaus
  - *Laskun PDF-pohja*, jossa on uusi vastaus

Data on keksittyä.

## Sivun ohjaimet

- **Valitsin ylhäällä** (alareunassa se peittäisi kentän): kolme suuntaa ja
  vertailuksi **Nykyinen**. Näppäimet 1–4 ja ←/→ vaihtavat suuntaa, R
  aloittaa tarinan alusta.
- **Tapahtuu**:
  - *Kirjautuminen valmistuu*: lähtökeskustelun agentti saa työnsä valmiiksi.
  - *Varmuuskopio vastataan toisella laitteella*.
  - *Uusi vastaus saapuu*: kolmas keskustelu tulee Sinun vuorosi -listaan
    kesken kaiken.
- Agentit valmistuvat myös itsestään: lähtö noin 45 sekunnissa ja muut noin
  15 sekunnissa vastauksesi jälkeen.
- **Ikkuna**: Oma, 1280 tai Puhelin. **Teema**: Vaalea tai Tumma.
- Alt+↓ ja Alt+↑ toimivat myös kirjoittaessa, kuten tuotannossa. Puhelimessa
  kaikki tehdään napauttamalla.

## Suunnat

1. **Paluu**: tarjous ja paluu ovat näkyvinä riveinä kentän yllä.
   - Lähdössä näkyy sama *Sillä aikaa* -rivi kuin nyt.
   - Kohteessa rivien paikka vastaa nuolta. Ylempi rivi on paluu (Alt+↑):
     *Takaisin · Kirjautumisen virheilmoitukset · työskentelee 0:42*. Alempi
     rivi on seuraava tarjous (Alt+↓), ja se tulee esiin, kun et enää ole
     tarpeen siinä keskustelussa, jossa olet: olet vastannut kysymykseen tai
     lukenut vastauksen.
   - Paluu vie aina lähtöön, ei askelta taaksepäin. Kun lähdön agentti
     valmistuu, paluurivi muuttuu oranssiksi: *valmis, uusi vastaus ·
     Palaa*.
   - Paluu lopettaa kävelyn.
2. **Jono**: kaikki odottavat näkyvät yhtenä kierroksena.
   - Lähdössä rivi sanoo *3 odottaa sinua · Käy läpi*.
   - Kierroksen ajan kentän yllä on jono: lähtö, sitten odottavat
     sivupalkin järjestyksessä. Nykyinen kohta on korostettu, hoidetut on
     merkitty ✓:llä ja toisaalla hoidettu on yliviivattu.
   - Alt+↓ vie seuraavaan ja Alt+↑ edelliseen. Myös jonon kohtaa voi
     napauttaa.
   - Viimeisen jälkeen Alt+↓ vie lähtöön ja sanoo *Kierros käyty: 3
     hoidettu*. ✕ tai Esc lopettaa kierroksen.
   - Puhelimessa jono tiivistyy muotoon *‹ ●●○○ 1/3 · nimi · Seuraava ✕*.
3. **Rinnakkain**: odottava avautuu nykyisen viereen, joten mihinkään ei
   siirrytä.
   - *Avaa viereen* (Alt+↓) avaa keskustelun oikealle omaksi palstakseen,
     jossa on oma kenttänsä. Kohdistus siirtyy sinne, ja lähtö jatkaa
     vasemmalla näkyvissä.
   - Kun olet vastannut, palstan alareunassa on seuraava odottava.
   - Esc tai Alt+↑ sulkee palstan, ja kohdistus palaa lähdön kenttään.
     Palstan ⤢ avaa keskustelun kokonaan.
   - Puhelimessa palsta on alalehti lähdön päällä. Lähdön nimi ja tila
     näkyvät sen yläpuolella.
4. **Nykyinen**: tuotannon käytös vertailua varten. Rivi on lähdössä, Alt+↓
   siirtää eteenpäin, ja Alt+↑ kelaa askeleen taaksepäin näkymättä missään.

## Mitä kannattaa katsoa

- Käy Paluussa sama polku kuin Nykyisessä:
  1. Paina Alt+↓ ja vastaa *Klo 4.30*.
  2. Paina Alt+↓ ja lue Tiedostopuun vastaus.
  3. Paina *Kirjautuminen valmistuu*.

  Missä kohtaa tiedät Nykyisessä, mihin Alt+↑ vie?
- Jonossa on tuplaosuma: näet koko kierroksen etukäteen, mutta jono vie
  rivin, joka on näkyvissä myös silloin, kun keskustelu kysyy jotain.
  Tuntuuko se avulta vai ylimääräiseltä?
- Rinnakkain 1280 px:n leveydellä ja puhelimessa: riittääkö puolikas näyttö
  kysymykseen vastaamiseen? Puhelimessa lähtö jää lähes kokonaan alalehden
  alle.
- Paina jossain vaiheessa *Varmuuskopio vastataan toisella laitteella*.

## Kysymyksiä sinulle

- Pitäisikö paluun viedä **lähtöön** (Paluu) vai **askel taaksepäin**
  (Nykyinen, Jono)? Ehdotan lähtöä, koska sinne jäi työ odottamaan.
- Tarjotaanko seuraavaa myös keskustelussa, jonka agentti ei työskentele,
  kun olet juuri lukenut sen vastauksen? Paluussa ja Rinnakkain tarjotaan,
  Nykyisessä ei.
- Mac: Option+↑/↓ siirtää kirjoituskentässä kohdistimen kappaleen alkuun tai
  loppuun. Nykyinen ominaisuus vie näppäimet kirjoittaessa. Haittaako se
  sinua? Vaihtoehto on ottaa ne vain, kun kenttä on tyhjä.

Suositus ja perustelut ovat issuen `result.md`-tiedostossa.

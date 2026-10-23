# Otsikon odotus · prototyyppikierros 23.10.2026

[Kolmen suunnan valitsin](https://glasspad.example.test/p/mqp4jiyirvqpczpen7bmej722a/)

## Yhteenveto

Otsikon luonnin odotuksen voi nähdä otsikossa, sen alla tai vieressä.
Kaikissa suunnissa vanha otsikko säilyy luettavana ja vaihtuu vasta vastauksen
saavuttua. Ensimmäisessä luonnissa näkyy siihen asti ”Uusi keskustelu”.
Animaatio loppuu myös virheessä; epäonnistuminen ei vaihda otsikkoa.
Tuotanto ja yhteinen prototyyppikirjasto ovat ennallaan. Issue jää in-progress,
valinta ja toteutus odottavat Jaria.

## Yksi akseli: odotusliikkeen paikka

| Suunta | Liikkeen paikka | Milloin hyvä | Hinta |
| --- | --- | --- | --- |
| Hengitys | Otsikkotekstin kevyt läpinäkyvyyden vaihtelu | Kun halutaan pienin mahdollinen lisämerkki | Teksti itse elää; nopea luonti voi näyttää vain välähdykseltä |
| Viiva | Lyhyt edestakaisin liikkuva viiva tekstin alla | Kun otsikko halutaan pitää täysin vakaana | Voi muistuttaa etenemispalkkia, vaikka ei mittaa etenemistä |
| Pisteet | Kolme porrastetusti liikkuvaa pistettä tekstin vieressä | Kun odotuksen pitää erottua selvästi | Vie hieman otsikkotilaa ja on viivaa levottomampi |

**Suositus: Viiva.** Otsikko on luettava tunniste, joten sen kirjainten ei
kannata sykkiä. Viiva kertoo juuri tämän kentän muuttumisesta eikä vie tilaa
otsikkoriviltä. Se ei täyty kohti sataa prosenttia. Reduced-motion-tilassa
viiva tai pisteet pysyvät paikallaan; Hengitys jää tavalliseksi tekstiksi.
Kaikissa tiloissa odotus kerrotaan myös tekstinä ja `aria-busy`-attribuutilla.

**Kysymys Jarille:** valitaanko otsikon alle liikkuva **Viiva**, vai tuntuuko
Hengitys tai Pisteet tässä yläpalkissa paremmalta?

## Kokeile

- Näppäimet 1–3 tai nuolet vaihtavat suuntaa, R toistaa. Valitsimen ↻ tekee saman.
- Valitse vaalea/tumma ja Puhelin 390 px. Otsikko katkeaa tarvittaessa, toiminnot eivät katoa.
- Vertaa 180 ms:n vastausta tavalliseen 1,4 s:n odotukseen ja 5 s:n hitaaseen vastaukseen.
- Vaihda ensimmäiseen otsikkoon, pitkään otsikkoon ja virheeseen.
- H-painike luo uudelleen myös onnistumisen tai virheen jälkeen. Tiedot ja puhelimen valikko toimivat kirjaston tavoin.
- Käyttöjärjestelmän vähennetty liike poistaa liikkeen. Julkaistussa kopiossa on järjestelmäfontit Glasspadin CSP:n vuoksi; paikallinen vedos upottaa tuotteen fontit.

## Toteutuksen lähtötiedot ja rajaus

Kierros käyttää `lib/app.js`:n sovelluskehystä ja sen toimintoja.
Yläpalkin piirto ja otsikon luonnin ajastus ohitetaan vain kierroksen omassa
koodissa. Järjestys ja typografia on verrattu `Navigation.tsx`:n
`AgentHeader`-komponenttiin sekä tämän työpuun synteettisen labin
1440/390 px -kuviin. Sisältö on keksittyä, ei henkilökohtaista historiaa.

Hostilta tarvitaan nykyinen otsikko, tiedossa oleva keskeneräinen
otsikonluonti, vahvistettu uusi otsikko tai virhe. Nykyinen
`titleAction.pending` antaa manuaalisen luonnin odotustiedon; automaattisen
luonnin tilan kytkentä on varmistettava toteutuksessa. Ei uusia host-komentoja,
prosentteja, arvioitua kestoa tai rinnakkaista otsikkovarastoa. Agentin
”Odottaa sinua” on eri tila eikä vaihdu otsikon luonnin vuoksi.

## Decisions for later review

- Liike alkaa heti ja loppuu todellisen vastauksen mukana: ei keinotekoista
  vähimmäiskestoa. Vaihtoehto olisi viivästetty näyttö välähdyksen välttämiseksi;
  nopean 180 ms:n tilanteen avulla Jari voi arvioida tarvitseeko sitä.
- Vanha otsikko säilyy eikä sitä korvata odotustekstillä. Ensimmäisessä luonnissa
  käytetään nykyistä väliaikaista otsikkoa. Näin tunnistettava nimi ei katoa.
- Vain otsikon oma merkki liikkuu. H-ikonin nurkkamerkkiä ei pyöritetä samalla,
  jotta suunnat vertaavat yhtä asiaa eivätkä kahta rinnakkaista animaatiota.

## Tarkistus ja toistaminen

Kierroksen lähde: `design-system/prototypes/rounds/2026-10-23-otsikon-odotus/`.
`dist/` on sivuutettu eikä rakennettua HTML:ää tai kuvadumppia commitoida.

```sh
node design-system/prototypes/build.mjs design-system/prototypes/rounds/2026-10-23-otsikon-odotus
# Linux, oman työpuun synteettinen host ja tuotantobundle:
umask 077
TMPDIR=/var/tmp go build -o .cache/browser-host ./test/browser-host
npm ci --prefix web --ignore-scripts --no-audit --no-fund
npm run build --prefix web
npm ci --prefix internal/daemon/pi-device-test --ignore-scripts --no-audit --no-fund
PLAYWRIGHT_BROWSERS_PATH=$PWD/.cache/ms-playwright node design-system/prototypes/rounds/2026-10-23-otsikon-odotus/verify.mjs
node design-system/prototypes/rounds/2026-10-23-otsikon-odotus/prepare-publish.mjs
glasspad publish design-system/prototypes/dist/title-publish --space-key open-habitat-title-animation-2026-10-23 --json
```

`verify.mjs` käynnistää ja sulkee vain oman synteettisen labihostinsa portissa
19481. Todisteet ovat `design-system/prototypes/dist/title-evidence/`:
labin kuva + inertti HTML kummassakin leveydessä, `check.mjs`:n teemamatriisi
sekä odotus- ja pitkän otsikon kuvat. Ei tuotantopalvelimen tai aidon Pi:n testi.

### Toteutunut tarkistustulos

- `check.mjs`: 12 suunta/teema/leveys-yhdistelmää + 2 klikkauskuvaa,
  ei konsoli- tai sivuvirheitä.
- `verify.mjs`: 24 yhdistelmää (3 suuntaa × 2 leveyttä × 2 teemaa ×
  tavallinen/vähennetty liike). Jokaisessa nopea ja tavallinen valmistuminen,
  virhe, ensimmäinen otsikko, pitkä otsikko, Tiedot ja R-uusinta. Kaikki läpi.
- Synteettinen tuotantolab: 1440 ja 390 px, kummastakin PNG + inertti HTML.
- `check-hosted.mjs`: kaikki 3 suuntaa julkaistusta iframe-sivusta, tumma
  puhelinkehys ja odotustila; ei konsoli- tai sivuvirheitä.
- `git diff --check`: puhdas. Tuotantotiedostoja tai `lib/`-tiedostoja ei muutettu.

Tarkistukset tehtiin Aldern omassa työpuussa: nykyinen `fleetrepo-exec`
-sijoitus kieltäytyi etätehtävästä ja ilmoitti repon olevan natiivisti ajettava.
Alkuperäinen Mac-kopio ei soveltunut Linux-labille; jaetun node_modules-linkin
puuttuvat riippuvuudet ratkesivat työpuun omalla lukitulla `npm ci`:llä.
Glasspadin julkaisu ja selaintarkistus onnistuivat; headless-palvelimen
`xdg-open` ei avannut käyttäjän selainta. Linkki on yllä ja KOKEILTAVAA:ssa.
Ei täyden gaten, natiivin Pi:n tai käyttäjäeristyksen hyväksyntäväitettä.

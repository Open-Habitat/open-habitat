# Reitti rinnalla · kierros 2

**[Avaa kolme suuntaa](https://glasspad.example.test/p/o4zqhanv6x7odq62y4latbpoca/)** · valitse alareunan valitsimesta tai näppäimillä **1–3 / ← →**. **R** aloittaa käyttöönoton alusta. Vain keksittyjä tietoja; ei oikeita kirjautumisia eikä tuotantomuutoksia.

Jari valitsi ensimmäisestä kierroksesta **Reitti rinnalla**. Tämä kierros tutkii yhtä akselia: **kuinka paljon reitti on jatkuvasti läsnä**. Tehtävät, sivuston säännöt ja sisältö ovat samat kaikissa suunnissa.

| Suunta | Akselin kohta | Milloin hyvä | Hinta |
| --- | --- | --- | --- |
| **Kartta** | Koko reitti pysyvästi rinnalla | Henkilö haluaa nähdä alusta asti, mitä on tulossa ja mitä ohitettiin | Vie työpöydällä palstan, puhelimessa kaksi riviä |
| **Kompassi** | Nykyvaihe ja seuraava rinnalla; koko reitti avattavissa | Henkilö haluaa keskittyä yhteen asiaan mutta säilyttää suunnan | Kokonaisuuden ja aiempien vaiheiden tilojen katsominen vaatii avauksen |
| **Reittitasku** | Reitti rinnalla vain pyydettäessä | Henkilö haluaa rauhallisimman tehtävänäkymän | Vaiheiden nimet eivät ole jatkuvasti näkyvissä |

**Suositus: Kartta.** Käyttöönotto on harvinainen tilanne, jossa kokonaisuuden näkyminen auttaa: GitHub, Google ja AI-tili eivät ole sama liitos. Neljän kohdan reitti on lyhyt eikä sen piilottamisesta synny suurta tilansäästöä. Tämä on suositus, ei tehty valinta.

## Mitä muuttui

- Valitsin tulee nyt sanatarkasti `/prototype/PICKER.md`:n yhteisestä toteutuksesta. Kierros käyttää `design-system/prototypes/build.mjs`:ää, tokeneita, `lib/`-kehystä, teema-/puhelinohjaimia sekä `check.mjs`:ää. Kirjastoon tai tuotantoon ei tehty muutoksia.
- Google-vaiheessa näkyvät **Google, mitä se antaa, yhdistämistoiminto ja tila**. Lisäksi yksi lyhyt oikeuksien vaikutusta kuvaava rivi ja jatkuva poistumistie. Repon hakukuitti on avattava, ei enää Googlen edellä luettava selostus.
- `ProviderMark` ja `ControlButton` tulevat samoista tuotantokomponenteista kuin Asetukset › Integraatiot. Kansiovalinta on oikea `ConnectDialog`; lopun asetukset on oikea `IntegrationsOverview`. Kompakti Google-yhteenveto on kierroksen oma sommitelma näistä palasista, **ei väite olemassa olevasta kompaktista tuotantokortista**. Tuotannon pitkä `Intro` ja koko palveluvalikoima eivät tulostu käyttöönoton vaiheeseen.
- Googlen lupahyväksyntä on lyhyt, selvästi merkitty simulaatio; oikeaa palveluntarjoajaa ei avata. Kansiovalinnan jälkeen tilaksi simuloidaan yhdistetty. AI-tilin tilakortti käyttää `PiDeviceSignIn`-komponenttia.

## Kokeile

1. GitHub → esivalittu repo → Google → AI-tili → työtilat. Vaihda suuntaa: käyttöönotto alkaa alusta.
2. Poista oletusrepon valinta tai jatka ilman repoja. Valinta ei vielä käynnistä hakua.
3. Näytä yli 14 päivää vanhat repot, valitse vanha ja piilota vanhat uudelleen: valittu pysyy. Tuntematon commitin aika sekä sivuston oletus pysyvät näkyvissä.
4. Avaa **Synteettinen prototyyppi · skenaariot**. Valitse automaattinen haku: repovalinta ohitetaan, tulos löytyy seuraavan vaiheen **Repojen haun tila** -avauksesta. Epäselvä tulos ei saa onnistumismerkkiä eikä käynnistä hakua uudestaan.
5. Yhdistä Google → simuloi hyväksyntä → valitse kansiot oikeassa asetusten dialogissa → jatka. Työtilojen **Asetukset › Integraatiot** näyttää saman simuloidun tilin.
6. Kokeile puuttuvaa repoluetteloa ja evättyä Google-lupaa: kumpikaan ei pakota aloittamaan uudelleen. Valinnaisen Googlen ja AI-tilin saa ohittaa. Ilman AI-tiliä agentti ei vielä käynnisty.
7. Pakollinen Google tarjoaa keskeytyksen ja paluun, ei virheellistä valmistumista. Pois käytöstä poistaa vaiheen reitistä. Tämä pakollisuuden tulkinta on edelleen avoin oletus, ei uusi päätös.

## Host-oletukset ja rajat

Sanasto säilyy: `onboarding.steps`, `onboarding.repositories.defaults`, `onboarding.repositories.stale_after_days`, `onboarding.integrations`, `invitations`.

Näkymä tarvitsee järjestetyt vaiheet ja niiden pakollisuuden, oletusrepojen automaattinen/esivalittu-tavan, vanhenemisrajan sekä henkilön omat repo-oikeudet ja haun todennetun tuloksen. Google- ja AI-tilan on tultava henkilön omalta natiivilta käyttäjältä. Kutsu ei anna repon tai Googlen käyttöoikeuksia. Git-identiteetin vahvistus oletetaan ensimmäisen kierroksen tavoin jo tehdyksi; sitä ei poisteta tuotannosta.

Viimeisen commitin aika ei ole `pushed_at`. Tämä kierros käyttää keksittyä commit-ikää; toteutuksen on edelleen selvitettävä oikea lähde. Selaimen muistissa oleva tila ei todista kirjautumista tai hostiin tallennettua jatkamista. Uudelleenlataus nollaa käyttöönoton; paikallisen HTML:n suuntavalinta säilyy URL-parametrilla. Ei auktoriteetti-, konfiguraatio-, OAuth- tai Unix-eristysratkaisuja.

## Kysymys Jarille

**Pidetäänkö koko reitti jatkuvasti näkyvissä (Kartta), vai haluatko keskittymistä tukevan Kompassin tai avattavan Reittitaskun?**

Aiempi kysymys pakollisen Googlen merkityksestä jää avoimeksi; sitä ei tarvitse ratkaista tämän esitystapavertailun yhteydessä. Issue jää `in-progress`-tilaan, `preparation: pending`.

## Lähde ja toistaminen

Lähde: `design-system/prototypes/rounds/2026-10-23-onboarding-person-r2/`. [Ensimmäisen kierroksen tulos](result-round1.md) säilyttää aiemman vertailun ja host-oletusten taustan.

```sh
npm ci --prefix web --ignore-scripts
TMPDIR=/var/tmp/oh-onboarding-r2 node design-system/prototypes/build.mjs design-system/prototypes/rounds/2026-10-23-onboarding-person-r2
node design-system/prototypes/check.mjs design-system/prototypes/dist/2026-10-23-onboarding-person-r2.html --modes desk-light,desk-dark,phone-light,phone-dark --click '[data-testid=signin]' --click '[data-testid=checkout]'
node design-system/prototypes/rounds/2026-10-23-onboarding-person-r2/journey.mjs design-system/prototypes/dist/2026-10-23-onboarding-person-r2.html design-system/prototypes/dist/journey-offline
node design-system/prototypes/rounds/2026-10-23-onboarding-person-r2/publish.mjs
glasspad publish design-system/prototypes/dist/onboarding-person-r2-space --space-key open-habitat-proto-onboarding-person-r2-2026-10-23 --no-open --json
node design-system/prototypes/rounds/2026-10-23-onboarding-person-r2/journey.mjs https://glasspad.example.test/p/o4zqhanv6x7odq62y4latbpoca/ design-system/prototypes/dist/journey-hosted
```

`round.mjs` paketoi nykyiset React-komponentit Viten kirjastotilassa ja tuottaa ohitetut `round.js`/`round.css`-tiedostot yhteistä rakentajaa varten. Myös `.bundle/` ja `dist/` ovat generoituja. Julkaisuvaihe poistaa upotetut fontit hosted-CSP:tä varten; offline-HTML säilyttää ne.

Aldern sijaan Chromium-tarkistukset ajetaan Cedarissa erillisessä tilapäispuussa samalla rakennetulla HTML:llä ja tämän worktreen Playwright-versiolla. Yllä olevat selaimen komennot ovat toistettavissa siellä. Tuotantokontekstina luettiin komponenttikoodi, designin nykytila sekä ensimmäisen kierroksen saman päivän synteettinen labiaineisto; uutta tuotantolabia ei käynnistetty.

## Tarkistustulos

- Yhteinen `check.mjs`: **14 kuvaa**, kaikki kolme suuntaa vaaleana/tummana sekä työpöytä- ja puhelinkehyksessä, GitHub- ja repoaskel klikattu, ei konsolivirheitä.
- Oma vuorovaikutusajo: **296 painallusta / ajo**, kolme suuntaa × 1440/390 px × vaalea/tumma, sekä [offline-HTML](evidence-r2/offline.json) että [julkaistu Glasspad-sandbox](evidence-r2/hosted.json) läpi. Vanhan repon valinnan säilyminen, oikea kansiovalitsin, yhdistetyn tilin asetukset, automaattisen haun epäselvyys, puuttuva luettelo, pakollisen vaiheen keskeytys/paluu, evätty lupa, off-vaihe, AI-tilin ohitus sekä valitsimen näppäimistö ja paikallisen URL-valinnan uudelleenlataus tarkistettu. Ei konsolivirheitä eikä vaakaylivuotoa kuvatuissa näkymissä.
- Edustavat kuva + inertti HTML -parit: [Kartta, vaalea työpöytä](evidence-r2/1440-light-v1-integration.html), [Kompassi, tumma työpöytä](evidence-r2/1440-dark-v2-integration.html), [Reittitasku, tumma puhelin](evidence-r2/390-dark-v3-integration.html). Kunkin vieressä on samanniminen `.avif`. Muut kuvat syntyvät yllä olevilla komennoilla.
- `python3 scripts/validate-project-view.py` ja `git diff --check`: läpi.

Rakentaja ilmoittaa Viten/PostCSS:n lähdepolkuvaroituksen sekä React Routerin `use client` -direktiivin käsittelystä; lopullinen rakennus ja molemmat selainajot onnistuvat. Nämä ovat staattisen prototyypin vuorovaikutustarkistuksia, eivät hostin, OAuthin, pysyvän jatkamisen tai Unix-eristyksen todisteita. Tuotantoa tai sopimuksia ei muutettu, joten full gatea ei ajettu.

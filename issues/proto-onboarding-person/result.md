# Uuden henkilön käyttöönotto

**Suositus: Askelkortti.** Yksi vaihe kerrallaan on lähimpänä nykyistä käyttöönottoa. Google käyttää samoja tuotantokomponentteja kuin Asetukset › Integraatiot, ei uutta rinnakkaista liittämisnäkymää. Valitse suunta ennen toteutusta.

**[Avaa prototyypin kolme suuntaa](https://glasspad.example.test/p/hbyhcwbt3xfvhazgrfndrmtm4u/)**

Tämä on vain synteettinen prototyyppi; tuotantoa, oikeuksia tai kirjautumisia ei muuteta.

## Vertailu

Sama sisältö ja samat sivuston säännöt kolmessa suunnassa. Akseli on **miten käyttöönoton reitti esitetään**:

1. **Askelkortti (suositus):** vaihelista kortin yläpuolella ja yksi tehtävä näkyvissä. Puhelimessa vaihelista rivittyy, ei vaakavieritystä.
2. **Reitti rinnalla:** työpöydällä reitti vasemmalla. Kokonaisuus näkyy rauhallisemmin, mutta vie enemmän leveyttä; puhelimessa reitti palaa yläpuolelle.
3. **Yksi sivu:** kaikki vaiheet omilla riveillään; nykyinen auki, käsitellyt ja tulevat tiiviinä. Kokonaisuus hahmottuu, mutta puhelimessa sivu on pidempi.

## Mitä kokeilla

Sivun yläosa on katselmoinnin ohjain, ei ehdotus uuden henkilön asetuksiksi. Suunnan tai skenaarion vaihto aloittaa simulaation alusta.

- GitHub-kirjautuminen → esivalittu repo → Google → AI-tili → työtilat.
- Poista esivalinta tai ohita repot kokonaan. Esivalinta ei käynnistä hakua ennen painallusta.
- Vaihda **Oletusrepot → Automaattinen haku**: repovaihe ohitetaan, tulos näkyy seuraavalla sivulla. Epäselvä haku ei muutu onnistumiseksi eikä käynnisty uudelleen itsestään.
- Näytä yli 14 päivää vanhat repot. Valittu vanha repo ei katoa, kun piilotat vanhemmat uudelleen. Tuntematon commitin aika ei merkitse vanhaa repoa.
- Kokeile tyhjää luetteloa, puuttuvaa luettelovastausta ja epäselvää hakua. Aina voi jatkaa ilman repoja.
- Liitä Google: oikea tuotannon lupaesittely → simuloitu hyväksyntä → oikea kansiovalinta → yhdistetty tili ja taustasynkronointi. Ulkoisia sivuja ei avata. Myös Googlen luvan epäämisen voi simuloida.
- Ohita valinnainen Google tai AI-tili. Työtiloihin pääsee ilman AI-tiliä, mutta agentti ei vielä käynnisty.
- Vaihda Google pakolliseksi: tarjolla on keskeytys ja paluu, ei väärää valmistumismerkintää. Pois käytöstä -asetus poistaa vaiheen koko reitistä.
- Lopun **Asetukset › Integraatiot** näyttää saman yhdistetyn tilin samoilla komponenteilla. Poisto ja tarkistus ovat paikallisia simulaatioita.

## Tuotantokonteksti ja rajat

Luettu nykyinen `GitHubOnboarding.tsx`, `GitHubRepoChooser.tsx`, `OnboardingFrame.tsx`, `PiDeviceSignIn.tsx`, `Integrations.tsx` sekä `ServerAdministration.tsx`. Nykyinen reitti on GitHub / Git-identiteetti → repot → AI-tili; sivuston määrittelemää Google-vaihetta tai nelivaiheista runkoa ei ole.

Kierros tuo suoraan tuotannosta `ControlButton`, `IntegrationsOverview`, `ConnectDialog` ja `PiDeviceSignIn` sekä yhteiset tokenit ja tyylit. Muuttuva vaihelista ja oletusrepojen esitys ovat vain kierroksen omaa koodia. Reponvalitsin ei ole tuotannon komponentin uudelleenkäyttö: nykyinen komponentti omistaa kiinteän kolmivaiheisen kehyksen, eikä sivuston ehdotukselle ole siinä näyttömallia. AI-kortti on tuotannosta, mutta prototyyppi vahvistaa sen vain simulaatiopainikkeesta.

Tämän kierroksen esimerkkisivusto on keksitty Aurinkolabra; tunnukset ovat `.test`-osoitteita. Git-identiteetti oletetaan jo vahvistetuksi, ei poistettavaksi tuotannosta. Prototyypin muistissa oleva tila häviää uudelleenlatauksessa: keskeytys/paluu ei todista hostin tallennusta eikä uuden selainistunnon jatkamista.

## Host-oletukset, eivät toteutuspäätökset

Yhteinen sanasto: `onboarding.steps`, `onboarding.repositories.defaults`, `onboarding.repositories.stale_after_days`, `onboarding.integrations`, `invitations`.

Näkymä tarvitsee sivuston järjestetyt vaiheet ja niiden pakollisuuden, repo-oletuksen hakutavan, vanhenemisrajan ja henkilön oman GitHub-luettelon sekä haun todennetun tuloksen. Integraation tila luetaan omalta käyttäjältä kuten asetuksissa; selaimen etenemismerkintä ei ole todiste natiivista kirjautumisesta. Kutsu/admission ei ole repon käyttöoikeus eikä Google-valtuutus. Tässä ei päätetä konfiguraation tallennuspaikkaa, CLI:tä eikä admission-auktoriteettia; ne kuuluvat rinnakkaiseen suunnitteluyksikköön.

Nykyinen repoluettelo näyttää `pushed_at`-ajan. Jarin pyytämä **viimeisen commitin aika** ei ole sama asia; prototyyppi olettaa sen saatavan luotettavasti. Toteutussuunnitelman on selvitettävä tiedon lähde eikä nimettävä push-aikaa commit-ajaksi. Tuntematon aika pidetään näkyvissä. Sivuston oletus ei saa kadota aikarajan takia.

## Decisions for later review

- **Suositus esitystavaksi:** Askelkortti; vaihtoehdot Reitti rinnalla ja Yksi sivu ovat katsottavissa samassa sivussa.
- **Automaattinen vs. esivalittu:** automaattinen haku ohittaa repovalinnan mutta ei peitä tulosta; esivalittu odottaa omaa painallusta. Automaattisen haun epäselvyys ei estä muiden vaiheiden tekemistä, eikä haku toistu automaattisesti.
- **Pakollinen Google:** tässä pakollinen tarkoittaa ehtoa työtiloihin siirtymiselle; aina voi keskeyttää ja jatkaa myöhemmin. Vaihtoehto olisi suositus, jonka saa ohittaa työtiloihin asti. Näitä ei pidä sekoittaa samaksi tilaksi. Tämä on prototyyppioletus Jarin ratkaistavaksi, ei uusi käyttöoikeusmalli.
- **Aikaraja:** oletus 14 päivää, vanhat saa näkyviin. Esivalinnat, valitut repot ja tuntemattomat ajat pysyvät näkyvissä. Vaihtoehto olisi kova rajaus, joka vaikeuttaisi poikkeustyötä.
- **AI-tili:** työtiloja saa selata ilman sitä, agenttien käyttö odottaa kirjautumista. Tämä on ehdotus jatkuvasta poistumistiestä, ei väite nykyisen palvelun toiminnasta.

## Kysymys Jarille

**Valitaanko Askelkortti, ja tarkoittaako pakollinen Google tässä oikeasti työtiloihin siirtymisen ehtoa vai vain vahvaa suositusta?** Muut valinnat näkyvät yllä, eikä mitään näistä ole toteutettu palveluun.

## Tarkistus ja toistaminen

Lähde: `design-system/prototypes/rounds/2026-10-23-onboarding-person/`. Tässä kierroksessa on oma React/Vite-rakentaja, jotta asetusten tuotantokomponentteja voi oikeasti käyttää.

```sh
npm ci --prefix web --ignore-scripts
TMPDIR=/var/tmp node design-system/prototypes/rounds/2026-10-23-onboarding-person/build.mjs
PLAYWRIGHT_BROWSERS_PATH="$HOME/.cache/ms-playwright" node design-system/prototypes/rounds/2026-10-23-onboarding-person/check.mjs design-system/prototypes/dist/onboarding-person/offline.html design-system/prototypes/dist/onboarding-person/evidence
```

`dist/` on generoitu eikä sitä commitoida. Offline-versiossa fontit ovat mukana; Glasspad-versio käyttää samojen tokenien varafontteja, koska hosted-sivun CSP ei salli upotettuja fontteja.

Tarkistettu 23.10.2026 pohjasta `d2a59b256d95cb30ef82ed3b66561b5935ae43d1` tämän kierroksen lähteillä:

- Tuotannon web-build ja synteettinen browser-host-build: onnistui. Oma foreground-lab portissa 15375, ei oikeita tilejä; `context.mjs` tallensi nykyiset repot, Integraatiot ja Palvelin. [Reponvalinta](context/production-repositories.html), [Integraatiot](context/production-integrations.html), [Palvelin](context/production-server.html); rinnalla vastaavat AVIF-kuvat.
- Offline Chromium: **108 tarkistuspistettä, 60 screenshot + staattinen HTML -paria**, kolme suuntaa × 1440/390 px × vaalea/tumma. Valinnat, suodatus, oletusrepon automaattinen ohitus, tyhjä/epäselvä hakutulos, Googlen lupaesittely/kansiovalinta/yhdistäminen, ohittaminen, pakollisen keskeytys/paluu, off-vaihe ja AI:n ohitus klikattu. Ei konsolivirheitä eikä dokumentin vaakaylivuotoa. [Koneellinen tulos](evidence/offline-check.json).
- **Sama 108 pisteen matriisi julkaistun Glasspad-sivun sandboxissa: läpi**, ei konsolivirheitä. [Hosted-tulos](evidence/hosted-check.json). Julkaisukomento: `glasspad publish design-system/prototypes/dist/onboarding-person/space --space-key open-habitat-proto-onboarding-person-2026-10-23 --no-open --json`.
- Edustavat säilytetyt parit: [Askelkortin repot, desktop vaalea](evidence/1440-light-d1-repos.html), [Reitti rinnalla, desktop tumma](evidence/1440-dark-d2-google.html), [Yksi sivu, 390 px vaalea](evidence/390-light-d3-repos.html), [Askelkortin Google, 390 px tumma](evidence/390-dark-d1-google.html). Jokaisen vieressä on samanniminen `.avif`. Kaikki muut 60 paria voi luoda yllä olevalla komennolla uudelleen.
- `issuectl doctor --json`, `python3 scripts/validate-project-view.py` ja `git diff --check`: läpi.

Rakentaja ilmoittaa Viten/PostCSS:n lähdepolkuvaroituksen, React Routerin `use client` -direktiivin ja yhden ison JS-paketin; nämä eivät estä prototyypin rakentamista tai käyttöä. Ensimmäisen julkaisun automaattinen paikallinen selainavaus ei onnistunut Aldern headless-ympäristössä; julkaisu onnistui ja lopullinen versio julkaistiin `--no-open`-valinnalla, minkä jälkeen hosted-sivu todennettiin Chromiumilla.

Tämä ei ole OAuth-, käyttöoikeus-, erillisten Unix-käyttäjien, verkon, pysyvän jatkamisen tai tuotannon toiminnallisuuden testi. Ei full gatea: tuotantokoodi tai sopimus ei muutu. Issue jää `in-progress`-tilaan, `preparation: pending`, odottamaan Jarin suuntavalintaa.

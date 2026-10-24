# Integraatiovaiheet sivuston asetuksista

Henkilön käyttöönottoreitti saa nyt yhden vaiheen jokaista integraatiota kohti,
jonka ylläpitäjä on lisännyt Käyttöönotto-välilehdellä ja joka on palvelimella
valmis käyttöön (katalogin `available`). Vaiheet ovat Repojen ja AI-tilin
välissä katalogin järjestyksessä. Aina näkyvä Google-vaihe on poistettu:
ilman lisättyjä integraatioita reitillä ei ole integraatiovaiheita.

- **Sääntö yhdessä paikassa**: `routeIntegrations` (`web/src/app/onboardingConfig.ts`)
  valitsee vaiheet sivuston listasta ja henkilön oman katalogin valmiudesta.
  Sekä henkilön reitti että ylläpitäjän esikatselu käyttävät sitä. Valmis
  tarkoittaa `available === true`; ei-valmis tai tuntematon (katalogia ei
  saatu luettua) piilottaa vaiheen poistamatta sitä asetuksista (Jari
  24.10.: tunnusten poisto piilottaa vaiheen).
- **Henkilön vaihe**: `GoogleOnboarding` yleistyi `IntegrationOnboarding`iksi
  (Asetukset › Integraatiot rajattuna yhteen palveluun). Ohitettavassa
  vaiheessa on *Jatka ilman tiliä*; pakollisessa ei ole ohitusta, vain
  Takaisin ja Keskeytä, ja Jatka ilmestyy, kun tili on yhdistetty. Pakollinen
  ei estä mitään muuta (ADR 0030). Takaisin vie edelliseen integraatioon tai
  repoihin. Ohitetut/yhdistetyt vaiheet muistetaan istunnon ajan
  (`nah:integration-steps`, sidottu istunnon tiivisteeseen kuten repovaiheen
  merkki).
- **Kartta-kehys**: `OnboardingFrame` nimeää integraatiovaiheen palvelun
  tunnuksella (`onboarding-step-google`), merkitsee pakollisen
  (`data-required`, tuleva vaihe "Pakollinen") ja tuntee esikatselun
  "valmis"-tilan.
- **Käyttöönotto-välilehti**: *Lisää integraatio* tarjoaa vain valmiit
  integraatiot; muut näkyvät "Ei käytössä" / "Tila ei tiedossa" ilman
  Lisää-painiketta. Asetuksissa oleva ei-valmis vaihe näkyy reittilistassa
  piilotettuna (numeroton, katkoviiva, "Piilotettu · ei käytössä") ja sen
  asetuksissa kerrotaan, että se palaa, kun integraatio on valmis.
- **Esikatselu**: piirtää tuotannon `OnboardingRoute` + `OnboardingFrame`
  -kehyksen (sama komponentti kuin henkilöllä) laitekehyksen sisällä; oma
  `PreviewRoute`-kopio ja sen CSS poistettiin.
- **Selainisäntä**: `/fixture/onboarding` ottaa `integrations=google:required,microsoft`.
  Oletussivustolla ei ole integraatiovaiheita, joten 16 speksiä lakkasi
  ohittamasta Google-vaihetta (`passGoogle` poistettu).

Sopimusta, yhdyskäytävää tai daemonia ei muutettu: henkilön
`GET /api/v1/onboarding/site` kantoi integraatiot jo, ja valmius luetaan
henkilön omasta `GET /api/v1/integrations`-katalogista. Arvio: kohdennettu
itsearvio (esitys olemassa olevan luvun päällä, ei auktoriteetin siirtoa).

## Näyttö

| Tarkistus | Tulos |
| --- | --- |
| vitest `GitHubOnboarding.test.tsx` (uusi): nolla, yksi ohitettava, yksi pakollinen (+ seuraava ja takaisin), ei-valmis/tuntematon | Läpi |
| vitest `OnboardingSettings.test.tsx`, `OnboardingAdministration.test.tsx`: vain valmiit lisättävissä, ei-valmis piilotettuna, esikatselun reitti tuotannon kehyksestä | Läpi |
| Koko vitest (102 tiedostoa, 619 testiä), `typecheck`, `lint` | Läpi |
| Selain: `onboarding-route-map.spec.ts` (uusi tapaus: pakollinen Google yhdistetään oikealla dialogilla, ohitettava Microsoft, axe), `site-onboarding.spec.ts`, `onboarding-default-repos.spec.ts`, `github-first-onboarding.spec.ts` | Läpi |
| Koko selainsarja (`test-focused.sh --area browser`) | 348 läpi, 3 ohitettu, 3 kaatui. `shell-accessibility.spec.ts` (AI-vaiheen otsikko ei saanut fokusta) oli tämän työn virhe: reitin fokuskohde nimesi vanhan `pi-device-title`-otsikon, minkä aina näkyvä Google-vaihe peitti. Korjattu ja testattu `GitHubOnboarding.test.tsx`:ssä, speksi uudelleen läpi. `browser-conversation.spec.ts` (identiteetin vaihto) ja `start-here.spec.ts` (lab) menivät läpi uudelleen ajettuina: kuorman alla heiluvia, koskemattomia. |
| `go vet ./test/browser-host`, `gofmt` | Läpi |
| Täysi portti `ci-local.sh --clean --json` | Pysähtyi `web-checks`-vaiheeseen: `CodeMirrorEditor.test.tsx` jättää käsittelemättömän jsdom-virheen (`getClientRects`), joka toistuu `main`issa 3/3. Kirjattu intakeen `fully-wrathful-trip`. Go/sopimus- ja selainvaiheet eivät siksi ajautuneet portissa; selainsarja ajettiin erikseen (yllä). Kuittia ei kirjoitettu. |
| Kuvakaappaukset (synteettinen lab, `web/lab/capture-onboarding-integration-steps.mjs`) | `person-required-*`, `tab-hidden-*`, `tab-add-*`, `preview-required-*` tässä kansiossa; työpöytä ja puhelin, vaalea ja tumma |

## Päätöksiä myöhempään tarkistukseen

- **Tuntematon valmius piilottaa vaiheen.** Jos henkilön katalogia ei saada
  luettua, integraatiovaiheita ei näytetä (kuten ennen Googlen kohdalla);
  ylläpitäjälle välilehdellä vastaava rivi on "Tila ei tiedossa" eikä
  integraatiota voi lisätä. Vaihtoehto olisi näyttää vaihe varmuuden vuoksi,
  mutta silloin henkilö voisi juuttua pakolliseen vaiheeseen, jota ei voi
  yhdistää.
- **Pakollinen vaihe ilman tiliä**: ei Jatka-painiketta lainkaan (ei
  harmaana), vain Takaisin ja Keskeytä. Tämä on "skip-toiminnon poisto"
  sellaisenaan; pääsy työtiloihin URL:lla ja SSH:lla säilyy.
- **Ei-valmiit integraatiot Lisää-näkymässä** näkyvät listattuina ilman
  painiketta, jotta ylläpitäjä näkee, miksi niitä ei tarjota. Ne voisi myös
  jättää kokonaan pois.
- **AI-vaihe esikatselussa** noudattaa edelleen `site_key`-sääntöä (vaihe
  puuttuu), vaikka henkilön reitti listaa AI-tilin aina ja Pi:n tila päättää
  sen ohittamisesta. Ei muutettu tässä työssä.
- **Takaisin-painike** pakollisesta/ohitettavasta integraatiovaiheesta vie
  edelliseen vaiheeseen; AI-vaiheen "Takaisin repojen valintaan" vie edelleen
  repoihin ja nollaa integraatiovaiheet, kuten se nollasi Google-vaiheen.

## Ei todennettu

Oikea Google/Microsoft-palvelu ja kahden UID:n asennus; selainisäntä on
saman UID:n synteettinen näyttö reitistä ja releistä.

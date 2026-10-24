# Käyttöönoton asetukset: tallennus, komentorivi ja Käyttöönotto-välilehti

Ylläpitäjä muokkaa sivuston käyttöönottoa kohdassa Asetukset › Käyttöönotto, ja
rootin agentti tekee saman komennoilla `open-habitat admin onboarding show` ja
`admin onboarding update --file <polku|-> --expected-version <n> [--dry-run]`.
Molemmat kirjoittavat yhden versioidun tietueen yhdyskäytävän ylläpitotilaan
(`administration.json`) samalla kirjoituslukolla ja samalla tarkistuksella.
`host apply` ei koske siihen. Henkilön puolelle on luku
`GET /api/v1/onboarding/site`, jossa ei ole oletusrepoja eikä niiden määrää.
Henkilön oma käyttöönotto ei vielä lue asetuksia; sen tekevät jatko-issuet.

## Näyttö

- Go: `internal/gateway/onboarding_test.go` (kierros selaimen ja ohjauspistokkeen
  kautta, versioristiriita, samat hylkäykset molemmilla poluilla, henkilön luku
  ilman oletusrepoja, `host apply`n operaatiot eivät muuta asetuksia, tallennettu
  tietue on kanoninen) ja `internal/cli/admin_onboarding_linux_test.go`
  (show/update/`--dry-run` gatewayn oikeaa ohjauskäsittelijää vasten, hylkäykset,
  tiukat liput, ohje).
- Sopimus: `server-onboarding.schema.json` ja `site-onboarding.schema.json`
  esimerkkeineen; negatiiviset tarkistukset hylkäävät henkilön luvun, jossa on
  `defaults` tai niiden määrä.
- Selain: komponenttitestit (`OnboardingSettings.test.tsx`,
  `OnboardingAdministration.test.tsx`, `onboardingConfig.test.ts`), Storybook
  `Settings/Käyttöönotto` ja host-backed spec `site-onboarding.spec.ts`
  (muokkaus, oletusrepo tuotannon RepoFinderilla, esikatselu, tallennus,
  ristiriita, tavallisen henkilön 403). Koko selainsarja: 336 läpi, kaksi
  kaatumista, joista toinen oli tämän työn konsolivaroitus (korjattu) ja toinen
  kuormassa heiluva `start-here`, joka meni yksin ajettuna läpi.
- Kuvat: `tab-*` ja `preview-*`, tietokone ja 390 px, vaalea ja tumma
  (synteettinen labra, `web/lab/capture-site-onboarding.mjs`).

## Päätöksiä myöhempään tarkistukseen

- **Oletusarvo ennen ensimmäistä tallennusta** on nykyinen tuotanto: *Esivalitse*
  ilman oletusrepoja, Google ohitettavana vaiheena ja AI-tilistä kaikki
  vaihtoehdot. Versio on silloin 0. Näin tallentamaton palvelin käyttäytyy
  jatko-issueiden jälkeenkin kuten ennen.
- **Integraatioiden järjestys** tallennetaan aina Integraatiot-sivun
  järjestyksessä (Google, Microsoft 365, IMAP, CalDAV, CardDAV, Dropbox), vaikka
  ne annettaisiin muussa järjestyksessä.
- **Sama oletusrepo eri kirjainkoolla** (`Org/Repo` ja `org/repo`) hylätään
  kaksoiskappaleena, koska GitHub ei erota niitä.
- **Sivuston avain** ei näy AI-tilin tavoissa ennen kuin `site-ai-key` tuo
  avaimen. Välilehdellä on siksi vain *Henkilö valitsee* ja *Oletus*.
  Palvelin hylkää `site_key`-tarjouksen koodilla `site_key_unavailable`.
- **Henkilön luvussa ei ole oletusrepojen määrää.** Määrä paljastaisi, että
  sivustolla on repoja, joihin henkilöllä ei ole pääsyä. Reitin "Sivusto hakee
  N repoa" tulee henkilökohtaisesta, suodatetusta suunnitelmasta
  (`onboarding-default-repositories`).
- **Asentamattoman integraation saa lisätä.** Se näkyy reitillä merkinnällä
  "Ei asennettu · jätetään pois", ja henkilön reitiltä se jää pois, kunnes se
  asennetaan. Saatavuus luetaan ylläpitäjän omasta integraatiokatalogista.
- **Ristiriidassa luonnos hylätään.** *Lataa nykyinen versio* tuo palvelimen
  version, ja muutos tehdään uudelleen. Vanhan luonnoksen tallentaminen uuden
  päälle kumoaisi toisen ylläpitäjän muutoksen huomaamatta.
- **Esikatselun henkilö on yksinkertaistettu.** Se näyttää reitin ja kunkin
  vaiheen olennaisen sisällön (oletusrepot valintoina, integraation laatta ja
  ohitus, AI-tarjous ja *› Käytä muuta AI-palvelua*). Tuotannon vaiheita se ei
  vielä käytä, koska `OnboardingFrame` tuntee vain Googlen integraatioista ja
  sitä muokataan rinnakkain. Jatko-issuet vaihtavat esikatseluun tuotannon
  vaiheet. Kierroksen 5 valinta *Esikatsele henkilönä: Ei pääsyä* jäi pois,
  koska tuotannossa ei tiedetä, kenellä pääsyä puuttuu.
- **Leveys:** Käyttöönotto-välilehti saa asetussivulla leveämmän palstan
  (enintään 1000 px), jotta reitti ja asetukset mahtuvat rinnakkain. Kapeammassa
  tilassa ne ovat allekkain.
- **Ohjauspistokkeen pyyntöraja** nostettiin 1 KiB:stä 8 KiB:hen, jotta 20
  oletusrepoa mahtuu yhteen pyyntöön.

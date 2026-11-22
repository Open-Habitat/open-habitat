# Selainkäynti keskustelussa: prototyyppikierros 22.11.2026 (Claude)

## Saatesanat

Tämä kierros korvaa hylätyn kierroksen kokonaan, eikä siitä ole otettu
mitään. Kun agentti on käyttänyt selaintasi, keskusteluun jää siitä merkintä:
milloin se tapahtui, millä sivustoilla, montako sivua, mitä se latasi ja mihin
se kirjoitti tai mitä painoi. Merkinnän voi avata, ja silloin näkyvät sivut,
tiedostot ja painallukset. Kun agentti työskentelee, ikkunaluettelo nimeää sen
välilehden ja kertoo, montako sivua se on siinä avannut.

**Suosittelen suuntaa 2, Kortti.** Se on vastauksen alla Muutokset-kortin
vieressä ja samannäköinen, joten "mitä agentti muutti" ja "missä agentti
kävi" löytyvät samasta paikasta. Kortti näkyy, vaikka työ olisi piilossa,
eikä keskustelusta tule lokia.

Kokeile näin: vaihda suuntaa alhaalta. Paina sitten **Kesken**, jolloin
selainpaneeli aukeaa ja agentin välilehti näkyy nimettynä. Paina
**Näytä keskustelussa** ja lopuksi **Seuraava askel** muutaman kerran, kunnes
välilehti sulkeutuu ja merkintä jää. Kaikki sisältö on keksittyä.

## Akseli ja suunnat

Akseli: **missä kohdassa keskustelua merkintä on.** Sisältö on joka suunnassa
sama.

| Suunta | Oletusnäkymä | Mitä valinta päättää |
| --- | --- | --- |
| 1 Rivi | Habitat-rivi vuoron jälkeen: "Agentti käytti selaintasi 16.42–16.48 · stays.example help.stays.example · 13 sivua · 13 latausta · 2 toimintoa", ja Näytä avaa luettelon paikallaan | Merkintä on Habitatin oma tapahtuma vuorojen välissä, kuten jaetun keskustelun rivit. Jokaisesta selainkäytöstä tulee rivi. |
| **2 Kortti** | Selain-kortti vastauksen alla Muutokset-kortin rinnalla. Kun vuoro on kesken, *Selain nyt* -kortissa on Katso-painike. | Merkintä kuuluu vuoron tulokseen, kuten Muutokset. Kesken olevassa vuorossa kortti on työrivin alla. |
| 3 Työ | Vain merkki työrivillä: "2 työkalua · selain: 13 sivua". Kun työn avaa, selainkomennot ovat yhtenä Selain-ryhmänä. | Merkintä on osa agentin työtä ja jää piiloon työn mukana. Tämä on kevyin vaihtoehto, mutta se tarkoittaa, että selainkäyttö on tekninen yksityiskohta. |

Kaikille yhteistä:

- **Ikkunaluettelo kesken työn.** Tuotannon `BrowserStrip` merkitsee
  agentin välilehden "agentti tässä" vain silloin, kun `agent_connected` on
  tosi. Se pätee vain yhden komennon ajan, joten merkki vilkkuu komentojen
  välissä. Tämä selittää testaajan havainnon. Prototyyppi pitää välilehden
  merkittynä koko käynnin ajan: "Agentin välilehti · 8 sivua tässä".
  Paneelin alla on "Käynti kirjautuu keskusteluun · Näytä keskustelussa".
  Omaa ikkunaasi ei merkitä.
- **Käynnin jälkeen** agentin välilehti on suljettu ja poistunut luettelosta.
  Merkintä kertoo sen ("Agentin välilehti suljettu"), ja tieto säilyy
  keskustelussa.
- **Erittely:** sivut ryhmiteltyinä sivustoittain (aika, sivun otsikko,
  polku), lataukset tiedostonimineen ja kohdekansioineen sekä painallukset
  ja kirjoitukset valitsimineen ja sivuineen. Lopussa kerrotaan, mistä
  luettelo on koottu ja mitä siitä puuttuu.
- **Semantiikka:** "10 varaussivua" kuuluu agentin vastaukseen ("10
  varausta ja 13 kuittia"). Merkintä laskee vain sivuja, latauksia ja
  toimintoja, jotka voidaan todentaa.

## Decisions for later review

- **Mistä merkintä kootaan (arkkitehtuuriehdotus, ei päätös).** Ehdotan,
  että merkintä johdetaan natiivista keskusteluhistoriasta. Agentti käyttää
  selainta `bash`-työkalulla `open-habitat agent browser …` -komennoin, ja
  Pi tallentaa jokaisen komennon ja sen JSON-tuloksen. Jos komentojen
  tuloksissa on sivun `url` ja `title` komennon jälkeen (`goto`, `click`) ja
  latauksissa tiedoston nimi, selain voi koota merkinnän vuoron
  työkalukutsuista. Kortti syntyisi siis samalla tavalla kuin Muutokset
  (`TurnChangesSource`). Silloin ei tarvita uutta tallennetta, daemonin
  selaushistoriaa eikä uutta sopimuskenttää, vain laajemmat CLI-tulokset.
  Vaihtoehto on, että browser-host tarkkailee agentin välilehtiä CDP:n kautta
  (`Page.frameNavigated`, latausten tapahtumat) ja kirjoittaa
  käyntitallenteen. Se näkisi myös uudelleenohjaukset ja sivun omat
  siirtymät, mutta se olisi toinen paikka, jossa tieto agentin työstä voi
  erota natiivista historiasta. Siksi se vaatisi oman päätöksensä.
  Johdetun merkinnän kattavuusraja kerrotaan erittelyssä: sivu kirjataan,
  kun agentin komento avaa sen tai kun sen painallus vie uudelle sivulle.
- **Origin vai koko URL.** Ehdotan näin: origin näkyy yhteenvedossa, ja
  erittelyssä näkyvät polku ilman kyselyosaa ja fragmenttia sekä sivun
  otsikko. Vaihtoehdot ovat pelkät originit tai täydet URL:t. Pelkillä
  originilla "13 sivua" ei ole tarkistettavissa. Täysissä URL:issä
  kyselyosa kantaa usein hakutermejä, tunnisteita ja kertakäyttöisiä
  avaimia. Polussakin voi olla varaus- tai asiakastunnus, kuten
  `/trips/R-1041`. Hyväksyn sen, koska `goto`-komennon argumentti on jo nyt
  täytenä URL:nä keskustelun työkalurivillä, joten merkintä ei paljasta
  enempää kuin historia. Kyselyosa poistetaan silti myös merkinnästä.
- **Lomakkeen lähetys.** Prototyyppi ei väitä lähetystä tapahtuneeksi.
  Se näyttää agentin painallukset (`click`) ja kirjoitukset (`type`)
  valitsimineen, koska komennoista ne tiedetään varmasti. `type` ei koskaan
  lähetä mitään. Vaihtoehto on tunnistaa lähetykset sivulta, mutta sitä ei
  saa luotettavaksi, ja väärä "ei lähetyksiä" olisi pahempi kuin rehellinen
  "painoi `button.search`". Kirjoitettua tekstiä ei näytetä.
- **`eval`.** Prototyypissä ei ole `eval`-komentoa. Toteutuksessa sen voisi
  laskea toiminnoksi nimellä "suoritti skriptin sivulla" ilman skriptin
  sisältöä. Merkintä ei voi tietää, mitä skripti teki.
- **Lataukset** näytetään tiedostoniminä ja kohdekansiona. Tiedostoa ei
  kopioida eikä latauksen URL:ää näytetä.
- **Yksi merkintä vuoroa kohden.** Jos sama vuoro käyttää selainta kahdesti,
  merkintöjä on silti yksi, koska suunta 2 seuraa Muutokset-mallia. Suunnassa
  1 tulisi kaksi riviä.
- **Ikkunaluettelon merkki** perustuu tietoon "agentin tämän vuoron aikana
  avaama välilehti" eikä `agent_connected`-tilaan. Status kertoo jo
  `agent: true` (viimeisin välilehti, jossa agentti toimi). Sivulaskuri
  luettelossa vaatii joko johdetun merkinnän tiedon selaimelle tai uuden
  statuskentän. Valitsen ensimmäisen, koska keskustelunäkymä tietää sen jo.

## Questions for Jari

1. Valitaanko **2 Kortti** (Muutokset-kortin rinnalla, näkyy myös työ
   piilossa)?
2. Hyväksytkö, että merkintä johdetaan natiivista historiasta
   (CLI-tuloksiin `url`/`title`) eikä browser-hostin omasta tallenteesta?
   Tämä on arkkitehtuurikysymys, ja se kirjataan issueen ennen toteutusta.
3. Riittääkö erittelyyn polku ja otsikko ilman kyselyosaa, vai haluatko
   pelkät sivustot?
4. Jaetussa keskustelussa: näkeekö osallistuja Selain-kortin? Ehdotan, että
   näkee yhteenvedon mutta ei erittelyä, koska selain ja sen kirjautumiset
   ovat omistajan.

## Aineisto ja tarkistus

- Lähde: `design-system/prototypes/rounds/2026-11-22-browser-visit-record/`
  (komennot sen `NOTES.md`:ssä). Hylätty kierros
  `design-system/prototypes/rounds/2026-11-22-server-browser-visit-log/`
  poistettiin. Se löytyy Git-historiasta.
- Rakennettu sivu:
  `/var/tmp/agent-keep/server-browser-agent-visit-log/claude-round/build/offline.html`
  (`index.html` ilman fontteja samassa kansiossa).
- Kuvat: `/var/tmp/agent-keep/server-browser-agent-visit-log/claude-round/check/`
  (108 kuvaa). Saman kansion juuressa on hylätyn kierroksen aineisto, eikä sitä
  ole muutettu.
- Pohjarevisio `242e26cc`. `build.mjs` onnistui. Tuotannon CSS-moduleista
  tulee tunnetut `composes`-varoitukset.
- `check.mjs`: **973 tarkistusta läpi**, 36 yhdistelmää (3 suuntaa × fi/en ×
  Päivä/Yö/Kontrasti × 1440/390 px). Konsoli on puhdas, verkkopyyntöjä ei ole
  eikä vaakaylivuotoa.
- Tuotannon labia ei käynnistetty. Kierros piirtää tuotannon komponentit
  (`AgentTurn`, `TurnChanges`, `BrowserChip`, `BrowserStrip`) suoraan
  synteettisellä tilalla, joten ne ovat samat kuin labissa. Prototyyppi ei
  todista oikean agentin komentotuloksia, pysyvyyttä eikä käyttäjäeristystä.

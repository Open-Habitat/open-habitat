---
created: 2026-09-29
updated: 2026-09-30
type: task
status: open
priority: normal
related: ['@build-agent-control', '@plan-v1-implementation']
lane: planning
collision: [docs/]
---

# Rethink project documents with Jari

## Tarkoitus

Käymme Jarin kanssa projektin dokumentteja ja issueita läpi. `/rethink-document`
sopii oikeiden päätösten erottamiseen agentin lisäämistä vaatimuksista.
Toteuttajalle suunnattu issue voi sopia paremmin `/rethink-instructions`-skillille:
se selventää tavoitetta, taustatietoa ja perusteluja sekä poistaa turhan
menettelyohjauksen ja lupaportit. Valinta tehdään tekstin tehtävän perusteella.
Tämä issue on jatkamiskohta: pidetään käsiteltyjen dokumenttien lista ja seuraava
ehdokas ajan tasalla, ei rakenneta erillistä katselmointiprosessia.

## Käsitelty

| Dokumentti | Lopputulos | Commit |
|---|---|---|
| [Agenttiohjauksen issue](../build-agent-control/item.md) | Tulevan toteutuksen käyttäjälle näkyvät lopputulokset, ei päätöshistoriaa. SSE ja päättyneen selainkeskustelun jatkaminen kuuluvat työhön; Pi:n kysymysdialogien vastausohjaus ja terminaaliohjauksen haltuunotto eivät; saapuneet kysymykset näytetään. | `8925a89` |
| [Toteutusbriefit](../plan-v1-implementation/implementation-briefs.md) | Lyhyt toteutuksen omistajuuskartta. Rajapintatiedot omalle sivulleen; vanhat portit ja perusteettomasti sitovat numerot pois. | `b54636a` |
| [ADR 0003: host stack](../../docs/adr-0003-host-stack.md) | Teknologiavalinta, vastuurajat ja perustelut. OAuth/OIDC-kirjaston valinta jää toteuttajalle; protokolla- ja käyttödetaljit muualle. | `4f50e89`, `855223a` |
| [Arkkitehtuuri](../../docs/architecture.md) | Käyttäjän kulku ja kolme auktoriteettia, natiivien tietojen omistajuus ja katkoista palautuminen. Kloonivirran poikkeus erotettu yleisestä tapahtumavirrasta; yksityiskohdat linkitetty omiin dokumentteihinsa. | `e78a084` |
| [Rajapinnat](../../docs/interfaces.md) | Nykyiset reitit erillään sovitusta tulevasta pinnasta; viestien merkitys, katkoista palautuminen ja vastuurajat säilyvät. Palveluasetukset asennusissuen liitteeseen. | `296e4a9`, `1c1e8f8`, `742197c` |
| [Tuotteen tavoite](../../docs/product.md) | Käyttäjän työ ja sovitut toiminnot. Nykytila erotettu tavoitteesta; vanhat MVP-portit, terminaalinsiirto ja testimatriisit poistettu tuotekuvauksesta. | `fae13b8` |
| [Todennettava näyttö](../../docs/assumptions.md) | Alkuperäisten kokeiden havainnot ja rajat sekä GitHub-käytön ja keskusteluun palaamisen puuttuva kokonaisnäyttö. Sovitut ratkaisut ja testien vastuut linkitetty omiin lähteisiinsä. UI-sivun terminaalisiirto korjattu samaan rajaan. | `75d4fa5` |
| [Käyttökulut](../../docs/ui.md) | Käyttäjän kulku ja sovittu keskustelukokemus. Nykytila erotettu tavoitteesta, vanhat dialogiohjaimet ja katselmointiportit poistettu; protokolla- ja komponenttidetaljit linkitetty omiin lähteisiin. | `925bdb1` |
| [ADR 0004: ensikirjautumisen tilinluonti](../../docs/adr-0004-first-login-user-provisioning.md) | Brokerin tilinluonti ja sidonta, gatewayn todennus ja daemonin natiivit tunnukset. Nykyinen keskeytyspolitiikka ilman vanhan palautusvaatimuksen historiaa; toteutusmekanismit ja näyttö linkitetty omiin lähteisiinsä. | `992d27d` |
| [ADR 0001: natiivi Unix-arkkitehtuuri](../../docs/adr-0001-unix-native-agent-host.md) | Natiivien tietojen omistajuus ja Unix-eristys perusteluineen; myöhemmät tilinluonti-, jatkamis- ja selainrajaukset linkitetty. | Tämän läpikäynnin commit (`Refs-Issue` Gitissä). |
| [Päätökset](../../docs/decisions.md) | Hyväksytyt ratkaisut lähteineen sekä käyttäjän poistamisen ja lokituksen avoimet ehdotukset. Toteutustilanne ja protokolladetaljit omiin lähteisiinsä. Jari hyväksyi läpikäynnin. | `80f8107` |
| [Toteutuksen työnjako](../../docs/implementation.md) | Toimintojen yhteinen perusta ja riippuvuudet, työn omistajat sekä todentamisen ja asennuksen vastuut. Jarin lukukierros odottaa. | Tämän läpikäynnin commit (`Refs-Issue` Gitissä). |

Samalla on tehty kohdennettuja korjauksia
CLI-konformanssiin ja liittyviin issueihin. Näitä ei ole vielä kokonaisuudessaan
käyty läpi tällä skillillä.

## Seuraavaksi

Jari hyväksyi 2026-09-30 neljän issuen uusintakierroksen:
`investigate-pi-browser-oauth`, `gate-native-routes-on-pi`, `speed-up-clean-ci`
ja `build-agent-control`. Niille tehtiin `/rethink-instructions` ja
`/fact-check-instructions` sekä Jarin lukukierroksen tarkennukset
(committisarja `8444680`–`8347997`). Pi-kirjautumisen issue kuvaa nyt pakollisen
onboardingin ja paluun OpenAI-vaiheeseen; testien nopeutus kattaa sekä testien
nopeuttamisen että tarpeellisten testien valinnan muutoksen perusteella.
Näiden kuvausten käsittely on valmis. Toteutusissueiden tilaa tai DAGia ei muutettu.

Jari hyväksyi päätössivun läpikäynnin ja valitsi seuraavaksi toteutuksen
työnjaon (`docs/implementation.md`). Se käsiteltiin 2026-09-30; seuraava askel
on Jarin lukukierros. Seuraavaa dokumenttikohdetta ei ole vielä sovittu.

ADR 0002:ssa on edelleen vaatimus jokaisen UI-osan hyväksynnästä ennen
riippuvien töiden jatkamista. Se on ristiriidassa nykyisen AGENTS-WORKFLOW.md:n
kanssa, joka sallii muun työn jatkamisen. Tämä kuuluu odottavaan UI-kokonaisuuteen;
historiallista päätöstä ei muutettu päätössivun toimituksellisessa korjauksessa.

UI- ja design-dokumentit ovat Jarin pyynnöstä odottamassa 2026-09-30:
toinen agentti tekee laajempaa käyttöliittymäkierrosta. Niihin palataan sen
jälkeen; alla säilyy aiemmin sovittu jatkorajaus.

### Odottava UI-kokonaisuus

Odottava kokonaisuus on [tuotantodesign](../../design-system/production-v1.md)
ja [komponenttikatalogi](../../design-system/component-catalog-v1.md) yhdessä.
Niiden läpikäynti jatkuu käyttöliittymäkierroksen jälkeen; muiden dokumenttien
käsittely jatkuu sillä välin.

- Korjaa terminaalin siirtodialogi ja Pi-kysymysten vastausohjaimet vastaamaan
  nykyistä agenttiohjauksen rajausta. Terminaalihistoriat ovat vain luettavia;
  päättynyttä selainkeskustelua voi jatkaa. Saapuvat kysymykset ja muu sisältö
  näytetään vähintään turvallisena tekstinä.
- Erota sovittu käyttökokemus agentin lisäämistä tarkoista mekanismeista ja
  lukurajoista. Selvitä niiden alkuperä päätöksistä ennen muuttamista;
  toteutuksen yksityiskohta ei sellaisenaan ole tuotevaatimus.
- Säilytä ulkoasun, saavutettavuuden ja komponenttien vastuiden perustelut.
  Reitit, fokus, näppäimet ja komponenttisopimukset tarvitsevat edelleen omat
  lähteensä; niitä ei kopioida takaisin UI-sivulle.

Lähteiksi nykyinen [UI-sivu](../../docs/ui.md),
[rajapintasivu](../../docs/interfaces.md), alkuperäinen
[UI-päätös](../review-ui-v1/review.md), ADR 0002 sekä
[agenttiohjauksen](../build-agent-control/item.md) ja
[keskustelun UI:n](../complete-conversation-ui/item.md) nykyiset rajaukset.
Tämä jatkamiskohta päivitettiin Jarin pyynnöstä; tuotantodesignin ja
komponenttikatalogin kokonaisläpikäyntiä ei ole vielä tehty.

## Rajapintasivun läpikäynti 2026-09-29

Jari hyväksyi tässä keskustelussa rajauksen: nykyinen toteutus ja sovittu tuleva
pinta erotetaan, skeemien muodot linkitetään ja palveluasetusten sekä testien
kuvaukset kuuluvat niitä toteuttavaan työhön. Aiempi linjaus toteutuksen
rajojen säätämisestä käytön perusteella säilyy. Otsikoinnin hyväksytyt
valinnat sekä ADR 0005:n erillinen kloonivirta säilyvät.

Lähdekoodi tarkistettiin revisiosta `35dccfc49b3cae505df75a8909aec276ce009580`.
Pi-kirjautumisen käyttöliittymä ja väliaikaiset keskustelureitit olivat olemassa,
vaikka vanha sivu kuvasi ne puuttuviksi tai jätti reitit taulukosta pois.
Gatewayn sisältöä koskeva lause täsmennettiin erottamaan liikenteen välitys
lokeista ja diagnostiikasta. Hyväksyttyjen päätösten välisiä ristiriitoja ei
läpikäynnissä havaittu. Sivu ei muuta protokollaa eikä väitä live-todennusta.

Palveluvaatimukset säilyvät [asennusissuen liitteessä](../prepare-mvp-operations/service-requirements.md).
Testien vastuut ja suunnitelmat ovat ennestään toteutuskartassa ja toteutusissueissa.
Dokumentaatio- ja toteutuskartan tarkistukset sekä `git diff --check` läpäisivät.
`./scripts/ci-local.sh --clean --json` läpäisi revisiolla
`296e4a9` (`status: passed`, `clean: true`). Tämä on paikallisen portin
synteettinen testi- ja pakettinäyttö; live-palvelinta ei muutettu eikä testattu.

Jarin lukukierroksen tarkennukset: yhden kirjoittajan käyttötapa koskee myös
tuotantoa. Kaikki saapuvat viestit, kysymykset ja sisältölohkot esitetään
käyttäjälle vähintään turvallisena tekstinä; pelkkä tuntemattoman lohkon ilmoitus
ei riitä. Kysymysdialogien vastaus- ja perumisohjaus pysyy erillisenä asiana.
Nämä täsmennettiin rajapintasivulle ja agenttiohjauksen sekä keskustelun UI:n
issueihin. Rajapintasivun lukukierros valmistui ennen arkkitehtuurisivun käsittelyä.

Sanamuotocommitin `1c1e8f8` puhdas portti läpäisi uusinnalla toisen testiajon
vapautettua Playwright-portin. Viimeiset dokumentti- ja issuetarkennukset
varmennetaan dokumentaatio- ja toteutuskartan validaattoreilla, issue doctorilla
sekä `git diff --check` -tarkistuksella. Täyttä porttia ei ajeta niille uudelleen:
nykyinen `TESTING.md` rajaa nämä dokumentaatiotarkistuksiin.

## Lyhyt briefi jatkajalle

- Dokumentti palvelee omaa tehtäväänsä: ADR kertoo päätöksen ja syyn, toteutusissue
  tulevan työn. Korjaushistoria kuuluu Gitiin, ei varsinaiseen tekstiin.
- Jari ei halua säilyttää issueiden vanhoja päätösmerkintöjä sanatarkasti tai
  testikuitteja vain säilyttämisen vuoksi. Tämä tarkentaa skillin oletusta.
- Tarkat raja- ja puskuriluvut eivät ole tuotevaatimuksia. Mekanismi tarvitsee
  konkreettisen tarpeen; arvot säätyvät havaintojen mukaan eivätkä estä normaalia käyttöä.
- OAuth/OIDC-kirjaston valinta ei ole Jarin vaatimus. Toimiva ja turvallinen
  kirjautuminen on; tämä ei hyväksy nykyisiä kirjautumisongelmia.
- Riippumattomaan mallikatselmointiin Jari suosii Astraa.

## Arkkitehtuurisivun läpikäynti 2026-09-29

Jari hyväksyi rajauksen: sivu selittää käyttäjän kulun ja vastuiden syyt;
protokollan yksityiskohdat ja julkaisemisen työohjeet linkitetään niiden omiin
dokumentteihin. Hyväksyttyä arkkitehtuuria ei muuteta.

Lähteinä olivat ADR:t 0001, 0003, 0004 ja 0005, rajapintasivu, toteutuskartta
sekä gatewayn ja daemonin reitit lähtörevisiossa `174ffe8`.
Vanhentuneet väitteet kokonaan puuttuvasta ohjauksesta ja työtilakirjoituksista
poistettiin. Broker nostettiin kaavioon ja tekstiin kolmanneksi auktoriteetiksi.
Yleisen SSE:n rinnalle kuvattiin hyväksytyn kloonivirran erilainen katkokäytös.
Muut harnessit ja usean palvelimen selain erotettiin ensimmäisestä toteutuksesta.

Natiivien komponenttien perustelut, Git-integroinnin tavoite, Taskfleetin
worktree-omistajuus, yhden kirjoittajan käyttötapa ja pienten annotaatioiden
rajat säilyvät. Rajapintojen ja operoinnin yksityiskohdat löytyvät jo omista
lähteistään; uusia rinnakkaisia liitteitä ei luotu. Tuotesivun ristiriidat
jätettiin seuraavan läpikäynnin aiheeksi.

`python3 scripts/validate-project-view.py` ja `git diff --check` läpäisivät.
Issue doctorissa ei ollut skeema- tai linkkivirheitä; sen neljä aiempaa
PNG-kuvahavaintoa ovat muissa issueissa. Täyttä porttia ei ajettu uudelleen,
koska muutos koskee vain dokumentaatiota ja issuen tekstiä (`TESTING.md`).
Live-palvelinta ei muutettu eikä testattu.

## Tuotesivun läpikäynti 2026-09-29

Jari hyväksyi rajauksen: sivu kertoo tuotteen tavoitteen ja sovitun
toiminnallisen laajuuden. Hyväksytyt toiminnot säilyvät; protokollan mekanismit
ja testimatriisit korvataan linkeillä niiden nykyisiin lähteisiin. Alder ja
nimettyjen ihmisten pakolliset kokeet poistuvat yleisestä tuotekuvauksesta.

Lähteinä olivat rajapinta- ja arkkitehtuurisivut lähtörevisiossa `e78a084`,
UI-päätös 2026-09-22, Jarin `review-mvp`-issuessa 2026-09-28 tekemä
loppuportin poisto sekä 2026-09-29 täsmennetty agenttiohjauksen rajaus.
Terminaalihistoriat jäävät luettaviksi, päättyneen selainkeskustelun jatkaminen
säilyy tavoitteena ja saapuvat kysymykset näytetään ilman erillisten
dialogiohjainten toteutuslupausta. Kirjautumisen, historian ja selainohjauksen
osittainen toteutus erotetaan sovitusta tavoitteesta.

Y1–Y5- ja M1–M7-taulukoiden yksityiskohtia ei kopioitu uuteen liitteeseen:
rajapinnat, toteutuskartta ja vastuulliset issuet kantavat jo niiden sisällön.
Pilotin ehdotettu kuormituslista ja lopullinen hyväksyntäportti poistettiin
Jarin päätöksen mukaisesti. GitHub, työtilojen elinkaari, Taskfleet-worktreet,
arkistointi, keskustelukokemus ja operointi säilyvät. Navigaation nimi ja kaksi
vanhoihin otsikoihin johtanutta linkkiä päivitettiin.

`python3 scripts/validate-project-view.py` ja `git diff --check` läpäisivät.
Issue doctorissa ei ollut skeema- tai linkkivirheitä; samat neljä muiden
issueiden PNG-kuvahavaintoa säilyvät. Täyttä CI-porttia ei ajettu uudelleen,
koska muutos koskee vain dokumentaatiota (`TESTING.md`). Live-palvelinta ei
muutettu eikä testattu.

## Oletussivun läpikäynti 2026-09-29

Jari hyväksyi rajauksen: sivu kertoo, mikä ratkaisussa tarvitsee vielä näyttöä
ja mitä epäonnistuminen merkitsisi. Pi- ja työtilakokeiden havainnot erotetaan
hyväksytyistä ratkaisuista. Testien yksityiskohdat jäävät niitä omistaviin
toteutusissueihin. Samalla korjataan UI-sivun terminaalisiirron ristiriita.

Lähtörevisio oli `fae13b8`. Lähteinä olivat alkuperäiset Pi- ja työtilakokeet,
ADR 0003, toteutusvalmiuden päätös sekä nykyiset agenttiohjauksen ja
GitHub-työtilojen issuet. Credential-ratkaisu ja daemonin lapsiprosessi ovat
hyväksyttyjä valintoja, eivät avoimia ehdotuksia. Vanha terminaali→RPC-siirron
vaatimus poistettiin; päättyneen selainkeskustelun jatkaminen säilyy. UI-sivun
alkuperäisen ohjattavuusvalinnan kohdalla kerrotaan myöhempi rajaus ja linkitetään
nykyinen toteutusissue.

Kokeiden tarkat versiot ja tulokset jäävät alkuperäisiin raportteihin, joihin
sivu linkittää täsmällisillä revisioilla. Testiluetteloa, protokollan detaljeja,
otsikon syöterajoja ja poiston algoritmia ei kopioitu uuteen liitteeseen:
niiden nykyiset lähteet ovat rajapintasivu, toteutuskartta ja toteutusissuet.
Sivu ei enää aseta omaa toteutusta edeltävää hyväksyntäporttia. GitHub-polun
ja keskusteluun palaamisen keskeneräinen kokonaisnäyttö pysyy näkyvissä.

`python3 scripts/validate-project-view.py`, toteutuskartan validaattori ja
`git diff --check` läpäisivät. Täyttä CI-porttia ei ajettu uudelleen, koska
muutos koskee vain dokumentaatiota (`TESTING.md`). Live-palvelinta ei muutettu
eikä testattu.

## UI-sivun läpikäynti 2026-09-29

Jari pyysi tekemään kokonaisläpikäynnin suoraan. Lähtörevisio oli `75d4fa5`.
Lähteinä olivat UI-päätös 2026-09-22, ADR 0002, nykyiset tuote- ja
rajapintasivut, agenttiohjauksen ja keskustelun UI:n issuet sekä Jarin
2026-09-28 poistama lopullinen MVP-portti. Sovelluksen App-, HistoryView-,
BrowserConversation- ja onboarding-lähteet tukevat eroa osittaisen toteutuksen
ja sovitun kokonaisuuden välillä.

Sivu kuvaa nyt kirjautumisen, navigoinnin, keskustelun, jonotuksen, otsikoinnin,
luonnosten ja lukukohdan säilymisen sekä katkosten ja osatulosten käytöksen.
Kysymykset ja tuntematon sisältö näytetään; erillisiä vastausdialogeja ei luvata.
React/TypeScript on valittu eikä historiaa tai ohjausta väitetä kokonaan
puuttuviksi. Odottava visuaalinen palaute ei ole riippumattoman työn portti.
Alkuperäiset päätöspöytäkirjat säilyvät lähteinä.

Reittitaulukko, komponenttilista, tilamatriisit ja tarkat saavutettavuusluvut
poistuivat tältä sivulta niiden omiin lähteisiin osoittavien linkkien tieltä.
Uutta liitettä tai tuotevaatimusta ei lisätty. Navigaation nimi ja poistuneisiin
otsikoihin johtaneet linkit korjattiin; alkuperäisiin suosituksiin viittaava
katselmointilinkki sidottiin sen valmistelurevisioon.
Tuotantodesignin ja komponenttikatalogin vanhat ohjaimet kirjattiin seuraavan
läpikäynnin kohteeksi.

`python3 scripts/validate-project-view.py`, toteutuskartan validaattori ja
`git diff --check` läpäisivät. Täyttä CI-porttia ei ajettu uudelleen:
muutokset koskevat vain dokumentaatiota ja linkkejä (`TESTING.md`).
Live-palvelinta ei muutettu eikä testattu.

## Rajapintasivun uusintatarkistus 2026-09-30

Jari hyväksyi rajatun faktapäivityksen. Revisioon `b0bac9e` verraten
nykyisten reittien taulukkoon lisättiin `steer`, `follow_up` ja `clear_queue`.
Snapshot- ja Pi-statusreittien virheellinen daemon-vastaus erotettiin
snapshotin identiteettiristiriidasta: ensimmäinen palauttaa 502:n,
jälkimmäinen 403:n. Historian ja sisällön lukureittien nykyinen 503-käytös
kerrotaan erikseen. Sovittua toiminnallista laajuutta ei muutettu.

Lähteinä olivat gatewayn ja daemonin keskustelureitit, gatewayn lukureitit
sekä selaimen istunnon tarkistus. UI- tai design-tiedostoja ei muutettu.

## ADR 0004:n läpikäynti 2026-09-30

Jari hyväksyi ehdotetun rajauksen ja tarkensi, ettei vanhan palautuspäätöksen
historiaa säilytetä dokumentissa. ADR kertoo nykyisen tilinluonnin vastuunjaon,
sen perustelut ja epäselvän keskeytyksen pääsyn estävän käytöksen.
Turvallinen vaiheiden uudelleentoisto on ehdollinen mahdollisuus, ei
palautumislupaus tai erillinen ylläpitäjän palautusprojekti.

Lähtörevisio oli `177006d`. Lähteinä olivat alkuperäinen tilinluontipäätös,
keskeytyneen provisioinnin issuen Jarin päätös 27.9., ADR:t 0003 ja 0006,
rajapintasivu ja brokerin toteutusissuet. Vanhan testikoneen tilanne,
nimetyt testitilit ja käyttöönottokokeiden luettelo poistettiin ADR:stä.
Protokollan, lukituksen, journalin ja testinäytön yksityiskohdat jäävät
olemassa oleviin lähteisiin; uutta liitettä ei luotu.

Dokumentaatiovalidaattori ja `git diff --check` läpäisivät. Issue doctorissa
ei ollut skeema- tai linkkivirheitä; muiden issueiden PNG-kuvahavainnot
säilyvät. Täyttä CI-porttia ei ajettu uudelleen, koska muutos koskee vain
dokumentaatiota. Live-palvelinta ei muutettu eikä testattu.
## Pi-selainkirjautumisen tutkimusissuen läpikäynti 2026-09-30

Jari hyväksyi rajauksen: ensin selvitetään palveluntarjoajan tuki ja Pi:n
integrointitapa. Kokonaista kirjautumisprotokollaa ei tarvitse suunnitella ennen
toteuttamiskelpoisuuden selviämistä. Pi omistaa edelleen tunnukset käyttäjän
Unix-tilillä. Gatewayn kautta välitettävä koodi on ehdotus, ei vaatimus.
Lopputulokseksi riittää perusteltu suositus toteutuksesta, rajatusta oikeasta
kokeesta tai laitekoodilla jatkamisesta. Oikeasta kokeesta kerrotaan etukäteen.

Issue ja `analysis.md` kirjoitettiin tämän mukaisiksi. Muistio säilyttää
Pi 0.85.1:n lähdehavainnot, kokeiden rajat ja avoimet kysymykset; spekulatiivinen
protokollasuunnitelma poistettiin. Toteuttamiskelpoisuutta ei selvitetty uudelleen
eikä issuea suljettu. Dokumentaatiovalidaattori, issue doctor (vain muiden
issueiden olemassa olevat kuvamuotohavainnot) ja `git diff --check` läpäisivät.
Täyttä CI-porttia ei ajettu dokumenttimuutokselle.
## Toteutusissueiden ohjeiden läpikäynti 2026-09-30

Jari korjasi skillivalinnan: myös issue voi olla agenttiohje, jolloin
`rethink-instructions` sopii paremmin kuin päätösten alkuperään keskittyvä
`rethink-document`. Ohje kirjattiin molempiin Fleetrepon omistamiin skilleihin.
Yleinen “this issue does not authorize” -lause poistettiin Pi-tutkimuksesta.
Oikeasta provider-kokeesta etukäteen kertominen säilyy Jarin nimenomaisena
toiveena, perusteltuna henkilön tilin ja kokeen jättämän tilan kautta.

Pi-portin issue kuvaa nyt repo-valinnan hyväksytyn poikkeuksen ja olemassa olevan
toteutuksen. CI-nopeutus alkaa jo tehdyistä muutoksista ja mittauksista;
jäljellä olevan työn arvo ratkaisee lisäoptimoinnin. Agenttiohjauksessa säilyvät
sovitut käyttötulokset, yhden kirjoittajan käyttötapa, SSE, jatkaminen ja
Unix-eristys. Toistuvat testikäskyt korvattiin TESTING.md-viitteellä ja vanhat
tulosraportit tunnistetaan tiettyjen revisioiden näytöksi.

Muutokset ovat ohjetekstiä, eivät uusi toteutus tai hyväksyntänäyttö.
Dokumentaatiovalidaattori ja `git diff --check` läpäisivät; issue doctorissa
oli vain muiden issueiden kuvamuotohavaintoja. Täyttä CI-porttia ei ajettu.

## Neljän issuen faktantarkistus 2026-09-30

`/fact-check-instructions` tarkisti revisiosta `8444680` samat neljä issuea.
Agenttiohjauksen tavoitteet erotettiin nykytilasta: selain kyselee nyt tilaa
HTTP:llä; SSE ja päättyneen selainkeskustelun jatkaminen puuttuvat edelleen.
Lähteet ovat `web/src/app/BrowserConversation.tsx`, daemonin ja gatewayn
`conversation_linux.go` sekä `docs/interfaces.md`. Pi-portin tunnusrajaus
korjattiin koskemaan Pi-tunnuksia: gateway välittää erillisessä GitHub-virrassa
väliaikaisen tunnuksen daemonille (`internal/AGENTS.md`).

OAuth-issuen localhost-havainto vastaa tämän koneen asennettua Pi 0.85.1:tä
(`pi-ai/dist/auth/oauth/openai-codex.js`); hostin helper on myös sidottu siihen
versioon ja valitsee device-code-menetelmän. Pi-portin reittien kytkentä,
istunto-omistajuus ja generoitu sopimus löytyvät nykykoodista. CI-issuen
välimuistit ja yhdistetty selainajo vastaavat `scripts/ci-local.sh`:ta;
`web/playwright.config.ts` pitää jaetun skenaariotilan vuoksi yhden workerin.
Ajat ja negatiivisten testien tulokset vastaavat kirjattuja historiallisia
raportteja. Kahteen jälkimmäiseen havaintokokonaisuuteen ei tarvittu uusia
vaatimuksia tai päätöksiä.

Tarkistus oli lähde- ja dokumenttitarkistus. Providerin hyväksymiä callbackeja,
nykyistä live-asennusta tai vanhojen suoritusraporttien tuloksia ei todennettu
uusilla ajoilla. Toteutusta, testipalvelinta tai issueiden tilaa ei muutettu.

## ADR 0001:n läpikäynti 2026-09-30

Jari hyväksyi rajauksen: natiivien komponenttien ja Unix-käyttäjien perustelut
säilyvät, usean palvelimen arkkitehtuurinen mahdollisuus erotetaan ensimmäisen
selainversion laajuudesta ja keskustelujen jatkaminen täsmennetään nykyiseen
rajaukseen. Ratkaistut avoimet kysymykset korvataan viitteillä ADR:iin 0003 ja
0004. HTTP/SSE-periaate säilyy, yksityiskohdat kuuluvat rajapintasivulle.

Lähtörevisio oli `2837e2c`. Lähteinä olivat alkuperäinen ADR revisiossa
`e3bd133`, sen kirjaamisissue, UI-päätöksen rajaus, ADR:t 0003–0005 sekä
nykyinen agenttiohjauksen issue. ADR linkittää myöhemmät päätökset eikä muuta
niiden sisältöä. Toisto ja vanhan vaihtoehtoisen alustamallin kuvaus poistettiin;
uutta liitettä ei tarvittu. UI- ja design-dokumentteihin ei koskettu.

Dokumentaatiovalidaattori ja `git diff --check` läpäisivät. Täyttä CI-porttia
ei ajettu uudelleen, koska muutos koskee vain dokumentaatiota. Live-palvelinta
ei muutettu eikä testattu.

## Päätössivun läpikäynti 2026-09-30

Lähtörevisio oli `dfaf362`. Rajaus oli sovittu edellisessä keskustelussa:
päätösten kartta, ei toteutuksen tilanne tai työjärjestys. Lähteinä olivat
ADR:t 0001–0007, alkuperäiset UI- ja toteutuspaketin hyväksynnät sekä
kloonivirran, istuntojen mitätöinnin ja käyttäjän poistamisen issuet.
Lokitussivu on yhä ehdotus. Päätösten tilaa ei muutettu.

Frontendin ja hostin vanhat ehdotusmerkinnät korjattiin myös navigaatiossa.
Protokolla- ja CLI-yksityiskohdat ovat jo omissa lähteissään, joten niitä ei
siirretty uuteen liitteeseen. Vanhoja pilotin tilatietoja ei otettu päätössivun
vastuulle. ADR 0002:n vanha UI-hyväksyntäportti jäi odottavaan läpikäyntiin.

Dokumentaatiovalidaattori ja `git diff --check` läpäisivät. Täyttä CI-porttia
ei ajettu dokumenttimuutokselle. Dokumentaatiota ei julkaistu eikä
live-palvelinta muutettu.

## Toteutuksen työnjaon läpikäynti 2026-09-30

Jari hyväksyi tehtäväksi selittää osien rakentumisen toistensa varaan sekä
erottaa pysyvät riippuvuudet DAGin työjärjestyksestä. Lähtörevisio oli
`80f8107`. Lähteinä olivat nykyinen toteutuskartta, alkuperäinen vaiheistus
(historialliseksi merkitty), tuotesivu, agenttiohjauksen ja keskustelu-UI:n
issuet, TESTING.md sekä MVP-loppuportin poisto ja nykyinen työskentelyohje.

Vanha loppuportti oli jo poistettu sivulta aiemmassa korjauksessa. Nyt teksti
selittää kirjautumisen, historian, ohjauksen ja muiden toimintojen yhteydet.
SSE ja jatkaminen kuvataan tavoitteina; kysymysten näyttäminen erotetaan
vastausdialogien rajauksesta. Testien valinta viittaa TESTING.md:hen,
puskurien yksityiskohdat säilyvät rajapintasivulla ja toteutuskartassa.
GitHub Actionsin käytöstäpoiston historiatieto poistettiin lukijan sivulta.
Julkaisun ja Fleetrepon vastuuraja säilyi. Navigaatio ja etusivun linkkikuvaus
vastaavat nyt työnjakosivun tehtävää.

Dokumentaatiovalidaattori ja `git diff --check` läpäisivät. Täyttä CI-porttia
ei ajettu dokumenttimuutokselle. Toteutusta tai päätettyä toiminnallista
laajuutta ei muutettu; dokumentaatiota ei julkaistu.

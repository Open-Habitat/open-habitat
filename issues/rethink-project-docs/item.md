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

Käymme Jarin kanssa projektin dokumentteja läpi `/rethink-document`-skillillä,
jotta toteuttaja erottaa oikeat päätökset agentin lisäämistä vaatimuksista.
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

Samalla on tehty kohdennettuja korjauksia toteutussivuun,
CLI-konformanssiin ja liittyviin issueihin. Näitä ei ole vielä kokonaisuudessaan
käyty läpi tällä skillillä.

## Seuraavaksi

Jari pyysi välissä neljän issuen läpikäynnin tässä järjestyksessä:

1. `investigate-pi-browser-oauth` — käsitelty: issue ja `analysis.md` rajattu
   tuetun kirjautumistavan selvittämiseen. Jari hyväksyi rajauksen 30.9.
2. [gate-native-routes-on-pi](../gate-native-routes-on-pi/item.md) — seuraavaksi.
3. [speed-up-clean-ci](../speed-up-clean-ci/item.md).
4. [build-agent-control](../build-agent-control/item.md) — uusintaläpikäynti.

Näiden jälkeen palataan [ADR 0001:een](../../docs/adr-0001-unix-native-agent-host.md).
Säilytetään natiivien komponenttien, Unix-käyttäjien ja tietojen omistajuuden
perustelut. Tarkistetaan myöhempien päätösten suhde usean palvelimen selaimeen,
keskustelujen jatkamiseen ja tekstin edelleen avoimiksi kuvaamiin valintoihin.

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

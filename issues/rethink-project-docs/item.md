---
created: 2026-09-29
updated: 2026-10-03
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
| [Toteutuksen työnjako](../../docs/implementation.md) | Toimintojen yhteinen perusta ja riippuvuudet, työn omistajat sekä todentamisen ja asennuksen vastuut. Jari siirtyi seuraavaan dokumenttiin. | `ab4f8ea` |
| [Etusivu](../../docs/index.md) | Lukupolku tavoitteesta arkkitehtuuriin ja toteutukseen; sivukuvaukset ajan tasalle ja vanha julkaisueste pois. | Tämän läpikäynnin commit (`Refs-Issue` Gitissä). |

Samalla on tehty kohdennettuja korjauksia
CLI-konformanssiin ja liittyviin issueihin. Näitä ei ole vielä kokonaisuudessaan
käyty läpi tällä skillillä.

### Yön 30.9. rethink-läpikäynti ilman Jaria

Nämä 19 issuea käytiin läpi consult-llm:n avulla ilman Jaria; kaikki yksiköt valmistuivat, eikä yhtään ohitettu tai jäänyt epäonnistuneeksi. `manage-agent-worktrees`-issuessa havaittu ristiriita Jarin aiempaan päätökseen jätettiin ratkaisematta ja kirjattiin issueen.

| Dokumentti | Lopputulos | Commit |
|---|---|---|
| [add-conversation-recap](../add-conversation-recap/item.md) | suunnittelutehtävä selkeytetty ja faktantarkistettu, päätösmerkintä kirjattu. | `5555acf` |
| [archive-agent-conversations](../archive-agent-conversations/item.md) | toteutusissue selkeytetty ja faktat tarkistettu; epävarma pysäytys ja puuttuva annotaatiototeutus täsmennetty. | `b32551a` |
| [connect-github-workspaces](../connect-github-workspaces/item.md) | toteutusohje selkeytetty ja faktat tarkistettu; päätösmerkintä tallennettu. | `731adb1` |
| [deliver-login-pilot](../deliver-login-pilot/item.md) | issue selkeytetty ja faktantarkistettu, Jarin päätökset säilytetty. | `0f24a4a` |
| [expose-native-status](../expose-native-status/item.md) | ohje selkeytetty ja vanhentunut MVP-raja korjattu; faktat tarkistettu. | `0dc77a2` |
| [extend-editor-tools](../extend-editor-tools/item.md) | suunnitteluisuetta selkeytetty ja vanhentuneet väitteet korjattu. | `e4541dd` |
| [extend-process-ui](../extend-process-ui/item.md) | tehtäväteksti selkeytetty, faktantarkistettu ja päätös kirjattu. | `200f6a9` |
| [extend-tool-views](../extend-tool-views/item.md) | tehtävä selkeytetty käyttöhavaintoon nojaavaksi suunnittelutyöksi, teematieto ajantasaistettu. | `579a497` |
| [manage-agent-worktrees](../manage-agent-worktrees/item.md) | ohje selkeytetty, faktat tarkistettu ja päätösristiriita kirjattu. | `1ad3882` |
| [manage-workspace-lifecycle](../manage-workspace-lifecycle/item.md) | ohje selkeytetty, faktat tarkistettu ja päätösmerkintä kirjattu. | `26b133b` |
| [native-agent-host-architecture](../native-agent-host-architecture/item.md) | arkkitehtuurieepos selkeytetty ja faktat tarkistettu. | `0de9982` |
| [plan-second-user-admission](../plan-second-user-admission/item.md) | testiasennuksen hyväksymisraja ja avoin broker-valinta selkiytetty; Jarin päätös säilytetty. | `f59c73e` |
| [prepare-interactive-demo](../prepare-interactive-demo/item.md) | harjoituksen tila ja vanhentuneiden kuvien rajaus selkeytetty, Jarin päätös säilytetty. | `e655539` |
| [prepare-mvp-operations](../prepare-mvp-operations/item.md) | toteutusissue selkeytetty ja faktantarkistettu; hyväksymis- ja palautumisrajat säilytetty. | `20546ef` |
| [prove-clean-server-install](../prove-clean-server-install/item.md) | ohje selkeytetty, faktat tarkistettu ja päätös kirjattu. | `c3a9049` |
| [refine-agent-status](../refine-agent-status/item.md) | selkeä nykyteksti säilytettiin; rethink- ja faktantarkistus kirjattiin päätösmerkintään. | `fe81b5f` |
| [rename-omega-habitat](../rename-omega-habitat/item.md) | issue selkeytetty ja asennetun tilan nimeämisriskit tarkistettu. | `a291033` |
| [verify-live-pi-journey](../verify-live-pi-journey/item.md) | hyväksyntäkirja selkeytetty ja vanhentunut reset-ohje rajattu pois. | `639ad01` |
| [verify-v1-resilience](../verify-v1-resilience/item.md) | ohje tiivistetty, lähteet tarkistettu ja päätös kirjattu. | `00d4539` |

## Arkkitehtuurikatselmus ja kahdeksan toteutusissuea: tekstikierros 1.10.2026

Jari valitsi seuraavaksi [arkkitehtuurikatselmuksen](../../docs/reviews/architecture-review-2026-10.md)
ja sen kahdeksan toteutusissuetta. Ne käytiin läpi `rethink-instructions`-skillillä
toteuttajille suunnattuina ohjeina lähtörevisiosta `ed6162d`:

| Dokumentti | Tekstin muutos |
|---|---|
| Katselmus, osat 1–3 | Kaikki 59 rivitunnistetta ja verdiktien luokat säilyvät. Historiallinen näyttö erotettu tulevasta kohdemuodosta; osa 3 kertoo työnjaon ja linkittää toteutusissueihin. |
| [gateway-authorize-once](../gateway-authorize-once/item.md) | Päätös 1 säilyy; näyttö koskee brokerikutsujen poistumista, istunnon päättymistä ja käyttäjien reititystä. |
| [gateway-single-proxy](../gateway-single-proxy/item.md) | Välityksen tavoite säilyy; aikarajat ja kokorajat sovitettu pitkään tapahtumavirtaan. |
| [daemon-validate-startup](../daemon-validate-startup/item.md) | Käynnistystarkistukset erotettu gatewayn UID:n tarkistuksesta ja onboardingin tunnustiedostoista. |
| [daemon-drop-status-stream](../daemon-drop-status-stream/item.md) | Tilapäivitysten kattavuus ja halpa status kuvattu lopputuloksina; tiedoston metadata ei todista historian luettavuutta. |
| [drop-conversation-lease](../drop-conversation-lease/item.md) | Päätös 2 säilyy; gatewayn uudelleenkäynnistys erotettu daemonin tai Pi-lapsen päättymisestä. |
| [browser-state-rewrite](../browser-state-rewrite/item.md) | Kohdemuodon kappale säilyy sellaisenaan. Rivimääräraja ja Jarin pakollinen loppukuittaus poistettu; latauksen yhtenäisyys, epävarman lähetyksen ratkaiseminen ja identiteetin vaihto kuvattu havaittavana toimintana. |
| [split-large-files](../split-large-files/item.md) | Jako vastuiden mukaan, ei 700 rivin kattoa. Arkkitehtuuri- ja agenttiohjeiden päivitys säilyy työn osana. |
| [pi-onboarding-poll](../pi-onboarding-poll/item.md) | Hitaampi kysely ilman istunnon esilukua; kahden sekunnin väli on toteutuksen lähtöarvo. |

Lähteinä olivat katselmuksen pohjarevisio, sen nykyteksti, lähdeissuen Jarin
päätös, toteutusissuet, `internal/AGENTS.md`, `AGENTS-WORKFLOW.md`, `TESTING.md`
sekä gatewayn kirjautumis- ja daemonin peer-tarkistuksen lähdekoodi.
Katselmuksen 60 sekunnin proxyraja oli ristiriidassa pitkän tapahtumavirran
kanssa. Käyttäjän vaihtumisen kuvausta täsmennettiin: vanha välilehti voi näyttää
ladattua sisältöä uuden identiteetin saapumiseen asti; peitteen poistaminen ei
tee vaihdosta välitöntä. Mittauksiksi nimettyjä vanhoja tuloksia ei ajettu uudelleen.

Tämä on tekstien läpikäynti. Toteutusissueiden tilat ja DAG säilyvät ennallaan;
Jarin kaksi päätöstä ja askelten 1–8 sarjajärjestys säilyvät. Dokumentaation
validaattori ja `git diff --check` läpäisivät. Issue doctor raportoi vain
muiden issueiden 225 kuvamuotohavaintoa. Täyttä CI-porttia ei ajettu
dokumenttimuutokselle, eikä toteutusta tai testipalvelinta muutettu.

## Aiemmin sovittu kokonaisuus: tilit, onboarding ja uusi selain-design

Jari pyysi 2026-09-30 seuraavan läpikäyntikokonaisuuden: neljä nimettyä
issuea, uuden design-agentin draftin vastaanotto ja jalkauttaminen sekä
käyttöliittymän dokumentit. Aiempi UI-dokumenttien odotus korvautuu tällä
kokonaisuudella. Tämä on tekstien ja päätösten läpikäyntijärjestys;
toteutuksen tilat ja riippuvuudet pysyvät issuectl:n DAGissa.

**Ensin uusi paketti tutuksi, sitten toiminnalliset rajat, niiden jälkeen
yleiset UI-dokumentit ja lopuksi toteutuksen työnjako.** Näin dokumentteja ei
ensin viimeistellä vanhaa designia varten eikä luonnoksen ehdotuksia tulkita
huomaamatta hyväksytyiksi vaatimuksiksi. Tilien turvallisuusnäyttö ja poistamisen
rajat käsitellään ennen tiliasetuksia, jotta eri toiminnot eivät sekoitu.

1. **[review-browser-design-v2](../review-browser-design-v2/item.md): design vertailukohdaksi.**
   Tutustu [handoffiin](../../design-system/design.md) ja neljään
   vedokseen. Tavoitteena on arvioida, miten nykyinen UI-koodi, komponentit ja
   yhteiset asettelu- ja tyyliratkaisut pystyvät tuottamaan tämän lopputuloksen
   tarkasti. Pelkkä designin lukeminen ja päätösten vertailu on lähtötietoa;
   varsinainen arvio tarvitsee nykykoodin ja renderöityjen näkymien vertailun.
   Toiminnalliset rajat täsmentyvät seuraavissa kohdissa, ja toteutuspolku
   kootaan kohdassa 8.
2. **[prove-jit-guest-isolation](../prove-jit-guest-isolation/item.md).**
   Erota jo saatu ensikirjautumisen ja kahden Unix-käyttäjän näyttö jäljellä
   olevasta työstä. Lue tulosraportit sekä Jarin myöhemmät rajaukset, etenkin
   uudelleenkäynnistyskokeen yksinkertaistaminen. Näin vanhat testivaatimukset
   eivät määritä seuraavien issueiden tilannekuvaa.
3. **[deprovision-bound-user](../deprovision-bound-user/item.md) ja sen [ADR 0007](../../docs/adr-0007-bound-user-deprovision.md).**
   Selvitä, mikä tarve on jäljellä testipalvelimen uudelleenrakennuksen jälkeen,
   mikä on hyväksytty tavoite ja mikä vasta ehdotettu poistamisarkkitehtuuri.
   Erota Unix-tilin poistaminen, selainuloskirjautuminen ja natiivien tunnusten
   irrottaminen. Historialliset pilot.11-väitteet tarkistetaan nykyisiä tuloksia
   vasten; yleistä poistotoimintoa ei päätellä testitilin kertaluonteisesta tarpeesta.
4. **[github-repos-first-onboarding](../github-repos-first-onboarding/item.md) sekä [design-first-use-onboarding](../design-first-use-onboarding/item.md) ja sen suunnitelma.**
   Käy ensin läpi repovalinnan nykyinen toiminta ja Jarin päätökset, sitten
   sovita vanhempi onboarding-kokonaisuus niihin. GitHub → repot → OpenAI,
   palaava käyttäjä ja epäselvän kloonauksen käsittely verrataan uuden draftin
   ehdotuksiin. Aiemmin läpikäydyt Pi-kirjautumisen ja Pi-portin issuet toimivat
   lähteinä; niitä avataan uudelleen vain esiin tulevien ristiriitojen osalta.
5. **[add-account-settings-ui](../add-account-settings-ui/item.md).**
   Erota jo toteutettu tilinäkymä jäljellä olevasta työstä. Käytä
   [decide-account-display](../decide-account-display/item.md)-päätöstä ja uuden
   draftin tilivalikkoa/asetuksia lähteinä. Täsmennä nimen ja sähköpostin lähde,
   GitHub- ja OpenAI-yhteyksien esitys sekä uloskirjautumisen ja irrotuksen rajat
   edellisten kohtien perusteella.
6. **Yleinen UI-kuvaus ja selainratkaisun päätös:**
   [docs/ui.md](../../docs/ui.md) ja
   [ADR 0002](../../docs/adr-0002-frontend-stack.md).
   Sovita käyttökulut edellä selvitettyihin päätöksiin ja draftin ratkaistuihin
   ehdotuksiin. ADR 0002:n vanha vaatimus jokaisen UI-osan hyväksynnästä ennen
   riippuvien töiden jatkamista on ristiriidassa nykyisen työskentelyohjeen kanssa;
   käsittele se päätöshistorian säilyttävällä tavalla. Rajapintasivusta tarkistetaan
   vain tämän kokonaisuuden koskettamat kohdat, ei aloiteta koko sivua uudelleen.
7. **Tuotantodesign ja komponenttisopimukset yhdessä:**
   [design.md](../../design-system/design.md),
   [components.md](../../design-system/components.md) ja
   [docs/design-system.md](../../docs/design-system.md).
   Erota sovittu ilme ja vuorovaikutus agentin lisäämistä mekanismeista ja
   lukurajoista. Säilytä saavutettavuus, fokus, näppäimet, reitit ja komponenttien
   vastuut. Korjaa vanha terminaalisiirto ja Pi-kysymysten vastausohjaimet nykyiseen
   rajaukseen: terminaalihistoria on luettava, päättynyttä selainkeskustelua voi
   jatkaa ja saapuva sisältö näytetään vähintään turvallisena tekstinä.
   Tokenit, tyylit ja nykyiset tuotantokomponentit ovat vertailuaineistoa.
8. **[review-browser-design-v2](../review-browser-design-v2/item.md): komponenttipohjan arvio ja toteutuspolku.**
   Arvioi konkreettisten näkymien ja koodin avulla, kuinka toimiva nykyinen
   käyttöliittymä on ja kuinka kaukana se on designista. Riittääkö komponenttien
   tarkentaminen ja kokoaminen, vai tarvitaanko yhteisiä korjauksia asetteluun,
   tyyleihin tai komponenttien vastuunjakoon? Tavoite on viivatarkka sijoittelu
   ja johdonmukainen ilme, jota on helppo tarkentaa yhteisten ratkaisujen kautta.
   Suosittele perusteltu polku yhteisistä parannuksista komponentteihin ja
   valmiisiin näkymiin sekä tapa todeta vastaavuus designiin. Komponenttikartta
   tukee tätä arviota. Sovita työ olemassa oleviin issueihin; merkittävät
   arkkitehtuurivalinnat käsitellään Jarin kanssa.
9. **Jalkauttavat toteutusissuet:**
   [complete-conversation-ui](../complete-conversation-ui/item.md) sekä
   v2-katselmoinnissa täsmentyvät tai syntyvät toteutusissuet.
   Sovita niiden tavoitteet ja työnjako komponenttikarttaan; onboardingin ja
   tiliasetusten jo käsiteltyjä issueita täydennetään tarvittaessa.
   Tarkista yhteys nykyiseen agenttiohjaukseen ja ehkäise päällekkäinen työ.
   Uusien toteutusissueiden linkit lisätään tähän, kun ne ovat olemassa.

### Design-review-issuen uudelleenkirjoitus valmis 30.9.2026

Jari hyväksyi [review-browser-design-v2-issuen](../review-browser-design-v2/item.md)
uudistetun tavoitteen ja merkitsi tämän tekstin läpikäynnin valmiiksi.
Hyväksytty versio on commitissa `82a5c4e`: design toimii nykyisen UI:n,
komponenttipohjan sekä asettelu- ja tyyliratkaisujen vertailukohtana.
Review tuottaa arvion puutteista, yhteisistä parannuksista ja toteutuspolusta
viivatarkkaan, helposti tarkennettavaan lopputulokseen. Varsinainen arvio
ja toteutussuunnitelma ovat edelleen tekemättä; review-issue pysyy avoimena.

### Ensimmäinen lukukierros tehty 30.9.2026

Designiin on tutustuttu: [selain-designin ensiluku](../review-browser-design-v2/first-read.md)
kokoaa neljän vedoksen sisällön, päätöslähteet, ristiriidat ja suositukset.
Omega Habitat ja etunimi/sähköposti ovat jo sovittuja; avatar, mobiilin
toteutuslaajuus, OpenAI-asetukset ja repohaun kuukausisuodin vaativat vielä
sovituksen. Epävarman kloonauksen piilottaminen ja aina loppuun vierittäminen
poikkeavat nykyisistä päätöksistä. Puhelin-onboarding on toimituksessa,
vaikka handoff sanoo sen puuttuvan.

Jari täsmensi reviewn tavoitteen: design on vertailukohta nykyisen
komponenttipohjan ja visuaalisen toteutustavan toimivuudelle. Ensiluku ei vielä
vastaa tähän. Arvio pohjan valmiudesta, yhteisistä parannustarpeista ja polusta
viivatarkkaan lopputulokseen on tekemättä.

**Kohta 2: prove-jit-guest-isolation — ensimmäinen uudistettu versio valmis.**
[Issue](../prove-jit-guest-isolation/item.md) kuvaa nyt jäljellä olevat
havainnot, ja [tulosyhteenveto](../prove-jit-guest-isolation/result.md)
erottaa jo saadun näytön niistä. Erillinen palautusmenettely poistui
vaatimuksista Jarin myöhemmän päätöksen perusteella. Fleetrepon 29.9.
uudelleenkäynnistyskoe oli ilman käyttäjäsidontoja, joten kahden sidotun
käyttäjän käynnistyksenjälkeinen eristys jää todennettavaksi. Todellisen
broker-kaatumisen jälkeisen pääsyneston näyttö erotetaan palautustoiminnosta.

Jari pyysi tästä ensimmäisen version; uutta hyväksyntää tai testitulosta ei
kirjattu. Kohdat 3 ja 4 on käsitelty alla kuvatulla tavalla. Seuraava lukukohde on
kohta 5: `add-account-settings-ui`. Designin sovitus jatkuu kohdissa 5–8;
nykyinen komponenttiarvio on `review-browser-design-v2/assessment.md`:ssä.

### Kohta 3: käyttäjän poistaminen käsitelty 30.9.2026

Jari vahvisti, että nyt tarvitaan toimiva testiympäristö, johon koko
järjestelmän nollaus riittää. Yksittäisen testitilin poistamisen toteutusissue
suljettiin korvautuneena. Käyttäjän ”poista minut” -toiminto ja ylläpitäjän
CLI-komento yksittäisen käyttäjän poistamiseen jäävät myöhemmiksi tarpeiksi;
niitä ei aikataulutettu eikä niiden arkkitehtuuria hyväksytty.

ADR 0007 kuvaa nyt tämän rajauksen ja nykyisen brokerin teknisen ongelman.
Vanha pilot.11-migraatioeste ja yksityiskohtainen poistomekanismi eivät ohjaa
nykyistä työtä. Päätössivu ja navigaatio päivitettiin vastaamaan rajausta.
Lähteinä olivat tuotekoodi revisiossa `0d9621c`, Fleetrepon reset- ja
uudelleenrakennusissueiden päätökset ja tulokset revisiossa `231bde93` sekä
Jarin tämän keskustelun täsmennys. Live-ympäristöä ei muutettu.

Dokumentaatiovalidaattori ja `git diff --check` läpäisivät. Issue doctorissa
oli vain muiden issueiden olemassa olevia kuvamuotohavaintoja. Täyttä
CI-porttia ei ajettu dokumenttimuutokselle.

### Kohta 4: repovalinta ja onboarding käsitelty 30.9.2026

`github-repos-first-onboarding`, `design-first-use-onboarding` ja sen suunnitelma
kirjoitettiin uudelleen nykyisen toteutuksen ja hyväksytyn GitHub → repot →
OpenAI -kulun pohjalta. Pi-adapteri, reitit, pääsyraja, valinta ja kloonaustuloksen
tarkistus ovat olemassa; vanhat ehdotukset niiden rakentamisesta poistettiin.
Toteutusissueiden tavoitteet erottavat jäljellä olevan työn historiallisesta
näytöstä. Rajapintadetaljit linkitetään nykyisiin sopimuksiin, tiliasetukset
niiden omaan issueen. Jarin pyynnöstä molempien issueiden päätös- ja
kommenttihistoria poistettiin. Voimassa olevat rajaukset ja testilupa säilyvät
leipätekstissä; aiemmat merkinnät löytyvät Gitistä.

Vertailukohta on uusi Selainpolku v2. Jari vahvisti, että designerin kanssa on
jo sovittu kaikkien repojen näkyvän oletuksena ja aikarajauksen olevan käyttäjän
valinta. Jarin pyynnöstä design-review-issueen ja sen arvioihin tehdyt
muutokset palautettiin; rajaus säilyy onboarding-teksteissä.
Toimitetun handoffin ja HTML:n kuukausisuodatin oletuksena ei vastaa sopimusta;
alkuperäinen toimitus säilyy vertailuaineistona. Epävarma kloonaustulos pysyy
näkyvissä, jos myöskään natiivin tilan tarkistus ei ratkaise sitä.

Lähdekoodi tarkistettiin revisioista `b4c74bb` ja `770f46a`; jälkimmäinen sisälsi
myös samanaikaisen design-arvion tekstipäivityksen. Arvioon myöhemmin tullut
`4f04de6` säilytettiin. Design-review-hakemisto jäi palautuksen jälkeen
täsmälleen sen commitoituun tilaan. Lähteinä olivat Jarin aiemmat
onboarding-päätökset, nykyinen selainvirta ja sopimukset, toteutusten tulokset
sekä tämän keskustelun v2-täsmennys. Live-kokeita ei tehty eikä toteutusissueita
suljettu tällä tekstien läpikäynnillä.

Dokumentaatiovalidaattori ja `git diff --check` läpäisivät. Issue doctorissa
oli vain muiden issueiden aiempia PNG-kuvamuotohavaintoja. Täyttä CI-porttia
ei ajettu dokumenttimuutokselle.

Seuraavaksi kohta 5: `add-account-settings-ui`.

### Aineiston ja skillin valinta

Uusi v2-toimitus on jo repossa. Erillisiä juuri tätä toimitusta jalkauttavia
v2-toteutusissueita ei löytynyt 2026-09-30 haussa; `review-browser-design-v2`
omistaa niiden valmistelun. `complete-conversation-ui`, onboarding ja
tiliasetukset ovat olemassa olevia sovitettavia töitä, eivät vielä valmis
v2-toteutussuunnitelma. Suljettu
[assemble-browser-redesign-handoff](../assemble-browser-redesign-handoff/item.md)
on designerille lähetetty lähtöpaketti. Suljetut `receive-designer-v1`,
`design-production-ui`, `build-design-system` ja `integrate-designer-rail`
ovat vanhan designin ja toteutuksen lähteitä, eivät uuden toimituksen työjono.

Toteuttajalle suunnattu issue tai handoff käydään läpi `/rethink-instructions`-
skillillä ja sen ajantasaisuus tarkistetaan lähteistä. Päätös- ja design-tekstiin
sopii `/rethink-document`. Lähteinä säilyvät alkuperäinen UI-päätös,
nykyiset rajapinnat, agenttiohjauksen rajaus ja issueiden tulokset. Tämän
kirjauksen yhteydessä kohteita ei vielä kirjoitettu uudelleen eikä draftia
hyväksytty tai toteutettu.

Tilannesivu (`docs/status.md`) jää myöhemmäksi ehdokkaaksi tämän Jarin valitseman
kokonaisuuden jälkeen. Se kuvaa yhä 24.9. tilaa, mukaan lukien vanhan
Glasspad-esteen ja lopullisen MVP-katselmoinnin. Muut dokumentit jatkuvat tämän
kokonaisuuden jälkeen Jarin kanssa valittavassa järjestyksessä.

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

## Etusivun läpikäynti 2026-09-30

Jari hyväksyi etusivun lukupolkujen ja vanhentuneen julkaisuesteen korjauksen.
Lähtörevisio oli `ab4f8ea`. Nykyiset tuote-, päätös- ja työnjakosivut sekä
navigaatio määräävät kuvaukset. Tavoite erotetaan valmiista toteutuksesta;
tilannesivuun viitataan päivättynä kuvauksena, koska se kuvaa yhä 24.9. tilaa.
Vanha julkaisueste poistettiin docs/AGENTS.md:n tiedon perusteella. Etusivu ei
lupaa terminaalikeskustelujen selainohjausta. Julkaisun ylläpitotieto säilyy
AGENTS.md:ssä, jonka viittaus nyt korjattuun etusivuun päivitettiin samalla.

Dokumentaatiovalidaattori ja `git diff --check` läpäisivät. Täyttä CI-porttia
ei ajettu dokumenttimuutokselle. Glasspad-julkaisua ei tehty eikä kokeiltu;
tuotteen toimintaa tai päätöksiä ei muutettu.

### Architecture-built-on-caution: tekstin läpikäynti 1.10.2026

Jarin pyynnöstä käsiteltiin [architecture-built-on-caution](../architecture-built-on-caution/item.md)
rethink-instructions-taidolla, koska teksti ohjaa tulevaa katselmointityötä.
Jarin kritiikki säilytettiin sanasta sanaan. Pi-portin poistopäätös erotettiin
muista tutkittavista mekanismeista; koko tuotteen laajuinen tarkastelu säilyy.
ADR 0006 säilyttää brokerin pyyntökohtaiset tarkistukset, joten erillinen
istunnon peruutus ei todista niitä tarpeettomiksi. Unix-eristyksen rinnalla
selvennettiin gatewayn todennusvastuu ja daemonin luottamusraja.

Automaattinen poistaminen tuntemattoman perustelun vuoksi, pakollinen
rivi riviltä hyväksyttäminen ja tarkka raporttimuoto korvattiin arvioinnin
tavoitteella ja projektin tavallisella vastuunjaolla. Arkkitehtuurimuutokset
pysyvät Jarin kanssa päätettävinä. Lähteinä olivat issuen alkuperäinen versio
`ce206ac`, pilot.14-bugi-issuen Jarin päätös sekä nykyinen lähdekoodi ja
arkkitehtuuriohjeet. Varsinaista katselmusta tai suorituskykymittauksia ei
tehty eikä uutta arkkitehtuuripäätöstä kirjattu. Tämä on tekstin ensimmäinen
uudistettu versio, ei Jarin hyväksymä katselmointitulos.

## Decisions

### 2026-10-02T03:17:43Z · @codex

Keskustelunvaihdon kokonaisuus käsitelty Jarin kanssa 2.10.2026. Jari hyväksyi rajatun selainmuistin, yhden tapahtumayhteyden välilehteä kohti ja uusimmasta päästä luettavan historian. ADR 0008 sekä design-snappy-conversation-switching ja kolme toteutusissuetta kirjoitettiin tämän mukaan. Viisi keskustelua, 50 merkintää, 4 MiB ja 16 ms erotettiin agentin mitoitusehdotuksiksi. Toteutusdetaljit kuuluvat toteutusissueihin, alkuperäiset mittaukset säilyvät taustana. Jari kyseenalaisti kohdennetun istuntoperuutuksen käyttötarpeen ja hyväksyi reliable-session-revocation-issuen sulkemisen wontfix-tilaan; olemassa oleva toteutus ja hyväksyttyjen tapahtumayhteyksien käytös säilyvät. Päätössivu ja ADR 0006:n jatkoissueviite sovitettiin päätökseen. Tuotekoodia, palvelinta tai toteutusissueiden aikataulua ei muutettu.

## Comments

### 2026-10-02T05:00:05Z · @codex

Jarin jatkopalaute 2.10.2026 sovitettu ADR 0008:aan, suunnitteluissuen nykykuvaukseen ja tulokseen sekä toteutusissueihin: väljät muutettavat muistirajat, merkittävästi nopeampi vaihto, komentojen hyväksymistä koskeva toisto pois. Uloskirjautumisen yhteyksien ja selainmuistin siivous siirretty omaan @browser-logout-cleanup-issueen. Historialliset päätösmerkinnät ja mittausten alkuperäiset luvut säilyvät.

### 2026-10-02T05:10:37Z · @codex

Jarin pyynnöstä 2.10.2026 poistettu keskustelunvaihdon alkuperäisen mallipaneelin yhteenveto ja raakavastaukset sekä niiden viittaukset ADR:stä, issueista ja mittausmuistiosta. Toteutuksen lähteenä säilyy yhdessä tarkennettu ADR ja toteutusissuet; paneelia ei säilytetä agenttien luettavana tausta-aineistona.

### 2026-10-02T06:01:26Z · @codex

docs/conversation-data-flow.md kirjoitettu Jarin hyväksymällä rakenteella uudelleen: tiedon kulku, vastuut ja käyttötilanteet. Tiivis rajapintakuvaus korvaa pitkät TypeScript-tyypit. Sovitut noin 50 keskustelun säilytys, 1024 tapahtuman / noin 16 MiB:n toistoikkuna sekä yhtenäisen historian sovitus säilyvät. Toteutusjärjestys ja testit jäävät issueihin. ADR 0009 kirjaa design-conversation-data-flow-issuen myöhemmän tilanhallintapäätöksen ja korvaa ADR 0002:n Redux-yksinomaisuuden keskusteludatalle. Toistoikkunan vanheneminen erotettu lähdeissuessakin ring_truncated-ilmoituksesta. Tuotekoodia tai DAGia ei muutettu.

### 2026-10-02T09:38:01Z · @codex

Jarin valitsema läpikäyntijärjestys 2.10.2026: named-server-admin-settings, consistent-control-feedback, account-profile-from-github, raw-thinking-history-blocks, latest-control-obscured. Ensimmäisen issuen teksti uudistettu hyväksytyn roolirajauksen mukaan: selainylläpitäjä hallitsee yhteisiä asetuksia ja rooleja, henkilökohtainen sisältö säilyy käyttäjien omana. Palvelin voi toimia ilman ylläpitäjäkäyttäjää; erillinen etuoikeutettu ylläpito-CLI voi nimetä sellaisen myöhemmin. Näin testiasennus ei tarvitse pakollista admin-onboardingia. Valtuutuksen arkkitehtuuri jää ratkaistavaksi. Seuraava käsiteltävä issue on consistent-control-feedback. Tämä on tekstin ja päätöksen päivitys, ei toteutus tai DAG-muutos.

### 2026-10-02T10:05:17Z · @codex

consistent-control-feedback käsitelty Jarin täsmennyksen mukaan: oireiden korjauslistasta koodiin perustuvaksi juurisyyn selvitykseksi ja yhteisen UI-ratkaisun suositukseksi. Nykyinen React Aria -pohja, valmiiden UI-kirjastojen hyödyntäminen ja niiden suunnitteluperiaatteet ovat arvioitavia vaihtoehtoja, eivät ennalta valittu ratkaisu. Agenttitilojen käytettävyys erotettu olemassa olevaan refine-agent-status-issueen: tilojen merkitys ja sama tunnistettava visuaalinen kieli eri näkymissä. Pelkkää pisteiden kolmijakoa ei kirjattu hyväksytyksi malliksi. Toteutusta tai DAGin ajoitusta ei muutettu. Seuraava käsiteltävä issue on account-profile-from-github.

### 2026-10-02T10:07:59Z · @codex

account-profile-from-github käsitelty ja Jari hyväksyi rajauksen: tilin tunnistettavuus, GitHub-profiilitiedon kulku ja yhteinen tiliesitys. Aiempi etunimi/sähköposti-päätös ja onboarding-varamenettely säilyvät; profiilikuva tukee tunnistamista. Seuraava käsiteltävä issue on raw-thinking-history-blocks, sen jälkeen latest-control-obscured. Muutos koskee tehtävätekstiä ja päätöksen tallentamista.

### 2026-10-02T10:11:24Z · @codex

raw-thinking-history-blocks käsitelty Jarin kanssa. Salatun JSONin oireesta laajennettu keskustelulohkojen yhteisen tulkinnan ja löydettävän lohkokirjaston tehtäväksi: merkitys, käsittelijä ja samaan tuotantokomponenttiin perustuva visuaalinen katalogiesimerkki. Käyttäjälle tarkoitettu sisältö säilyy, teknisiä payloadeja ei näytetä viesteinä eikä salatun thinkingin pois jättämisestä tarvita varoitusta. Tuntemattoman sisällön esitys on hillitty ja historia/live noudattavat samaa periaatetta. docs/interfaces.md:n vanha kaiken tuntemattoman sisällön näyttövaatimus sovitettu päätökseen ja design-system-sivulle lisätty tavoiteviite nykykatalogin rinnalle. Seuraava käsiteltävä issue on latest-control-obscured. Tuotekoodia ei muutettu.

### 2026-10-02T10:13:24Z · @codex

Jari täsmensi lohkokirjaston työtavan: designer suunnittelee jokaisen lohkon. Kirjattu raw-thinking-history-blocks-issueen, design-system-sivulle ja AGENTS-WORKFLOW.md:n UI-työhön. Agentti toimittaa lohkojen kartoituksen ja esimerkit suunnitteluaineistoksi, toteuttaa designerin suunnitelmat ja ylläpitää niiden katalogiesityksiä.

### 2026-10-03T05:40:49Z · @codex

latest-control-obscured käsitelty Jarin kanssa 3.10.2026 rethink-instructions-skillillä. Hyväksytty tavoite on näkyvä ja käytettävä hyppypainike myös kirjoituskentän kasvaessa sekä yhtenäinen keskustelualueen asettelu. Työ yhdistyy composer-footer-layout-issuen yhteisten säiliöiden selvitykseen; eri tyhjien välien yhteistä juurisyytä tai tiettyä CSS-korjausta ei oleteta. Näin 2.10. valittu viiden issuen tekstikierros on käsitelty. Seuraavaa dokumenttia ei ole tässä kierroksessa valittu. Tuotekoodia, issueiden tilaa tai DAGin ajoitusta ei muutettu.

### 2026-10-03T05:44:00Z · @codex

add-account-settings-ui tutkittu ja päivitetty 3.10.2026 Jarin pyynnöstä, lähderevisio 94b6b57. Tilivalikko, asetukset, teema ja selainuloskirjautuminen erotettu jo toteutetuksi. Profiilitiedot kuuluvat account-profile-from-github-issueen, v2-ulkoasu restore-v2-settings-issueen ja selaimen siivous browser-logout-cleanup-issueen. Asetuksista puuttuu edelleen designin OpenAI-yhteysrivi; olemassa oleva Pi-tilasopimus ei todista tilin identiteettiä tai toimivaa provider-pyyntöä. Vanha estetty irrotuspainike ja erilliset testi-/julkaisuportit poistettu tehtävävaatimuksista. Historiallinen tulos säilyy oman revisionsa näyttönä. Tuotekoodia, tilaa tai DAGia ei muutettu. Aiemman kokonaisuuden seuraava kohta on docs/ui.md ja ADR 0002, etenkin myöhempien päätösten sovitus.

### 2026-10-03T05:52:02Z · @codex

Jarin tekstipalaute 3.10.2026 sovitettu add-account-settings-ui-issueen: nykytila proosaksi tutkitun commitin kera; vanhentuneiden tulosten viitteet, läpikäynnin testiselostus, aiempien porttien historia, yleiset laatumuistutukset ja lupakieli pois. Jäljelle jäävät nykyinen toiminta, puuttuva OpenAI-yhteyden esitys ja työnjako profiili- sekä design-issueiden kanssa. Uloskirjautumisella on jo valmis browser-logout-cleanup-issue.

### 2026-10-03T06:07:55Z · @codex

Jari pyysi 3.10.2026 yhden nykyisen designin: versionimet ja päällekkäiset määrittelyt pois HEAD:sta. design-system/design.md kuvaa designin, drafts/ sisältää yhden vedossarjan ja components.md johtaa tuotantokomponentteihin. Vanha vedossarja, staattinen keskustelumock ja vanhentuneet tuotantodesignin/propsien rinnakkaismäärittelyt poistettu; ne löytyvät Git-historiasta. Nykyiset ohjeet, avoimien issueiden design-viitteet ja designer-paketin kokoaja käyttävät samaa lähdettä. Historiallisten raporttien tiedostolinkit sidottu niiden kuvaamiin vanhoihin lähteisiin Gitissä. Puhelinrajaus sekä lukukohdan, repohaun ja sisältölohkojen myöhemmät päätökset sovitettu yhteiseen kuvaukseen. Issueiden tunnisteet ja DAG säilyvät.

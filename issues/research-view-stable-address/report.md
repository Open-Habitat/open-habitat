# Näkymän pysyvä osoite: kustannus ja merkitys

**Yhteenveto.** Pysyvä avausosoite ei ole kohtuuttoman suuri muutos: arvio on noin **viisi rajattua toteutus- ja varmennustyötä** arkkitehtuuripäätöksen jälkeen. Daemonin tiedostopalvelu, Unix-eristys, root-broker ja nykyiset näkymäoriginit voidaan säilyttää. Työ painottuu gatewayn pysyvään osoitetietueeseen, sen elinkaareen ja selaimen avausreittiin. Suosittelen silti nyt vaihtoehtoa 1: yksityinen välilehti käyttää omaa osoitettaan ja julkinen välilehti samaa osoitetta kuin *Kopioi linkki*. Syy ei ole ”liian iso arkkitehtuurimuutos”, vaan vaihtoehdon 2 väistämätön merkitys: **jokainen yksityisenä nähty osoite muuttuu avaimeksi julkaistaessa, jos osoite todella pysyy samana**. Kierrättäminen estää tämän, mutta silloin osoite ei pysy samana. Jos pysyvyys on tätä ominaisuutta tärkeämpi, vaihtoehto 2 on järkevästi rakennettavissa; sitä ei tarvitse torjua teknisesti mahdottomana.

## Rajaus ja lähteiden lukutapa

Tutkimuksen koodipohja on `f3e121a238c4ca66a015f86a362d0f5f31fde2c2` (1.11.2026). **Fakta** tarkoittaa alla koodista tai nimetystä päätöshistoriasta luettua. **Ehdotus/arvio** tarkoittaa tämän tutkimuksen johtopäätöstä, ei hyväksyttyä arkkitehtuuria. Koodiviitteiden rivit tarkoittavat tätä versiota. Tuotekoodia tai rinnakkaista r3-prototyyppiä ei muutettu. Testejä tai uutta selainkoetta ei ajettu; selaintoimintaa koskeva näyttö on olemassa olevasta toteutuksesta ja sen raportoiduista kokeista, ei tämän työn mittauksesta.

Historia tarkistettiin komennolla `git log --all -- 'issues/*view*'` ja `scripts/from-history.sh`-lukemisilla:

- `issues/html-view-owner-first/item.md`: 25.10. omistajan avaama jäädytetty näkymä, erillinen origin, ei julkista jakamista. Toteutus `2cf3db91`.
- `issues/view-own-tab-subresources/result.md`: `d56dd148` muutti oman välilehden app-sivun kehykseksi; `d475627c` irrotti kehyksen latauksen otsikon hausta. Raportti erottaa Jarin havaitseman evästeongelman ja automaattisessa selaimessa saavuttamatta jääneen toiston.
- `issues/decide-view-link-sharing/item.md`: Jari hyväksyi 29.10. anonyymin linkin mutta hylkäsi sisältöä haittaavan pakollisen huijaussuojakehyksen ja erillisen julkisen verkkotunnuksen. ADR 0033 ja toteutus `c38c9a58`, tarkennukset `81bb024d`.
- `issues/view-link-sharing/item.md` ja `result.md`: linkki on omistajan erikseen julkaisema; linkin sisältö voidaan vaihtaa osoitetta muuttamatta. API sallii useita linkkejä samaan näkymään, kortti käyttää uusinta. Jarin 30.10. tarkennuksen mukaan jaetun linkin pitää avautua internetissä kenelle tahansa sen saaneelle, ei vain ingressin kirjautumisen läpäisseelle.
- `issues/proto-view-offer-card-r2/result.md` (`ae3337c7`) esitti vaihtoehdot; `issues/research-view-stable-address/item.md` (`f3e121a2`) säilytti vaihtoehdon 1 toistaiseksi ja tilasi tämän selvityksen. Nämä eivät valtuuta toteuttamaan vaihtoehtoa 2.

Historiapolut yllä ovat gitistä luettavia lähteitä, eivät lupaus niiden säilymisestä työpuussa. ADR:t 0032 ja 0033 sekä `internal/AGENTS.md` kertovat hyväksytyt rajat. `docs/product.md` on tavoite, `docs/operations.md` asennuskonteksti; kumpikaan ei korvaa alla olevia koodihavaintoja.

## 1. Miten osoitteet toimivat tänään

### Omistajan välilehti

**Fakta.** Kortin *Avaa omalle välilehdelle* avaa aina `https://<app>/view?id=<view_id>`: `web/src/app/ViewHost.tsx:237–245`, `web/src/app/views.ts:71–75`. Se ei vielä vaihda julkiseen linkkiin; vaihtoehto 1 on prototyypin jatkotyö, ei tämän koodiversion toiminta.

`ViewOpenPage` hakee app-istunnon ja minttaa sen CSRF-tunnisteella näkymän handoffin (`web/src/app/ViewOpenPage.tsx:20–55`, `web/src/app/views.ts:48–68`). Gateway johtaa omistajan identiteetistä ja näkymätunnisteesta SHA-256-pohjaisen hostin ilman pysyvää host→näkymärekisteriä (`internal/gateway/views_linux.go:122–129`). Handoff on 60 sekunnin kertakäyttöinen satunnaissalaisuus; lunastus sitoo sen tähän hostiin ja app-istuntoon. Host-only `__Host-oh-view`-eväste on Secure, HttpOnly, SameSite=None. Näkymäistunto päättyy viimeistään 12 tunnissa tai app-istunnon päättyessä (`views_linux.go:40–50,172–212,331–416`).

App-sivu jää ylimmäksi dokumentiksi ja näyttää `sandbox="allow-scripts"`-kehyksen (`web/src/components/ViewPanel.tsx:16–33`). Tämä säilyttää oman paneelin toimivan evästeasetelman myös välilehdessä; yksityistä näkymää ei pidä ratkaista vain ohjaamalla selainta suoraan sandboxatun sisältödokumentin osoitteeseen. **Näytön raja:** aiempi raportti ei saanut Jarin aliresurssivirhettä toistumaan automaattisessa selaimessa, joten kattavaa kaikkien selainten evästetakuuta ei ole.

### Julkinen linkki

**Fakta.** Osoite on `https://<linkin host>/<token>/`. Host johdetaan linkin ID:stä, ei näkymän ID:stä eikä salaisuudesta (`internal/gateway/view_links_linux.go:117–139`). Tokenissa on 256 satunnaisbittiä (`internal/gateway/auth.go:353–360`, `view_links_linux.go:469–476`). Gateway tallentaa omistajareitin, näkymän ID:n, otsikon, tokenin ja ajat yksityiseen `view-links.json`-tiedostoon. Kirjoitus käyttää 0600-välitiedostoa, fsyncia ja renamea; luettavaksi kelpaamaton tila sulkee linkit (`view_links_linux.go:64–72,144–263`).

Vain app-istunto CSRF-tarkistuksineen luo tai muuttaa linkin. Gateway varmistaa viennin olemassaolon omistajan daemonilta ja tarkistaa istunnon uudelleen ennen tallennusta (`view_links_linux.go:353–525`). Luonti sallii 1–operaattorin enimmäismäärän päiviä; käyttöliittymän oletus on `min(30, maxDays)` (`view_links_linux.go:407–418`; `web/src/app/viewLinks.ts:261–263`).

Linkkihostin GET/HEAD ei käytä app- tai näkymäevästettä. Jokainen sisältöpyyntö tarvitsee polun tokenin, vakioaikaisen vertailun, voimassaolon, operaattorin sallinnan ja omistajan deny-tarkistuksen (`views_linux.go:293–310`; `view_links_linux.go:699–734`). Root ohjaa viennin aloitustiedostoon saman token-etuliitteen alla; suhteelliset resurssiosoitteet säilyttävät tokenin (`views_linux.go:456–528`). *Uusi osoite* vaihtaa tokenin, ei hostia; *Vaihda sisältö* vaihtaa näkymän, ei linkin osoitetta. Peruminen poistaa tietueen (`view_links_linux.go:527–617`).

**Fakta.** Voimassaolon päättyminen ei nykyisin jätä pysyvää osoitevarausta: käynnistys ja muutokset pudottavat vanhentuneet linkit (`view_links_linux.go:177–186,204–215`). Julkisia samanaikaisia lukuja ja päivän tavuja rajataan linkittäin ja koko palvelimelle; laskurit ovat muistissa (`view_links_linux.go:50–58,737–774`).

### Sisältö ja eristys

**Fakta.** Näkymän ID ei ole jakamisen salaisuus: daemon luo sen ja palauttaa sen agentille tarjouksessa sekä listauksessa (`internal/daemon/views_linux.go:151–158,653–667,793–794`). Vienti on käyttäjän kotona oleva tiedostokopio ja manifesti, ei julkaisupäätös (`views_linux.go:328–376`). Gateway välittää vain rakenteensa itse muodostaman `/view-export/<id>/<path>`-pyynnön varmennettuun daemon-socketiin, ilman selaimen evästeiden tai identiteettiväitteiden välittämistä (`internal/gateway/views_linux.go:456–495`). Daemon tarkistaa luotetun kutsujan ja avaa vain viennin tavallisia tiedostoja ilman symlinkkien seuraamista (`internal/daemon/views_linux.go:557–616`).

Kaikki näkymähostin vastaukset, virheet mukaan lukien, saavat sandbox-CSP:n: skriptit sallitaan, mutta same-origin-oikeudet, fetch, workerit, sisäkehykset ja lomakkeet eivät. Resurssilähteet rajataan täsmälleen kyseiseen hostiin; referrer on pois ja välimuistille annetaan `no-store` (`internal/gateway/views_linux.go:243–258`; `internal/gateway/server.go:134–153`). Linkki ei ole lupaus muuttumattomista biteistä omaa UID:tä vastaan: agentti voi muuttaa kotinsa vientiä. Tämä hyväksyttiin ADR 0033:ssa; sama tiedostopalvelu avaa tiedoston uudelleen jokaisella pyynnöllä.

## 2. Mitä vaihtoehto 2 muuttaisi

### Ensin on erotettava kaksi lupausta

**Päätelmä.** ”Sama osoite avaa näkymän” voi tarkoittaa pysyvää **sisääntulo-osoitetta**, vaikka selain ohjataan julkisena toiseen osoitteeseen. Se on halvempi kuin lupaus, että myös **osoiterivillä pysyy sama URL**. Nykyinen `/view?id=`-sivu ja erillinen sisältöhosti näyttävät jo, ettei osoiterivin ja sisältöoriginin tarvitse olla sama asia.

**Ehdotettu pienin malli, jos vaihtoehto 2 valitaan:** gateway varaa selaimen pyynnöstä satunnaisen `https://<app>/n/<osoitesalaisuus>`-osoitteen. Yksityisenä sen avaaminen vaatii juuri tietueen omistajan app-istunnon ja käyttää nykyistä handoffia sekä kehystä. Julkisena gateway tarkistaa julkaisutietueen ja ohjaa nykyiselle evästeettömälle linkkihostille. Tämä säilyttää julkisen sisällön nykyisen top-level-käytöksen, jonka Jari hyväksyi 29.10. Redirect on gatewayn omista tiedoista muodostettu, ei selaimen antama kohde.

Tässä mallissa kortista avattu ja kopioitu **sisääntulo-osoite** on sama ennen ja jälkeen julkaisun, mutta julkisen dokumentin osoiterivi vaihtuu. Jos osoiterivinkin on pysyttävä samana, julkinenkin sisältö on kehystettävä `/n/…`-sivuun tai rakennettava uusi erillisen hostin avausjärjestely. Ensimmäinen muuttaisi Jarin hyväksymää julkisen sivun navigointikäytöstä; jälkimmäinen laajentaisi tunnistautumistyötä. Kumpaakaan ei pidä ujuttaa ”pelkkänä URL-muutoksena”.

### Muutokset komponenteittain (ehdotus, ei nykytila)

| Osa | Tarvittava muutos ja rajaus |
|---|---|
| Gatewayn pysyvä tila | Nykyistä linkkitietuetta laajennetaan osoitevaraukseksi: omistaja, osoitteen salaisuus, yksityinen/julkinen tila, julkisen jakson päättymisaika ja kohdevienti. Yksityinen tietue säilyy myös vanhentumisen jälkeen. Sama tila omistaa reitityksen ja julkaisupäätöksen; ei erillistä sisältö- tai työtilarekisteriä. Nykyinen vanhentuneiden pudotus ei riitä. |
| Varauksen luonti | Tietue syntyy vasta selaimen tarpeeseen, esimerkiksi ensimmäisessä oman välilehden avauksessa, app-istunnon kirjoituksena. Agentin tarjoaminen ei tarvitse gateway-kutsua eikä kaikkia vientitiedostoja tarvitse indeksoida etukäteen. Rinnakkaisten avausten on palautettava sama varaus omistaja+näkymä-parille. |
| Avausreitti | Uusi `/n/…` tunnistaa varauksen, mutta URL ei valitse Unix-käyttäjää. Yksityisenä tarkistetaan istunnon omistaja; toiselle käyttäjälle ei näytetä vientiä eikä tietoja omistajasta. Julkisena palautetaan vain julkaistun vientilinkin kohde. Kirjautumisen paluu rajataan saman appin hyväksyttyyn reittiin. |
| Julkaisuelinkaari | Julkaisu ja yksityiseksi palautus muuttavat varauksen tilaa atomisesti; peruminen ei enää poista pysyvää varausta. Vanhentuminen päättää vain anonyymin pääsyn. Uusi julkaisu on uusi nimenomainen teko, ei automaattinen jatko. Tietueiden kokorajat erotetaan aktiivisten julkaisujen rajoista. |
| Näkymäorigin ja julkinen token | Nykyiset omistajan per-view-hostit ja julkiset per-link-hostit voidaan säilyttää. Linkkihostissa ei tarvita omistajan tunnistautumista eikä uutta evästettä. `/n/…` on julkisena toinen bearer-osoite; myös sen salaisuus on suojattava. |
| Daemon ja agentti | Ei uutta reittiä eikä oikeutta. Sama vienti ja export-read. Agentti saa edelleen vain näkymän ID:n, ei varausta tai julkista osoitetta. Viennin poistuttua osoite ei saa alkaa näyttää muuta sisältöä. |
| Broker ja asennus | Ei uusia root-oikeuksia, UID-kartoituksia, socketteja tai DNS/varmennevaatimuksia tällä app-sisääntulomallilla. Nykyinen view-namespace ja `link_max_days` riittävät. Ingressin on edelleen päästettävä anonyymi julkinen lukija läpi; myös uusi sisääntuloreitti on tarkistettava. |
| Selain ja sopimus | Varauksen osoite ja julkisuustila tulevat gatewayn vastauksesta. Muuttuvat avausreitti, `ViewOpenPage`, `ViewHost`, kortti, linkkiasetukset ja `contracts/v1/view-link.schema.json` sekä generoidut tyypit. Julkaisun epävarma vastaus luetaan uudelleen, ei toisteta kirjoitusta automaattisesti; käyttäjän vaihdon epoch-suoja säilyy (`web/src/app/viewLinks.ts:51–75,87–110`). |
| Ylläpito | Ylläpitäjän luettelo pysyy julkaistujen linkkien metatietona ilman salaisuutta. Ylläpitäjän peruminen ja henkilön pääsyn peruminen sulkevat sekä vanhan sisältölinkin että uuden sisääntulon. Yksityisten varausten lisääminen ylläpitoluetteloon ei ole tarpeen. |

**Tärkeä ristiriita nykytoiminnan kanssa.** Nykyinen linkki on siirrettävissä näkymästä toiseen (`view_links_linux.go:527–591`), ja monta linkkiä voi osoittaa samaan näkymään (`createViewLink`, rivit 444–509). ”Yksi pysyvä osoite per näkymä” ei yksin määrittele, mitä *Vaihda sisältö* tekee: onko osoite näkymän vai julkaisun pysyvä osoite? Ehdotan, ettei kanonista näkymäosoitetta siirretä toiseen vientiin. Vanha siirrettävä jakolinkki voidaan erottaa omaksi käsitteekseen vain, jos ominaisuus edelleen halutaan; tämä on päätettävä ennen sopimuksen muutosta, ei jätettävä toteuttajan arvaukseksi.

### Onko uusi rekisteri pakollinen?

**Päätelmä.** R2:n vaihtoehdot ”kaikkien näkymien rekisteri tai view ID avaimeksi” eivät ole tyhjentävät. Pysyviä osoitevarauksia voi luoda laiskasti. Myös gatewayn salakirjoittama, reititystiedot sisältävä osoitelippu voisi välttää yksityisten varausten indeksin. Se toisi kuitenkin pitkäikäisen avaimen, lipun versionhallinnan ja avainkierron; julkisen tilan ja perumisen kirjanpitoa tarvitaan silti. Nykyinen suojattu linkkitiedosto (`view_links_linux.go:144–263`) on pienemmän muutoksen pohja. Uutta kryptografista lippujärjestelmää ei kannata rakentaa vain sen välttämiseksi.

## 3. Turvallisuusseuraukset ja vastaukset

| Seuraus | Vastaus ja jäljelle jäävä merkitys |
|---|---|
| Yksityisenä nähty URL muuttuu avaimeksi | Tämä seuraa vaihtoehdon määritelmästä, ei toteutusvirheestä. Historiasynkronointi, kuvakaappaus, chatti tai unfurlerin tallenne voi säilyttää URL:n. Niiden haltija saa lukea julkaistaessa. Satunnaisuus estää arvaamisen, ei jo tunnetun osoitteen käyttöä. |
| Uudelleenjulkaisu herättää vanhat kopiot | Tiukasti pysyvässä mallissa tämäkin on ominaisuus. Peruminen ja expiry katkaisevat nykyisen julkisen jakson, eivät tee osoitteesta uutta. Käyttöliittymä ei saa luvata vanhojen osoitteiden pysyvää kuolemaa. |
| ”Kierrätetään julkaistaessa” | Uusi osoitesalaisuus ja julkinen token estävät vanhojen kopioiden käytön vain, jos vanha osoite **ei anonyymisti ohjaa uuteen**. Vanha sisääntulo voi jäädä omistajan kirjautumisen taakse. Tällöin malli vastaa olennaiselta turvaominaisuudeltaan vaihtoehtoa 1, ei aidosti pysyvää osoitetta. Pelkän sisäisen sisältötokenin vaihto ei auta, jos sama julkinen `/n/…` paljastaa aina uuden. |
| App-originille tulee uusi bearer-reitti | Agentin HTML:ää ei koskaan palauteta siellä: vain tuotteen oma avauskehys tai kiinteästä gateway-tietueesta tehty redirect. Tuntematon/yksityinen/vanhentunut osoite ei paljasta otsikkoa tai omistajaa anonyymille. Ei automaattista julkaisemista GET-pyynnöstä. App-cookie ei siirry sisältöhostille. Nykyiset host- ja kehysrajat: `server.go:134–183`. |
| Salaisuus päätyy uusiin loki- ja välimuistipintoihin | Uusi app-polku vaatii tokenin poissulkemisen diagnostiikasta, ingressilokeista ja analytiikasta sekä `no-store`, `no-referrer`, `noindex` myös redirecteihin ja virheisiin. Nykyiset app-pyynnöt kulkevat diagnostiikkamiddlewareen (`server.go:129–134`), joten linkkihostin nykyinen lokikäytäntö ei yksin riitä todisteeksi. Tokenia ei laiteta DNS-nimeen (`view_links_linux.go:117–127`). |
| Toinen kirjautunut ihminen avaa yksityisen URL:n | Omistajavertailu ennen handoffia; selaimen antama owner/view-pari ei ole auktoriteetti. Julkisena myös toinen kirjautunut ihminen on vain julkinen lukija ja käyttää julkisia budjetteja. Nykyisen mallin `sameOwner` ja istunnon jälkitarkistus ovat uudelleenkäytettävissä (`view_links_linux.go:347–349,514–525`). |
| Peruminen kilpailee jo alkaneen lukemisen kanssa | Jokainen uusi sisältöpyyntö tarkistaa tilan. Jo lähetettyä sisältöä tai hyväksyttyä käynnissä olevaa vastausta ei vedetä takaisin. Näin toimii nykyinen tarkistus ennen relayta (`view_links_linux.go:713–734`). Sisääntulon tarkistus ei saa korvata sisältöpyynnön tarkistusta. |
| Pysyvät yksityiset varaukset kasvavat | Nykyiset 50/4096 rajat koskevat eläviä linkkejä, eivät kaikkia koskaan avattuja näkymiä (`view_links_linux.go:50–51,444–458`). Tarvitaan erillinen rajattu varausmäärä, selkeä poistotoiminto ja puuttuvan viennin käsittely; ei automaattista näkymätiedostojen siivousta tai kaikkien kotien skannausta. |
| Agentti saa julkaisuvallan vahingossa | Osoitesalaisuus ei johdu view ID:stä eikä sijaitse kotihakemistossa. Vain app-istunnon kirjoitus julkaisee. Gateway ei luota agentin ilmoittamaan julkisuuteen. Omaa UID:tä vastaan viennin sisältö ei silti muutu suojatuksi: jo hyväksytty ADR 0033:n raja säilyy. |

**Oikaisu R2:n perusteluun:** vahingossa julkaiseminen ei ole absoluuttisesti ”haitatonta” vaihtoehdossa 1:kään. Se luo todellisen anonyymin lukuoikeuden. Sen etu on rajatumpi ja täsmällinen: ennen luontia nähty yksityinen osoite ei avaa sisältöä, koska julkinen salaisuus luodaan vasta julkaisussa (`view_links_linux.go:469–476`). Myös R2:n väite appin ensimmäisestä anonyymistä sivusta on liian laaja: staattinen UI-kuori on jo anonyymisti palveltava (`server.go:192–227`). Uutta olisi tämän reitin oikeus ratkaista julkinen näkymä, ei pelkkä sivun näyttäminen kirjautumatta.

## 4. Siirtymä ja työn koko

**Ehdotus siirtymäksi:** ei kotien tai vanhojen keskusteluviestien migraatiota. Vanhat viennit saavat varauksen vasta ensimmäisestä selaimen pyynnöstä. Nykyinen `/view?id=` voi pysyä omistajan avausreittinä; se ei saa alkaa anonyymisti paljastaa uutta osoitesalaisuutta. Gatewayn linkkitilan formaatti täytyy vaihtaa hallitusti, sillä nykyinen version 1 lukija hylkää tuntemattomat kentät ja pudottaa vanhentuneet linkit (`view_links_linux.go:164–186`).

Pre-release-projektissa yksinkertaisin julkaisu voisi mitätöidä vanhat jakolinkit ja kertoa siitä. Se ei kuitenkaan ole huomaamaton ”migraatio”: jo jaetut osoitteet lakkaisivat toimimasta. Jos niitä säilytetään, tehdään rajattu kertamuunnos, joka säilyttää voimassa olevien linkkien omistajan, tokenin ja expiran eikä koskaan herätä poistettuja tai vanhentuneita. Useista saman näkymän linkeistä ei pidä hiljaisesti valita yhtä ja hävittää muita. Säilyttäminen ei edellytä ikuista rinnakkaista API:a, mutta sen tuotekäytös on sovittava.

**Arvio:** seuraavat ovat yhden workerin rajattuja, testattavia toimituksia, eivät viisi samanaikaisesti tehtävää työtä. Arvio ei ole mitattu kalenteriaika.

1. **Osoitteen elinkaari ja sopimus:** tietueformaatti, varausoperaatio, omistaja+näkymä-uniikkius, yksityinen/julkinen/vanhentunut tila, säilytysrajat ja restart-testaus. Hyödyntää `changeViewLinks`-kirjoitusmallia.
2. **Pysyvä avausreitti:** app-reititys, omistajan avaus ja kirjautumisesta paluu, julkinen redirect, virheet ja salaisuuksien lokisuoja. Testaa vieraan käyttäjän, anonyymin ja tuntemattoman osoitteen erikseen.
3. **Julkaisun ja perumisen kokonaisuus:** sisääntulo ja sisältötoken saman tilan alla; expiry, uudelleenjulkaisu, operaattorin pois-kytkentä, ylläpitäjän peruminen ja omistajan deny. Siirtymä vanhasta tiedostosta sekä monta linkkiä / sisällön vaihto -ratkaisu mukaan tähän.
4. **Selain:** uusi avaus- ja kopiointikohde, kortti ja linkkiasetukset, epävarmat kirjoitustulokset, tilin vaihto ja uudelleenlataus; sopimusgenerointi ja yksikkötestit. R3:n visuaalinen valinta integroidaan, sitä ei suunnitella tässä uudelleen.
5. **Kokonaisuuden varmennus:** kahden käyttäjän ja anonyymin selaimen lukumatriisi, monen tiedoston vienti, evästeiden esto, uudelleenkäynnistys, revoke/expiry/rotation sekä todellinen ingress ilman kirjautumisporttia tai edge-cachea. Operaattoriohje ja hyväksytyn auktoriteettirajan kirjaus.

Riippuvuudet: 1 → 2 ja 3 → 4 → 5, vaikka testejä tehdään joka osassa. Nykyiset pohjat ovat `internal/gateway/views_linux_test.go:127,197,256` ja `view_links_linux_test.go:63,132,276,302,334,401`; historiaan kirjattu Chromium-koe ei korvaa uuden reitin todentamista. Jos sama **näkyvä osoiterivi** on ehdoton, varaisin **1–2 lisätyötä** avausmallin selaintutkimukseen ja toteutukseen. Vaihtoehdon 1 muutos on vertailuksi arviolta **1–2 web-työtä** r3:n visuaalisen toteutuksen ja varmennuksen kanssa: nykyinen julkinen `url` on jo selaimen tiedossa, eikä gatewayn tilaa tarvitse muuttaa (`web/src/app/viewLinks.ts:25–32`; `ViewHost.tsx:237–245`).

## 5. Suositus

**Pidetään vaihtoehto 1 tässä kierroksessa.** Se täyttää julkisen käytön tärkeän lupauksen: *Avaa omalle välilehdelle* ja *Kopioi linkki* vievät samaan sisältöön samalla julkisella osoitteella. Se säilyttää myös yksityisen osoitteen merkityksen: sen aikaisempi jakaminen ei vahingossa anna tulevaa julkista pääsyä.

Vaihtoehtoa 2 ei pidä hylätä suuren palvelu-uudistuksen pelossa. Se on keskikokoinen gatewayn elinkaarimuutos, ei uuden palvelun, julkaisukopion tai root-rajapinnan rakentamista. Jos Jari haluaa nimenomaan ennen julkaisua tehtyjen kirjanmerkkien ja osoitekopioiden alkavan toimia julkaistaessa, se on vaihtoehdon 2 todellinen hyöty ja samalla tietoinen oikeusmuutos. Silloin seuraava askel on lyhyt arkkitehtuuripäätös kolmesta asiasta: **pysyvä sisääntulo vai pysyvä osoiterivi; vanhojen kopioiden elpyminen vai osoitteen kierto; näkymän osoite vai toiseen vientiin siirrettävä julkaisulinkki**. Tätä tutkimusta ei tarvitse uusia eikä daemonia suunnitella uudelleen ennen päätöstä.

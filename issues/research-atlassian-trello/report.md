# Jira, Confluence ja Trello Contosoin agenteille

Selvitys 2.11.2026. [Tehtävä](item.md). Tämä on suositus seuraavan prototyypin pohjaksi, ei toteutus- tai käyttöönottopäätös.

## Suositus lyhyesti

**Jiraan ja Confluenceen Atlassianin oma etä-MCP, henkilön omalla OAuth-kirjautumisella ja Pi:n omalla tunnustallenteella. Trelloon ensimmäiseksi rajattu REST-yhteys curlilla, henkilön Trello-tokenilla.** Trellon oma MCP kannattaa kokeilla ennen toteutuksen lukitsemista: se on olemassa, mutta eri palvelu kuin Jira/Confluence-MCP, eikä sen täydellistä asiakasasennusta saatu tässä varmennettua.

MCP tarkoittaa tässä Atlassianin ylläpitämää työkalurajapintaa, johon henkilön oma agentti ottaa suoraan yhteyden. Habitat ei välitä palvelukutsuja eikä ylläpidä tunnuspalvelinta. Jira ja Confluence saadaan samalla kirjautumisella; erillistä Confluence-CLI:tä ei tarvita. Trellon REST-vaihtoehto on pienempi ja paremmin tunnettu kuin oman OAuth-asiakkaan rakentaminen. Sen haittoina ovat tokenin käsin liittäminen ja laaja tilikohtainen pääsy.

Aloitetaan **vain luvulla ja haulla**. Kirjoitus on erillinen tietoinen valinta, ja käyttöliittymä saa luvata teknisen lukueston vain, kun palveluntarjoaja todella estää kirjoituksen. Agentin ohje tai työkalujen piilottaminen ei tee kirjoittavasta tunnuksesta lukutunnusta.

## Mitä tiedetään Contosoista

Fleetrepon `research/swiss-headhunter-outreach/cv-inputs/fabrikam-monorepo.md` kuvaa Contosoin Jira Cloud -pilottia, Scarlett-bottia ja jaettua palvelutilin tokenia. Se on aiemman projektin yhteenveto, **ei nykyinen lisenssi- tai käyttöoikeusinventaario**. Rajatussa haussa Fleetrepon `infra/`, `docs/` ja `research/`-hakemistoista ei löytynyt varmistusta Contosoin Confluence- tai Trello-tilauksesta, Guardista, Enterprise-tasosta tai nykyisistä ylläpitäjistä.

Scarlettin jaettua tunnusta ei pidä siirtää Habitatiin: täällä jokainen toimii omana itsenään. Selvitys ei käyttänyt Contosoin tunnuksia eikä tehnyt muutoksia sen palveluihin.

## 1. Jira ja Confluence: yhteinen virallinen MCP

Atlassianin nykyinen ohje nimeää osoitteeksi `https://mcp.atlassian.com/v2/mcp`. Palvelu tarjoaa Jiran työasioiden lukemisen, haun, luonnin, muokkauksen, tilasiirtymät ja kommentit sekä Confluencen sivujen lukemisen, luonnin, muokkauksen ja kommentit. Näiden lisäksi siinä on paljon toimintoja, joita pilotissa ei tarvita. V2:n työkaluluettelo muuttuu; esimerkiksi `createConfluenceContent` korvaa ajatuksen pelkästä sivuluontikomennosta. [1–3]

**Tunnistautuminen:** henkilö hyväksyy Atlassianin OAuth 2.1 -suostumuksen selaimessa. Pi hoitaa OAuth-asiakkuuden, tallentamisen ja uusimisen. Konfiguraatio on henkilön `~/.pi/agent/mcp.json`, tunnukset Pi:n omassa `~/.pi/agent/mcp-auth.json`-tiedostossa. Eri tilit voidaan erottaa eri palvelinnimillä saman URL:n alla. Tämä on Pi:n dokumentoitu ominaisuus; Atlassianin ja Habitatin yhteinen päästä päähän -kirjautuminen pitää vielä kokeilla. [4]

**Oikeudet:** V2 dokumentoi esimerkiksi `read:jira:agent-interface`, `write:jira:agent-interface`, `read:confluence:agent-interface` ja `write:confluence:agent-interface`. Haulla on omat oikeusryhmänsä. Sovelluksen suostumus ei ohita henkilön Jira-projekti- tai Confluence-sivuoikeuksia. Contosoin organisaatioylläpitäjä voi MCP:n Permissions-näkymässä estää kirjoituksen tuotteittain. Tämä on palvelupuolinen esto, toisin kuin agentin oman työkaluluettelon suodatus. [2, 3, 5]

Pilottiin sallitaan vain tarvittavat Read/Search-ryhmät ja estetään Write. Henkilökohtaisen luku-/kirjoitustasovalinnan toteutus riippuu siitä, mitä suostumuksesta ja Pi:n tallenteesta voidaan luotettavasti lukea. Jos henkilökohtainen rajaus ei onnistu, prototyypissä lukutaso on organisaation määräämä eikä kuvitteellinen oma kytkin. Organisaation esto voi vaikuttaa myös muihin sen MCP-asiakkaisiin: sitä ei saa ottaa käyttöön Contosoin puolesta hiljaisesti.

**Kustannus ja kattavuus:** nykyinen dokumentaatio sanoo MCP:n käyttävän Rovo-krediittejä ja erityisesti rikastetun Teamwork Graph -haun kuluttavan niitä. Budjettia tai saatavuutta ei voi päätellä siitä, että Jira toimii selaimessa. Tarkistetaan Contosoin oikea tilaus ja testataan tavallinen Jira-haku sekä sivuluku ilman laajaa yrityshakua. [1]

### Miksi ei acli ensisijaiseksi?

Atlassianin virallinen `acli` on hyvä vaihtoehto **Jira-automaatioon**: selkeät komennot, JSON-tulokset ja virallinen ylläpito. Mutta tarkastettu komentohakemisto ei tarjoa Confluence-komentoja. Samalle käyttäjälle tulisi kaksi työkalua ja kaksi yhteyden elinkaarta. Lisäksi `acli jira auth login --token` dokumentoi nimenomaan **scopeittoman API-tokenin**; sillä ei pidä luvata teknistä vain luku -tasoa. OAuth onnistuu `--web`-valinnalla, mutta sen tarkkaa myöntöä ja headless-tallennetta ei tässä kirjautumatta varmennettu. [6, 7]

Yhteisön `ankitpokhrel/jira-cli` tarjoaa Jira-työskentelyn mutta ei ratkaise Confluencea. `sooperset/mcp-atlassian` tarjoaa molempia ja myös Server/Data Center -käyttöä; Cloud-pilottiin se lisäisi paikallisen palvelinriippuvuuden, kun Atlassian jo ylläpitää etäpalvelua. Niitä ei hylätä laaduttomina, vaan ne eivät tässä vähennä ylläpidettävää. [8, 9]

### Miksi ei oma Jira/Confluence 3LO -sovellus?

Suora REST ja OAuth 2.0 3LO ovat teknisesti mahdollisia: kehittäjäkonsolissa rekisteröidään sovellus, callback ja API-scopet, käyttäjä antaa suostumuksen ja kutsut tehdään `api.atlassian.com/ex/.../{cloudId}`-osoitteisiin. `offline_access` antaa kiertävän refresh tokenin; dokumentoitu käyttämättömyysaika on 90 päivää ja uudelleenkäytön toleranssi 10 minuuttia. Asiakas käsittelee `expires_in`-arvon eikä oleta tunnuksen olevan ikuinen. [10]

Tämä vaatisi valmiin natiiviasiakkaan, joka omistaa rekisteröinnin, tallenteen ja tokenien uusimisen, tai uuden työkalun kehittämisen. Habitatin gatewaysta ei tehdä sitä. **Atlassian myös nimenomaisesti kieltää jaeltavaa integraatiota keräämästä API-tokeneita tai ohjeistamasta jokaista asiakasta luomaan omaa 3LO-sovellusta**; sen ohje on yksi jaettava 3LO-sovellus. Siksi nykyisten Google/Microsoft-asennuskohtaisten sovellusasetusten kopioiminen tähän ei ole hyväksyttävä oletus. Valitulla virallisella MCP-reitillä Habitat ei rekisteröi omaa Jira/Confluence REST-sovellusta. Pi:n mahdollinen MCP-asiakasrekisteröinti on eri asia. [10]

Henkilökohtainen Jira/Confluence API-token on silti Atlassianin tukema skriptien tunnus, ei automaattisesti sallittu tuoteintegraation jakelutapa. Nykyiset tokenit vanhenevat 1–365 päivässä; scopelliset tokenit käyttävät Atlassianin API-yhdyskäytävää. Niillä ei ole OAuth-refreshiä. Scopeiton token ei rajoita toimintaa lukemiseen. [11]

## 2. Trello: pieni REST-yhteys ensin, oma MCP seuraavaksi kokeiluun

**Ensimmäinen toteutuskelpoinen reitti:** Trellon `1/authorize` tuottaa henkilölle tokenin, jolla curl käyttää REST-rajapintaa. Sovelluksen API-avain luodaan Trellon sovellushallinnassa Power-Upin kautta; avain ei ole käyttäjän salaisuus. Käyttäjän token on. Power-Up-avaimen olemassaolo ei itsessään tarkoita taululle asennettua lisäosaa. Julkisen jakelun ehdot ja sovelluksen omistaja varmistetaan ennen muuta kuin rajattua pilottia. [12]

- Haku ja taulujen, listojen, korttien sekä kommenttien luku: `scope=read`.
- Kortin luonti, siirtäminen, päivitys ja kommentointi: `scope=read,write`.
- `account` jätetään pois: sähköpostin lukua tai henkilön profiilin muuttamista ei tarvita.
- Voimassaoloksi pilotissa `30days`, ei `never`. Vaihtoehdot ovat 1 tunti, 1 päivä, 30 päivää ja rajaton. Tässä vanhemmassa tokenimallissa ei ole refresh tokenia: vanhentuessa yhdistetään uudelleen.
- Token antaa pääsyn henkilön tilin oikeuksilla, **ei vain käyttöliittymässä valittuihin tauluihin**. Työskentelytaulujen valinta on käyttömukavuutta, ei käyttöoikeusraja.

Tunnus tallennettaisiin vain henkilön curl-konfiguraatioon (0700-hakemisto, 0600-tiedosto), ei Habitatin omaan tokenirekisteriin. Kutsu käyttäisi `curl --config <tiedosto>` -mallia ja Authorization-headeria. Dokumentaation `?key=...&token=...`-esimerkkejä ei kopioida: tunnus ei kuulu komentoriviin, URL-lokeihin eikä agentin tulosteisiin. Tarkka tiedostonimi on toteutuksen asia, ei olemassa oleva Trello-standardi. curl on tässä natiivityökalu samaan tapaan kuin nykyisissä DAV-yhteyksissä. [12]

Tämä on myös rajallinen ratkaisu: käyttäjä liittää tokenin selaimesta, eikä curl hoida OAuth-virtaa. Se on silti rehellisempi ensimmäinen yhteys kuin Habitatin sisälle rakennettu OAuth-asiakas. Lukuoikeus voidaan todentaa Trellon tokenin oikeusmetadatasta ja kirjoituksen estosta testitaululla, ei pelkästään käyttäjän valitsemasta napista. Katkaisu erottaa paikallisen tallenteen poistamisen Trellossa tehtävästä tokenin perumisesta.

### Trellolla on nyt myös OAuth 2.0 — ja erillinen MCP

Vanha tieto ”Trello tukee vain OAuth 1.0:aa” ei enää pidä. Lokakuun 2026 kehittäjäohje kuvaa OAuth 2.0 3LO:n, PKCE:n, lyhytikäiset access tokenit (oletus tunti), refresh tokenit (90 päivää) ja tarkemmat scopet. Esimerkiksi `read:board:trello` lukee kortit, listat ja kommentit; `write:board:trello` luo ja päivittää niitä. Jäsenyyksien, Workspacejen ja Enterprise-asetusten kirjoittamiseen on erilliset scopet. [13–15]

Tärkeä ero: Power-Upin OAuth-asiakas on Workspace-rajattu, mutta sillä ovat aina mukana sekä board-read että board-write. **Se ei sovi aidon lukutason lähtökohdaksi.** Ei-Power-Up-sovelluksen OAuth-asiakkaalla ei ole tätä pakollista kirjoitusoikeutta eikä samaa Workspace-rajausta. Sovellus rekisteröidään Trellon omassa hallinnassa, ei oleteta Jira-sovelluksen tunnusten toimivan. [14]

Trellon oma MCP on virallisen tukiohjeen mukaan olemassa, tukee yhtä Workspacea yhteyttä kohden ja käyttää Atlassianin MCP-hallinnan domain-, IP- ja luku-/kirjoitusrajoituksia. **Trello-data ei saman ohjeen mukaan ole saatavilla Jira/Confluenceen käytettävästä Atlassian Rovo MCP:stä.** [16]

Tämä on houkutteleva seuraaja REST-tokenille. Tässä selvityksessä löydetty ohje oli kuitenkin vianetsintäohje, ei varmennettu yleisen Linux-asiakkaan asennus- ja endpoint-ohje. En nimeä arvattua osoitetta tuotteen riippuvuudeksi. Ennen toteutusta kokeillaan virallinen Trello MCP Pi:llä: jos henkilön kirjautuminen, Workspace-valinta, lukuesto ja kortin luonti toimivat, **korvataan suositeltu Trello-REST tällä**, eikä rakenneta molempia turhaan. Vaihtoehtoinen oma Trello OAuth 2.0 -asiakas jää viimeiseksi, koska curl ei yksin omista sen uusimiskiertoa.

## 3. Mitä Contosoin ylläpitäjän on tehtävä

Sovelluksen rekisteröinti, henkilön suostumus ja organisaation pääsypolitiikka ovat kolme eri asiaa. Organisaation olemassaolo ei tarkoita, että jokainen käyttäjäkirjautuminen automaattisesti tarvitsee Entran kaltaisen admin consent -vaiheen.

**Jira/Confluence MCP:** organisaatioylläpitäjä tarkistaa `Connectors → Atlassian MCP server` -kohdasta sallitut OAuth-asiakas-/paluuosoitedomainit ja Permissions-välilehdeltä tuotteiden Read, Search ja Write. Listalle tarvitaan käytetyn natiiviasiakkaan todellinen paluuosoite; pelkkä Habitatin julkisen domainin lisääminen ei välttämättä riitä. IP-sallintalistan pitää kattaa Habitat-palvelimen ulostulo, ei vain käyttäjän kannettavaa. API-token-kirjautumista ei tarvitse sallia valittua OAuth-reittiä varten. [5, 17]

Tämän lisäksi tarkistetaan Connected apps sekä Jira-projektien ja Confluence-tilojen/sivujen omat oikeudet. Data security policy voi estää kelvollisten Marketplace- ja custom-sovellusten sisältöpääsyn; hienojakoiset sallintalistat riippuvat Guard-tilauksesta. MCP:n nykyinen Permissions-hallinta on sen oman ohjeen mukaan ensisijainen MCP-oikeuksille. Näitä kontrolleja ei pidä niputtaa yhdeksi ”hyväksy Habitat” -napiksi. [5, 10, 18]

**Trello:** Workspace-ylläpitäjä vahvistaa, mihin Workspaceen ja tauluihin henkilö kuuluu. Enterprise-ylläpitäjä tarkistaa Power-Up-sallinnat, tokenien luonnin eston ja managed users -joukon. Power-Upien sallintalista hallitsee lisäosien lisäämistä tauluille; se ei ole yleinen lupaus kaiken REST-liikenteen estosta. Enterprise voi estää vanhojen API-tokenien luonnin ja perua niitä. Uudelle OAuth 2.0:lle dokumentoidaan per-käyttäjä/per-token-peruminen, mutta julkaisuvaiheessa ei vanhan mallin yleistä luontikieltoa eikä bulk-perumista. Siksi vanhaa tokenikäytäntöä ei saa luvata sellaisenaan uudelle OAuthille. [19, 20]

**Tietojen sijainti:** Jira/Confluencen data residency koskee määriteltyä Atlassianin sisäistä dataa. Se ei siirry API-vastauksen mukana Habitatin palvelimelle, Pi:n historiaan tai mallipalveluun. Trellolle ei saa luvata Jira/Confluence-ohjeen EU-pinnausta: se ei kuulu kyseisen ohjeen tuotelistaan. Contosoin on hyväksyttävä myös Habitatin ja valitun mallipalvelun käsittelypaikat, säilytys ja sopimukset. [21]

## 4. Sovitus Habitatin nykyiseen malliin

Luettu nykyiset `web/src/components/Integrations.tsx`, `internal/daemon/integrations/{google_linux,microsoft_linux,relay_linux,skill_linux}.go`, katalogin integraatiot sekä `internal/AGENTS.md`. Integraatioiden aiemmat päätökset tarkistettiin issueista `integrations-catalog-core`, `integration-grant-capabilities`, `integration-account-level-google`, `integration-account-level-microsoft-dropbox` ja `gitlab-integration`. Historiasta luettiin `27459932`-commitin `issues/research-integration-permission-scopes/result.md`; sen vanhaa nykytilakuvausta ei käytetty tämän päivän koodin korvikkeena.

Nykyinen sivu on **Asetukset → Tiedot agenteille** (aiemmin Integraatiot). Tilikohtainen kortti kertoo palvelut, todellisen myönnön ja puuttuvat oikeudet. Google käyttää selainpalautuksen välitystä, Microsoft laitekoodia ja natiivin MCP-työkalun tallennetta; GitLab/Gitea henkilön omaa glab/tea-tunnusta. Tästä seuraa prototyypille:

1. Atlassian-kortti: henkilö ja sivusto, Jira ja Confluence omina palveluriveinään. Trello omana korttinaan, Workspace näkyvissä MCP-vaihtoehdossa. Kaikille näkyvä varoitus, että agentti toimii henkilön oikeuksilla.
2. Kirjautumisdialogi käynnistää natiiviasiakkaan henkilön daemonissa. Pi:n MCP-login tukee etäkoneen selaimesta palautusosoitteen liittämistä, mutta Habitatin nykyiseen login-rajapintaan tarvittava sovitus on uutta työtä. Gateway ei vaihda tai uusi Atlassian-tokeneita.
3. Erotetaan ”ylläpitäjä estää”, ”henkilöltä puuttuu oikeus”, ”kirjaudu uudelleen” ja ”palvelu ei vastaa”. Ei automaattista oikeuksien laajennusta, uudelleenkirjautumista tai epävarman kirjoituksen uusintaa.
4. `personal-data` generoidaan samoista natiivitallenteista. Nykyiset tunnistetut tietolajit ovat mail/calendar/contacts/files: Jira-asiat, Confluence-sivut ja Trello-kortit tarvitsevat myös skillin kuvauksen laajennuksen, eivät vain uutta kappaletta loppuun. Skill kertoo tilin, sivuston/Workspacen, työkalun ja sallitun käytön, ei tunnuksia.
5. Agentti lukee ja hakee ilman erillistä kysymystä. Kirjoittaa vain käyttäjän pyytämän muutoksen, ei noudata sivujen tai korttien sisään kirjoitettuja käskyjä. Kommentti ja tilasiirtymä voivat ilmoittaa muille ihmisille; poisto ja oikeuksien muuttaminen eivät kuulu oletuskäyttöön.

`open-habitat agent integration-account --help` tarjoaa create/update/delete-toiminnot; create ottaa suojatun JSON-tiedoston tai stdin-syötteen **salasanatyyppisille yhteyksille**. Se ei ole valmis yleinen Atlassian OAuth -komento. Agentti saa aloittaa tuetun yhdistämisen, mutta henkilön suostumus kuuluu selaimeen. Olemassa olevaan agenttipintaan ei pidä luvata Atlassian-tukea tämän selvityksen perusteella.

## 5. Linux-asennus ja mitä on oikeasti varmennettu

| Vaihtoehto | arm64 / x86_64 Linux ilman rootia | Tässä varmennettu |
|---|---|---|
| Virallinen acli | Kummallekin valmis itsenäinen binääri; käyttäjän oma hakemisto riittää [6] | Molemmat ladattu, ELF-arkkitehtuuri ja staattinen linkitys tarkistettu. arm64:llä versio `1.3.40-stable` ja login-help ajettu erillisellä HOMElla. x86_64:ää ei ajettu onnistuneesti tällä arm64-isännällä. |
| Atlassianin etä-MCP | Ei paikallista Atlassian-palvelinta; käyttää jo asennettua Pi:tä | Pi:n HTTP/OAuth/tallenneominaisuudet dokumentaatiosta. Ei kirjautumistestiä tai Contosoin tenant-testiä. |
| Trello REST / curl | Sama REST-protokolla molemmilla arkkitehtuureilla; curl kuuluu isännän työkaluihin | Auktorisointi ja header-muoto virallisesta dokumentaatiosta. Ei oikean tilin API-kutsuja. curlin puuttuminen ratkaistaan host-profiilissa, ei henkilön sudo-oikeudella. |
| Yhteisön Jira CLI / MCP | Mahdollisia käyttäjäkohtaisia julkaisu-/pakettiasennuksia | README-vertailu, ei molempien arkkitehtuurien asennus- tai kirjautumistestiä. Ei oteta hyväksytyksi riippuvuudeksi tämän perusteella. |

Asennus ilman rootia on työkalun ominaisuus, ei ehdotus ohittaa Habitatin integraatioprofiilin tai Fleetrepon versiohallittua asennusta. Kokeilubinäärit olivat vain `/var/tmp/atlassian-research`-hakemistossa, eivät PATHissa.

Ennen toteutusta tarvitaan yksi rajattu kokeilu: Pi:n OAuth selaimesta toisella koneella; uudelleenkäynnistyksen jälkeinen käyttö ja tokenin uusiminen; kaksi henkilöä ja tilien erottuminen; oikean lukueston tarkistus; katkaisu ja peruminen; Jira-kommentti, Confluence-sivupäivitys ja Trello-testikortti erikseen annetulla kirjoitusluvalla. MCP:n uudistuneet ohjeet ja Trellon lokakuun OAuth-ohjeet eivät korvaa tätä koetta.

## Enintään viisi kysymystä Jarille

1. Mitkä ovat Contosoin Jira-/Confluence-sivustot ja Trello-Workspacet, ja ovatko kaikki Cloud-palveluja?
2. Kuka Contosoilla vahvistaa Atlassian-, Guard-, Rovo- ja Trello Enterprise -tilaukset sekä hyväksyy agenttikäytön?
3. Aloitetaanko pilotissa vain luvulla, ja missä testiprojektissa, Confluence-tilassa ja Trello-taulussa kirjoitus voidaan myöhemmin kokeilla?
4. Saako sisältö kulkea nykyisen Habitat-palvelimen ja valitun mallipalvelun kautta, vai onko EU-sijainnille tai säilytykselle erillinen vaatimus?
5. Tarvitseeko ensimmäinen Trello-käyttäjä useita Workspaceja vai riittääkö yksi? Tämä ratkaisee, kuinka arvokas Trellon yhden Workspacen MCP-reitti on.

## Lähteet

Verkkolähteet luettu 2.11.2026. Ohjeet ovat muuttuvia; tuotesaatavuus Contosoilla jäi tarkistettavaksi.

1. [Atlassian MCP: aloitus, v2 ja Rovo-krediitit](https://support.atlassian.com/atlassian-ai-gateway/docs/get-started-with-the-atlassian-remote-mcp-server/)
2. [MCP supported tools](https://support.atlassian.com/atlassian-ai-gateway/docs/supported-tools/)
3. [MCP OAuth 2.1](https://support.atlassian.com/atlassian-ai-gateway/docs/configure-oauth-2-1/)
4. Asennetun Pi:n virallinen `docs/mcp.md`, runtime-paketissa `@earendil-works/pi-coding-agent`; luettu kokonaan. Paikallisen version dokumentaatio, ei väite kaikkien Pi-versioiden tuesta.
5. [MCP permissions](https://support.atlassian.com/security-and-access-policies/docs/configure-atlassian-mcp-server-permissions/)
6. [acli Linux-asennus](https://developer.atlassian.com/cloud/acli/guides/install-linux/)
7. [acli Jira login](https://developer.atlassian.com/cloud/acli/reference/commands/jira-auth-login/) ja [komentohakemisto](https://developer.atlassian.com/cloud/acli/reference/commands/)
8. [jira-cli: ylläpitäjän README](https://github.com/ankitpokhrel/jira-cli)
9. [mcp-atlassian: ylläpitäjän README](https://github.com/sooperset/mcp-atlassian)
10. [Jira/Confluence OAuth 2.0 3LO, jakelu ja refresh](https://developer.atlassian.com/cloud/jira/platform/oauth-2-3lo-apps/)
11. [Atlassian API-tokenit](https://support.atlassian.com/atlassian-account/docs/manage-api-tokens-for-your-atlassian-account/)
12. [Trello REST authorization](https://developer.atlassian.com/cloud/trello/guides/rest-api/authorization/)
13. [Trello OAuth 2.0 aloitus](https://developer.atlassian.com/cloud/trello/guides/rest-api/oauth-2-getting-started/)
14. [Trello OAuth 2.0 client configuration ja scopet](https://developer.atlassian.com/cloud/trello/guides/rest-api/oauth-2-client-configuration/)
15. [Trello OAuth 2.0 confidential client](https://developer.atlassian.com/cloud/trello/guides/rest-api/oauth-2-confidential-client-usage/)
16. [Trellon oman MCP:n rajoitukset ja hallinta](https://support.atlassian.com/trello/docs/troubleshoot-trello-mcp-connection-errors/)
17. [MCP-domainit, tunnistautuminen ja IP-rajoitukset](https://support.atlassian.com/security-and-access-policies/docs/control-atlassian-mcp-server-settings/)
18. [Marketplace/custom app -pääsyn estäminen](https://support.atlassian.com/security-and-access-policies/docs/block-app-access/)
19. [Trello Enterprise Power-Up Administration](https://support.atlassian.com/trello/docs/enterprise-power-up-administration/)
20. [Trello Enterprise dashboard: API-tokenit ja OAuth 2.0](https://support.atlassian.com/trello/docs/enterprise-admin-dashboard/)
21. [Atlassian data residency: kattavuus ja tuotteet](https://support.atlassian.com/security-and-access-policies/docs/understand-data-residency/)

### Selvityksen työkalupoikkeamat

Ensimmäinen hakuskripti käytti puuttuvaa `python`-komentoa; se ajettiin onnistuneesti `python3`:lla. Kaksi arvattua tukidokumentin osoitetta palautti 404:n (Enterprise Power-Up Administration ja MCP access); oikeat sivut löytyivät virallisten sivujen linkeistä ja luettiin. Ensimmäinen historiatiedostonimi oli väärä; oikea `result.md` löydettiin git-puusta ja luettiin. x86_64-acli:n version ja helpin ajaminen arm64-isännällä palautti Exec format errorin; vastaavat tarkistukset tehtiin arm64-binäärillä, eikä x86_64-suoritusta väitetä testatuksi. Mikään näistä ei tarvinnut tunnuksia tai muuttanut palveluita.

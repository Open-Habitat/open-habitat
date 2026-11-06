# Julkaisu 6–12 minuutissa: mistä aika saadaan pois?

**Suositus: tee tavallisesta, runtimea muuttamattomasta julkaisusta ennalta testatun puun automaattinen toimitus, älä jokaisella kerralla uutta agenttiprojektia.** Pilot.17:n onnistunut gate vei 27 min 41 s, muuttumattomien runtimejenkin lähettäminen GitHubiin noin 31 min ja kolmen koneen asennustyön koordinointi noin 47 min. Sen sijaan Contosoin varsinaiset päivitysoperaatiot kestivät 33–34 sekuntia ja Birchn 10 sekuntia. Suurin voitto on jo tulossa pilot.18:n pienennetystä julkaisusta: pilot.17:n 2,482 GB:n asseteista 2,439 GB oli uudelleen julkaistua runtimea. Seuraavaksi tarvitaan vakioitu, mitattu toimitusohjelma sekä saman puun valmiin gaten käyttö. **6–12 minuutin toimitus on uskottava tavoite valmiiksi gatetulle, runtimea muuttamattomalle puulle, ei vielä mitattu tulos eikä lupaus 6–12 minuutista uudesta commitista kaikkien testien ja kolmen asennuksen valmistumiseen.** Tuore gate yksin ylitti tavoitteen yli kaksinkertaisesti. Allekirjoituksen poistaminen ei ratkaise tätä: ADR 0034 on jo hyväksynyt digest-luottamuksen, ja nykyinen asentaja käyttää sitä.

## Rajaus ja lähteet

Tutkimus 1.11.2026, tilannekuva noin **18:00 UTC**. Tuotteen tarkastettu puu: `9169402ce5500bdb679a40a375b690792cf559fe`; paikallinen Fleetrepo: `186f3334a9074683f9e5a6ccef498bf8c5a8c505`. Aldera, Fleetrepoa, pilot.18-työpuuta ja käynnissä olevaa gatea luettiin vain; mitään ajoa ei käynnistetty, keskeytetty tai muutettu. Alla MB/GB ovat desimaaliyksiköitä.

Lähdeavaimet (Fleetrepo-polut ovat sen repossa, eivät tässä repossa):

- **[P17]** `issues/release-pilot-17/result.md`: julkaistu commit, gate, arkistojen uudelleenkäyttö ja tarkistusten järjestys.
- **[G17]** Birchn `~/.local/state/oh-conductor/gate-pilot17{,-2}/{stderr.log,stdout.json}`: skriptin sekuntiajat. Onnistuneen gaten valmistuminen 31.10. **08:56:15 UTC** on myös Fleetrepon asennusraportissa.
- **[API17]** GitHub `GET repos/Open-Habitat/open-habitat/releases/tags/v0.1.0-pilot.17`, luettu autentikoidulla `gh api` -komennolla: assettien koot ja `created_at`/`updated_at`, `published_at`, `immutable`.
- **[H17]** Fleetrepo `infra/open-habitat-upgrades/v0.1.0-pilot.17-01m68n3xmhep5ds4jfhtxn41qk.md` ja `infra/habitat-birch/pilot17-result.md`: kohteet, operaatiot ja tarkistukset.
- **[T17]** Aldern `~/.taskfleet/runs/<id>/events.jsonl`, pääajo `01m68n3xmhep5ds4jfhtxn41qk`, Northwind `01m68n690wtgxrcfpvt8zyqews`, Contoso `01m68pma18xz7nsqe9wk9rt7j7`: töiden todelliset alku- ja raportointiajat.
- **[P18]** `taskfleet run show 01m6c2ybczc0gvg629k2gnka93 --output json`; Birchn `~/.local/state/oh-conductor/gate-pilot18/{stdout.json,stderr.log}`; Aldern `/var/tmp/agent-keep/pilot18-01m6c2yb/cut.sh`: keskeneräisen julkaisun tila ja valmisteltu resepti, ei sen onnistumistodiste.
- **[CODE]** `scripts/{ci-local.sh,prepare-test-release.sh,successor-descriptors.py,release-upload-plan.py}`, `internal/host/{apply_generation_linux.go,upgrade_native_linux.go}`; Fleetrepon `.claude/skills/open-habitat-upgrade/{SKILL.md,scripts/upgrade.py}` ja `infra/habitat-birch/`.
- **[POLICY]** `AGENTS-WORKFLOW.md`, `TESTING.md`, `docs/operations.md`, `docs/decisions/adr-0034-release-digest-verification.md`.

**Näytön rajoitus:** [P17]:n nimeämä Aldern `/var/tmp/agent-keep/pilot17-01m68gbv/` ei ollut enää saatavilla. Myöskään [H17]:n pilot.17-kohtaisia agent-keep-hakemistoja ei löytynyt rajatusta hakemistoluettelosta. Siksi allekirjoituksen, edeltäjän latauksen ja yksittäisten verifiointikomentojen aikoja ei voi erottaa luotettavasti. Käytän säilyneitä gate-lokeja, GitHubin metadataa, gitissä olevia raportteja ja Taskfleetin tapahtumia; en nimeä väliin jäävää aikaa yhden komennon kestoksi. Raakalokeja tai henkilötietoja ei kopioitu raporttiin.

## Mitattu aikabudjetti: pilot.17

### Gate (seinäkello, ei CPU-aika)

| Vaihe | Epäonnistunut yritys | Onnistunut yritys | Tulkinta |
|---|---:|---:|---|
| setup | 4 s | 4 s | Työkalut ja eristetty ympäristö |
| dependencies | 82 s | 402 s | Go/npm/Playwright ja fixture; ei erillisiä alavaiheaikoja |
| web-checks | 44 s | 48 s | Go/Storybook-haara on jo rinnalla |
| browser-and-go-contracts | 318 s | 1 111 s | Odotetaan molempia; ei lisätä alla olevaa Go-aikaa tähän |
| native-fixture | 0 s | 0 s | Sekuntiresoluutio |
| packaging | 98 s | 96 s | Molempien arkkitehtuurien kahdet paketit ja tarkistukset |
| final-checks | 0 s | 0 s | Ensimmäinen exit 1, toinen exit 0 |
| **Yhteensä** | **546 s = 9:06** | **1 661 s = 27:41** | Molempien ajoaika yhteensä **36:47**, korjausväli lisäksi |

Onnistuneen ajon alahaarat: Storybook 9 s, Go-checks 334 s, koko Go/contracts 346 s. Tavallinen browser 510 passed / 3 skipped, **13,6 min**; lab 162 passed, **5,0 min**; yhteinen browser-aika 1 111 s. Haara-ajat ovat päällekkäisiä päätaulukon kanssa. Ensimmäisen ajon lyhyt browser-aika ei ole nopeampi hyväksytty gate: tavallinen suite ei käynnistynyt porttivarauksen vuoksi ja orphan-testi epäonnistui. [G17, P17]

Dependencies-vaiheen 82 → 402 sekunnin ero on havainto, ei osoitettu cache-missin tai verkkohitauden diagnoosi. Skriptin cachet ovat työpuukohtaisia; täysin uusi gate-työpuu ei itsestään peri toisen työpuun cacheja. [CODE]

### Gate-valmistumisesta asennuksiin

| Jakso, 31.10.2026 UTC | Kesto | Mitä aika oikeasti sisältää |
|---|---:|---|
| Gate valmis 08:56:15 → ensimmäiset assetit 09:00:09 | **3:54** | Gate-siirto, paketointi, manifestit ym. yhteensä; kaikkien valmistelujen alkua ei tunneta |
| Assettien ensimmäinen `created_at` 09:00:09 → viimeinen `updated_at` 09:31:17 | **31:08** | GitHubin tallentama upload-ikkuna, ei erillinen verkkomittari |
| Viimeinen asset valmis → julkaisu 09:36:36 | **5:19** | Tuore draft-lataus, tarkistukset, arm64-todiste ja julkaisu; yksittäisiä kestoja ei eroteltu |
| Julkaisu → asennusajon synty 09:37:10 | **0:34** | Handoff |
| Asennusajo 09:37:10 → terminal report 10:24:12 | **47:02** | Kaikki kolme kohdetta, agentit, verifioinnit, korjaukset, git ja raportit |
| **Gate valmis → asennusraportti** | **1:27:57** | Mittaus tunnetuista aikaleimoista |
| **Onnistunut gate + yllä oleva ketju** | **1:55:38** | Johdettu summa; epäonnistunut gate ja korjausaika eivät sisälly |

GitHubin julkaisun `created_at` ei ole gaten tai julkaisutyön aloituskello, joten sitä ei käytetty lähtöpisteenä. [API17, H17, T17]

Uploadin 35 assettia olivat **2 482 024 343 tavua**, joista 24 runtime-arkistoa **2 438 534 369 tavua**. Molempien arkkitehtuurien paketit, manifestit ja sivutiedostot olivat yhteensä **43 489 974 tavua**, vain **1,752 %** kokonaismäärästä. Efektiivinen koko upload-ikkunan keskinopeus oli noin **1,33 MB/s**; tämä sisältää GitHubin ja rinnakkaisten siirtojen käyttäytymisen, eikä ole yleinen Aldern uplinkin benchmark. Kaikki runtime-arkistot olivat jo edellisessä julkaisussa samoina. [API17, P17]

### Asennusajan sisällä

| Kohde / työ | Mitattu aika | Huomio |
|---|---:|---|
| Northwind-child: run.created 09:38:27 → node.report 10:03:22 | **24:55** | .15 → .16 → .17, ei tavallinen yhden välin asennus |
| Contoso-child: 10:03:35 → 10:19:41 | **16:06** | Myös kaksi versioväliä, sekä tarkistukset ja kirjaukset |
| Contoso .16 operation 10:10:49 → 10:11:23 | **34 s** | Raportin operaation aikaväli; ei koko lataus/staging/hyväksyntä |
| Contoso .17 operation 10:15:41 → 10:16:14 | **33 s** | Sama rajaus |
| Contoso raportti → koko ajon raportti | **4:31** | Birchn loppuvaihe ja pääraportti; Birchn valmistelua tehtiin jo aiemmin |
| Birch .17 operation 10:21:49 → 10:21:59 | **10 s** | Ei koko Birchn asennuksen kesto |

Kohteet suoritettiin sarjassa. Northwindin ja Contosoin ajat sisältävät myös edeltäjäketjun umpeen kuromisen, uusia skriptejä, paikallisten tarkistinten korjauksia ja repository-työtä. Niitä ei saa tulkita tuotteen vaatiman I/O:n alarajaksi. Yhtään konetta ei bootattu; rebootin poistamisesta ei tässä aineistossa saa säästöä. [H17, T17]

## Pilot.18: mitä on jo muuttunut ja mitä ei vielä tiedetä

Ajo alkoi 1.11. **17:36:31 UTC**. Tilannekuvassa se oli edelleen `pending`, supervisor alive, ei terminal reportia eikä landed-tulosta. Gate-lokissa valmistuneet vaiheet olivat setup **6 s**, dependencies **47 s**, web-checks **52 s**, yhteensä **105 s**. Browser/Go-, paketointi- ja loppuaikaa ei ollut vielä tulostettu. Näistä ei voi päätellä valmista gatea, julkaisua eikä kolmen kohteen aikaa. Pilot.18:n tulosraporttia ei ollut tarkastetussa työpuussa. Tutkimus ei odota tai ohjaa toisen työn valmistumista. [P18]

Aldern valmisteltu `cut.sh` käyttää jo `archive_release=v0.1.0-pilot.17` ja upload-planneria: **8 uutta assettia, 24 runtime-viittausta**, ei runtimejen uudelleen-uploadia. Se edelleen lataa pilot.17:n koko 35 assetin joukon, tarkistaa molemmat edeltäjät ja seuraajat, tekee arkkitehtuurit sarjassa sekä rakentaa webin kummankin `prepare-test-release.sh`-kutsun sisällä uudelleen. Draftista ladataan uudet assetit uudelleen; viitatut runtime-tavut ovat aiemmin tässä ajossa haettua ja GitHub-tiivisteillä tarkistettua pilot.17-dataa.

Resepti ei julkaise `.sig`/`.pub`-assetteja. Kommentin mukaan vanha kehitysavain puuttui ja vanhan `sign`-CLI:n vaatimus täytetään scratchin kertakäyttöavaimella. Tämä on **reseptistä luettu suunnitelma**, ei tämän tutkimuksen tarkistama onnistunut julkaisu tai avainten poistotoimi. Tuotteen ja Fleetrepon digest-only-luottamus on jo käytössä; ADR 0034:n keyless-komento on eri työ. `SHA256SUMS` on tässä reseptissä vielä mukana. [P18, CODE, POLICY]

## Ehdotukset hyöty/vaiva-järjestyksessä

Ajansäästöt ovat **arvioita**, ellei kohdassa erikseen sanota mittaus. Työmäärä on suuruusluokka yhdelle toteuttajalle testauksineen, ei tarjous. Säästöt menevät osin päällekkäin eikä sarakkeita pidä summata.

| Järjestys | Muutos | Aikahyöty tavallisessa product-only-julkaisussa | Vaiva ja luottamus |
|---|---|---|---|
| 1 | **Älä lähetä muuttumatonta runtimea uudelleen.** Käytä jo toteutettuja immutable-source-viittauksia. | Pilot.17:n 31:08 uploadista arviolta **28–30 min pois**. Samalla efektiivisellä nopeudella 43,5 MB olisi noin 33 s; API-viiveineen budjetoi 1–3 min. | Mekanismi jo valmis, pilot.18 käyttää reseptissään. Ei heikennystä: lähdejulkaisun immutable/published, koko ja digest tarkistetaan. Vanhojen lähdejulkaisujen saatavuus on ylläpitovelvoite. |
| 2 | **Käytä valmista saman puun gate-kuittia**, älä aja gatea toistamiseen julkaisupäätöksen jälkeen. | **27:41** pois päätöksen jälkeiseltä polulta tässä esimerkissä; testityö ei katoa. | Tuki on jo olemassa. Pieni orkestrointityö (noin 1 päivä): lukitse ehdokas, gate sille etukäteen, älä lisää edes issue-diffiä ennen cutia. Sama tree ja kaikki gate-inputit; ei kavennettua tiedostolistaa eikä vanhan kuitin nimeämistä uudelleen. |
| 3 | **Tavallinen toimitus ohjelmaksi, agentti poikkeusten ratkaisijaksi.** Yksi pääajo, kiinteät verify/stage/activate/check-askeleet ja automaattinen kohderaportti. | Nykyisestä **47:02** asennustyöstä tavoite **3–6 min** yhden välin toimituksessa. Tämä on tavoite, ei mitattu korvaavan ohjelman tulos. | Noin 3–7 päivää Fleetrepossa ja kohdeadaptereissa. Säilytä per-kohde lukko, vain site.release-muutos, alku/lopputilan vertailu, täsmälleen owner_binary, journal ja keskeytys-/jatkamislogiikka. Ei sokeaa automaattista korjausreittiä. Kertaluonteiset .15→.16→.17-ketjut eivät saa vääristää säästölupausta. |
| 4 | **Valmistele/lataa kerran per arkkitehtuuri ja jaa saman ajon tarkistetut tavut.** Säilytä kohteen jo olemassa olevat arkistot vain uuden manifestin hash/size-vertailun jälkeen. | Arviolta **1–5 min** verkosta ja päällekkäisestä valmistelusta; tarkka osuus puuttuu. | Noin 1–3 päivää. Älä rakenna uutta pysyvää palvelua: ensin saman ajon scratch ja kohteen nykyinen incoming. Fleetrepo-helper lataa nyt jokaisella verify-kutsulla kaikki arkistot. Digest tarkistetaan myös luottamusrajan jälkeen kohteessa ennen root-executionia. |
| 5 | **Yksi web-build, kaksi erillistä arkkitehtuuripaketointia rinnakkain.** | Arviolta **0,5–2 min**, ei 10×-ratkaisu. | Noin 1–2 päivää. Nykyistä prepare-skriptiä ei saa vain taustattaa samassa työpuussa: molemmat kirjoittavat node_modules/web/dist. Tuota muuttumaton saman puun build-output tai erilliset työpuut, sido paketti omaan commit/version-identiteettiin. Aldern kuormabudjetti säilyy. |
| 6 | **Rinnakkaista Northwind ja Contoso**, Birchn aktivointi erikseen valitussa järjestyksessä. | Pilot.17:n kahden child-ajan idealisoitu säästö **16:06** (summa → max); verkon ja uuden ohjelman kanssa käytännössä pienempi, ehkä **1–3 min**. | Noin 1–2 päivää lukituksen ja raporttien uudistus. Ei samaa hostia kahdelle kirjoittajalle. Nykyinen koko asennusjoukon flock/asiakkaat-ennen-Birch-sääntö täytyy muuttaa tietoisesti. |
| 7 | **Poista vain saman luottamusrajan sisäinen toisto.** Yksi täysi runtime-inventaarion tarkistus paikallisesti; valmis closure voidaan käyttää saman digestin seuraajassa. | Arviolta **alle minuutista muutamaan minuuttiin**; ei mittausta per verify. | Noin 2–4 päivää, tarkka inputien elinkaari. Draftista ladatun uuden paketin/manifestin tarkistus, published-digestien vertailu ja kohteen root-raja jäävät. Paikallisen tarkistuksen kuitti ei yksin todista verkon yli saatuja tavuja. |
| 8 | **Gate-cachet ja kylmän ympäristön kustannus.** Jaa sisältöosoitteiset lataus/build-cachet luotetusti työpuiden välillä; dependency- ja browser-vaiheiden tarkempi ajoitus. | Pilot.17:n 6:42 dependency-vaiheen ja pilot.18:n 0:47 ero **5:55**, mutta tämä ei todista cachemuutoksen säästöä. Browser 18:31 jää. | Noin 1–3 päivää. Säilytä lockfile/digest, eristetty HOME ja puhdas tuotanto-build; ei testituloksen reusea muuttuneelle puulle. Ei kahta kokonaissuitea kilpailemaan Birchn CPU:sta. |
| 9 | **Pienempi asennusdelta generation-tasolla.** Tuotepaketin lisäksi vain muuttuneet payloadit. | Ei vielä perusteltua minuuttisäästöä: aktivointiajat olivat jo 10–34 s, staging erottelematta. | Noin 1–2 viikkoa suunnittelua ja toteutusta. Nykyinen uusi manifest-digest tekee uuden generationin ja StageRelease purkaa profiilit uudelleen. Reflink/private copy voisi säästää I/O:ta; jaettu mutatoituva hardlink-payload tai uusi CAS muuttaa eheys-/elinkaarimallia. Ei ensimmäinen työ. |

### Mitä ei kannata laskea uutena optimointina

- **Muuttumattomien runtimejen rakentamatta jättäminen** oli jo pilot.17:n käytäntö. Sen lisäsäästö tässä vertailussa on nolla. Jos runtime muuttuu, rakennetaan vain muuttunut profiili molemmille arkkitehtuureille; core/integrations vaativat natiivin arkkitehtuurin. Tämä on hitaampi erillinen julkaisuluokka.
- **Vain muuttuneen allekirjoittaminen:** muuttunut product inventory vaatii uuden manifestin/digestin joka tapauksessa. Ed25519-operaation kustannusta ei mitattu, eikä se selitä kymmeniä minuutteja. ADR 0034:n loppuunsaattaminen poistaa avainriippuvuuden ja tarpeettomia tarkistuksia, ei mitattua 31 minuutin siirtoa.
- **Pelkkä verifiointien poisto** ei ole turvallinen nopeutus. Paikallinen build, GitHubista takaisin saatu draft ja kohteen root-rajalla olevat tavut ovat eri havaintoja. Kohteen inventory/mode/ownership-tarkistuksia tai upgrade-predecessor-sidosta ei korvata CI-kuittauksella.
- **Julkaisu ensin, gate rinnalla:** disposable-testipalvelimelle on jo sallittu ungated-reitti. Birchn ja asiakaspilottien Fleetrepo-ohje vaatii ungatedille nimenomaisen omistajapäätöksen; nykyinen tehtävä ei anna sitä. Tuotantoon clean gate ennen julkaisemista säilyy. Turvallinen rinnakkaisuus on rakentaa ja valmistella draftia gaten aikana, mutta julkaista vasta sen läpäistyä. Pakkausprosessit tarvitsevat erilliset outputit.

## Mitkä yhdistelmät pääsevät kymmenesosaan?

**A. Vain jo tehty pienempi upload:** pilot.17:n 115:38 → arviolta **86–88 min**. Ei lähellä tavoitetta. Vaikka myös asiakkaat rinnakkaistettaisiin vanhoilla child-ajoilla, jäätäisiin noin 70 minuuttiin.

**B. Pieni upload + automatisoitu toimitus + sama tuore gate alussa:** gate 27:41 + build/manifest/draft 3–6 min + asennukset 3–6 min = **noin 34–40 min**. Hyvä parannus, ei 6–12 min. Pelkät paketointi- ja hash-optimoinnit eivät poista browser-gaten alarajaa. Go/Storybook on jo rinnakkain.

**C. Suositeltu fast path, sama puu gatettu etukäteen:** seuraava on **tavoitebudjetti, ei tulos**:

| Kriittisen polun osa | Tavoite |
|---|---:|
| Valmiin kuitin ja ehdokkaan tarkistus | 0,1–0,3 min |
| Yhteinen web + paketit rinnakkain + manifestit | 1–2 min |
| Pieni upload + tuore draft-lataus + digest/inventory/native identity + publish | 1,5–3 min |
| Valmistellut kohteet, stage/activate/acceptance, Birch erillisessä aktivointivaiheessa | 3–5 min |
| Koneellinen raportti ja callback | 0,3–0,7 min |
| **Yhteensä** | **5,9–11 min** |

Ehdot: yksi versioväli, ei runtime-muutosta, ei apt-korjausta, palvelut tavoitettavissa, ei aktiivisen julkaisun lukko-odotusta, saman puun gate on jo valmis, vakaat adapterit ja lämmin build-ympäristö. Etukäteisvalmistelun aikaa ei piiloteta: mittarissa raportoidaan sekä **commit → kaikki kohteet hyväksytty** että **julkaisupäätös valmiille ehdokkaalle → kaikki kohteet hyväksytty**. Vain jälkimmäiselle aineisto tukee tätä 6–12 minuutin suunnitelmaa.

**D. Uusi commit → kaikki kolmessa koneessa 6–12 min, täydellä gatella:** nykyinen näyttö ei tue lupausta. Se edellyttäisi lisäksi gate-benchmarkia ja testien perusteltua uudelleenjärjestelyä/dedikoitua kapasiteettia. Neljän browser-workerin nostaminen kahdeksaan ei todista puolittumista; nykyiset molemmat suitet tarvitsevat mitatun CPU-/inotify-budjetin. Kahden kokonaisen suiten rinnakkaisajon on jo havaittu hidastavan Bircha [POLICY]. Gaten ajo etukäteen parantaa toimitusviivettä mutta ei tätä kokonaismittaria.

## Päätökset ja seuraava tutkimusnäyttö

Suosittelen keskusteltavaksi **ensin vakioitua product-only-toimitusta (kohdat 2–4)**, en generation-CASia tai gaten ohittamista. Alustava toteutuspanos 1–2 työviikkoa, olemassa olevat release-viittaukset mukaan lukien; ei uutta pysyvää palvelua eikä pakollista uutta konetta. Erillisen CI-koneen kustannusta ei hinnoiteltu, koska kapasiteettitarvetta ei vielä mitattu.

Jarin päätettävät rajaukset ennen toteutusta:

1. Onko 6–12 min tavoite valmiin ehdokkaan toimitukselle vai uudesta commitista asti? Edellinen on suositus; jälkimmäinen on eri gate-optimointihanke.
2. Kohteiden järjestys: nykyinen upgrade-skill tekee asiakkaat ennen Bircha keskustelun katkeamisen vuoksi, mutta TESTING.md nimeää Birchn ensin tapahtuvan päivityksen staging-hyväksynnäksi. Ehdotan eksplisiittiseksi säännöksi Birchn tekninen hyväksyntä ensin, sitten asiakkaat rinnakkain, detached-ohjaus Alderlla; keskustelukatko ilmoitetaan. Tämä ei ole nykyisen reseptin hiljainen muuttaminen. Vaihtoehtona säilyy nykyjärjestys, jolloin uuden version staging-canaryä ei pidä väittää saaduksi Birchsta.
3. Pidetäänkö pilotitkin aina gatettuina? Suositus tässä: kyllä, käytä valmista kuittia. Ungated-pilotti muuttaisi laadun ajoitusta, vaikka digest/immutable/Unix-user/TLS-luottamus säilyisi. Tätä ei toteutettu eikä oletettu sallituksi.

Ensimmäisen toteutuksen hyväksyntä: vähintään kolme tavallista yhden versiovälin product-only-julkaisua, molemmat arkkitehtuurit ja kaikki kolme kohdetta. Tallenna monotonic start/end erikseen jonotukselle, lataukselle, hashille, inventorylle, web/buildille, uploadille, draft-verifioinnille, stage- ja activate-kutsuille, acceptancelle ja raportoinnille. Raportoi kokonaisaika sekä median/max, kylmä/lämmin cache, siirretyt/uudelleenkäytetyt tavut, gate-tree ja kunkin kohteen edeltäjä. Testaa myös katkennut siirto, väärä digest, kilpaileva asennus ja keskeytynyt aktivointi: nopeus ei saa tehdä epäselvästä lopputuloksesta onnistumista. Pilot.18:n valmis tulos on ensimmäinen vertailupiste pienennetylle uploadille, ei vielä tämän koko tavoitepolun testi.

Tutkimus ei avaa toteutusissueita tai sijoita ehdotuksia DAGiin. Jokainen valittu ehdotus suunnitellaan Jarin kanssa erikseen [POLICY].

## Raportin tarkistus

`git diff --check` läpäisi. `issuectl doctor --json` suoritettiin; trackerissa ei ollut rikkinäisiä viitteitä tai syklejä, mutta olemassa olevista kuvamuodoista tuli huomautuksia. Issue merkittiin pyydetysti done; CLI varoitti alkuperäisestä tekstistä puuttuvasta Acceptance Criteria -osiosta (ei estävä DoD-asetus). `validate-project-view.py` epäonnistui ennestään HEADissa olevaan `KOKEILTAVAA.md`:n katkaistuun `/api/v1/attachments/9e619403-2fa…`-esimerkkilinkkiin. Tiedostoa ei muutettu tässä tutkimuksessa. Tuote- tai integraatiotestejä ei ajettu pelkän tutkimusraportin vuoksi.

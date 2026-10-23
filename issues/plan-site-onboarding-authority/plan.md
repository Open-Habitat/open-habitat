# Ehdotus: sivuston aloituspolku ja kutsumisvaltuus

## Tiivistelmä Jarille

**Tämä on päätösehdotus, ei hyväksytty ADR eikä toteutussuunnitelman hyväksyntä.**

Suosittelen jaettua omistajuutta ilman päällekkäisiä asetuksia:

- `host apply` määrittää asennuksen turvarajat, alkuperäiset sallitut GitHub-identiteetit ja sen, saavatko sivuston ylläpitäjät kutsua lisää ihmisiä. Oletuksena kutsumisvaltuutta ei ole.
- Aloituspolku on gatewayn ylläpitoasetus. Asentava agentti asettaa sen `admin`-CLI:llä; ylläpitäjä muuttaa samaa asetusta kohdassa Asetukset › Palvelin. `host apply` ja päivitys eivät palauta sitä vanhaan arvoon.
- Jos kutsuminen sallitaan, ylläpitäjä saa uuden, rajatun valtuuden pyytää brokerilta GitHub-identiteetin päästämistä palvelimelle. **Broker pysyy ainoana liittymisoikeuden ja Unix-tilien kirjoittajana, mutta gatewayn luottamus laajenee:** sen ylläpitäjätarkistus voi nyt johtaa uuden henkilön tilin luontiin. Tämä tarvitsee sinun hyväksyntäsi.

Kutsu ei ole sähköposti, salainen liittymislinkki eikä GitHub-organisaation jäsenyys. Se on oikeus kirjautua tähän Open Habitat -asennukseen omalla GitHub-tilillä. Tilin luonti tapahtuu vasta kirjautumisessa. Repoihin pääsy ja Googlen suostumus pysyvät henkilön omina oikeuksina.

**Kysymys:** hyväksytkö tämän jaon ja sen, että erikseen käyttöön otettu kutsumisvaltuus antaa gatewayn tunnistamalle ylläpitäjälle oikeuden lisätä palvelimelle ihmisiä? Jos et, turvallinen vaihtoehto on root-operaattorin hyväksymä liittyminen; selaimen kutsupainike voi silloin vain valmistella pyynnön, ei myöntää oikeutta.

## Rajaus ja rinnakkaiset työt

Lähtökohtana on [Jarin pyyntö ja päätös](../proto-site-onboarding-and-invites/item.md). [Henkilön aloituspolku](../proto-onboarding-person/item.md) prototypoi repo-oletukset, vanhojen repojen suodatuksen sekä integraatioaskeleet samoilla näkymillä kuin Asetukset › Integraatiot. [Ylläpitäjän näkymä](../proto-admin-server-onboarding/item.md) prototypoi asetusten muokkauksen sekä kutsujen odottaa/hyväksytty/peruttu-tilat. Tämä dokumentti ei valitse niiden visuaalista suuntaa eikä oleta rinnakkaisten prototyyppien valmistuneen.

Yhteiset nimet ovat `onboarding.steps`, `onboarding.repositories.defaults`, `onboarding.repositories.stale_after_days`, `onboarding.integrations` ja `invitations`. Ne ovat tässä ehdotettua sanastoa, eivät nykyisen site-skeeman kenttiä.

## Nykyinen lähtökohta: mitä koodi todella antaa tehdä

Viitteet koskevat tämän suunnittelutyön lähtöpuuta; symbolit yksilöivät kohdat ilman muuttuvia rivinumeroita.

1. [internal/AGENTS.md](../../internal/AGENTS.md), ”Identity and authority”: gateway tunnistaa selaimen, daemon toimii vain omana UID:nään, root-työ kuuluu provision-brokerille. Gateway ei lue koteja eikä aja agentteja. Valtuuden siirtäminen on arkkitehtuuripäätös, ei uusi asetuskenttä.
2. [internal/host/site.go](../../internal/host/site.go), `Site`, `Identities`, `ParseSite`: site sisältää numeeriset admission- ja administrator-listat, integraatioiden asennussyötteet sekä julkaisun ja tallennuksen rajat. Aloituspolkua tai kutsuja ei ole. Lukija torjuu tuntemattomat kentät: alla olevia ehdotuksia ei voi nyt lisätä site-tiedostoon.
3. [internal/gateway/administration.go](../../internal/gateway/administration.go), `serverSettings`, `adminHTTP`, `changeRoleFor`, `AdminControl`: gateway omistaa nimen, ylläpitäjäroolit ja oletuskiintiön. Selainmuutos vaatii session, ylläpitäjän ja write/CSRF-tarkistuksen; paikallinen control-polku vaatii root-peerin. Roolin myöntö edellyttää jo sidottua kohdehenkilöä. **Ylläpitäjärooli ei nykyisin myönnä liittymisoikeutta.**
4. [internal/cli/admin_linux.go](../../internal/cli/admin_linux.go), `adminRequest`, `adminServerCommand`: `admin` on jo rootin paikallinen reitti gatewayn ylläpitoon. Uusi CLI-nimi ei edellytä uutta palvelua tai etä-API-avainta.
5. [internal/provision/protocol.go](../../internal/provision/protocol.go), `ParseRequest`, ja [transport_linux.go](../../internal/provision/transport_linux.go), `Server.exchange`: brokerin rajattu Unix-sokettiprotokolla tarkistaa gateway-UID:n. Operaatiot kattavat sidonnan/valtuutuksen, listauksen ja kiintiöt, eivät admissionin kirjoittamista. Browser-rooli tai selaimen lähettämä actor-kenttä ei ole brokerin itsenäinen todiste.
6. [internal/provision/writer_linux.go](../../internal/provision/writer_linux.go), `Writer.Handle`, `handleLocked`, `stateAt`: liittymisoikeus, sidokset ja monotoninen epoch/generation tarkistetaan lukitussa tilassa. Keskeneräinen transaktio sulkee reitit. Ensimmäinen `ensure` luo sidonnan; myöhempi valtuutus ei perustu käyttöliittymän käyttäjälistaan. [broker_linux.go](../../internal/provision/broker_linux.go), `Writer.startupBindings`, säilyttää myös peruttujen sidokset mutta ei aktivoi niitä sallittuina.
7. [internal/provision/installation_linux.go](../../internal/provision/installation_linux.go), `PublishAdmission`, ja [internal/host/apply_control_linux.go](../../internal/host/apply_control_linux.go), `converge`: nykyinen admission-muutos on root-operaattorin compare-and-publish-transaktio, ei broker-listenerin API. Poistot tehdään suljetun HTTP-sisääntulon alla, sessiot perutaan vanhan admissionin aikana, ja operaattori odottaa brokerin havaitsemaa epochia. Suora allowlist-tiedoston kirjoitus tai nykyisen funktion kutsuminen selaimen puolesta ei korvaa tätä kokonaisuutta.
8. [docs/operations.md](../../docs/operations.md), ”Install”, ”Start and prove first use” ja ”Named-release upgrade”: asentaja toimittaa suojatun site-tiedoston ja palveluntarjoajien sovellusasetukset. Ensikirjautumaton ylläpitäjä jää `deferred_until_bound`-tilaan, ja apply ajetaan sidonnan jälkeen uudelleen. Päivitys erotetaan asetusten konvergenssista. ”Optional Google integration” erottaa asennuksen OAuth-sovelluksen henkilön omista gog/rclone-tokeneista.

## Vaihtoehdot

| Vaihtoehto | Asetusten totuus ja CLI | Kutsuminen | Miksi valita / miksi ei |
|---|---|---|---|
| A. Kaikki site-julistukseen | Rootin site on jatkuva tavoitetila; `host plan/apply`. Selain näyttää tai tuottaa ehdotetun muutoksen. | Root hyväksyy GitHub-ID:n siteen; nykyistä admission-rajaa ei tarvitse laajentaa. | Yksi deklaratiivinen malli ja pienin uusi luottamus. Ei täytä itsenäistä ”muuta ja kutsu selaimesta” -tarvetta. Selaimelle ei pidä antaa root-tiedoston kirjoitusoikeutta sen kiertämiseksi. |
| B. Kaikki ajonaikaiseen ylläpitoon | Gatewayn runtime-asetukset ja `admin`; host vain käynnistää palvelun ja alustaa ensimmäisen ylläpitäjän. | Runtime-ylläpitäjä hallitsee koko liittymislistaa brokerin uuden API:n kautta. | Selkeä päivittäinen käyttökokemus, mutta operaattori menettää jatkuvan admission-tavoitetilan. Muuttaa myös nykyisen host-konvergenssin sopimuksen laajasti. |
| **C. Jaettu omistajuus (suositus)** | Host omistaa turvarajat ja operaattorin admissionin. Gateway omistaa aloituspolun. Broker omistaa erikseen delegoidut kutsut. `host` ja `admin` vastaavat eri vastuista. | Erillinen rootin sallima delegaatio; ei yleistä admission-tiedoston muokkausta. | Täyttää selaimen ja asentavan agentin tarpeen säilyttäen rootin rajat. Hinta on uusi, rajattu broker-protokolla ja sen transaktiot. |

En suosittele ”site oletuksena, selain yliajaa, seuraava apply ehkä palauttaa” -mallia. Siinä ylläpitäjä ei tiedä, mikä arvo pysyy. Myöskään kutsujen lisääminen gatewayn käyttäjälistaan ei riitä: lista ei ole admissionin lähde.

## Suosituksen tarkempi merkitys

### Yksi omistaja kullekin tiedolle

| Tieto | Omistaja ja säilytys | Muutoksen reitti |
|---|---|---|
| Asennuksen rajat, operaattorin sallitut GitHub-ID:t, kutsumisdelegaatio | Rootin site → brokerin oma suojattu policy/admission-tila | `host plan/apply`; ei selainkirjoituksia |
| `onboarding.*` | Gatewayn olemassa olevan yksityisen administration-tilan laajennus | Sama validoitu muutos selaimesta ja `admin`-CLI:stä |
| `invitations`: kutsutut GitHub-ID:t ja kutsun tila | Brokerin oma lukittu, kestävä tila; ei gatewayn rinnakkaista admission-rekisteriä | Rajatut broker-operaatiot delegaation sisällä |
| Repon checkout ja integraation yhteys | Henkilön daemon sekä git/gh/gog/rclone/Pi:n natiivit tiedostot | Henkilön aloittama aloituspolku; ei hostin credentials- tai workspace-rekisteriä |

Uusi pysyvä kutsutieto on perusteltu: vielä kirjautumattomalla henkilöllä ei ole sidosta, mutta hänen oikeutensa pitää kestää uudelleenkäynnistys ja olla peruttavissa. Se kuuluu samaan auktoriteettiin kuin admission, ei uuteen palveluun. Tarkka tiedostomuoto jää toteutukselle; olemassa olevien broker-tiedostojen formaattia ei pidä kiertää erillisellä union-cachella.

**Konvergenssi:** hostin deklaroitu admission ja delegoidut kutsut ovat brokerin erottamia oikeuden lähteitä. `host apply` ei poista kutsua siksi, ettei sen ID ole site-listassa. Selain ei poista rootin myöntämää oikeutta. Päällekkäinen uusi kutsu jo operaattorin sallimalle henkilölle torjutaan selkeänä konfliktina; lähteet näytetään tehokkaan oikeuden readbackissa. Myöhempi lähteiden päällekkäisyys ei saa tehdä kutsun perumisesta lupausta pääsyn loppumisesta. Host-suunnitelma näyttää myös kutsuista jäävän tehokkaan pääsyn.

Delegoinnin sulkeminen ehdotetaan vahvaksi toimeksi: se poistaa kutsulähteestä tulevan pääsyn myös jo liittyneiltä (ei rootin lähteestä sallittuja). Plan näyttää vaikutetut henkilöt ja vaatii nykyisen admission-poiston kaltaisen suljetun, todennetun transaktion. Uudelleen avaaminen ei herätä vanhoja peruttuja kutsuja. Root voi näin katkaista delegoidun pääsyn muuttamatta jokaisen kutsun tietoa käsin.

Aloituspolku asetetaan vasta palvelun käynnistyttyä `admin`-komennolla. Sen arvoja ei samalla lisätä jatkuvasti konvergoitavaan siteen. Asennusautomaatio voi säilyttää erillisen aloituspolun syötetiedoston ja asettaa sen kerran tai muuttaa sitä tietoisesti myöhemmin; jokainen tavallinen apply/upgrade ei toista kirjoitusta. Hostin nykyisten roolien ja kiintiön konvergenssia ei tässä muuteta.

### Kuka saa kutsua ja mitä vaarapinta kasvaa

Ehdotus: vain nykyinen gatewayn ylläpitäjä, vain kun root on ottanut kutsumisdelegoinnin käyttöön. Tavallinen käyttäjä tai daemon ei kutsu. Kutsuminen ei anna vastaanottajalle ylläpitäjäroolia. Ensimmäinen ylläpitäjä syntyy edelleen operaattorin admissionista, kirjautumisesta ja roolin myönnöstä; ensimmäisen kirjautumisen perusteella ei tehdä ylläpitäjää.

Gateway tarkistaa session, CSRF:n ja ajantasaisen roolin eikä hyväksy selaimelta valtuuttavaa actor/UID/home-kenttää. Broker tarkistaa sallitun Unix-peerin, rootin delegaation ja oman transaktionsa ehdot. **Broker luottaa gatewayn päätökseen siitä, kuka oli ylläpitäjä.** Pelkkä actor-ID protokollassa ei suojaa kaapatulta gatewaylta. Delegointi kasvattaa gateway-murron vaikutusta: hyökkääjä voisi päästää uuden GitHub-identiteetin sisään ja kuluttaa sille sallitut resurssit. Ilman delegointia tämä jää nykyisen root-admissionin ulkopuolelle. UID-poolin, kiintiöiden, tilien luomisen ja kotien eristyksen rajat eivät siirry gatewaylle.

Rootin suljettu delegaatio on raja, jota gateway ei voi itse avata. Erillistä brokerin ylläpitäjärekisteriä tai credential brokeria ei suositella: se lisäisi toisen identiteetti-/roolitotuuden. Jos gatewayn laajempaa luottamusta ei hyväksytä, valitaan A:n root-hyväksyntä, ei näennäistä suojaa actor-kentillä.

### Kutsun elinkaari

1. Ylläpitäjä antaa GitHub-käyttäjänimen. Gateway hakee GitHubista numeerisen ID:n ja näyttää tunnistetun tilin vahvistettavaksi. Virhe tai epävarma haku ei synnytä kutsua. Broker ei saa verkkoyhteyttä eikä OAuth-tokeneita tätä varten.
2. Broker tallentaa vahvistetun ID:n kutsuttuna (`pending`). Nimi on näyttötietoa, ei pysyvä avain. Nimen vaihtuminen ei siirrä oikeutta toiselle tilille. Jaettava tavallinen palvelimen URL ei sisällä valtuuttavaa tokenia; viestin lähettää ylläpitäjä itse.
3. Vastaanottaja kirjautuu GitHubilla. ID:n pitää vastata kutsua. Broker tekee normaalit `ensure`-tarkistukset ja luo tilin vasta nyt. `accepted` tarkoittaa brokerin vahvistamaa sidontaa, **ei** valmista onboardingia, Google-suostumusta tai varmasti onnistunutta web-session luontia. Jos tokenin luovutus tai muu myöhempi kirjautuminen epäonnistuu, UI ei saa väittää koko kirjautumista onnistuneeksi.
4. Peruminen ennen kirjautumista estää liittymisen. Peruminen sen jälkeen katkaisee tästä kutsusta tulevan web-pääsyn ja siihen kuuluvat relaysessiot. Se ei poista Unix-tiliä, tiedostoja, SSH-avaimia eikä pysäytä kaikkea henkilön natiivityötä. Jos rootin admission yhä sallii henkilön, readback kertoo, ettei kutsun peruminen poistanut kokonaispääsyä.

Brokerin uusi kutsu-API ei saa olla `PublishAdmission` selaimen napin takana. Tarvitaan saman auktoriteetin alle uusi kestävä operaatiokokonaisuus, joka estää rinnakkaisen `ensure`/authorize-kilpailun, peruu vanhat sessiot ja keskeneräiset login-yritykset sekä todentaa uuden admissionin ennen onnistumista. Kesken jäänyt peruminen pysyy suljettuna myös restartissa; brokerin headia ei päivitä gateway. Host-apply ja runtime-kutsut eivät saa ohittaa toistensa lukkoa tai maintenance-fenceä. Toteutus on hyväksyttävä erikseen näillä ominaisuuksilla, ei pelkällä onnistuvan kutsun UI-testillä.

### Aloituspolku ei saa laajentaa henkilön oikeuksia

`onboarding.steps` on järjestetty polku: GitHub aina ensin, sen jälkeen repositoriot, integraatiot ja AI-tili valitussa järjestyksessä. GitHub-tunnistus/admission ei ole ohitettava onboarding-valinta. Repoaskel voi olla esivalittu, automaattinen checkout tai ohitettu. Checkout suoritetaan vasta henkilön aloittaman polun aikana hänen daemonissaan ja hänen gh-oikeuksillaan; epäselvää tulosta ei toisteta automaattisesti. Puuttuva repo-oikeus tarjoaa virheen ja tien jatkaa, ei root-clonea tai yhteistunnusta.

`onboarding.repositories.defaults` sisältää repo-tunnisteet ja esivalinta/auto-checkout-tavan, ei mielivaltaisia komentoja tai koti-/checkout-polkuja. `onboarding.repositories.stale_after_days` suodattaa valitsimen, ei poista repositorioita tai pääsyoikeutta. [github_repos_linux.go](../../internal/daemon/github_repos_linux.go), `nativeRepo.project`, välittää nyt GitHubin `pushed_at`-ajan; se ei todista viimeisimmän commitin aikaa. Toteutuksessa suodatin on joko nimettävä viimeisimmän pushin mukaan tai hankittava commit-ajalle oikea tietolähde. Tuntematonta aikaa ei esitetä todistetusti vanhana; oletusrepo ei katoa huomaamatta suodattimeen.

`onboarding.integrations` määrittää required/optional/off-esityksen, ei uusia tokeneita tai palveluntarjoajan valtuuksia. `off` jättää askeleen pois, ei poista henkilön natiivia yhteyttä. Asennuksen pitää tarjota Google-työkalut ja app-asetukset ennen kuin sitä voi esittää käytettävänä. Muuten konfigurointi kertoo puuttuvan edellytyksen, ei näytä kuviteltua toimivaa yhteyttä.

Sisarbriefin ”aina tapa jatkaa” vuoksi suosittelen, että `required` tarkoittaa näkyvää, pyydettyä tehtävää, jonka voi siirtää myöhemmäksi — **ei** pääsyvaatimusta eikä takeita siitä, että suostumus pysyy voimassa. UI:n on sanottava tämä rehellisesti. Jos Jari tarkoittaa pakollisuudella käytön estämistä, se on erillinen tuotesääntö; tämä ehdotus ei ota sitä huomaamatta käyttöön. AI-tilin avain jää Pi:n omaan storeen. Sivuston asetuksen muutos koskee seuraavaa uutta polkua, ei tee valmiille käyttäjille uusia checkoutteja tai integraatiokirjautumisia taustalla.

## CLI-ehdotus (ei vielä olemassa)

Nykyiset `host plan/apply` ja `admin settings/users/role` säilyvät. Uudet resurssit ovat ehdotus, eivät nyt suoritettavia ohjeita:

```text
open-habitat admin onboarding show --json
open-habitat admin onboarding update --file <selective-update.json> --expected-version <version> --dry-run --json
open-habitat admin invitations list --json
open-habitat admin invitations show <github-id> --json
open-habitat admin invitations create --github-id <confirmed-id> --idempotency-key <key> --dry-run --json
open-habitat admin invitations delete <github-id> --expected-version <version> --dry-run --json
```

CLI käyttää vahvistettua numeerista ID:tä; agentti voi ratkaista käyttäjänimen GitHubista ennen tätä. Selain tarjoaa yllä kuvatun nimihakuvaiheen. `delete` peruu kutsun oikeuden, ei poista henkilön tiliä tai hävitä tarvittavaa perumistilaa. Rootin paikallinen `admin`-polku käyttää samoja sääntöjä; suljetun delegoinnin ohitus tapahtuu vain tietoisella host-policy-muutoksella, ei piilossa CLI:n root-oikeuden perusteella.

`update --file -` lukee stdinistä ja muuttaa vain nimetyt kentät; listat korvataan kokonaisina, `steps`-järjestystä ei lajitella. Readback palauttaa version ja omistajan/lähteen. Rinnakkainen muutos aiheuttaa version konfliktin, ei viimeinen kirjoittaja voittaa -hiljaisuutta. Kaikki mutaatiot tarjoavat aidon read-only dry-runin; se ei varaa GitHub-identiteettiä tai takaa tulevan kirjautumisen onnistumista. Puuttuva broker tai epävarma vastaus on unavailable/unknown, ei tyhjä kutsulista tai lupa automaattiseen uusintayritykseen. Pitkä perumisoperaatio tarvitsee operaation ID:n ja `show`-readbackin eikä pidä JSON-kutsua rajatta auki. Tarkat streaming-/komentomuodot ratkaistaan toteutuksen CLI-suunnittelussa kanonin mukaisesti.

Asennusagentin järjestys olisi: toimita provider-app-syötteet ja rootin site-policy → host plan/apply → `admin onboarding update` ja readback → ensimmäisen ylläpitäjän oma kirjautuminen ja nykyinen roolikonvergenssi → myöhemmät kutsut. Ei yhteisiä Google- tai AI-tunnuksia eikä henkilön suostumuksen automatisointia.

## Hyväksymisen jälkeen tarvittava näyttö

Tämä työ ei muuta tuotantoa eikä väitä prototyypin todistavan turvarajoja. Toteutuksen pitää todistaa ainakin:

- tavallinen käyttäjä, vieras UID ja poistettu ylläpitäjä eivät muuta polkua tai kutsuja; rootin sulkema delegaatio kestää myös gateway-UID:ltä tulevan pyynnön;
- GitHub-nimen vaihtuminen, väärä kirjautuva ID, päällekkäinen kutsu ja saman idempotenssiavaimen uusinta eivät vaihda tai monista oikeutta;
- host-konvergenssi ei kadota runtime-kutsuja tai palauta onboarding-asetuksia; oikeuksien lähteet ja delegaation sulkemisen vaikutus näkyvät suunnitelmassa;
- kutsun perumisen kilpailu loginin, token handoffin ja jo auki olevien terminal/editor-yhteyksien kanssa sekä restart jokaisessa kestävän transaktion vaiheessa pysyvät suljettuina;
- kahden eri UID:n kotien eristys, kiintiöt ja normaalit brokerin epoch/binding-tarkistukset säilyvät; testi ei korvaa tätä saman UID:n HTTP-mockilla;
- repo- ja integraatioaskeleiden virheestä voi jatkaa ilman toista checkoutia, yhteistunnusta tai epävarman kirjoituksen automaattista uusintaa. Google-suostumus todistetaan vasta oikean suostuvan henkilön kokeella.

## Päätöksen tila

Suositus on C. Mitään vaihtoehtoa ei ole hyväksytty eikä delegaatiota lisätty. Issue jää `in-progress` / `preparation: pending` odottamaan Jarin valintaa. Jos C hyväksytään, ensin täsmennetään brokerin kutsu-/perumistransaktion protokolla ja testattava turvallisuussopimus; vasta sitten toteutetaan yhdessä hyväksyttyjen henkilö- ja ylläpitoprototyyppien kanssa.

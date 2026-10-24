# Palvelimen ylläpito › integraatiot

## Kierros 5 · Dropboxin ohjattu asetus

**Suositus: Sivu kerrallaan.** *Aseta tunnukset…* Dropboxin rivillä avaa saman Vaiheittain-dialogin kuin Googlella ja Microsoftilla. Vaiheita on neljä, yksi kutakin Dropbox App Consolen sivua kohti: *Luo sovellus*, *Asetukset*, *Käyttöoikeudet* ja *Tunnukset*. App key ja App secret kysytään lopussa, kuten kierroksen 4 päätöksessä. Ensimmäisessä vaiheessa on suora linkki konsolin sivulle, jolla sovellus luodaan. Kehitystilan *Enable additional users* on Asetukset-vaiheessa, koska se on samalla Settings-sivulla kuin uudelleenohjausosoite. 50 henkilön sääntö näkyy myöhemmin rivin *Tunnukset*-valikossa. Sääntö tulee vastaan kuukausien päästä, joten valikko on paikka, jonne ylläpitäjä silloin katsoo.

**[Avaa kierros 5](https://glasspad.example.test/p/f3cv5ap6h4r6y6qbcz3rue5f2a/).** Suunta vaihdetaan alareunan valitsimesta (myös 1–2, nuolet ja R). Integraatiot-välilehti on kierroksen 2 suunta *Käytössä vai ei* sellaisenaan. Esimerkkipalvelimet ovat *Microsoft asetettu* (lähtötilanne, Dropbox puuttuu), *Kaikki asetettu* ja *Vajaa asennus* (rclone puuttuu). Kaikki tiedot ovat keksittyjä.

### Mitä koodi vaatii

Lähteet: `internal/daemon/integrations/dropbox_linux.go` ja `catalog_linux.go`.

- **Scoped access, Full Dropbox.** Synkronointi käsittelee juurta `dropbox:` ja kansiovalinta on koko Dropbox (`Folders()` → *Dropbox*). App folder -sovelluksella henkilö näkisi vain sovelluksen oman kansion. Muita sovellustyyppejä Dropbox ei enää tarjoa.
- **Käyttöoikeudet:** `dropboxScopes` pyytää seitsemää käyttäjätason oikeutta: `account_info.read`, `files.metadata.read`, `files.metadata.write`, `files.content.read`, `files.content.write`, `sharing.read` ja `sharing.write`. Kirjautumisosoite pyytää ne kaikki nimeltä, joten jokaisen on oltava sovelluksessa päällä. Tiimioikeuksia (`team_data.*`, `members.*`) ei pyydetä. Tiimisovellusta ei tarvita, ja Dropbox Businessin jäsen yhdistää oman tilinsä samalla sovelluksella.
- **Uudelleenohjaus:** täsmälleen `http://localhost:53682/` (`dropboxRedirect`). Henkilö liittää selaimen lopullisen osoitteen dialogiin, joten palvelimelle ei tarvita kuuntelijaa eikä julkista osoitetta.
- **PKCE ja salaisuus:** valtuutus käyttää PKCE:tä (S256), mutta koodin vaihto ja rclonen myöhemmät token-päivitykset lähettävät myös `client_secret`in. App secret tarvitaan siis aina. *Allow public clients* -asetukseen ei kosketa.
- **Kehitystila:** uuteen sovellukseen voi yhdistää vain sen omistaja, kunnes valitaan *Enable additional users*. Ilman tätä jokaisen muun henkilön yhdistäminen epäonnistuu. Kehitystilassa voi olla enintään 500 käyttäjää. Kun 50 on yhdistänyt, tuotantotila on haettava ja saatava kahdessa viikossa, muuten uudet yhdistämiset jäädytetään. Dropbox ei käsittele hakemusta ennen kuin 50 käyttäjää on yhdistänyt.
- **Tunnukset:** App key ja App secret. `dropboxApp()` hyväksyy kummallekin 1–256 merkkiä `[A-Za-z0-9_-]`, ja prototyyppi tarkistaa saman. Lisäksi se huomaa, jos sama arvo on liitetty molempiin kenttiin (*Tämä on sama kuin App key.*). Salaisuuskenttä on salasanakenttä, ja palvelin palauttaa vain App keyn alun.
- **Ei vaihtoa:** Dropbox ei anna ylläpitäjän luoda uutta App secretiä itse. Avaimet vaihtaa vain Dropboxin tuki. Kierroksen 3 sääntö (vaihto = uusi salaisuus, tai vaihdettavaa ei ole) tarkoittaa siis, että valikossa on vain *Poista tunnukset…*, kuten Microsoftilla. Poistodialogi lisää rivin *Yhdistettyjen tilien synkronointi pysähtyy.*, koska synkronointi ajetaan vain, kun integraatio on käytettävissä (`catalog_linux.go`, `SyncEntry`).
- **Organisaatio:** Dropbox-sovellus kuuluu aina sille tilille, jolla se luodaan. Tiimi ei voi omistaa sovellusta, ja omistajan vaihtaa vain Dropboxin tuki. Ohje pyytää luomaan sovelluksen organisaation Dropbox-tilillä.

### Vaiheet ja konsolin sanat

| Vaihe | App Consolessa (englanniksi) |
| --- | --- |
| Luo sovellus | Linkki `https://www.dropbox.com/developers/apps/create`. *Choose an API: Scoped access*, *Choose the type of access you need: Full Dropbox*, *Name your app: Open Habitat &lt;organisaatio&gt;* (yksilöllinen, ei sanaa Dropbox eikä alkua "drop"), *Create app* |
| Asetukset (suunta 2) / Uudelleenohjaus (suunta 1) | *Settings › OAuth 2 › Redirect URIs*: `http://localhost:53682/` › *Add*; suunnassa 2 myös *Development users › Enable additional users* |
| Käyttöoikeudet | *Permissions*: seitsemän oikeutta yhtenä kopioitavana lohkona, *Submit*. `account_info.read` on valmiina. |
| Käyttäjät (vain suunta 1) | *Settings › Development users › Enable additional users*, rajat 500 ja 50 sekä kaksi viikkoa |
| Tunnukset | *Settings*: App key, App secret (*Show*) |

**Haku:** App Consolessa ei ole hakukenttää kuten Entrassa. Permissions-sivu on pitkä luettelo valintaruutuja, joten ohje neuvoo etsimään oikeuksien nimet selaimen haulla (Ctrl+F tai ⌘F). Muuten suora linkki vie perille: luonnin jälkeen Dropbox avaa sovelluksen Settings-sivun, jonka välilehtiä vaiheet käyttävät.

**Järjestys:** oikeudet asetetaan ennen tallennusta. Dropbox ei lisää myöhemmin päälle laitettua oikeutta jo yhdistettyihin tileihin, joten jälkikäteen korjattu puuttuva oikeus vaatisi jokaiselta uuden yhdistämisen. Ohje sanoo tämän yhdellä rivillä.

En pystynyt tarkistamaan konsolia itse. Polut ja painikkeiden nimet ovat Dropboxin dokumentaatiosta (lähteet alla). *Development users* -rivin otsikko ja tuotantotilan hakupainikkeen tarkka nimi ovat dokumentaatiossa vain kuvailtuja (*app's info page*, *Enable additional users*), joten ohje ei nimeä hakupainiketta.

### Suunnat

Akseli: missä Dropboxin kehitystila hoidetaan. Tämä on ainoa aidosti Dropboxille ominainen valinta. Sovellustyyppi, pääsy, oikeudet ja osoite tulevat koodista, ja tunnukset kysytään lopussa kierroksen 4 päätöksen mukaan.

| Suunta | Vaiheet | Hyöty | Hinta |
| --- | --- | --- | --- |
| **1. Käyttäjävaihe** | Luo sovellus → Uudelleenohjaus → Käyttöoikeudet → Käyttäjät → Tunnukset | Kehitystila ja sen rajat (500, 50, kaksi viikkoa) sanotaan kerran ja selvästi. | Viisi vaihetta, joista kaksi samalla Settings-sivulla. Raja unohtuu, kun dialogi suljetaan. |
| **2. Sivu kerrallaan** (suositus) | Luo sovellus → Asetukset → Käyttöoikeudet → Tunnukset | Neljä vaihetta, yksi konsolisivu kerrallaan. 50 henkilön sääntö pysyy rivin *Tunnukset*-valikossa. | Rajat eivät näy ohjeessa. Valikon rivi on kiinteä muistutus, koska palvelin ei tiedä Dropboxin tilaa tai yhdistäjien määrää. |

Kummassakin *Minulla on jo sovellus* vie suoraan kenttiin (1/1 Tunnukset), ja *Takaisin* palaa ensimmäiseen vaiheeseen.

### Kokeile

1. Suunta 2: *Aseta tunnukset…* Dropboxille. Avaa konsolilinkki ja kulje vaiheet. Syötä *Tunnukset*-vaiheessa sama arvo molempiin kenttiin, tai App secretiksi välilyönnin sisältävä arvo. Esimerkiksi `p3n8vq1zt6ka0rw` ja `h2m5c9xj4ub7ye1` kelpaavat.
2. *Tallenna* → *Odottaa palvelinta* → *Käytössä*. Avaa *Tunnukset*-valikko: siinä on App keyn alku, 50 henkilön muistutus ja vain *Poista tunnukset…*.
3. Suunta 1: *Käyttäjät*-vaihe ja rajat. Valikossa ei ole muistutusta.
4. *Kaikki asetettu*, *Vajaa asennus* (rclone puuttuu, joten myös Google ja Microsoft ovat poissa käytöstä) ja 390 px.

### Kysymykset Jarille

1. **Käyttäjävaihe vai Sivu kerrallaan?**
2. **Vain *Poista tunnukset…*:** Dropbox ei anna vaihtaa salaisuutta itse, joten Vaihda-toimintoa ei ole. Riittääkö tämä, kuten Microsoftilla?
3. **Sovelluksen omistaja:** Dropbox-sovellus kuuluu aina yhdelle tilille, ei tiimille. Sopiiko ohjeen neuvo luoda sovellus organisaation Dropbox-tilillä? Jos tili myöhemmin suljetaan, sovellus menee mukana, ja omistajan vaihtaa vain Dropboxin tuki.

### Toteutukselle (`server-integrations-admin`)

- Broker tarkistaa App keyn ja App secretin samalla säännöllä kuin `dropboxApp()` ja lisäksi, että ne eroavat. Palvelin palauttaa selaimelle vain App keyn.
- `Commit()` kopioi App keyn ja App secretin jokaisen henkilön rclone-asetukseen (`~/.config/rclone/open-habitat-dropbox/<tili>.conf`). Kun sovellus poistetaan ja tilalle asetetaan toinen, vanhat yhdistämiset käyttävät edelleen vanhaa sovellusta, ja henkilöiden on yhdistettävä uudelleen. Poistodialogi ja käyttöönoton ohje voisivat sanoa tämän, jos Jari haluaa toisen sovelluksen polun tueksi.
- `docs/operations.md`:n *Dropbox app registration* vastaa jo tätä ohjetta (Full Dropbox, seitsemän oikeutta, osoite, Enable additional users). Muutosta ei tarvita, ennen kuin selainasetus korvaa käsin muokattavan `integrations.json`in.

### Oletukset, ei toteutuspäätöksiä

- App key on julkinen, koska se on jokaisessa kirjautumisosoitteessa. Valikko näyttää sen neljä ensimmäistä merkkiä. Esimerkkiavaimet ovat keksittyjä 15 merkin merkkijonoja. Dropbox ei dokumentoi avainten muotoa.
- Palvelimen vahvistus on edelleen 0,9 sekunnin viive. Palvelin ei tiedä, onko *Enable additional users* valittu, onko oikeudet asetettu tai onko sovellus tuotantotilassa. Puuttuva asetus näkyy vasta, kun henkilö yhdistää.
- Tarkistamatta: Dropbox Businessin tiimitilassa (*team space*) rclone näkee ilman `root_namespace`-asetusta todennäköisesti vain henkilön oman kansion, ei tiimin yhteisiä kansioita. Tämä koskee synkronointia eikä ylläpitäjän asetusta, joten se jää tämän kierroksen ulkopuolelle.
- Googlen ja Microsoftin *Aseta tunnukset…* ovat tällä kierroksella paikkamerkkejä.

### Lähteet

- Sovelluksen luonti App Consolessa, *Scoped access*, App folder vs. Full Dropbox, kehitys- ja tuotantotila, *Enable additional users*, 500/50 käyttäjää ja kaksi viikkoa, Permissions-välilehti: https://docs.dropboxapi.com/dropbox-api/docs/developer-resources/developer-guide
- App Consolen kentät (App key, App secret, *Show*, *OAuth 2 Redirect URIs*, *Add*, *Development users*, *Allow public clients*, Permissions ja Submit): https://docs.dropboxapi.com/dropbox-api/docs/get-started/tutorial/app-console
- OAuth: täsmälleen rekisteröity `redirect_uri`, App folder ja Full Dropbox, PKCE, `token_access_type=offline`: https://docs.dropboxapi.com/dropbox-api/docs/oauth
- Sovelluksen oikeudet ovat pyydettävien oikeuksien yläraja, ja myöhemmin lisätty oikeus ei tule jo yhdistettyihin tileihin: https://dropbox.tech/developers/customizing-scopes-in-oauth-flow
- Avainten vaihto ja omistajan siirto vain tukipyynnöllä ("open an API support ticket"); vaihto ei mitätöi olemassa olevia tokeneita: https://www.dropbox.com/developers/support
- Sovelluksen nimi: ei sanaa Dropbox, ei alkua "drop": https://docs.dropboxapi.com/dropbox-api/docs/developer-resources/branding-guide
- rclonen oma Dropbox-sovellus: luontisivu `https://www.dropbox.com/developers/apps/create`, Full Dropbox, yksilöllinen nimi, `http://localhost:53682/`, App key = `client_id`, App secret = `client_secret`: https://rclone.org/dropbox/
- Vaiheiden nimet *Choose an API: Scoped access*, *Choose the type of access you need* ja *Name your app*: https://docs.n8n.io/integrations/builtin/credentials/dropbox

### Näyttö

[evidence](evidence/) sisältää `r5-`-alkuiset kuvakaappaus/staattinen HTML -parit: `create-1`, `users-1`, `settings-2` ja `menu-2` (1440/390, vaalea/tumma), `permissions-1`, `enter-1`, `enter-2`, `saved-2`, `menu-1`, `remove-1` ja `partial-1`.

Tarkistukset:

- `check.mjs`: 44 tarkistuspistettä kahdella suunnalla, 1440 ja 390 px, vaalea ja tumma. Mukana:
  - yhteinen `picker-check.mjs`, valitsimen näppäimet, URL ja R
  - oikeudet ja uudelleenohjausosoite luettuina suoraan `dropbox_linux.go`:sta ja verrattuina ohjeeseen sekä PKCE + salaisuus ja juuren `dropbox:` synkronointi koodista
  - konsolilinkki, Scoped access, Full Dropbox, nimisääntö, *Enable additional users* ja suunnan 1 rajat
  - vaiheiden järjestys kummassakin suunnassa
  - muotovirheet ja sama arvo kahdesti ilman lähetystä, ja virheen poistuminen korjattaessa
  - *Odottaa palvelinta* → *Käytössä* ja käyttöönoton merkki
  - valikossa vain Poista, 50 henkilön muistutus vain suunnassa 2, poiston teksti, *Minulla on jo sovellus*, puuttuva rclone

  Ei konsolivirheitä eikä vaakaylivuotoa. Tulos `evidence/r5-checks.json`, julkaistulla sivulla `evidence/r5-hosted-checks.json`.
- Yhteinen `design-system/prototypes/check.mjs` hyväksyi sivun (6 kuvaa, ei virheitä), ja `picker-check.test.mjs` meni läpi.

Synteettinen selainprototyyppi. Se ei testaa daemonia, brokeria, Dropboxia eikä oikeaa `integrations.json`ia. Tuotantotiedostoja ei muutettu.

Lähde: `design-system/prototypes/rounds/2026-10-24-palvelin-integraatiot-5/`:

```sh
node design-system/prototypes/rounds/2026-10-24-palvelin-integraatiot-5/build.mjs
node design-system/prototypes/rounds/2026-10-24-palvelin-integraatiot-5/check.mjs \
  design-system/prototypes/dist/server-integrations-r5-space/offline.html /var/tmp/server-integrations-r5-evidence
```

Julkaise vain rakennettu `index.html`.

## Kierros 4 · Microsoft 365:n ohjattu asetus

**Suositus: Tunnukset heti.** *Aseta tunnukset…* Microsoft 365:n rivillä avaa kierroksen 3 Vaiheittain-dialogin. Viisi vaihetta: *Rekisteröi sovellus*, *Tunnukset*, *Julkinen asiakas*, *Käyttöoikeudet* ja *Hyväksyntä*, jonka lopussa on *Tallenna*. Entra avaa sovelluksen Overview-sivun heti, kun ylläpitäjä valitsee *Register*, ja molemmat tarvittavat arvot ovat siinä. Siksi ne kysytään toisena vaiheena, kun sivu on jo auki. Hyväksyntävaihe voi silloin näyttää valmiin linkin ylläpitäjälle, jolla on oikeus hyväksyä. Tallennus on silti viimeisenä, joten kukaan ei yritä yhdistää puoliksi asetettuun sovellukseen.

**[Avaa kierros 4](https://glasspad.example.test/p/5kr3poyu5hscj6hk565dng5fsa/).** Suunta vaihdetaan alareunan valitsimesta (myös 1–2, nuolet ja R). Integraatiot-välilehti on kierroksen 2 suunta *Käytössä vai ei* sellaisenaan. Esimerkkipalvelimet ovat *Google asetettu* (lähtötilanne), *Microsoft asetettu* ja *Vajaa asennus*. Kaikki tiedot ovat keksittyjä.

### Mitä koodi vaatii (ja mikä poikkeaa Googlesta)

Lähteet: `internal/daemon/integrations/microsoft_linux.go` ja `microsoft_files_linux.go` sekä `runtime/profiles/integrations/microsoft-native.mjs`.

- **Ei salaisuutta.** `MicrosoftApp` on julkinen asiakas, jossa on vain `client_id` ja `tenant_id`. Henkilö kirjautuu laitekoodilla (`/devicecode` ja `/token` ilman salaisuutta), ja rclone ja MCP-palvelin saavat vain client id:n. Lomakkeessa ei siis ole salaisuuskenttää, ja ohje sanoo, ettei client secretiä luoda.
- **Vain organisaatio = single tenant ja tenant ID.** Kierroksen 3 *Internal*-päätöstä vastaa Entrassa *Supported account types: Single tenant only - &lt;organisaatio&gt;*. Single tenant -sovellus ei voi käyttää `common`-osoitetta (AADSTS50194), joten `tenant_id` on organisaation **Directory (tenant) ID**. `microsoftApp()` hyväksyy sen jo (GUID), samoin `microsoft-native.mjs`, eikä koodia tarvitse muuttaa. Kierroksen 1 kenttä *Kirjautujat* (`common` / `organizations` / `consumers`) poistuu: ylläpitäjä ei valitse yleisöä.
- **Käyttöoikeudet:** `microsoftScopes` ja `microsoftMCPScopes` yhdistettyinä ja ilman kaksoiskappaleita, kymmenen *delegated*-oikeutta Microsoft Graphiin: `openid`, `profile`, `User.Read`, `offline_access`, `Files.ReadWrite.All`, `Sites.ReadWrite.All`, `Mail.ReadWrite`, `Mail.Send`, `Calendars.ReadWrite` ja `Contacts.ReadWrite`. Sovellusoikeuksia (*application permissions*) ei tarvita.
- **Julkinen asiakas:** laitekoodi toimii vain, kun *Allow public client flows* on päällä.
- **Uudelleenohjausosoite:** laitekoodi ei tarvitse sitä. `microsoftConsent()` kuitenkin nimeää osoitteen `https://login.microsoftonline.com/common/oauth2/nativeclient` linkissä, jonka henkilö näkee, kun hyväksyntä puuttuu (virheet 65001, 65004 ja 90094). Ohje lisää osoitteen alustalle *Mobile and desktop applications*, jotta linkki toimii.
- **Hyväksyntä:** ohje pyytää *Grant admin consent for &lt;organisaatio&gt;*, jotta henkilöiltä ei kysytä mitään. Organisaation käyttäjäsuostumusasetus voi muuten estää henkilöä hyväksymästä esimerkiksi oikeutta kaikkiin tiedostoihin.
- **Vaihto:** vaihdettavaa salaisuutta ei ole. Kierroksen 3 sääntö (vaihto = uusi salaisuus, toinen asiakas poistamalla ja asettamalla uudelleen) tarkoittaa Microsoftille, että *Tunnukset*-valikossa on vain *Poista tunnukset…*. Valikon otsikko on *Microsoft Entra · client id `3f2a91c4-…` · asettaja ja päivä*, ja poistodialogi lisää rivin *Toisen sovelluksen voi asettaa poiston jälkeen.*
- **Tunnukset:** Application (client) ID ja Directory (tenant) ID, kumpikin muodossa 8-4-4-4-12 kuten `microsoftID`. Väärä muoto kerrotaan kentässä, ja virhe poistuu, kun kenttää korjataan. Jos molempiin liitetään sama arvo, virhe on *Tämä on sama kuin client id.* Tämä on todennäköisin liittämisvirhe, koska molemmat arvot ovat samalla Overview-sivulla. Tallennuksen jälkeen näkyy *Odottaa palvelinta…* ja sitten *Käytössä*, ja käyttöönoton merkistä poistuu *piilossa*, kuten Googlella.

### Vaiheet ja Entran sanat

| Vaihe | Entrassa (englanniksi, kuten Microsoft Learn) | Rooli |
| --- | --- | --- |
| Rekisteröi sovellus | *Entra ID › App registrations › New registration*: Name *Open Habitat*, *Supported account types: Single tenant only - &lt;organisaatio&gt;*, Redirect URI tyhjä, *Register* | vähintään Application Developer |
| Tunnukset | *Overview*: Application (client) ID ja Directory (tenant) ID | |
| Julkinen asiakas | *Authentication › Settings › Allow public client flows: Enabled › Save* ja *Authentication › Redirect URI configuration › Add Redirect URI › Mobile and desktop applications*: `…/common/oauth2/nativeclient` | |
| Käyttöoikeudet | *API permissions › Add a permission › Microsoft Graph › Delegated permissions*, kymmenen oikeutta yhtenä kopioitavana lohkona, *Add permissions* (User.Read on valmiina) | |
| Hyväksyntä | *API permissions › Grant admin consent for &lt;organisaatio&gt; › Yes*; Status: *Granted for &lt;organisaatio&gt;*. Jos rooli puuttuu: `https://login.microsoftonline.com/{tenant}/adminconsent?client_id={client}` | Cloud Application Administrator, Application Administrator tai Privileged Role Administrator |

Learnin vanhemmat sivut puhuvat yhä nimillä *Accounts in this organizational directory only*, *Add a platform* ja *Advanced settings › Allow public client flows: Yes*. Prototyyppi käyttää uusimpia sivuja (päivätty 2026). En pystynyt tarkistamaan konsolia itse.

### Suunnat

Akseli: missä kohtaa Vaiheittain-ohjetta ylläpitäjä syöttää tunnukset. Muuta aidosti Microsoftille ominaista valintaa ei ollut. Yleisö on päätetty (vain organisaatio), salaisuutta ei ole, ja kaikki konsolin asetukset tulevat koodista.

| Suunta | Järjestys | Hyöty | Hinta |
| --- | --- | --- | --- |
| **1. Tunnukset lopussa** | Rekisteröi → Julkinen asiakas → Käyttöoikeudet → Hyväksyntä → Tunnukset | Sama järjestys kuin Googlella | Ylläpitäjän pitää palata Overview-sivulle lopuksi. Hyväksyntälinkki on vain malli `{Directory (tenant) ID}` / `{Application (client) ID}`. |
| **2. Tunnukset heti** (suositus) | Rekisteröi → Tunnukset → Julkinen asiakas → Käyttöoikeudet → Hyväksyntä + *Tallenna* | Arvot kopioidaan siltä sivulta, jolle Entra juuri avautui. Hyväksyntälinkki on valmis ja kopioitavissa. Väärä ID huomataan ennen konsolityötä (*Seuraava* tarkistaa muodon). | Tallenna-painike on eri vaiheessa kuin kentät. Järjestys poikkeaa Googlesta. |

Kummassakin *Minulla on jo sovellus* vie suoraan kenttiin (1/1 Tunnukset), ja *Takaisin* palaa ensimmäiseen vaiheeseen.

### Kokeile

1. Suunta 2: *Aseta tunnukset…* Microsoft 365:lle. Valitse *Seuraava*, ja syötä tenant ID:ksi `contoso.onmicrosoft.com` tai sama arvo kuin client id:ssä. Esimerkiksi `5b7e0d3a-91c2-4f68-a4d1-2c9e8f60b7a3` ja `e04c61f9-3b8d-4a27-9f5e-7d1a2c48b903` kelpaavat.
2. Kulje loppuun: hyväksyntävaiheen linkissä ovat juuri syötetyt arvot. *Tallenna* → *Odottaa palvelinta* → *Käytössä*.
3. *Tunnukset*-valikko Microsoftin rivillä: vain *Poista tunnukset…*.
4. Suunta 1: sama, ja hyväksyntälinkki on malli.
5. *Minulla on jo sovellus*, *Vajaa asennus* (`ms-365-mcp-server` puuttuu) ja 390 px.

### Kysymykset Jarille

1. **Tunnukset lopussa vai Tunnukset heti?**
2. **Microsoftilla ei ole Vaihda-toimintoa,** koska vaihdettavaa salaisuutta ei ole. Riittääkö pelkkä *Poista tunnukset…*?
3. **Henkilökohtaiset Microsoft-tilit (Outlook.com, OneDrive Personal) jäävät pois,** koska yleisö on vain organisaatio. Nykyinen koodi ja `docs/operations.md` olettavat monen organisaation ja henkilökohtaisten tilien sovelluksen (`common`) ja tukevat OneDrive Personalia. Hyväksytkö, että ylläpitäjän ohjattu asetus tukee vain organisaation tilejä, kuten Googlella?
4. **Hyväksyntä osana ohjetta:** sopiiko, että ohje pyytää organisaation hyväksyntää aina, eikä sitä jätetä henkilöiden omaksi hyväksynnäksi?

### Toteutukselle (`server-integrations-admin`)

- Broker tallentaa `tenant_id`:ksi Directory (tenant) ID:n GUIDina, ei arvoa `common`. Selaimen tarkistus on sama kuin `microsoftApp()`, ja lisäksi client id ≠ tenant id.
- `microsoftConsent()` muodostaa linkin aina osoitteeseen `/organizations/v2.0/adminconsent`. Kun `TenantID` on GUID, linkin pitäisi käyttää samaa tenanttia. Toimiiko `organizations` single tenant -sovellukselle, on tarkistamatta.
- `docs/operations.md`:n *Microsoft app registration* -osio kuvaa monen organisaation ja `common`-yleisön asetuksen. Se päivitetään, jos kysymykseen 3 vastataan kyllä.

### Oletukset, ei toteutuspäätöksiä

- Molemmat ID:t ovat julkisia (ne ovat jokaisessa kirjautumisosoitteessa), joten palvelin voi palauttaa ne kokonaan. Valikko näyttää client id:n ensimmäisen ryhmän.
- Palvelimen vahvistus on edelleen 0,9 sekunnin viive. Palvelin ei tiedä, onko hyväksyntä annettu. Se selviää vasta henkilön kirjautuessa (`ConsentRequired`).
- Googlen ja Dropboxin *Aseta tunnukset…* ovat tällä kierroksella paikkamerkkejä.

### Lähteet

- Rekisteröinti, *Entra ID › App registrations › New registration*, *Single tenant only - &lt;your tenant&gt;*, Application Developer, Overview ja Application (client) ID: https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-register-app
- *Authentication › Settings › Allow public client flows* (Enabled/Disabled, julkinen asiakas ei vaadi salaisuutta), *Redirect URI configuration › Add Redirect URI*, Overview: Application (client) ID ja Directory (tenant) ID: https://learn.microsoft.com/en-us/azure/healthcare-apis/register-application
- Redirect URI -alustat ja *Mobile and desktop applications* -ehdotus `…/common/oauth2/nativeclient`: https://learn.microsoft.com/en-us/entra/identity-platform/how-to-add-redirect-uri
- Laitekoodi vaatii julkisen asiakkaan; *Accounts in this organizational directory only*, Application (client) ID ja Directory (tenant) ID: https://learn.microsoft.com/en-us/entra/identity-platform/scenario-desktop-app-configuration
- Laitekoodivirta ja tenant-parametri (`common`, `organizations`, `consumers` tai tenantin GUID): https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-device-code
- Authority ja yleisö: single tenant -sovellus käyttää tenant ID:tä, ja authorityn on vastattava kohtaa *Supported account types*: https://learn.microsoft.com/en-us/entra/identity-platform/msal-client-application-configuration
- `common` ei käy single tenant -sovellukselle (AADSTS50194): https://learn.microsoft.com/en-us/answers/questions/960066/aad-returned-an-error-response-case-usage-of-the-c
- *API permissions › Add a permission › Microsoft Graph › Delegated permissions › Add permissions*, *Grant admin consent for {your tenant}* ja *Granted for*: https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-configure-app-access-web-apis
- Hyväksynnän roolit ja linkki `…/{organization}/adminconsent?client_id=…`: https://learn.microsoft.com/en-us/entra/identity/enterprise-apps/grant-admin-consent
- Käyttäjäsuostumuksen asetukset (oletuksena henkilö voi hyväksyä pääsyn omaan postiinsa, mutta ei kaikkiin organisaation tiedostoihin; *verified publishers* -politiikka): https://learn.microsoft.com/en-us/entra/identity/enterprise-apps/configure-user-consent

### Näyttö

[evidence](evidence/) sisältää `r4-`-alkuiset kuvakaappaus/staattinen HTML -parit: `register-1`, `consent-1`, `consent-2` ja `enter-2` (1440/390, vaalea/tumma), `enter-1`, `saved-2`, `menu-1` ja `remove-1`.

Tarkistukset:

- `check.mjs`: 32 tarkistuspistettä kahdella suunnalla, 1440 ja 390 px, vaalea ja tumma. Mukana:
  - yhteinen `picker-check.mjs`, valitsimen näppäimet, URL ja R
  - käyttöoikeudet ja uudelleenohjausosoite luettuina suoraan `microsoft_linux.go`:sta ja verrattuina ohjeeseen
  - single tenant, Allow public client flows, Delegated permissions, Grant admin consent ja roolit
  - ei salaisuuskenttää
  - vaiheiden järjestys kummassakin suunnassa ja hyväksyntälinkki mallina (suunta 1) ja tarkkana (suunta 2)
  - muotovirheet ja sama arvo kahdesti ilman lähetystä, ja virheen poistuminen korjattaessa
  - *Odottaa palvelinta* → *Käytössä* ja käyttöönoton merkki
  - valikossa vain Poista, poiston teksti, *Minulla on jo sovellus*, puuttuva työkalu

  Ei konsolivirheitä eikä vaakaylivuotoa. Tulos `evidence/r4-checks.json`, julkaistulla sivulla `evidence/r4-hosted-checks.json`.
- Yhteinen `design-system/prototypes/check.mjs` hyväksyi sivun (6 kuvaa, ei virheitä), ja `picker-check.test.mjs` meni läpi.

Synteettinen selainprototyyppi. Se ei testaa daemonia, brokeria, Entraa eikä oikeaa `integrations.json`ia. Tuotantotiedostoja ei muutettu.

Lähde: `design-system/prototypes/rounds/2026-10-24-palvelin-integraatiot-4/`:

```sh
node design-system/prototypes/rounds/2026-10-24-palvelin-integraatiot-4/build.mjs
node design-system/prototypes/rounds/2026-10-24-palvelin-integraatiot-4/check.mjs \
  design-system/prototypes/dist/server-integrations-r4-space/offline.html /var/tmp/server-integrations-r4-evidence
```

Julkaise vain rakennettu `index.html`.

## Kierros 3 · Googlen ohjattu asetus

**Suositus: Sivupaneeli.** *Aseta tunnukset…* avaa paneelin rivien viereen. Ylimpänä ovat Client ID, Client secret ja *Tallenna*, joten ylläpitäjä, jolla on jo asiakas, ei lue ohjetta lainkaan. Ohje on niiden alla neljänä avattavana kohtana, ja kopioitavat arvot ovat siinä. Rivi näkyy paneelin vieressä koko ajan, joten tila *Odottaa palvelinta* → *Käytössä* näkyy samalla, kun paneeli sulkeutuu. Puhelimessa paneeli korvaa listan, ja *‹ Integraatiot* palaa listaan.

**[Avaa kierros 3](https://glasspad.example.test/p/h5jrjw3ub7sxmdedylv42nyqnu/).** Suunta vaihdetaan alareunan valitsimesta (myös 1–3, nuolet ja R). Integraatiot-välilehti on kierroksen 2 suunta *Käytössä vai ei* sellaisenaan. Kaikki tiedot ovat keksittyjä.

### Mitä kaikissa suunnissa on samaa

Sisältö tulee daemonin koodista (`internal/daemon/integrations/google_linux.go`), ja konsolin sanat tulevat Googlen ohjeista (lähteet alla):

1. **API:t:** Gmail API, Google Calendar API, Google Drive API ja People API. Linkki *Ota käyttöön Google Cloudissa* avaa Googlen enableflow-sivun, jossa kaikki neljä ovat valmiina.
2. **Kohdeyleisö** (*Google Auth platform › Branding › Get started*): App name ja valinta *Internal* / *External*. Internal: vain organisaation Workspace-tilit, eikä Googlen vahvistusta tarvita. External: *Testing*-tilassa jokainen tili lisätään kohtaan *Audience › Test users* (enintään 100), ja kirjautuminen vanhenee 7 päivässä. *In production* -tilassa Gmail ja Drive ovat rajoitettuja käyttöoikeuksia, joten ne vaativat Googlen vahvistuksen ja vuosittaisen tietoturva-arvion.
3. **Käyttöoikeudet** (*Data Access › Add or Remove Scopes*): koodin kuusi scopea yhtenä kopioitavana lohkona.
4. **OAuth-asiakas** (*Clients › Create Client*): *Desktop app*, nimi *Open Habitat*. **Uudelleenohjausosoitetta ei lisätä.** Daemon käyttää osoitetta `http://localhost`, jonka henkilö liittää takaisin. Desktop-asiakkaalle konsoli kysyy vain nimeä, eikä palvelin tarvitse julkista callbackia. Varoitus: Google näyttää Client secretin vain kerran.
5. **Tunnukset:** Client ID (päättyy `.apps.googleusercontent.com`) ja Client secret. Väärä muoto kerrotaan kentässä, eikä mitään lähetetä. Tallennuksen jälkeen painike näyttää *Odottaa palvelinta…*, rivi *Odottaa palvelinta*, ja palvelimen vahvistuksen jälkeen ohje sulkeutuu, rivi näyttää *Käytössä* ja käyttöönoton merkistä poistuu *piilossa*.

**Vaihda tunnukset** (*Tunnukset*-valikosta) kysyy ensin, mitä vaihdetaan:

- *Uusi salaisuus samalle asiakkaalle* (*Clients › Open Habitat › Add secret*): Client ID pysyy ja kysytään vain salaisuus. Ohjetta ei näytetä.
- *Uusi asiakas*: koko ohje.

Kummassakin lukee: *Yhdistetyt tilit käyttävät vanhaa salaisuutta / asiakasta, kunnes poistat sen Googlessa. Sen jälkeen niiden täytyy kirjautua uudelleen.* Tämä vastaa kierroksen 1 avoimeen oletukseen. Kun henkilö yhdistää tilin, daemon kirjoittaa asiakkaan ja salaisuuden hänen omaan rclone-konfiguraatioonsa ja gogin tunnuksiin (`googleLogin.Commit`). Vaihto koskee siis vain uusia kirjautumisia, ja vanhat yhteydet katkeavat vasta, kun vanha salaisuus tai asiakas poistetaan Googlessa.

**Korjaus kierroksiin 1–2:** Tunnukset-valikon otsikko näyttää nyt client id:n alun (`704213598812-…`, projektin numero), ei neljää viimeistä merkkiä. Googlen client id päättyy aina `.apps.googleusercontent.com`, joten loppu olisi aina `.com`.

### Suunnat

Akseli: miten ohje asettuu konsolityön rinnalle.

| Suunta | Muoto | Hyöty | Hinta |
| --- | --- | --- | --- |
| **1. Tarkistuslista** | Dialogi, jossa kaikki viisi kohtaa numeroituna ja kentät lopussa | Kaikki näkyy kerralla, ja sivua voi selata konsolin rinnalla | Pitkä. Kentät ovat alimpana, joten valmiin asiakkaan omistaja vierittää ohjeen ohi. Dialogi peittää rivin. |
| **2. Vaiheittain** | Dialogi, jossa yksi kohta kerrallaan, edistymispalkki (1/5…5/5), *Takaisin* / *Seuraava* sekä ensimmäisellä sivulla *Minulla on jo asiakas* | Vähiten tekstiä kerrallaan | Neljä painallusta kenttiin. Edellisen vaiheen arvo ei näy, kun konsolissa tarvitaan kahta kohtaa yhtä aikaa. |
| **3. Sivupaneeli** (suositus) | Avoin paneeli rivien vieressä. Ensin kentät, sitten avattava ohje. | Kentät ensin. Rivi ja sen tila pysyvät näkyvissä. Ei modaalia. | Leveällä näytöllä rivit kapenevat. Puhelimessa paneeli on oma näkymänsä. |

### Kokeile

1. Suunta 1, *Uusi asennus*: *Aseta tunnukset…* Googlelle. Vaihda *Internal* → *External* ja lue ero.
2. Kirjoita Client ID:ksi `abc` ja tallenna: virheet näkyvät kentissä. Kokeile oikealla muodolla, esimerkiksi `915508263417-a8d2kq0zr7m3vh1ts9pe5wybc6lfnjxu.apps.googleusercontent.com` ja salaisuus `GOCSPX-x`.
3. *Tunnukset* › *Vaihda tunnukset…*: oletuksena uusi salaisuus. Vaihda *Uusi asiakas* -vaihtoehtoon.
4. Suunta 2: kulje vaiheet läpi ja kokeile *Minulla on jo asiakas*.
5. Suunta 3: rivi näkyy paneelin vieressä tallennuksen ajan. 390 px:n leveydellä paneeli korvaa listan.

### Kysymykset Jarille

1. **Tarkistuslista, Vaiheittain vai Sivupaneeli?**
2. **Internal vai External:** riittääkö, että ohje kertoo molempien seuraukset, vai pitäisikö se suositella Internalia suoraan ja näyttää External vain, jos organisaatiolla ei ole Workspacea?
3. **Vaihda:** tarvitaanko valinta *uusi salaisuus / uusi asiakas*, vai riittääkö pelkkä uusi salaisuus? Toisen asiakkaan voi asettaa myös poistamalla tunnukset ja asettamalla ne uudelleen.
4. **Konsolin sanat englanniksi** (*Google Auth platform › Clients › Create Client*), kuten Googlen ohjeissa: kelpaako? Suomenkielistä konsolia en pystynyt tarkistamaan dokumentaatiosta.

### Oletukset, ei toteutuspäätöksiä

- Palvelin palauttaa client id:n kokonaan, koska se ei ole salaisuus: se näkyy jokaisessa kirjautumisosoitteessa. Salaisuus ei palaa koskaan.
- Internal/External on vain ohjeen valinta. Palvelin ei tallenna sitä eikä voi tietää sitä.
- Palvelimen vahvistus on edelleen 0,9 sekunnin viive. Palvelimen hylkäystä (esim. `integrations.browser_setup` pois päältä) ei ole tällä kierroksella.
- Selaimen muototarkistus on tiukempi kuin daemonin (`googleApp()` sallii `[A-Za-z0-9._-]`). Brokerin pitää tarkistaa sama muoto itse.
- Microsoft ja Dropbox ovat yhä paikkamerkkejä.

### Lähteet

- Suostumusnäkymän asetus, Internal/External, Test users ja Data Access: https://developers.google.com/workspace/guides/configure-oauth-consent
- OAuth-asiakas (*Clients › Create Client › Desktop app*): https://developers.google.com/workspace/guides/create-credentials
- API:en käyttöönotto ja enableflow-tunnisteet (`gmail.googleapis.com`, `calendar-json.googleapis.com`, `drive.googleapis.com`, `people.googleapis.com`): https://developers.google.com/workspace/guides/enable-apis
- Testing-tila: 100 testikäyttäjää, 7 päivän vanheneminen, *Publish app*: https://support.google.com/cloud/answer/15549945 ja https://developers.google.com/identity/protocols/oauth2 (refresh token -vanheneminen)
- Client secret näkyy vain luotaessa, *Add Secret*, *Disable*: https://support.google.com/cloud/answer/15549257
- Vahvistuksen poikkeukset (sisäinen käyttö, testaus, alle 100 käyttäjää): https://support.google.com/cloud/answer/13464323
- Rajoitettujen käyttöoikeuksien vuosittainen tietoturva-arvio: https://support.google.com/cloud/answer/13464321
- Rajoitetut scopet: `gmail.modify` https://developers.google.com/workspace/gmail/api/auth/scopes ja `drive` https://developers.google.com/workspace/drive/api/guides/api-specific-auth
- Desktop-asiakkaan loopback-osoite ja OOB-kopioinnin poisto: https://developers.google.com/identity/protocols/oauth2/native-app ja https://developers.google.com/identity/protocols/oauth2/resources/loopback-migration

### Näyttö

[evidence](evidence/) sisältää `r3-`-alkuiset kuvakaappaus/staattinen HTML -parit: `guide-1…3` (kaikki suunnat 1440/390, vaalea/tumma), `external-1`, `enter-2`, `replace-1`, `replace-3`, `menu-1` ja `saved-3`.

Tarkistukset:

- `check.mjs`: 36 tarkistuspistettä kolmella suunnalla, 1440 ja 390 px, vaalea ja tumma. Mukana yhteinen `picker-check.mjs`, valitsimen näppäimet, URL ja R. Ohjeen API:t, enableflow-linkki ja scopet verrataan koodin arvoihin, ja tarkistetaan uudelleenohjausosoitteen puuttuminen ja localhost, Internal/External-seuraukset, muotovirheet ilman lähetystä, tila *Odottaa palvelinta* → *Käytössä*, valikon client id:n alku ilman `.com`ia, vaihdon kaksi tapaa, vaiheiden järjestys ja *Minulla on jo asiakas*, paneelin kentät ennen ohjetta, rivien näkyvyys leveällä näytöllä ja paneelin oma näkymä puhelimessa sekä poisto ja puuttuva työkalu. Ei konsolivirheitä eikä vaakaylivuotoa. Tulos `evidence/r3-checks.json`, julkaistulla sivulla `evidence/r3-hosted-checks.json`.
- Yhteinen `design-system/prototypes/check.mjs` hyväksyi sivun (9 kuvaa, ei virheitä), ja `picker-check.test.mjs` meni läpi.

Synteettinen selainprototyyppi; ei testaa daemonia, brokeria, Googlea eikä oikeaa `integrations.json`ia. Tuotantotiedostoja ei muutettu.

Lähde: `design-system/prototypes/rounds/2026-10-24-palvelin-integraatiot-3/`:

```sh
node design-system/prototypes/rounds/2026-10-24-palvelin-integraatiot-3/build.mjs
node design-system/prototypes/rounds/2026-10-24-palvelin-integraatiot-3/check.mjs \
  design-system/prototypes/dist/server-integrations-r3-space/offline.html /var/tmp/server-integrations-r3-evidence
```

Julkaise vain rakennettu `index.html`.

## Kierros 2 · Rivi

**Suositus: Käytössä vai ei.** Rivillä on vain palvelun nimi, tila ja yksi toiminto. Tila on kirjoitettu henkilön kannalta: *Käytössä* tai *Ei käytössä*, ja puuttuva työkalu nimetään tilassa (*Ei käytössä · rclone puuttuu*). Valmiilla DAV-riveillä ei ole muuta kuin *Käytössä*, joten ne eivät toista mitään. Käyttöönotto näkyy vain, kun palvelulla on vaihe: merkki *Käyttöönotossa* tai *Käyttöönotossa · piilossa*, ja merkki vie Käyttöönotto-välilehdelle. *Aseta tunnukset…* on rivillä. *Vaihda* ja *Poista* ovat harvinaisia, joten ne ovat *Tunnukset*-valikossa, jonka otsikossa näkyy client id:n loppu, asettaja ja päivä. Puuttuvan työkalun korjaus on *Korjaa…*-dialogissa: yksi komento ja kopiointipainike.

**[Avaa kierros 2](https://glasspad.example.test/p/frv6jdpbbcpq74spkwo5a724f4/).** Suunta vaihdetaan alareunan valitsimesta (myös 1–3, nuolet ja R). Teema ja 390 px:n kehys vaihtuvat yläreunasta, esimerkkipalvelimet ovat samat kuin kierroksella 1. Kaikki tiedot ovat keksittyjä.

Kierroksen 1 suunnasta 1 on poistettu kaikista suunnista *Näytä henkilön näkymä*, johdanto, selitys tunnusten tallennuksesta ja yhteenvetorivi. Sivulla on vain otsikko *Integraatiot* ja kuusi riviä katalogin järjestyksessä.

### Suunnat

Akseli: miten rivi kertoo tilan ja seuraukset ja missä sen toiminnot ovat.

| Suunta | Tila | Seuraus henkilöille ja käyttöönotolle | Toiminnot | Työkalu puuttuu |
| --- | --- | --- | --- | --- |
| **1. Tila ja lause** | Kierroksen 1 sanat: *Valmiina käyttöön*, *Tarvitsee sovellustunnukset*, *Työkalu puuttuu* | Yksi lause vain, kun jokin on pielessä (*Henkilöt eivät voi vielä yhdistää.*). Käyttöönoton merkki, kun vaihe on olemassa. | *Aseta tunnukset…* sekä *Vaihda…* ja *Poista* suoraan rivillä | Yksi ilmoitus listan yllä komennon kanssa, koska korjaus on koko palvelimelle sama. Rivit nimeävät puuttuvan työkalun. |
| **2. Käytössä vai ei** (suositus) | *Käytössä* / *Ei käytössä* / *Ei käytössä · rclone puuttuu* omassa sarakkeessaan | Tila on itse seuraus, ei lausetta. Käyttöönoton merkki, kun vaihe on olemassa. | *Aseta tunnukset…* rivillä; *Vaihda* ja *Poista* *Tunnukset*-valikossa | *Korjaa…* avaa komennon dialogiin |
| **3. Avattava rivi** | Kierroksen 1 sanat tasattuna oikealle | Avattavassa osassa: lause, sovelluksen tiedot ja *Käyttöönoton vaihe, piilossa · Käyttöönotto* | Kaikki avattavassa osassa; valmiit DAV-rivit eivät avaudu | Komento avattavassa osassa |

Suunta 1 kertoo eniten, mutta vaihda- ja poista-painikkeet ovat aina näkyvissä, vaikka niitä käytetään harvoin. Suunta 3 on rauhallisin suljettuna, mutta ylläpitäjän pitää avata rivi nähdäkseen, mitä tehdä, ja yksi painallus lisää jokaiseen asetukseen. Suunta 2 on lyhyin ja silti näyttää tehtävän työn heti: jokainen *Ei käytössä* -rivi on myös rivi, jolla on painike.

### Kokeile

1. Suunta 2, *Uusi asennus*: kolme *Ei käytössä* -riviä painikkeineen, kolme *Käytössä*-riviä ilman mitään muuta.
2. *Aseta tunnukset…* Googlelle → *Simuloi: tallennettu*. Rivi näyttää *Odottaa palvelinta* ja sitten *Käytössä*. Käyttöönoton merkistä katoaa *piilossa*.
3. *Tunnukset*-valikko Googlen riviltä: client id:n loppu ja asettaja otsikossa, *Vaihda tunnukset…* ja *Poista tunnukset…*.
4. *Vajaa asennus*: *Ei käytössä · rclone puuttuu* ja *Korjaa…*. Vertaa suunnan 1 yhteen ilmoitukseen listan yllä.
5. Klikkaa *Käyttöönotossa · piilossa*: avautuu Käyttöönotto-välilehti, jossa kierroksen 1 säännöt pätevät.
6. Suunnat 1 ja 3 samoilla esimerkkipalvelimilla.

### Kysymykset Jarille

1. **Tila ja lause, Käytössä vai ei vai Avattava rivi?** Tai yhdistelmä, esimerkiksi suunta 2 ja suunnan 1 yksi ilmoitus listan yllä, kun työkalu puuttuu.
2. **Riittääkö *Käytössä / Ei käytössä*?** Vaihtoehto on *Ei käytössä · tarvitsee tunnukset*, joka kertoo syyn, mutta painike *Aseta tunnukset…* on jo samalla rivillä.
3. **Käyttöönotto merkkinä:** riittääkö merkki vain silloin, kun vaihe on olemassa, ilman mitään tekstiä muille riveille?
4. **Kierros 3:** Googlen ohjattu asetus, kuten issue ehdottaa?

### Oletukset, ei toteutuspäätöksiä

- Palvelimen vahvistus on edelleen 0,9 sekunnin viive, ja asettajan nimi ja aika ovat option B kirjanpitoa, jota ei vielä ole.
- Poiston vahvistus on lyhennetty kolmeen seuraukseen: uusia tilejä ei voi yhdistää, yhdistetyt tilit eivät voi kirjautua uudelleen ja käyttöönoton vaihe piilotetaan.
- *Aseta tunnukset…* on yhä paikkamerkki, joka nimeää kysyttävät kentät.

### Näyttö

[evidence](evidence/) sisältää `r2-`-alkuiset kuvakaappaus/staattinen HTML -parit: `overview-1…3`, `partial-1…3` (vajaa asennus), `menu-2` (Tunnukset-valikko), `fix-2` (Korjaa-dialogi), `setup-1` ja `remove-1`.

Tarkistukset:

- `check.mjs`: 44 tarkistuspistettä kolmella suunnalla, 1440 ja 390 px, vaalea ja tumma. Mukana yhteinen `picker-check.mjs`, valitsimen näppäimet, URL-valinta ja R, katalogin järjestys, kierroksen 1 poistojen pysyminen poissa, tilat ja välitila, valmiiden DAV-rivien hiljaisuus, käyttöönoton merkki ja sen linkki, valikko, poiston seuraukset, puuttuvan työkalun korjaus kerran sanottuna (suunta 1) ja suljettuna (suunta 3). Ei konsolivirheitä eikä vaakaylivuotoa. Tulos `evidence/r2-checks.json`, julkaistulla sivulla `evidence/r2-hosted-checks.json`.
- Yhteinen `design-system/prototypes/check.mjs` hyväksyi sivun (9 kuvaa, ei virheitä), ja `picker-check.test.mjs` meni läpi.

Synteettinen selainprototyyppi; ei testaa daemonia, brokeria eikä oikeaa `integrations.json`ia. Tuotantotiedostoja ei muutettu.

Lähde: `design-system/prototypes/rounds/2026-10-24-palvelin-integraatiot-2/`:

```sh
node design-system/prototypes/rounds/2026-10-24-palvelin-integraatiot-2/build.mjs
node design-system/prototypes/rounds/2026-10-24-palvelin-integraatiot-2/check.mjs \
  design-system/prototypes/dist/server-integrations-r2-space/offline.html /var/tmp/server-integrations-r2-evidence
```

Julkaise vain rakennettu `index.html`.

## Kierros 1 · Yleiskuva

**Suositus: Oma välilehti.** *Palvelimen ylläpito* -ryhmään tulee välilehti *Integraatiot* Palvelimen ja Käyttöönoton väliin. Siinä on yksi rivi kullekin kuudelle palvelulle samassa järjestyksessä ja samoilla merkeillä kuin henkilön Asetukset › Integraatiot -sivulla. Rivillä on tila, ja sen alla kerrotaan, mitä tila tarkoittaa henkilöille ja käyttöönotolle. Tunnuksia tarvitsevilla riveillä on painike *Aseta tunnukset…*. Suosittelen omaa välilehteä, koska jokaisella palvelulla on kaksi seurausta, jotka ylläpitäjän pitää nähdä, eikä niille ole tilaa Palvelin-välilehden osiossa. Lisäksi Käyttöönotto-välilehti viittaa tähän näkymään. Kiinteä järjestys pitää rivit paikallaan, kun tila muuttuu.

**[Avaa kierros 1](https://glasspad.example.test/p/7xaaidgbl3ebzck24twjpmy6c4/).** Suunta vaihdetaan alareunan valitsimesta (myös 1–3, nuolet ja R). Teema ja 390 px:n kehys vaihtuvat yläreunasta. *Esimerkkipalvelin* vaihtaa kolmen palvelintilan välillä: uusi asennus, Google asetettu ja vajaa asennus. Kaikki tiedot ovat keksittyjä.

### Mitä kaikissa suunnissa on samaa

- **Palvelut ja tilat tulevat katalogista** (`internal/daemon/integrations`). IMAP, CalDAV ja CardDAV ovat valmiina käyttöön heti, kun työkalut on asennettu. Google, Microsoft 365 ja Dropbox tarvitsevat lisäksi organisaation sovellustunnukset. Rivin tila on yksi seuraavista:
  - *Valmiina käyttöön*: henkilö näkee Yhdistä…-painikkeen.
  - *Tarvitsee sovellustunnukset*: henkilö näkee tekstin "Ei käytettävissä tällä palvelimella", ja painike on pois käytöstä. Teksti on tuotannon nykyinen.
  - *Työkalu puuttuu*: henkilö näkee saman kuin edellisessä tilassa. Rivi nimeää puuttuvan työkalun (esimerkiksi `rclone`), ja *Miten korjataan…* neuvoo ajamaan `host apply`n. Tilaa ei pitäisi esiintyä, kun `integration-tools-always-installed` on tehty. Se näytetään silti, koska daemon voi päätyä siihen vajaalla asennuksella.
  - *Tallennetaan · odottaa palvelinta*: välitila. Muutos on voimassa vasta, kun palvelin on vahvistanut sen. Tämä noudattaa kierroksen 6 periaatetta "selain pyytää, palvelin vahvistaa".
- **Henkilön näkymä:** *Näytä henkilön näkymä* avaa tuotannon `IntegrationsOverview`-komponentin sellaisena kuin uusi henkilö sen näkee tällä palvelimella. Kokeile asettaa Googlen tunnukset ja avata näkymä uudelleen.
- **Käyttöönoton integraatiovaiheet:** ehdotan kolmea sääntöä.
  1. Vaihe näkyy uusille henkilöille vain, kun sen integraatio on valmiina käyttöön. Muuten vaihe on tallessa mutta *piilossa uusilta henkilöiltä*, ja Käyttöönotto-välilehti linkittää sen tilaan.
  2. Uudeksi vaiheeksi voi lisätä vain valmiin integraation.
  3. Tunnusten poisto ei poista vaihetta, vaan piilottaa sen.

  Näin puuttuvat tunnukset eivät koskaan pysäytä uuden henkilön käyttöönottoa.
- **Sovellustunnukset ovat vain kirjoitettavia.** Tallennuksen jälkeen näkyy palvelu, client id:n neljä viimeistä merkkiä, asettaja ja päivä. Salaisuutta ei näytetä. Tämä toimii samoin kuin ADR 0030:n sivuston AI-avain.
- **Tunnusten poisto** kertoo seuraukset ennen vahvistusta: uusia tilejä ei voi yhdistää, jo yhdistetyt tilit näkyvät mutta niihin ei voi kirjautua uudelleen, vaihe piilotetaan ja sovellus jää palveluntarjoajan konsoliin. Poisto ja uudelleenkirjautuminen toimivat näin tuotannon nykyisessä koodissa (`AccountCard` ilman `onSignInAgain`ia, kun palvelu ei ole saatavilla).
- *Aseta tunnukset…* on tällä kierroksella paikkamerkki. Se kertoo, mitä ohjattu asetus kysyy: Googlelta Client ID ja Client secret, Microsoftilta sovelluksen id ja kirjautujat (`common`, `organizations`, `consumers` tai oma tenant), Dropboxilta App key ja App secret. Lisäksi siinä on painike, joka simuloi tallennuksen. Varsinainen ohjattu asetus tehdään kierroksilla 2–4.

### Suunnat

Akseli: missä ylläpitäjän integraatioyleiskuva on ja miten se on järjestetty.

| Suunta | Paikka | Järjestys | Hyöty | Hinta |
| --- | --- | --- | --- | --- |
| **1. Oma välilehti** (suositus) | *Palvelimen ylläpito › Integraatiot* | Katalogin järjestys, yksi rivi palvelua kohden. Kummallakin rivillä näkyy *Henkilöille* ja *Käyttöönotossa*, ja yläreunan yhteenveto kertoo tilojen lukumäärät. | Vastaa henkilön sivua. Rivit eivät hypi. Molemmat seuraukset näkyvät jokaisella rivillä. | Pitkä sivu. Valmiit DAV-rivit toistavat samaa tekstiä. |
| **2. Tilan mukaan** | Oma välilehti | Ryhmät: *Korjattavaa*, *Tarvitsee sovellustunnukset* (kortti, jossa "Tarvitaan: …") ja *Valmiina käyttöön*. Valmiit IMAP, CalDAV ja CardDAV ovat yhdessä tiiviissä kortissa. | Tehtävä työ on ylimpänä, mikä toimii hyvin uudessa asennuksessa. | Rivi siirtyy ryhmästä toiseen tallennuksen jälkeen, ja järjestys poikkeaa henkilön sivusta. |
| **3. Osana Palvelinta** | Palvelin-välilehden osio palvelintietojen alla | Tiivis taulukko: palvelu, tila, henkilöille ja toiminto. Käyttöönoton vaihe on pienenä merkintänä nimen alla. | Yksi välilehti vähemmän, ja kokonaisuus mahtuu yhdelle näytölle. | Seuraukset käyttöönotolle jäävät yhteen sanaan. Palvelin-välilehti kasvaa, ja se jää kauemmas Käyttöönotosta. |

Suuntia voi myös yhdistää, esimerkiksi suunnan 1 järjestykseen suunnan 2 *Korjattavaa*-ryhmän, jos jokin on rikki.

### Auktoriteettimuistio: kuka kirjoittaa sovellustunnukset

**Nykytila.** Sovellustunnukset ovat tiedostossa `/opt/open-habitat/integrations.json` työkalupolkujen vieressä. Tiedoston omistaa root, ja kaikki liitetyt käyttäjät voivat lukea sitä. Daemon lukee sen funktiolla `core.ReadOperatorFile`, joka hylkää tiedoston, jos se tai jokin sen hakemistoista ei ole rootin omistama tai jos muut voivat kirjoittaa siihen. Daemonin luottamus tunnuksiin perustuu siis siihen, että vain root kirjoittaa tiedostoa. Tiedostoon kirjoittaa nyt operaattori käsin, ja `integration-tools-always-installed`in jälkeen `host apply` kirjoittaa sen `tools`-osion ja säilyttää tunnukset. Jos selaimen ylläpitäjä voi kirjoittaa tunnukset, auktoriteetti muuttuu samalla tavalla kuin ADR 0030:ssä: ylläpitäjä voi vaihtaa sovelluksen, jonka kautta kaikkien tulevat Google-, Microsoft- ja Dropbox-kirjautumiset kulkevat. Vaihdetun sovelluksen haltija saisi käyttöönsä niiden henkilöiden tunnukset, jotka kirjautuvat sen kautta.

| Vaihtoehto | Miten | Mitä muuttuu | Arvio |
| --- | --- | --- | --- |
| **A. Vain root** | Selain näyttää tilan ja valmiin komennon, esimerkiksi `sudo open-habitat admin integrations set google`, joka lukee salaisuuden stdinistä. | Ei muutosta. | Turvallisin, mutta ylläpitäjä ei voi viimeistellä asennusta selaimessa, mikä oli tavoite. Komento tarvitaan joka tapauksessa, kuten ADR 0030:n `admin onboarding`. |
| **B. Broker kirjoittaa gatewayn pyynnöstä** (suositus) | Uudet gateway-socketin operaatiot `set_integration_app` ja `clear_integration_app`, samaan tapaan kuin ADR 0030:n `admit` ja `withdraw`. Gateway tarkistaa ylläpitäjän ja välittää syötteen. Broker validoi saman tiukan muodon kuin `parseConfig` ja korvaa vain kyseisen palvelun osion atomisesti saman lukon alla, jota `host apply` käyttää `tools`-osion kanssa. Selaimelle palautetaan vain palvelu, client id:n loppu, asettaja ja aika. | Broker saa yhden root-kirjoituksen tiedostoon `/opt`. Se ei saa verkkoa, henkilöiden tunnuksia eikä kirjoitusoikeutta koteihin. Daemon, tiedoston muoto ja luottamuksen juuri pysyvät ennallaan. | Sama malli kuin ADR 0030:n pääsylistassa: broker omistaa tiedon, gateway saa vain pyytää, ja juuri voi rajata. Rajaus: `site.json`in kytkin `integrations.browser_setup`, jonka ollessa `false` broker hylkää kirjoitukset. Lisäksi asettaja ja aika näkyvät `host plan`issa ja `admin integrations list`issä. |
| **C. Gateway omistaa** | Kuten ADR 0030:n sivuston AI-avain: tunnukset ovat gatewayn omassa tiedostossa, ja daemon saa ne pyynnöissä tai lukee gatewayn tiedoston. | Daemon alkaa luottaa gatewayn kirjoittamaan sovelluksen tunnisteeseen. Gateway näkee jo nyt henkilöiden liittämät paluuosoitteet, joten salaisuuden haltijana se voisi lunastaa niiden koodit itse. | Hylkään. AI-avain kuului gatewaylle, koska se kylvetään kerran henkilön kotiin. Sovellustunnus taas on asennuksen yhteinen syöte jokaiselle kirjautumiselle. ADR 0030 jätti vastaavan yhteisen syötteen, pääsylistan, brokerille. Se hylkäsi brokerin AI-avaimen haltijana vain siksi, että avain olisi vaatinut kirjoitusta henkilöiden koteihin, eikä sitä tässä tarvita. |

**Suositus: B.** Yksi avoin valinta on `integrations.browser_setup`-kytkimen oletus. Ehdotan, että se on päällä (`true`), toisin kuin ADR 0030:n `runtime_admission`. Tunnusten asetus ei luo tilejä eikä anna pääsyä kenenkään tietoihin ilman henkilön omaa kirjautumista, ja tavoite on, että asennus valmistuu selaimessa. Root voi silti lukita kytkimen. Jos haluat yhtenäisyyttä ADR 0030:n kanssa, oletus on `false` ja asennusohje kertoo sen kääntämisestä. Ratkaisu kirjataan ADR:ksi tai ADR 0030:n lisäykseksi ennen toteutusta.

### Kokeile

1. Suunta 1, *Uusi asennus*: lue Googlen rivi. Käyttöönoton vaihe on olemassa mutta piilossa. Avaa *Näytä henkilön näkymä*.
2. *Aseta tunnukset…* Googlelle → *Simuloi: tunnukset tallennettu*. Rivi näyttää ensin *odottaa palvelinta* ja sitten *Valmiina käyttöön*. Avaa henkilön näkymä uudelleen.
3. *Poista* Googlen riviltä: lue seuraukset.
4. *Vajaa asennus*: rclone puuttuu, joten Google, Microsoft ja Dropbox ovat *Työkalu puuttuu*. Avaa *Miten korjataan…*.
5. *Käyttöönotto*-välilehti: piilotettu Google-vaihe ja *Lisää integraatio*. Microsoft on estetty, IMAP voidaan lisätä.
6. Suunnat 2 ja 3 kaikilla esimerkkipalvelimilla. Esimerkkipalvelin säilyy, kun suuntaa vaihdetaan.

### Kysymykset Jarille

1. **Oma välilehti, Tilan mukaan vai Osana Palvelinta?** Tai yhdistelmä, esimerkiksi suunta 1 ja *Korjattavaa*-ryhmä ylimpänä.
2. **Välilehden nimi:** asetuksissa olisi silloin kaksi *Integraatiot*-kohtaa, henkilön oma ja ylläpidon. Kelpaako sama nimi ryhmän alla, vai käytetäänkö nimeä *Integraatioiden asetus*?
3. **Käyttöönoton säännöt:** kelpaako, että vaihe näkyy vain, kun integraatio on valmiina käyttöön, että vaiheeksi voi lisätä vain valmiin integraation ja että tunnusten poisto piilottaa vaiheen poistamatta sitä?
4. **Auktoriteetti:** hyväksytkö vaihtoehdon B? Onko `integrations.browser_setup`-kytkimen oletus `true` vai `false`?
5. **Kierros 2:** aloitetaanko Googlen ohjatusta asetuksesta, kuten issue ehdottaa?

### Oletukset, ei toteutuspäätöksiä

- Palvelimen vahvistus on prototyypissä 0,9 sekunnin viive.
- Asettajan nimi ja aika ("24.10. Kaisa Admin") ovat B:n kirjanpitoa, jota ei vielä ole.
- En ole tarkistanut, toimivatko jo yhdistetyt tilit, kun sovellus *vaihdetaan* toiseen (työkalun tallentamat refresh-tokenit ovat sidottuja client id:hen). Vaihtodialogi sanoo varovasti, että uudelleenkirjautuminen voi olla tarpeen. Tämä tarkistetaan Googlen kierroksella.
- Microsoftin "Kirjautujat" on `MicrosoftApp.TenantID`. Katalogin kommentin mukaan se on kirjautumisen kohdeyleisö eikä operaattorin oma tenant.

### Näyttö

[evidence](evidence/) sisältää `r1-`-alkuiset kuvakaappaus/staattinen HTML -parit: `overview-*` (suunnat 1–3), `partial-*` (vajaa asennus), `person-1-*` (henkilön näkymä), `setup-1-*`, `remove-1-390-light` ja `onboarding-1-*`. Kaikki on otettu 1440 px:n ja 390 px:n leveydellä sekä vaaleassa ja tummassa teemassa siltä osin kuin `check.mjs` ne ottaa.

Tarkistukset:

- `check.mjs` (Playwright `web/node_modules`ista): 36 tarkistuspistettä kolmella suunnalla, molemmilla leveyksillä ja molemmilla teemoilla. Mukana ovat yhteinen `picker-check.mjs`, valitsimen näppäimet, URL-valinta ja R:n uudelleenaloitus, katalogin järjestys, kaikki tilat, henkilön näkymän ruutujen käytettävyys ennen tallennusta ja sen jälkeen, välitila *odottaa palvelinta*, poiston seuraukset, puuttuvan työkalun ohje, käyttöönoton piilotettu vaihe sekä estetty ja sallittu lisäys, suunnan 2 ryhmät ja suunnan 3 osio ilman omaa välilehteä. Ei konsolivirheitä eikä vaakaylivuotoa. Tulos on `evidence/r1-checks.json`.
- Sama tarkistus julkaistulla Glasspad-sivulla: `evidence/r1-hosted-checks.json`, 36 tarkistuspistettä.
- Yhteinen `design-system/prototypes/check.mjs` hyväksyi sivun (9 kuvaa, ei virheitä), ja `picker-check.test.mjs` meni läpi.

Tämä on synteettisen selainprototyypin näyttöä. Se **ei** testaa daemonin katalogia, brokeria eikä oikeaa `integrations.json`ia. Tuotantotiedostoja ei muutettu.

Lähde: `design-system/prototypes/rounds/2026-10-24-palvelin-integraatiot-1/`. Rakenna checkoutissa, jossa `web/node_modules` on asennettu lukosta:

```sh
node design-system/prototypes/rounds/2026-10-24-palvelin-integraatiot-1/build.mjs
node design-system/prototypes/rounds/2026-10-24-palvelin-integraatiot-1/check.mjs \
  design-system/prototypes/dist/server-integrations-r1-space/offline.html /var/tmp/server-integrations-r1-evidence
```

Julkaise vain rakennettu `index.html`.

# Selvitys: integraatioiden oikeustasot (vain luku, vain luonnokset, rajatut kansiot)

Päivitetty 2026-10-26. Tehtävä: [item.md](item.md).

## Tiivistelmä

Ainoa raja, joka pitää agenttia vastaan, on palveluntarjoajan päässä
myönnetty oikeus: OAuth-scope, sovellusrekisteröinnin tyyppi tai palvelun
oma salasanarajaus. Agentti ajaa samana Unix-käyttäjänä kuin tunnukset
omistava henkilö, joten se voi lukea jokaisen tunnustiedoston kotihakemistosta
ja kutsua palvelua suoraan ohi minkä tahansa työkalun lipun. Työkalujen omat
"turvatilat" (`gog --gmail-no-send`, `ms-365-mcp-server --read-only`) ja
personal-data-skillin ohjeet ("luonnos ensin") ovat siksi ohjeita eivätkä
rajoja.

Palveluntarjoajan oikeuksilla saa valittua:

| Palvelu | Vain luku | Luonnokset, ei lähetystä | Vain tietty kansio |
|---|---|---|---|
| Google (Gmail, Kalenteri, Kontaktit, Drive) | Kyllä, jokaiselle palvelulle | **Ei**: Gmailissa ei ole luonnos-scopea ilman lähetysoikeutta | **Ei** Drivessa (ainoastaan `drive.file`, joka koskee yksittäisiä tiedostoja) |
| Microsoft Graph (Outlook, OneDrive, SharePoint) | Kyllä | **Kyllä**: `Mail.ReadWrite` ilman `Mail.Send` | SharePoint/OneDrive: kyllä `*.Selected`-oikeuksilla, mutta myöntäminen on raskasta |
| IMAP/SMTP, CalDAV/CardDAV | Yleensä ei (palvelukohtaista) | Vain jos palvelu antaa protokollakohtaisen sovellussalasanan | Ei |
| Dropbox | Kyllä (scopet) | – | Vain sovelluskansio (App folder -sovellus) |
| GitHub | Ei nykyisellä OAuth-sovelluksella | – | GitHub Appilla tai fine-grained PAT:lla kyllä, repokohtaisesti |
| Gitea | Kyllä (read/write per kategoria) | – | Ei repokohtaisesti, vain "public-only" |

Mikään scope ei suojaa siltä, että agentti vuotaa sen, mitä se saa lukea.
Lukuoikeus kaikkeen postiin on edelleen lukuoikeus kaikkeen postiin, ja
pitkäikäinen refresh token toimii mistä tahansa koneesta, jos se päätyy
mallin tuottajalle tai prompt-injektion kautta jonnekin muualle.

**Suositus** (perustelut lopussa): integraatioluettelo hyväksyy kapeamman
myönnön ja tarjoaa yhdistettäessä tilikohtaisen oikeustason siellä, missä
palveluntarjoaja sen toteuttaa. Lukuoikeus vaihtaa synkronoinnin
yksisuuntaiseksi. Yrityksen ylläraja on palveluntarjoajan päässä
(Entra-hyväksyntä, Google Workspace -sovellusohjaus), ja tuote kestää sen.
Tunnuksia pitävä välityskäyttäjä jää vaihtoehdoksi, joka otetaan esiin vasta
kun asiakas tarvitsee jotain, mitä palveluntarjoaja ei osaa (Gmailin
pelkät luonnokset tai Driven yksittäinen kansio).

## Mistä lähdettiin: nykytila koodissa

Luettu koodista (`internal/daemon/integrations/`, `internal/gateway/github.go`):

- **Google** pyytää kiinteästi `drive gmail.modify calendar contacts`
  (`google_linux.go`, `googleScopes`). Vaihto hylätään, jos jokin näistä
  puuttuu, vaikka Google sallii osittaisen suostumuksen. rclone saa saman
  tokenin `scope = drive`, ja Drive synkronoidaan kaksisuuntaisesti
  (bisync).
- **Microsoft** pyytää tiedostoille `Files.ReadWrite.All Sites.ReadWrite.All`
  ja Outlookille `Mail.ReadWrite Mail.Send Calendars.ReadWrite
  Contacts.ReadWrite` (`microsoft_linux.go`). Tiedostotokenin on sisällettävä
  `Files.ReadWrite.All`, muuten kirjautuminen hylätään. ms-365-mcp-server
  käynnistetään `--allowed-scopes`-listalla, joka on Pi:n `mcp.json`issa
  henkilön kotihakemistossa.
- **Dropbox** pyytää `files.content.write`, `sharing.write` jne. yhdeltä
  operaattorin sovellukselta (`dropbox_linux.go`), ja synkronointi on
  kaksisuuntainen.
- **IMAP/SMTP ja CalDAV/CardDAV** käyttävät sovellussalasanaa, joka on
  himalayan TOML-tiedostossa ja curlin config-tiedostossa.
- **GitHub**: yhdyskäytävän kirjautuminen pyytää `repo read:org gist`, ja
  sama token annetaan henkilön `gh`:lle (`transport`, `nativegh`).
- **Gitea**: henkilö liittää itse tekemänsä PAT:n. Tuote vaatii
  `read:user` ja `read:repository` (`nativegitea/client.go`, `Verify`).

ADR 0026 (`docs/decisions/adr-0026-integrations-catalog.md`) päätti, että
pääsy on oletuksena luku ja kirjoitus ja että vain luku -valinta voidaan
lisätä tilikohtaisesti myöhemmin siellä, missä työkalu sen tukee. Samassa
ADR:ssä hylättiin tunnuksia pitävä isäntäpuolen välittäjä.

## Uhkamalli: mitä raja tarkoittaa tässä arkkitehtuurissa

Agentti (Pi, Claude sillan kautta) ajaa henkilön UID:llä, ja sillä on shell
ja verkkoyhteys. Siksi:

1. **Kaikki tunnukset ovat agentin luettavissa.** gog-avainrengas
   (`GOG_KEYRING_PASSWORD=open-habitat` on koodissa kiinteä eikä salaisuus),
   rclone-konfiguraatiot, ms-365-mcp-serverin MSAL-välimuisti, himalayan
   TOML, curlin config, `gh`:n ja tean tiedostot. Tiedoston 0600-oikeus
   erottaa ihmiset toisistaan mutta ei henkilöä ja hänen agenttiaan.
2. **Asiakaspuolen rajaukset voi ohittaa.** Agentti voi jättää lipun pois,
   muokata `~/.pi/agent/mcp.json`ia tai gogin `gmail_no_send`-asetusta tai
   kutsua API:a curlilla tokenilla. Ne auttavat, kun malli toimii hyvässä
   uskossa, mutta eivät auta prompt-injektiota vastaan.
3. **Tokenin myöntämä oikeus on se, mikä oikeasti on annettu.** Jos tokenissa
   ei ole lähetysoikeutta, injektoitukaan agentti ei lähetä postia.
4. **Vuoto.** Jos agentti tulostaa tokenin, se menee mallin tuottajalle ja
   Pi:n historiaan. Prompt-injektio voi myös lähettää sen ulos verkkoon
   (`internal/egress` ei ole saman UID:n egress-eristys). Refresh token on
   haltijatunniste: Googlen desktop-asiakkaan client secret ei ole
   salaisuus (se on myös henkilön rclone-konfiguraatiossa), ja Microsoftin
   julkinen asiakas ei tarvitse salaisuutta lainkaan. Vuotanut refresh token
   toimii siis toiselta koneelta, kunnes se kumotaan tai vanhenee.
   Scope rajaa vain sen, mitä vuotaneella tokenilla voi tehdä.
5. **Lähetyskanavia on muitakin kuin "lähetä posti".** Kalenteritapahtuman
   luominen osallistujineen lähettää kutsut (Exchange, Google Calendar).
   Tiedosto-oikeus `drive`, `Files.ReadWrite.All` ja Dropboxin
   `sharing.write` voi luoda julkisen jakolinkin. Postisäännöt
   (`MailboxSettings.ReadWrite`) voivat ohjata postin eteenpäin. "Vain
   luonnokset" tarkoittaa siis "ei Mail.Send", mutta se ei tarkoita "ei mitään ulospäin
   lähtevää", ellei myös kalenteri ja tiedostojen jakaminen ole vain luku.

## Löydökset palveluittain

Merkinnät: **[kokeiltu]** = ajettu tällä koneella asennetuilla, tuotteen
kiinnittämillä työkaluversioilla (`/opt/open-habitat/current/payloads/integrations`);
**[koodi]** = luettu tämän repositorion koodista; **[dok.]** = palveluntarjoajan
dokumentaatio, linkki mukana. Mitään oikeaa OAuth-vaihtoa ei tehty, koska
testitilejä ei ollut käytössä. Live-käyttäytyminen kapealla myönnöllä on
siksi todentamatta.

### Google (Gmail, Kalenteri, Kontaktit, Drive)

Mitä yhdistettäessä voi valita:

- **Gmail** [dok.: [Gmail API scopes](https://developers.google.com/workspace/gmail/api/auth/scopes)]:
  `gmail.readonly` (luku), `gmail.compose` ("Manage drafts and send
  emails"), `gmail.send` (pelkkä lähetys), `gmail.modify` (luku, luonnokset,
  lähetys, siirrot; ei pysyvää poistoa), `gmail.labels`, `gmail.metadata`.
  **Mikään scope ei salli luonnosta ilman lähetysoikeutta.** Luonnosten luonti
  vaatii vähintään `gmail.compose`n, joka sallii myös lähetyksen.
- **Kalenteri ja kontaktit**: `calendar.readonly`, `calendar.events`
  (tapahtumat, ei kalenterien hallintaa), `contacts.readonly`
  [dok., Googlen scope-luettelo]. Tapahtuman kirjoitusoikeus voi lähettää kutsuja.
- **Drive** [dok.: [Drive API scopes](https://developers.google.com/workspace/drive/api/guides/api-specific-auth)]:
  `drive` (kaikki), `drive.readonly`, `drive.file` (vain sovelluksen
  luomat tai Pickerillä valitut yksittäiset tiedostot), `drive.appdata`
  (näkymätön sovelluskansio), `drive.metadata.readonly`. **Kansiotason
  scopea ei ole.** rclone 1.71.2 tarjoaa samat vaihtoehdot `--drive-scope`lla
  [kokeiltu: `rclone help backend drive`].
- Google näyttää suostumusruudussa scopet erikseen, ja henkilö voi jättää
  osan myöntämättä. Koodi hylkää nyt tällaisen osittaisen myönnön kokonaan
  [koodi].
- Yritystasolla Google Workspacen ylläpitäjä voi merkitä sovelluksen
  luotetuksi, rajatuksi tai estetyksi (API controls). Workspacen sisäinen
  sovellus välttää Googlen tarkastuksen ja Testing-tilan 7 päivän
  tokenit, kuten ADR 0026 toteaa. Scopekohtaista kavennusta ylläpitäjä ei
  voi tehdä yhdelle sovellukselle, vain sallia tai estää sen ja rajata
  palveluita [dok., yleistieto; ei tarkistettu tätä selvitystä varten].
- Rajoitetut scopet (`gmail.*`, `drive`, `drive.readonly`) vaativat julkiselta
  ulkoiselta sovellukselta Googlen tarkastuksen ja tietoturva-arvion. Tämä
  koskee jo nykyistä asetelmaa eikä muutu kavennettaessa, paitsi jos
  siirrytään kokonaan `drive.file`en [dok.].

Vaikutus työkaluihin ja synkronointiin:

- gog v0.39.1 tukee `auth add --gmail-scope full|readonly|send|read-send` ja
  `--drive-scope full|readonly|file` sekä ajonaikaisia lippuja `--readonly`
  ja `--gmail-no-send` ja config-avainta `gmail_no_send` [kokeiltu:
  `gog --help`, `gog auth add --help`, `gog config keys`]. Tuote tekee
  vaihdon itse eikä käytä `gog auth add`ia, joten scopet valitaan
  `googleScopes`-merkkijonossa. Liput ja config ovat kotihakemistossa ja siis
  vain ohjeita.
- `drive.readonly` rikkoo nykyisen bisyncin, koska ylöslataus epäonnistuu.
  Vain luku -tilassa synkronoinnin on oltava yksisuuntainen
  (`rclone sync google: ~/cloud/...`). Paikalliset muutokset kirjoittuvat
  silloin seuraavalla kierroksella yli, ja paikalliset lisäykset poistuvat.
  Personal-data-skillin on sanottava, että kansio on peili.
- `drive.file` ei käy synkronointiin: se ei näe henkilön olemassa olevia
  tiedostoja.

### Microsoft Graph (Outlook, OneDrive, SharePoint)

Mitä yhdistettäessä voi valita:

- Delegoidut oikeudet on porrastettu hienosti: `Mail.Read`,
  `Mail.ReadWrite` (luonnokset, siirrot, poistot), `Mail.Send` erikseen;
  `Calendars.Read`/`ReadWrite`; `Contacts.Read`/`ReadWrite`;
  `Files.Read.All`/`ReadWrite.All`; `Sites.Read.All`/`ReadWrite.All`;
  `Files.ReadWrite.AppFolder`.
- **Luonnokset ilman lähetystä toimii työkalussa** [kokeiltu]:
  ms-365-mcp-server 0.170.1 `--preset mail,calendar,contacts
  --allowed-scopes "User.Read Mail.ReadWrite Calendars.ReadWrite
  Contacts.ReadWrite" --list-permissions` poistaa käytöstä työkalut
  `send-mail`, `reply-mail-message`, `reply-all-mail-message`,
  `forward-mail-message` ja `send-draft-message` mutta jättää
  `create-draft-email`in sekä `create-reply-draft`- ja `create-forward-draft`-luonnostyökalut.
  `--read-only` vaihtaa oikeudet muotoon `Mail.Read Calendars.Read
  Contacts.Read MailboxSettings.Read User.Read`. Nykyinen tuotteen lista
  poistaa jo nyt postisääntöjen työkalut (`MailboxSettings.*` puuttuu).
- **Kriittinen rajoite** [dok.: [Scopes and permissions](https://learn.microsoft.com/en-us/entra/identity-platform/scopes-oidc),
  [MSAL.js resources and scopes](https://learn.microsoft.com/en-us/entra/msal/javascript/browser/resources-and-scopes)]:
  delegoidun access tokenin `scp` sisältää *kaikki* sovellukselle kyseiseen
  resurssiin hyväksytyt oikeudet eikä vain pyydettyjä. Koska tuotteen
  Entra-sovellus on yhden tenantin sovellus, jolle ylläpitäjä on antanut
  hyväksynnän koko tenantille, jokainen henkilö saa sovelluksen koko
  oikeusjoukon, vaikka tuote pyytäisi vähemmän. **Tilikohtainen
  oikeustaso vaatii siksi erillisen sovellusrekisteröinnin jokaiselle
  tasolle** (esim. "Habitat – luku" ja "Habitat – täysi"). Toinen tapa on,
  että ylläpitäjä hyväksyy yhdelle sovellukselle vain kapean joukon, joka
  silloin koskee kaikkia.
- **Kansio- ja sivustorajaus** [dok.: [Selected permissions overview](https://learn.microsoft.com/en-us/graph/permissions-selected-overview)]:
  `Sites.Selected`, `Lists.SelectedOperations.Selected`,
  `ListItems.SelectedOperations.Selected` ja `Files.SelectedOperations.Selected`
  toimivat myös delegoituina. Hyväksyntä ei yksin anna mitään pääsyä;
  sivuston, kirjaston tai kansion omistaja (tai `Sites.FullControl.All`-oikeuksinen)
  myöntää sovellukselle roolin kohteen `/permissions`-resurssiin.
  Delegoituna lopullinen pääsy on sovelluksen myönnön ja käyttäjän omien
  oikeuksien leikkaus. Tämä on ainoa palvelu, jossa "agentti näkee vain
  tämän kansion" onnistuu palveluntarjoajan päässä. Rajoitteina myönnöt
  tehdään Graph-kutsuilla eikä hallintakäyttöliittymässä, ja haku ei toimi.
  Lisäksi rclone ei ole testattu tällaisella tokenilla: juuren listaus voi epäonnistua.
- **Tokenin sitominen verkkoon** [dok.: [Continuous access evaluation](https://learn.microsoft.com/en-us/entra/identity/conditional-access/concept-continuous-access-evaluation)]:
  Conditional Accessin IP-pohjainen nimetty sijainti, jota Exchange,
  SharePoint ja Graph valvovat CAE:n kautta lähes reaaliajassa, estää
  tokenin käytön palvelimen osoitteiden ulkopuolelta ("Token export to a
  machine outside of a trusted network can be prevented"). Tämä on ainoa
  tässä selvityksessä löytynyt palveluntarjoajan mekanismi, joka lieventää
  *vuotoa*. Se on tenantin ylläpitäjän asetus eikä tuotteen.

Vaikutus synkronointiin: `Files.Read.All` + `Sites.Read.All` vaatii
yksisuuntaisen synkronoinnin kuten Googlella. Lisäksi koodin tarkistus
`Files.ReadWrite.All` on muutettava [koodi].

### IMAP/SMTP ja CalDAV/CardDAV

- Protokollissa ei ole scopeja. Sovellussalasana avaa yleensä kaiken, minkä
  tilin salasana avaa samoilla protokollilla.
- **Luonnokset ilman lähetystä** onnistuu vain, jos sama salasana ei kelpaa
  SMTP:hen. Pelkkä SMTP-asetusten jättäminen pois himalayan konfiguraatiosta
  on ohje eikä raja, koska agentti voi puhua SMTP:tä itse samalla salasanalla.
  Fastmail antaa valita sovellussalasanan palvelut erikseen (posti, kontaktit,
  kalenterit, tiedostot), ja kolmannen osapuolen lähteiden mukaan myös
  pelkän SMTP:n [dok.: [Fastmail app passwords](https://www.fastmail.help/hc/en-us/articles/360058752854-App-passwords);
  IMAP-ilman-SMTP-vaihtoehtoa ei vahvistettu Fastmailin omasta
  dokumentaatiosta]. Googlen ja Applen sovellussalasanat eivät tiettävästi
  rajaa protokollaa [yleistieto, ei tarkistettu].
- **Vain luku -kalenteri** on saatavilla ilman kirjoitustunnusta, jos palvelu
  julkaisee kalenterin salaisena ICS-osoitteena (Google "secret address",
  Outlookin julkaistu kalenteri, iCloudin jaettu kalenteri). Tämä on
  todellinen palveluntarjoajan raja. Haittoina osoite on itse haltijatunniste,
  ja yksityiskohtien näkyvyys riippuu julkaisuasetuksesta [yleistieto].
- **Delegointitili** on palvelun oma mekanismi rajattuun pääsyyn: erillinen
  käyttäjätili, jolle henkilö jakaa postilaatikon tai kalenterin vain
  lukuoikeudella. Tähän kuuluvat IMAP ACL (RFC 4314) Dovecotissa ja
  Nextcloudin kalenterijako. Raja on aito, mutta jokainen henkilö tarvitsee
  toisen tilin palveluun.
- Vaikutus nykyisiin työkaluihin: himalaya ja curl toimivat sellaisinaan
  kapeammallakin salasanalla. Tarkistus (`account check --backend smtp`)
  näyttäisi SMTP:n hylätyksi, joten tilan on erotettava "ei lähetysoikeutta"
  virheestä.

### Dropbox

- Dropbox-sovelluksen **pääsytyyppi valitaan sovellusta luotaessa**: *App
  folder* (vain `/Apps/<sovellus>/`) tai *Full Dropbox*
  [dok.: [Dropbox OAuth guide](https://docs.dropboxapi.com/dropbox-api/docs/oauth)].
  Pääsytyypin vaihtamista jälkikäteen ei dokumentoida, joten käytännössä
  sovelluskansiotaso vaatii operaattorilta toisen Dropbox-sovelluksen.
- Scopet voi kaventaa tilikohtaisesti samalla sovelluksella: "Apps may
  request different scopes, per authorization, using the scope parameter"
  [dok.]. Vain luku = `account_info.read files.metadata.read
  files.content.read` ilman `*.write`- ja `sharing.write`-oikeuksia.
- rclone 1.71.2 tukee Dropboxia sellaisenaan. Sovelluskansio näkyy
  rclonelle juurena [kokeiltu: `rclone help backend dropbox`; juuri-asia
  dokumentaation perusteella]. Vain luku vaatii yksisuuntaisen synkronoinnin.

### GitHub

- Nykyinen OAuth-sovellus pyytää `repo`, joka on "Full access to public and
  private repositories including read and write access to code…". **Yksityisille
  repoille ei ole vain luku -scopea, eikä OAuth-sovelluksen scopea voi
  rajata repoihin** [dok.: [Scopes for OAuth apps](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps)].
- **GitHub Appin käyttäjätoken** on sovelluksen ja käyttäjän oikeuksien
  leikkaus ja rajattu repoihin, joihin sovellus on asennettu. Oikeudet ovat
  hienojakoisia (esim. Contents: read). Token vanhenee 8 tunnissa, refresh
  token 6 kuukaudessa, ja device flow on tuettu
  [dok.: [User access tokens](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-user-access-token-for-a-github-app)].
- Fine-grained PAT, jonka henkilö tekee itse, rajaa repoihin ja
  oikeuksiin. `gh` hyväksyy sen (`gh auth login --with-token`). Organisaatio
  voi vaatia PAT:ille hyväksynnän ja rajata OAuth-sovellusten pääsyn [dok., yleistieto].
- Vaikutus: GitHub-token syntyy **yhdyskäytävän** kirjautumisessa.
  Kavennus tarkoittaa joko yhdyskäytävän OAuth-sovelluksen vaihtamista
  GitHub Appiin tai sitä, että henkilö liittää oman PAT:n daemonille kuten
  Giteassa. Ensimmäinen koskee yhdyskäytävän kirjautumista, toinen tuo
  daemoniin uuden yhdistämistavan.

### Gitea

- Token-scopet ovat kategorioittain read/write: repository, issue, user,
  organization, package, notification, admin jne. **Repokohtaista rajausta
  ei ole.** "public-only" rajaa julkisiin, mutta sen valvonnassa on ollut
  useita ohituksia vielä 2026 (mm. CVE-2026-58429 ja CVE-2026-58443, korjattu
  1.27.0:ssa ja myöhemmissä backporteissa) [dok.: [Gitea OAuth2 provider](https://docs.gitea.com/development/oauth2-provider),
  [GHSA-wrr5-99h5-gq57](https://github.com/go-gitea/gitea/security/advisories/GHSA-wrr5-99h5-gq57)].
- Henkilö valitsee scopet jo nyt itse PAT:ia tehdessään. Tuote vaatii vain
  `read:user` ja `read:repository`, joten vain luku -Gitea toimii jo
  tänään; push epäonnistuu palvelimella [koodi; ADR 0031]. Repokohtainen vain
  luku onnistuu SSH-deploy-avaimella, jota ADR 0031 ei valinnut.

## Vaihtoehdot

### A. Nykytila ja selvempi varoitus

Ei muutoksia oikeuksiin. Yhdistämisdialogin varoitus (ADR 0026) ja skillin
ohjeet pysyvät.

- \+ Ei työtä, ei uusia operaattorivaatimuksia.
- − Ei vastaa yritysasiakkaan vaatimukseen: mikään ei estä lähettämistä.
- − Nykyinen koodi hylkää jopa ylläpitäjän tarkoituksella kaventaman
  myönnön (Microsoftin `Files.ReadWrite.All`-tarkistus, Googlen kaikkien
  scopejen vaatimus). Tenantti, jossa `Mail.Send` puuttuu, ei voi käyttää
  integraatiota lainkaan, jos hyväksyntä epäonnistuu.

### B. Palveluntarjoajan oikeustasot yhdistettäessä (tunnukset pysyvät kotihakemistossa)

Integraatioluettelo pyytää tilikohtaisesti valitun tason scopet ja
tallentaa ne työkalun omaan tiedostoon kuten nyt. Taso luetaan myönnöstä
(tokenin scope-kentästä), joten tuotteeseen ei tule erillistä tietuetta.
Skill ja tilarivi kertovat tason, ja työkalut käynnistetään vastaavilla
lipuilla, jotta hyvässä uskossa toimiva agentti ei törmää virheisiin.

Toteutettavissa:

- Google: "vain luku" kaikille palveluille, tai "täysi". Gmailin "vain
  luonnokset" ei ole mahdollinen. Drive vain luku → yksisuuntainen
  synkronointi.
- Microsoft: "vain luku", "luonnokset ilman lähetystä" (Mail.ReadWrite,
  ei Mail.Send; kalenteri vain luku, jotta kutsuja ei lähde), "täysi".
  **Vaatii operaattorilta yhden Entra-sovelluksen tasoa kohden**, koska
  tenantin hyväksyntä yhdistetään tokeniin.
- Dropbox: "vain luku" samalla sovelluksella. "Vain sovelluskansio" vaatii
  operaattorilta toisen Dropbox-sovelluksen.
- IMAP/SMTP: tuote hyväksyy tilin ilman SMTP:tä ja kertoo, että raja on aito
  vain, jos salasana ei kelpaa SMTP:hen.
- GitHub: ei osa tätä vaihtoehtoa ilman yhdyskäytävämuutosta (ks. alla).

Arvio:

- \+ Raja on palveluntarjoajalla, joten se pitää myös prompt-injektoitua
  agenttia vastaan.
- \+ Pysyy ADR 0026:n linjassa: natiivit työkalut, natiivit tunnusvarastot,
  ei uutta tietovarastoa.
- − Ei suojaa vuodolta. Kapea token vuotaa yhtä helposti; vahinko vain on
  pienempi.
- − Gmailin luonnokset ja Driven kansiorajaus eivät onnistu.
- − Operaattorin konfiguraatio (`integrationapps`, root-brokerin kirjoittama
  `integrations.json`) laajenee useampaan sovellukseen per palveluntarjoaja.

### C. Yrityksen ylläraja palveluntarjoajan päässä, tuote sopeutuu

Tenantin tai Workspacen ylläpitäjä päättää oikeudet, esim. hyväksyy
Habitatin Entra-sovellukselle vain `Mail.ReadWrite`n ilman `Mail.Send`ia,
asettaa Conditional Accessin IP-rajauksen palvelimen osoitteisiin tai
estää Google-sovelluksen Gmailin. Tuote hyväksyy minkä tahansa myönnön,
joka riittää ainakin yhteen palveluun, ja näyttää puuttuvat palvelut ja
oikeudet.

- \+ Yritysympäristössä päätösvalta on juuri siellä, missä yritys sen haluaa:
  omassa hallintakonsolissaan, auditoitavana. Tuote ei tee lupausta, jota se
  ei voi pitää.
- \+ Pieni muutos: scope-tarkistukset joustaviksi ja ms-365-mcp-serverin
  `--allowed-scopes` myönnön mukaiseksi.
- \+ Ainoa löydetty vuodon lieventäjä (CAE + IP-sijainti) kuuluu tähän.
- − Koskee kaikkia tenantin henkilöitä samalla tavalla. Henkilökohtaista
  valintaa ei ole ilman B:tä.

B ja C eivät sulje toisiaan pois: C on B:n edellytys (tuotteen on
kestettävä kapea myöntö), ja B on C:n henkilökohtainen tarkennus.

### D. Tunnuksia pitävä välityskäyttäjä (proxy) — Jarin päätettäväksi

Erillinen Unix-käyttäjä (henkilöä kohden tai asennusta kohden) pitää
refresh tokenit. Agentti puhuu sille socketin kautta, ja välittäjä valvoo
sääntöjä, joita OAuth ei osaa ilmaista: Gmail-luonnokset ilman lähetystä,
vastaanottajien sallittu lista, Driven yksittäinen kansio, nopeusrajat.
Synkronointi ajaisi välittäjäkäyttäjänä, ja synkronoidut tiedostot olisivat
sen omistamia ja henkilölle ryhmäluettavia. Silloin vain luku -kansio olisi
Unix-oikeuksilla valvottu.

- \+ Ainoa malli, jossa tokenit eivät ole agentin luettavissa. Vuoto mallin
  tuottajalle tai injektion kautta estyy, koska agentilla ei ole tokenia,
  vain oikeus pyytää välittäjältä sallittuja toimintoja.
- \+ Sallii sääntöjä, joita palveluntarjoaja ei tarjoa.
- − Se on juuri se credential broker, jonka root `AGENTS.md` ja ADR 0026
  hylkäsivät: toinen totuuden paikka henkilön yhteyksistä ja kohde, joka
  pitää (asennuskohtaisena) kaikkien ihmisten pääsyn.
- − Henkilökohtainen välittäjäkäyttäjä tarkoittaa uutta tilinluontia
  `internal/provision`-brokerille (toinen UID per henkilö, sen
  daemon-yksiköt ja socket-ACL:t). Tämä on muutos root-brokerin valtaan.
- − Välittäjän on toteutettava jokaisen palvelun API-pinta sääntöineen
  tai suodatettava raakaa HTTP:tä. Tämä on iso ja jatkuvasti hajoava
  ylläpitopinta, ja natiivit työkalut (gog, himalaya, ms-365-mcp-server)
  eivät enää puhu palveluun suoraan.
- − Ei poista lukuvuotoa: mitä välittäjä antaa agentin lukea, sen agentti
  voi vuotaa.

Kevyempi muunnelma on, että välittäjä vain lyö lyhytikäisiä access tokeneita
refresh tokenista. Se lyhentää vuotaneen tokenin ikää tuntiin, mutta tunnin
token on yhtä laaja. Se ei siis toteuta "vain luonnokset" -vaatimusta.

## Mitä koskee gatewayn, daemonin ja provisionin valtajakoon

- **B ja C** pysyvät daemonin integraatioluettelossa ja operaattorin
  konfiguraatiossa. Valtaa ei siirry. `integrationapps`in tiedostomuoto
  laajenee (useampi Microsoft- tai Dropbox-sovellus), ja root-broker
  kirjoittaa sen ylläpitäjän selaimesta kuten nyt. Kyse on muodon
  muutoksesta eikä vallan siirrosta, mutta se on brokerin `Valid`-säännön muutos.
- **GitHubin kavennus** koskee yhdyskäytävää. GitHub-kirjautuminen on
  yhdyskäytävän tunnistusta, ja sama token siirtyy `gh`:lle. GitHub Appiin
  siirtyminen muuttaa sekä kirjautumista että tokenin luovutusta
  (`transport`/`nativegh`). PAT-liitos daemoniin erottaisi tunnistuksen ja
  `gh`:n tunnuksen. Kumpikin on Jarin arkkitehtuuripäätös.
- **D** lisää uuden valtakeskittymän, tunnusvaraston, ja vaatii provisionilta
  uuden käyttäjätyypin. Tämä on root `AGENTS.md`:n mukaan arkkitehtuurimuutos.

## Suositus

**Toteutetaan C heti ja B vaiheittain. D jätetään auki, ja se nostetaan
esiin vasta konkreettisen tarpeen kohdalla.**

1. **C ensin:** integraatioluettelo hyväksyy kapeamman myönnön (Google ja
   Microsoft eivät enää hylkää puuttuvaa scopea vaan merkitsevät
   palvelun/oikeuden puuttuvaksi). ms-365-mcp-serverin `--allowed-scopes`
   johdetaan myönnöstä. Skill kertoo, mitä tilillä ei voi tehdä.
   Operaattoriohje (`docs/operations.md`) kertoo yritykselle sen omat
   vivut: Entra-hyväksynnän kavennuksen, Conditional Accessin
   IP-sijainnin palvelimen osoitteisiin ja Google Workspacen sovellusohjauksen.
   Tämä vastaa suoraan ulkopuolisen kehittäjän M365-esimerkkiin ("luonnoksia
   mutta ei lähetystä"), eikä se vaadi arkkitehtuuripäätöstä.
2. **B Microsoftille ja Dropboxille, sitten Googlelle:** tilikohtainen
   "vain luku" (ja Microsoftille "luonnokset ilman lähetystä") yhdistämisdialogiin.
   Vain luku -synkronointi on yksisuuntainen peili. Microsoftin
   tilikohtainen taso edellyttää operaattorilta toista Entra-sovellusta,
   joten se tulee vasta kun joku sitä pyytää. Dropbox-sovelluskansio
   samalla periaatteella.
3. **Ei luvata sitä, mitä ei voi pitää.** Käyttöliittymä ja skill eivät saa
   esittää gogin `--gmail-no-send`ia tai MCP-palvelimen `--read-only`a
   rajana. Gmailille tarjotaan "vain luku" tai "täysi", ei "vain luonnokset".
4. **D:n laukaisija** kirjataan: asiakas, jonka vaatimus on Gmailin
   luonnokset ilman lähetystä, Driven yksittäinen kansio tai se, ettei
   token saa olla agentin luettavissa lainkaan. Silloin Jari päättää
   välittäjästä oman ADR:n kautta.
5. GitHubin `repo`-scopen kavennus on erillinen päätös, koska se koskee
   yhdyskäytävää. Ensimmäinen askel olisi, että henkilö voi korvata `gh`:n
   tokenin omalla fine-grained PAT:lla kuten Giteassa.

Miksi tämä: palveluntarjoajan raja on ainoa, joka pitää agenttia vastaan
saman UID:n mallissa, ja yritysasiakkaan vaatimus on nimenomaan
palveluntarjoajan oikeuksien kieltä ("Mail.Send pois"). C+B saavuttaa sen
koskematta valtajakoon ja ilman uutta tunnusvarastoa. D:n ainoa etu, ettei
token ole agentin luettavissa, on todellinen, mutta sen hinta on juuri se
keskitetty kohde ja toinen totuuden paikka, joita arkkitehtuuri välttää.
Sitä ei kannata maksaa ennen kuin joku sitä oikeasti tarvitsee.

## Avoimet ja todentamatta

- Kapean myönnön live-käyttäytyminen (Entra-token ilman `Mail.Send`ia,
  rclone OneDrivella `Files.Read.All`-tokenilla, rclone `*.Selected`-tokenilla,
  Dropbox-vain luku) on dokumentaation varassa. Toteutusissue tarvitsee testitenantin.
- Fastmailin IMAP-ilman-SMTP-salasanan nykyinen saatavuus.
- Google Workspacen ylläpitäjän tarkat mahdollisuudet rajata yksittäisen
  sovelluksen scopeja.

## Päätöksiä myöhempää tarkistusta varten

- Live-OAuth-vaihtoja ei tehty, koska testitilejä ei ollut. Väitteet on
  merkitty lähteittäin, ja kokeillut asiat rajoittuvat paikallisesti
  asennettujen kiinnitettyjen työkalujen ohjeisiin ja
  `--list-permissions`-tulosteeseen.

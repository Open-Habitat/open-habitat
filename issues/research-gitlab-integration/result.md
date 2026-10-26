# GitLab koodipalveluna: selvitys

Selvitys 2026-10-26, issue `research-gitlab-integration`. Pohjana on Gitean
ratkaisu (ADR 0031, `internal/nativegitea`, `internal/daemon/gitea_*`,
`internal/daemon/integrations/gitea_linux.go`, Asetukset › Koodipalvelut) ja
kloonaustyöt (ADR 0024). Tämä on lähtökohta `proto-gitlab-connect`-kierrokselle
ja `gitlab-integration`-toteutukselle.

## Lyhyesti

Gitean mallia kannattaa jatkaa GitLabiin lähes sellaisenaan. GitLabin oma
CLI `glab` omistaa yhteyden ja tunnuksen tiedostossa
`~/.config/glab-cli/config.yml`. Habitatin binäärin rajattu adapteri kirjoittaa
siihen vain oman merkintänsä ja tarjoaa Gitille oman credential-apuohjelmansa
(`gitlab git-credential`). Rajapinnasta luetaan vain kiinteät lukuoperaatiot.
Tunnistautumiseen ensimmäisessä vaiheessa riittää henkilökohtainen
access token (PAT), jonka oikeuksiksi ohjataan `read_api` ja `write_repository`.
OAuth (device flow) jätetään myöhemmäksi omaksi päätöksekseen.

Gitea-toteutuksesta kolme asiaa ei siirry GitLabiin sellaisenaan:

1. **Sisäkkäiset ryhmät.** GitLabin projektin polku on `ryhmä/aliryhmä/…/projekti`,
   jossa voi olla enintään 20 tasoa. Gitean koodi ja sopimukset olettavat kaikkialla
   muodon `owner/repo`. Tämä koskee apuohjelman polkusääntöä (`repoUnder`),
   `giteaFullName`-skeemaa ja keskeytyneen kloonin tunnistusta.
2. **glab pitää yhden tilin palvelinta kohden.** `hosts` on avainnettu palvelimen
   nimellä. Saman henkilön kahta GitLab-tiliä samalla palvelimella ei voi
   tallentaa natiivisti, kun taas tean kanssa Gitea-toteutus tukee sitä.
3. **Tunnus vanhenee.** GitLabin PAT vanhenee oletuksena enintään 365 päivässä.
   Koodipalvelut-sivun pitää kertoa vanhenemispäivä ja ohjata uusimaan tunnus
   ennen kuin kloonit lakkaavat toimimasta.

GitLab tarjoaa myös jotain, mitä Gitealla ei ole. `GET /personal_access_tokens/self`
kertoo tunnuksen oikeudet ja vanhenemispäivän, joten kirjoitusoikeuden puute
voidaan sanoa jo yhdistettäessä eikä vasta ensimmäisessä pushissa.

## Mitä on varmistettu ja miten

**Kokeiltu itse** (2026-10-26, kertakäyttöinen HOME-hakemisto
`/var/tmp/agent-scratch`-alla, ei oikeita tunnuksia):

- glab v1.124.0 (julkaistu 2026-10-20). Linux arm64 -arkisto tarkistettiin
  julkaisun `checksums.txt`-tiedostoa vasten. Kirjautuminen tehtiin paikallista
  valepalvelinta vasten komennolla `glab auth login --stdin --hostname … --setup-git-credential-helper`:
  - Kun Secret Serviceä ei ole, glab varoittaa ja kirjoittaa tunnuksen
    selväkielisenä tiedostoon `config.yml`. Tiedoston tila on `0600`, ja samaan
    hakemistoon syntyy `config.lock`. Kirjautuessa glab kutsui vain
    `GET /api/v4/user`; tunnuksen oikeuksia se ei tarkistanut.
  - Tiedoston rakenne: `hosts.<host[:port]>` sisältää kentät `token`, `user`,
    `api_protocol`, `api_host`, `git_protocol`, `use_keyring`, `subfolder`, `ca_cert`,
    `skip_tls_verify`, `proxy`, `custom_headers` ja `client_id`. Yhdellä palvelimella
    on siis yksi merkintä. Ylätasolla on muun muassa `telemetry: true` ja
    `check_update: true` oletusarvoina.
  - `~/.gitconfig`-tiedostoon tuli `[credential "https://host:port"]`, jossa ensin
    tyhjä `helper =` ja sitten `helper = !<absoluuttinen polku glabiin> auth git-credential`.
    Rekisteröinti on siis rajattu URL:iin ja nollaa apuohjelmaketjun. Polku osoittaa
    glab-binääriin itseensä, joten se vanhenee, jos binääri on julkaisukohtaisessa
    hakemistossa.
  - `glab auth git-credential get` antoi tunnuksen pelkän palvelimen nimen
    perusteella. Se vastasi myös pyyntöön, jonka protokolla oli `http` (vaikka
    tiedostossa luki `api_protocol: https`), ja pyyntöön ilman polkua. Pyynnön,
    jossa oli eri `username`, se hylkäsi. Toisen palvelimen tai pelkän
    `localhost`-nimen se ohitti. `store` palautti virheen eikä muuttanut
    tiedostoa. Ympäristömuuttuja `GITLAB_TOKEN` ohittaa tiedoston tunnuksen.
- glabin lähdekoodi, tagi v1.124.0:
  - `internal/config/writefile.go` kirjoittaa tiedoston atomisesti (`renameio`).
  - `flock.go` sarjallistaa tunnusten kirjoitukset `config.lock`-tiedoston
    flockilla, ja lukon odotus aikakatkaistaan 3 sekunnissa.
  - `internal/oauth2/config.go` pyytää OAuthissa oikeudet
    `openid profile read_user write_repository api`, ja selaimen paluuosoite on
    `http://localhost:7171/auth/redirect`.
  - Itse ylläpidetylle palvelimelle tarvitaan ylläpitäjän rekisteröimä `client_id`.
    gitlab.comille glabissa on valmiiksi oma.
  - `token_source.go` uusii OAuth-tunnuksen ja kirjoittaa sen takaisin tiedostoon
    lukon alla. GitLabin refresh token on kertakäyttöinen.
- gitlab.comin rajapinta ilman tunnusta:
  - `/api/v4/user` ja `/api/v4/version` vastaavat `401` ja `application/json`.
  - Keyset-sivutus (`pagination=keyset&order_by=id`) antaa vain `Link: rel="next"`
    -otsakkeen, ja siinä on palvelimen täydentämä pitkä kyselyosa.
  - Offset-sivutus (`/groups/:id/projects`) antaa otsakkeet `x-total`, `x-next-page`
    ja `Link`.
  - `simple=true` jättää pois kentät `archived` ja `empty_repo`.
  - Sisäkkäisen projektin `http_url_to_repo` on muotoa
    `https://gitlab.com/gitlab-org/security-products/analyzers/semgrep.git`, ja
    `namespace.full_path` sisältää koko ryhmäpolun.
- Ubuntu-paketin `glab` versio on 1.36.0 (`apt-cache policy`). Se on vanha, joten
  Ubuntun paketti ei kelpaa.

**Vain dokumentaatiosta** (GitLabin dokumentaation lähde `gitlab-org/gitlab`,
`doc/`, päähaara 2026-10-26; viitataan versioihin 17.x–19.x):

- PAT-oikeudet ja niiden merkitys (`security/tokens/access_token_scopes.md`):
  - `read_api` antaa lukuoikeuden rajapintaan. `/user` on luettavissa
    tällä oikeudella (päätelty siitä, että `read_api` kattaa koko luku-API:n;
    varmistetaan Jarin tilillä).
  - `read_repository` sallii pullin Git-over-HTTPS:n kautta.
  - `write_repository` sallii pullin ja pushin, mutta ei toimi rajapinnan kanssa.
  - `api` antaa täyden kirjoitusoikeuden rajapintaan ja PAT:lle myös Gitiin.
  - `self_rotate` (17.9) antaa luvan uusia vain tämän tunnuksen.
- PAT vanhenee oletuksena enintään 365 päivässä (ylläpitäjä voi muuttaa,
  17.6:sta alkaen jopa 400). Vanhentumatonta tunnusta ei saa ilman ylläpitäjän
  asetusta, paitsi service accounteille.
- Tunnuksen luontisivulle voi esitäyttää kentät:
  `/-/user_settings/personal_access_tokens?name=…&description=…&scopes=read_api,write_repository`.
- Git over HTTPS hyväksyy minkä tahansa ei-tyhjän käyttäjänimen; tunnus kulkee
  salasanana. OAuth-tunnuksen kanssa suositeltu käyttäjänimi on `oauth2`.
- Fine-grained PAT on tuotannossa (GA) versiosta 19.2. Git vaatii oikeudet
  Code: Download/Push. Pakotuksen ollessa päällä gitlab.comin ylimmän tason ryhmä
  voi estää vanhan mallin PATit omissa projekteissaan, ja itse ylläpidetty
  palvelin voi estää niiden luonnin.
- `GET /personal_access_tokens/self` palauttaa tunnuksen tiedot: `scopes`,
  `expires_at` ja 19.5:stä alkaen `granular_scopes`. Sitä, toimiiko kutsu
  pelkällä `read_api`-oikeudella, **ei ole kokeiltu**.
- Projektilista `GET /projects`:
  - Ilman `membership=true` gitlab.com listaa kaikki näkyvät julkiset projektit,
    joita on miljoonia.
  - Offset-sivutus yltää 50 000 projektiin, keyset-sivutus pidemmälle
    (vain `order_by=id`).
  - `per_page` on enintään 100.
  - Yli 10 000 tuloksen kyselyistä puuttuvat `x-total` ja `x-total-pages`.
- gitlab.comin rajoitukset: `/projects`-listaus 2 000 pyyntöä / 10 min käyttäjää
  kohden, yksittäinen projekti 400/min ja tunnistettu API-liikenne yleisesti
  2 000/min.
- Rajapinta uudelleenohjaa GET-pyynnön, jos projekti on siirretty uuteen polkuun.
  Numeerinen id ei muutu.
- Ryhmiä voi olla sisäkkäin 20 tasoa. Projektin polku alkaa ja päättyy kirjaimeen
  tai numeroon, sallitut merkit ovat `[A-Za-z0-9_.-]`, peräkkäisiä erikoismerkkejä
  ei sallita eikä loppua `.git` tai `.atom`.
- Ryhmän ja projektin access tokenit (bot-käyttäjä): gitlab.comissa ryhmätunnus
  vaatii Premiumin. Niihin ei sovelleta SSO-pakotusta, PAT:iin sovelletaan.
  Jos ryhmä pakottaa ”SSO-only for Git”, henkilöllä täytyy olla voimassa oleva
  SSO-istunto jossain selaimessa ennen kuin Git toimii.
- OAuth: authorization code (PKCE:n kanssa tai ilman) ja device authorization grant
  (yleisesti saatavilla 17.9:stä). Access token on voimassa 7 200 sekuntia, ja
  refresh token uusitaan joka kerta. Sovelluksia on kolmea tasoa: käyttäjän,
  ryhmän ja palvelimen (instance-wide).

**Ei kokeiltu oikealla GitLab-tilillä.** Ne kohdat odottavat Jarin tunnusta;
katso ”Testattavaa Jarin tilillä”.

## Löydökset kysymyksittäin

### 1. Tunnistautuminen

**PAT on oikea ensimmäinen askel.** Se toimii samalla tavalla gitlab.comissa ja
itse ylläpidetyllä palvelimella. Ylläpitäjää ei tarvita, ja kaava on sama kuin
Gitean osoite + tunnus -lomakkeessa. Oikeuksiksi ohjataan `read_api` +
`write_repository`. Tämä on pienin pari, jolla saa listauksen, kloonin ja pushin.
`api` antaisi kirjoitusoikeuden koko rajapintaan, mitä Habitat ei tarvitse.
Lomakkeen ohje voi linkittää esitäytettyyn luontisivuun (`…/-/user_settings/personal_access_tokens?name=Habitat&scopes=read_api,write_repository`),
jolloin henkilö valitsee vain vanhenemispäivän.

Agentti tai ihminen, joka käyttää `glab`ia shellissä, tarvitsee monissa
komennoissa (merge requestit, issuet) `api`-oikeuden. glab käyttää samaa
tiedoston tunnusta, joten tässä on todellinen valinta: suppea tunnus, jolla
glabin kirjoittavat komennot epäonnistuvat, tai laaja tunnus, jolla Pi voi
muokata kaikkea GitLabissa. Gitean kohdalla sama kysymys ratkaistiin
agenttivaroituksella. Suosittelen samaa: lomake ohjaa suppeaan oikeuteen,
hyväksyy myös `api`-oikeuden ja kertoo, mitä se merkitsee agenteille.

**Fine-grained PAT** pitää hyväksyä, koska pakottava organisaatio sallii vain
sen. Tarkistus toimii samoin kuin Gitealla, eli tehdään ne lukuoperaatiot,
joita adapteri todella käyttää (`/user` ja yksi `/projects`-sivu). Pushin
valmiuden voi päätellä vain vanhan mallin oikeuksista (`write_repository` tai
`api`). Fine-grained-tunnukselle sen tila on ”ei tiedossa”, kunnes push
onnistuu tai epäonnistuu.

**Ryhmän tai projektin access token** toimii lomakkeessa sellaisenaan. `/user`
palauttaa bot-käyttäjän, ja `membership=true` listaa ryhmän projektit.
Commitin tekijä tulee henkilön omasta Git-konfiguraatiosta, pushaaja on botti.
Tämä on ulkopuolisen käyttäjän tapauksessa todennäköisesti hyödyllinen: yrityksen
ryhmätunnus voi rajata pääsyn yhteen asiakasryhmään. Erillistä tukea ei tarvita.

**OAuth** on luontevampi kokemus (ei tunnuksen kopiointia), mutta siihen liittyy
kolme vaikeutta:

- glab pyytää aina `api`-oikeuden.
- Itse ylläpidetyllä palvelimella tarvitaan ylläpitäjän rekisteröimä sovellus.
- Kahden tunnin tunnus pitää uusia kertakäyttöisellä refresh tokenilla. Sen tekee
  joko glab tai Habitatin apuohjelma, ja silloin kumpikin kirjoittaa samaa
  tiedostoa. glabin oma uusinta käsittelee kilpailun prosessien välillä
  (”adopt the winner”), mutta Habitatin apuohjelman pitäisi toteuttaa sama
  protokolla.

Device flow sopii Habitatin sääntöön, jonka mukaan palveluntarjoajan suostumus
annetaan selaimen URL:lla tai laitekoodilla. Esimerkiksi daemon ajaisi
`glab auth login --device` ja välittäisi koodin selaimelle. Se on kuitenkin
oma kokonaisuutensa, ks. vaihtoehto D.

### 2. Repojen ja ryhmien listaus ja sivutus

Henkilön oma inventaario on `GET /api/v4/projects?membership=true&archived=false`.
Arkistoidut kannattaa joko jättää pois tai näyttää kuten Gitealla, mikä on
prototyypin päätettävä. Ilman `membership=true` gitlab.com palauttaa koko
julkisen maailman, joten parametri on pakollinen eikä vapaaehtoinen suodatin.

Sivutukseen sopii keyset (`pagination=keyset&order_by=id&sort=asc&per_page=100`),
jossa seuraava sivu otetaan `Link: rel="next"` -otsakkeesta. Gitea-koodin
`nextPage`-sääntö (linkki tarkistetaan, sitä ei seurata mielivaltaisena URL:na)
siirtyy suoraan, kunhan se sallii keyset-kursorin (`id_after=<numero>`) ja
palvelimen lisäämät kyselyparametrit. Seuraava pyyntö rakennetaan itse samasta
perusosoitteesta ja edellisen sivun viimeisestä id:stä (`id_after`). Linkistä
tarkistetaan vain, että se on olemassa ja on sama polku samassa perusosoitteessa.
Listan valmistumisen voi päätellä vain linkin puuttumisesta, koska `x-total`
puuttuu isoista tuloksista eikä keyset-sivutus anna sitä lainkaan. Tämä sopii
Gitean ”complete vain, kun loppu nähtiin” -periaatteeseen.

Kentät otetaan täydestä vastauksesta, ei `simple=true`-muodosta, koska tarvitaan
`archived` ja `empty_repo`. Vastauksen koko kasvaa, joten sivukohtainen
tavuraja on asetettava suuremmaksi kuin Gitealla. Sopiva koko mitataan Jarin
tilillä.

Ryhmiä ei tarvitse listata erikseen. `namespace.full_path` ja `namespace.kind`
riittävät ryhmittelyyn ja hakuun yhteisessä listassa. Ryhmäpuu (`/groups`) olisi
uusi käyttöliittymäkäsite, jota Gitea- ja GitHub-listoissa ei ole. Jos prototyyppi
haluaa ryhmäsuodattimen, se rakennetaan projekteista.

Yksittäisen projektin haku tehdään numeerisella id:llä
(`GET /projects/:id`), kuten Gitealla. Polulla haettaessa GitLab voi ohjata
uudelleen siirrettyyn projektiin. Gitea-asiakkaan ”ei uudelleenohjauksia”
-sääntö pysyy, eikä id:llä haettaessa uudelleenohjausta pitäisi tulla.

`http_url_to_repo` muodostuu GitLabin `external_url`-asetuksesta. Gitea-koodi
hylkää repon, jonka ilmoitettu clone-osoite ei ole täsmälleen sama kuin
kytketyn perusosoitteen alla laskettu, ja sama sääntö on tarpeen tässä, jotta
tunnusta ei lähetetä minnekään muualle. Itse ylläpidetyllä palvelimella, jonka
`external_url` on väärin (esimerkiksi `http://` tai sisäverkon nimi), kaikki
repot jäisivät pois. Se pitää näyttää omana selkeänä virheenään eikä tyhjänä
listana.

### 3. HTTPS-kloonaus ja push natiivilla credential-tuella

Mekanismi on sama kuin Gitealla. Remote on tunnukseton
`https://host/ryhmä/…/projekti.git`, ja kloonin oma
`credential.<remote>.username` valitsee tilin. URL-rajattu apuohjelma, jossa on
`useHttpPath=true`, antaa tunnuksen vain HTTPS:lle, täsmälleen samalle
palvelimelle ja portille ja polulle perusosoitteen alla. Erot Gitea-koodiin:

- **Polkusääntö.** `repoUnder` hyväksyy nyt täsmälleen kaksi segmenttiä.
  GitLabille hyväksytään 2–21 segmenttiä (ryhmä + enintään 19 aliryhmää + projekti),
  joista jokainen on GitLabin sallittu polku. Viimeinen voi päättyä `.git`.
  Lisäksi hylätään GitLabin reittisegmentti `-`, joka ei koskaan ole projektin
  osa (`/-/`).
- **Rinnakkaiset perusosoitteet** (`subfolder`, esim. `https://host/gitlab`) ovat
  GitLabissa harvinaisia, mutta glab tukee niitä. Gitea-koodin
  ”pisin perusosoite voittaa” -sääntö siirtyy sellaisenaan.
- **Tilin valinta.** Koska glabissa on yksi tili palvelinta kohden, apuohjelman
  valinta yksinkertaistuu: palvelin + perusosoite antaa enintään yhden merkinnän,
  jonka `user`-kentän on vastattava pyydettyä käyttäjänimeä.
- **Kirjautumisnimi Gitille** on GitLabin käyttäjänimi `/user`-vastauksesta. GitLab
  ei tarkista käyttäjänimeä, mutta sitä tarvitaan kloonin tilivalintaan.
- **Virhetilat.** SSO-pakotus ja vanhentunut tai peruttu tunnus näkyvät Gitissä
  HTTP 401/403 -virheinä. Kloonaustyön tulee näyttää ne kiinteinä koodeina
  (”tunnus ei kelpaa tai SSO-istunto puuttuu”) eikä Gitin tekstinä.

glabin oma apuohjelma toimisi teknisesti, mutta se tarkistaa vain palvelimen
nimen. Se ohittaa protokollan, polun ja perusosoitteen ja antaa
`GITLAB_TOKEN`-ympäristömuuttujan ohittaa tiedoston tunnuksen. Lisäksi sen
rekisteröinti sisältää glab-binäärin absoluuttisen polun. Nämä ovat samat syyt,
joiden vuoksi ADR 0031 hylkäsi tean apuohjelman sellaisenaan.

### 4. Natiivi CLI (glab) ja sen tunnusten tallennus

- Tiedosto on `~/.config/glab-cli/config.yml` (tai `$XDG_CONFIG_HOME/glab-cli/` ja
  `GLAB_CONFIG_DIR`), tilaltaan `0600`. Kirjoitus on atomista, ja tunnusten
  kirjoitukset sarjallistetaan `config.lock`-flockilla. Tämä on tean käytäntöä
  turvallisempi: tea katkaisee tiedoston paikallaan.
- glab 1.124 tallentaa oletuksena **käyttöjärjestelmän avainnippuun** (Secret Service),
  jos sellainen on saatavilla, ja muuten selväkieliseen tiedostoon. Habitatin
  palvelimella daemonin ympäristössä ei normaalisti ole Secret Serviceä, joten
  tulos on tiedosto. Henkilön oma shell-istunto voi kuitenkin olla eri tilanteessa,
  joten käyttäytyminen ei ole ennustettavaa. Habitatin kirjoittamassa merkinnässä
  on siksi oltava `use_keyring: "false"`. Avainnippuun tallennettu merkintä, jonka
  henkilö on tehnyt itse, näkyy Koodipalveluissa ”ei tuettu tässä” -tilassa
  (kuten tean OAuth- ja SSH-merkinnät), eikä Habitat lue avainnippua.
- Merkintä on avainnettu nimellä `host[:port]`, joten yksi tili palvelinta kohden.
  Kaksi saman palvelimen tiliä jäävät glabin mallissa mahdottomiksi.
- Merkinnät, joissa on `skip_tls_verify`, `ca_cert`, `client_cert`, `proxy`,
  `custom_headers`, `api_protocol: http` tai `api_host` eri kuin palvelin, ovat
  adapterille ”ei tuettu”. Ne ovat glabin omia tapoja ohittaa juuri ne säännöt,
  joita adapteri valvoo (TLS ja egress).
- glab kirjoittaa ensimmäisellä käynnistyskerralla oletusasetukset, muun muassa
  `telemetry: true` ja `check_update: true`. Telemetrian lähettämistä ei tutkittu.
  Kirjoitetaanko oletukset Habitatin luomaan tiedostoon, on toteutuksen
  päätettävä asia (Habitat kirjoittaa vain oman `hosts`-merkintänsä).
- Ubuntun glab (1.36.0) on liian vanha. Kelpuutettu glab toimitetaan samoin kuin
  tea, eli tarkkana allekirjoitettuna arkistona integrations-profiilissa
  (MIT-lisenssi, NOTICE).

### 5. Mitä Gitea-toteutuksesta voi käyttää uudelleen

| Osa | Gitea-toteutus | GitLabille |
|---|---|---|
| Osoitteen jäsennys (`ParseBase`) | `nativegitea/base.go` | Sellaisenaan, siirrettynä yhteiseen pakettiin |
| Egress-tarkistettu HTTP-asiakas, TLS, ei uudelleenohjauksia, JSON-vaatimus | `nativegitea/client.go` | Sama; otsake `PRIVATE-TOKEN` tai `Authorization: Bearer`, polku `/api/v4` |
| Credential-protokollan jäsennys ja vastaus | `nativegitea/credential.go` | Sellaisenaan; `match` ja `repoUnder` GitLab-kohtaisiksi |
| Git-konfiguraation apuohjelmarekisteröinti, `current`-polku | `nativegitea/gitconfig.go` | Sama logiikka, apuohjelman argumentit `gitlab git-credential` |
| Natiivitiedoston turvallinen elinkaari (omistaja, tila, symlinkit, lukko, atominen korvaus) | `nativegitea/store_linux.go`, `lifecycle_linux.go` | Sama periaate, glabin tiedosto ja `config.lock` |
| YAML-merkintöjen projektio (`Login`, `Kind`, `ConnectionID`) | `nativegitea/logins.go` | Uusi: glabin `hosts`-kartta, yksi merkintä per palvelin |
| Repolista ja sivutus | `nativegitea/repos.go` | Uusi: keyset, `membership`, sisäkkäiset polut, `empty_repo` ja `archived` |
| Kloonaustyöt, keskeytyneen kloonin tunnistus | `daemon/gitea_clone_linux.go`, `github_interrupted_linux.go` | Sama työmalli; lähde `gitlab`, polkusääntö ja `full_name` sisäkkäisiksi |
| Katalogi ja reitit | `daemon/integrations/gitea_linux.go` | Sama muoto, uusi provider |
| Sopimukset | `gitea-connection*.schema.json`, `gitea-repos.schema.json`, `github-clone.schema.json` | GitLab-vastineet; `full_name` voi olla pidempi ja sisäkkäinen |
| Käyttöliittymä | `GiteaConnection.tsx`, Koodipalvelut, `ClonePage`, `NewWorkspacePage` | Lomake samaa kaavaa; lisänä tunnuksen vanhenemispäivä, oikeustila ja `gitlab.com` oletusosoitteena |

Suosittelen erillistä pakettia `internal/nativegitlab`. Yhteiset, provider-riippumattomat
osat (perusosoite, rajattu HTTP-asiakas, credential-protokolla,
gitconfig-rekisteröinti, tiedostojen elinkaaren apufunktiot) siirretään ensin
yhteiseen pakettiin, joka toimii samaan tapaan kuin `egress/`. Yleistä
”forge”-rajapintaa ei tehdä etukäteen. Sisäkkäiset polut, sivutus ja natiivitiedostot
eroavat niin paljon, että yhteinen abstraktio piilottaisi juuri ne kohdat,
joissa virheet syntyvät.

### 6. gitlab.com ja itse ylläpidetty palvelin

Ero on pieni, kun tunnistautuminen tehdään PAT:lla. Itse ylläpidetyllä
palvelimella on lisäksi nämä riskit:

- yksityinen CA, joka on asennettava käyttöjärjestelmän luottamusvarastoon
  ylläpitäjän toimesta, kuten ADR 0031:ssä
- väärä `external_url`
- relative URL (`subfolder`)
- vanha GitLab-versio: `self_rotate` ja fine-grained eivät ole saatavilla, ja
  device flow vaatii 17.9:n

Lomakkeen oletusosoite on `gitlab.com`. Itse ylläpidetyn osoite kirjoitetaan
samaan kenttään, kuten Gitealla.

## Vaihtoehdot

**A. glabin tiedosto ainoana varastona, Habitatin rajattu adapteri ja oma
credential-apuohjelma (ADR 0031:n malli).** Daemon tarkistaa PAT:n muistissa
(`/user`, yksi `/projects`-sivu ja tunnuksen tiedot), kirjoittaa vain glabin
`hosts`-merkinnän glabin lukon alla ja rekisteröi `gitlab git-credential`
-apuohjelman URL-rajattuna. glab toimitetaan shelliä ja Piitä varten, ja se
lukee saman tunnuksen.

- Plussat: sama turvamalli ja koodipohja kuin Gitealla, yksi tunnuskopio, tarkka
  polku- ja protokollasääntö, natiivi glab toimii heti.
- Miinukset: glabin YAML-muoto ja lukko ovat uusi riippuvuus. Kaksi saman
  palvelimen tiliä ei ole mahdollista. Tunnuksen vanheneminen pitää näyttää.

**B. glab sellaisenaan.** Daemon ajaa
`glab auth login --stdin --hostname … --setup-git-credential-helper`, ja glabin
oma apuohjelma hoitaa Gitin.

- Plussat: vähiten koodia. Kokeiltu toimivaksi ei-interaktiivisesti.
- Miinukset: apuohjelma tarkistaa vain palvelimen nimen (ohittaa protokollan,
  polun ja perusosoitteen), ja `GITLAB_TOKEN` ohittaa sen. gitconfigiin jää glabin
  julkaisukohtainen polku. Tallennuspaikka riippuu avainnipun saatavuudesta.
  Tarkistuksena on vain `/user`. API-luvut (lista) tarvitsevat silti oman
  asiakkaan, koska `glab api` on mielivaltainen HTTP. ADR 0031 hylkäsi tean
  vastaavan käytön samoista syistä.

**C. Habitatin oma varasto (Git credential store tai oma tiedosto) ja oma API-asiakas.**
Hylätään samoin kuin ADR 0031:ssä. Se olisi toinen tunnuskopio ja toinen
yhteysrekisteri, eikä glab näkisi yhteyttä.

**D. OAuth device flow glabin kautta** (A:n laajennus myöhemmin). Daemon ajaa
`glab auth login --device --insecure-storage`, ja selain näyttää koodin ja
osoitteen. gitlab.comissa käytetään glabin omaa `client_id`:tä.

- Plussat: ei kopioitavaa tunnusta, ei vanhenemispäivän hallintaa.
- Miinukset:
  - Oikeus on aina `api`.
  - Itse ylläpidetty palvelin tarvitsee ylläpitäjän sovelluksen.
  - Kahden tunnin tunnus on uusittava, ja Habitatin apuohjelman pitäisi uusia
    se glabin lukkoprotokollalla ja kertakäyttöisellä refresh tokenilla tai
    delegoida se glabille.
  - Riippuvuus siihen, että glabin julkinen `client_id` pysyy gitlab.comissa.
  - Jos Habitat rekisteröisi oman OAuth-sovelluksensa, sen tiedot menisivät
    rootin integrations.json-tiedostoon (ADR 0030:n malli).

## Mitä tämä koskettaa auktoriteettijaossa (Jarin päätökset)

Suositeltu vaihtoehto A **ei siirrä auktoriteettia**. Tilanne on sama kuin Gitealla:

- Gateway todentaa istunnon, tarkistaa CSRF:n ja rajat ja välittää pyynnön
  henkilön daemonille jäsentämättä tai kirjaamatta tunnusta. Sille ei tule
  GitLab-asiakasta eikä yhteisiä tunnuksia.
- Daemon kutsuu GitLabia, kirjoittaa glabin tiedoston henkilön UID:llä ja ajaa
  kloonaustyöt.
- Provision ei muutu: ei uutta broker-reittiä, eikä root lue kotihakemistoja.
- Credential-apuohjelma on binäärin CLI-lehti, joka lukee glabin tiedoston
  suoraan eikä kutsu daemonia tai gatewayta.

Jarin päätettäviä asioita on kolme:

1. **Natiivi omistaja ja formaattiriippuvuus.** Hyväksytäänkö glab ja sen
   `config.yml` GitLab-yhteyden ainoaksi varastoksi samaan tapaan kuin tea
   Gitealle (ADR 0031)? Tämä on arkkitehtuuripäätös, joka kirjataan uudeksi
   ADR:ksi tai ADR 0031:n laajennukseksi.
2. **Yksi GitLab-tili palvelinta kohden.** Hyväksytäänkö glabin rajoitus
   tuotteen rajoitukseksi? Vaihtoehto olisi Habitatin oma toinen varasto, mikä
   rikkoisi natiiviperiaatteen. Suosittelen hyväksymistä: ulkopuolisen käyttäjän
   tapaus on yksi yritystili, ja toinen tili onnistuu ryhmätunnuksella toisella
   palvelimella tai erillisellä Unix-käyttäjällä.
3. **OAuth.** Jätetäänkö OAuth (vaihtoehto D) myöhemmäksi omaksi päätöksekseen?
   Jos Habitat joskus rekisteröi oman GitLab-sovelluksen, sen `client_id` ja
   mahdollinen salaisuus kuuluvat rootin `integrations.json`-sovellusosioon ADR 0030:n
   mallin mukaan. Silloin broker kirjoittaa ylläpitäjän pyynnöstä, mikä on
   olemassa oleva reitti eikä uusi auktoriteetti. Device flow julkisella
   client_id:llä ei tarvitse sitäkään.

Pienempiä asioita, jotka toteutus voi ratkaista ja kirjata päätöksinä:

- arkistoitujen projektien näyttäminen
- glabin oletusasetusten (telemetria) käsittely
- tunnuksen vanhenemisvaroituksen raja

## Suositus

Valitaan **A**: glabin `config.yml` on ainoa varasto, ja `internal/nativegitlab`
tarjoaa rajatun adapterin ja `gitlab git-credential` -apuohjelman. Tunnistautuminen
tehdään PAT:lla (`read_api` + `write_repository`, myös `api` ja fine-grained hyväksytään
selityksen kanssa), kloonaus olemassa olevilla kloonaustöillä ja glab toimitetaan
tarkkana arkistona. Ennen GitLab-koodia erotetaan Gitea-koodista yhteiset osat
pieneen yhteiseen pakettiin. Sisäkkäiset polut ovat koko toteutuksen tärkein
uusi testattava asia, ja ne vaikuttavat apuohjelman sääntöön, sopimuksiin ja
keskeytyneen kloonin tunnistukseen.

`proto-gitlab-connect`-kierrokselle tästä seuraa:

- Lomake: osoite (oletuksena `gitlab.com`) ja tunnus sekä linkki esitäytettyyn
  tunnuksen luontisivuun.
- Virhetilat: väärä osoite tai ei GitLab, TLS, tunnus ei kelpaa tai vanhentunut,
  puuttuva oikeus (lista toimii, push ei), SSO-istunto puuttuu ja väärä
  `external_url`.
- Yhteyden tila: tunnuksen vanhenemispäivä ja pushin valmius
  (”kyllä”, ”ei” tai ”ei tiedossa”).
- Yhteiseen listaan tulevat sisäkkäiset ryhmäpolut (`ryhmä/aliryhmä/projekti`) ja
  ryhmäsuodatin, joka rakennetaan projekteista.

## Testattavaa Jarin tilillä

Jari ajaa nämä itse omassa shellissään. Tunnusta ei liitetä keskusteluun,
komentoriville eikä tähän repoon. Tunnus luetaan tiedostosta
(`curl -H @tiedosto`, jossa tiedostossa on rivi `PRIVATE-TOKEN: …`, tila
`0600`), ja tiedosto poistetaan lopuksi.

1. `GET /api/v4/personal_access_tokens/self` tunnuksella, jolla on pelkkä
   `read_api` + `write_repository`: toimiiko, ja näkyvätkö `scopes` ja `expires_at`?
2. `GET /api/v4/projects?membership=true&pagination=keyset&order_by=id&sort=asc&per_page=100`:
   sivujen määrä, sivun tavukoko ja `Link`-otsakkeen muoto. Näkyvätkö ryhmän
   kautta saadut projektit?
3. Kloonaus ja push sisäkkäiseen ryhmäprojektiin Gitillä, kun käytetään
   väliaikaista apuohjelmaa, joka lukee tunnuksen tiedostosta. Mitä
   `path`-attribuuttia Git lähettää, kun `useHttpPath=true`?
4. Pelkällä `read_api`-tunnuksella: millä koodilla ja tekstillä push hylätään?
   Tämä määrää virhekoodin.
5. Kun glab käyttää samaa tiedostoa: toimivatko `glab repo list` ja `glab mr list`
   suppealla tunnuksella, ja mitkä komennot vaativat `api`-oikeuden?

## Lähteet

- GitLabin dokumentaatio, `gitlab-org/gitlab`, `doc/` (päähaara, haettu
  2026-10-26): `user/profile/personal_access_tokens.md`,
  `security/tokens/access_token_scopes.md`, `auth/tokens/fine_grained_access_tokens.md`,
  `auth/tokens/fine_grained_access_tokens_other.md`, `api/personal_access_tokens.md`,
  `api/projects.md`, `api/rest/_index.md`, `user/gitlab_com/rate_limits.md`,
  `api/oauth2.md`, `integration/oauth_provider.md`,
  `user/group/settings/group_access_tokens.md`, `user/group/saml_sso/_index.md`,
  `user/reserved_names.md`, `user/group/subgroups/_index.md`.
- glab v1.124.0, `gitlab-org/cli`: julkaisuarkisto ja `checksums.txt`, `glab auth login --help`,
  `internal/oauth2/{config,token_source}.go`, `internal/config/{writefile,flock,flock_unix}.go`.
- gitlab.comin julkinen REST API ilman tunnusta (vastaukset ja otsakkeet,
  2026-10-26).
- Repon oma: ADR 0024, ADR 0031, `internal/AGENTS.md`, `internal/nativegitea/`,
  `internal/daemon/gitea_clone_linux.go`, `internal/daemon/integrations/gitea_linux.go`,
  `contracts/v1/github-clone.schema.json`.

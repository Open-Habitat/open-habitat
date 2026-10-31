# Vertailu: JupyterHub (SystemdSpawner, idle-culler, OAuthenticator)

Tutkimusajo `01m68hqwwm215yz17mbzpnw471`, 31.10.2026. Lähteinä ovat
JupyterHubin, SystemdSpawnerin, jupyterhub-idle-cullerin, OAuthenticatorin,
SudoSpawnerin ja The Littlest JupyterHubin (TLJH) repot ja lähdekoodi
(commitit lähdeluettelossa, luettu 31.10.2026), niiden repoissa oleva
dokumentaatio, GitHubin tietoturvatiedotteet (GHSA) API:n kautta, PyPI-tilastot
ja Hacker Newsin Algolia-haku. Open Habitatin puoli on luettu tämän repon
koodista (commit `15d78618`), ja kaksi asiaa on tarkistettu ajossa
Habitat-palvelimella `birch`. Merkintä **(lähde)** tarkoittaa, että asia lukee
lähteessä tai koodissa, **(havainto)** sitä, että mittasin sen itse, ja
**(päättely)** omaa tulkintaani.

## Tiivistelmä

JupyterHub on vuodesta 2014 kehitetty BSD-lisensoitu monen käyttäjän
palvelin. Hub tunnistaa käyttäjän (tässä GitHubin kautta OAuthenticatorilla),
spawner käynnistää hänelle oman palvelinprosessin hänen Unix-tunnuksellaan
(SystemdSpawner tekee jokaisesta oman systemd-yksikön muisti- ja
CPU-rajoineen), ja idle-culler sammuttaa joutilaat palvelimet. Se on Open
Habitatin perusmallin kypsin olemassa oleva toteutus, ja sen kymmenen vuoden
kokemus on kirjattu poikkeuksellisen suoraan dokumentaatioon ja
tietoturvatiedotteisiin. Vertailun keskeinen tulos on, että **Open Habitat on
jo ottanut käyttöön JupyterHubin tärkeimmän opetuksen yhteisestä originista**.
Käyttäjän hallitsemaa koodia ajavat osat (code-server, agentin HTML-näkymät ja
jaetut linkit) ovat omilla hosteillaan, evästeet ovat `__Host-`-evästeitä ja
kirjoitukset vaativat tarkan Originin ja CSRF-otsakkeen. Kaikki nämä
JupyterHub on joutunut lisäämään jälkikäteen tiedotteiden seurauksena.
Valtuuksien jaossa Open Habitat on JupyterHubia tiukempi: hub ajetaan
SystemdSpawnerin kanssa rootina, ja sen admin-rooli pääsee jokaisen käyttäjän
palvelimelle. Tärkein puute löytyi resursseista. **Selaimesta käynnistetty
Pi ja kaikki sen työkalujen käynnistämät prosessit ajetaan daemonin
järjestelmäyksikössä `system.slice`-puussa ilman muistirajaa**, joten
ylläpito-oppaan neuvo asettaa rajat `user-<uid>.slice`-tasolle ei koske niitä.
SystemdSpawnerin malli, jossa jokaisella käyttäjällä on oma yksikkönsä ja sille
oma `MemoryMax`, on tähän valmis vastaus. Puutteesta on avattu intake-issue
`daemon-pi-outside-user-slice`. Muut suositukset ovat
puolustusta syvyyssuunnassa: sovellusoriginille tiukka `script-src`-CSP,
gatewaylle sallittujen Content-Type-arvojen lista daemonin vastauksille,
käyttäjäkohtainen `/tmp` myös terminaaleille ja editorille sekä yläraja sille,
kuinka kauan luonnos pitää Pi:tä hereillä.

## 1. Mikä JupyterHub on ja kenelle

JupyterHub kuvaa itsensä "simple multi-user server for modestly sized groups"
**semi-trusted**-käyttäjille. Se toteaa suoraan, että se "is not suitable for
untrusted users in its default configuration" ([Security overview][websec])
**(lähde)**. Käyttäjiä ovat yliopistokurssit, tutkimusryhmät, yritysten
datatiimit ja julkiset palvelut kuten mybinder.org ([Capacity
planning][capacity]) **(lähde)**. Tässä vertailussa tarkastellaan kokoonpanoa,
joka on lähinnä Open Habitatia: yksi Linux-palvelin, GitHub-kirjautuminen
(OAuthenticator), jokaiselle ihmiselle oma Unix-tunnus ja oma systemd-yksikkö
(SystemdSpawner) sekä joutilaiden sammutus (idle-culler). Juuri tämä
yhdistelmä on The Littlest JupyterHubin (TLJH) oletus, sillä TLJH on projektin
virallinen "yksi palvelin, muutama sata käyttäjää" -jakelu ([TLJH
spawner][tljh-spawner]) **(lähde)**. Notebook-ominaisuudet on rajattu pois
vertailusta.

## 2. Arkkitehtuuri

### Missä prosessit ajetaan

JupyterHubissa on kolme osaa ([Concepts][concepts]) **(lähde)**:

- **Hub** (Python ja Tornado) hoitaa kirjautumisen, tietokannan (käyttäjät,
  palvelimet, tokenit ja roolit), REST API:n ja spawnerin.
- **Proxy** (configurable-http-proxy tai Traefik) on ainoa julkinen kuuntelija.
  Se reitittää polun `/hub/` hubille ja polun `/user/<nimi>/` kyseisen
  käyttäjän palvelimelle. Hub päivittää reitit proxyyn.
- **Single-user server** (`jupyterhub-singleuser`, eli Jupyter Server ja
  JupyterLab) ajetaan käyttäjänä. Selain puhuu sille suoraan proxyn läpi, ja
  hub ei ole datapolulla.

SystemdSpawner käynnistää jokaisen palvelimen komennolla `systemd-run`
transienttina järjestelmäyksikkönä `jupyter-{USERNAME}-singleuser`, jossa on
`--uid=<käyttäjä>`. Yksikkö saa konfiguraatiosta ominaisuudet `MemoryMax`,
`CPUQuota`, `PrivateTmp`, `PrivateDevices`, `NoNewPrivileges` sekä
`ReadOnlyDirectories`- ja `ReadWriteDirectories`-listat, ja valinnaisesti
`--slice=`, jolloin kaikille käyttäjille yhteinen raja asetetaan slicen
tasolle ([`systemdspawner.py`][sds-py] r. 140–146 ja 257–339,
[`systemd.py`][sds-systemd]) **(lähde)**. Ympäristömuuttujat, hubin API-token
mukaan lukien, kirjoitetaan `0700`-hakemistossa olevaan `EnvironmentFile`-
tiedostoon. Tämä on korjaus tiedotteeseen [GHSA-cg54-gpgr-4rm6][ghsa-cg54]:
token oli aiemmin yksikön ympäristössä, jonka jokainen käyttäjä näki komennolla
`systemctl show` **(lähde)**.

### Valtuudet ja eristys

- **Hub on root.** SystemdSpawnerin README sanoo: "JupyterHub must be run as
  root to use Systemd Spawner … unrestricted access to `systemd-run` is
  equivalent to root" ([README][sds-readme]) **(lähde)**. Myös TLJH:n
  `jupyterhub.service` on `User=root` ([unit][tljh-unit]) **(lähde)**.
  Vaihtoehto on SudoSpawner, jossa hub ajetaan omana tunnuksenaan ja sudo
  sallii vain välittäjäskriptin, joka osaa kaksi asiaa: lähettää signaalin ja
  käynnistää single-user-palvelimen ([SudoSpawner][sudospawner]) **(lähde)**.
  Kumpikin malli tarkoittaa, että hubin vaarantuminen antaa pääsyn jokaisen
  käyttäjän tunnukselle **(päättely)**.
- **Tunnusten luonti.** TLJH luo Unix-tunnuksen `jupyter-<nimi>` ensimmäisellä
  käynnistyksellä spawnerissa (`useradd --create-home`, `chmod o-rwx`).
  Etuliite estää esimerkiksi nimen `root` käyttämisen. Jos tunnus on jo
  olemassa, `ensure_user` ottaa sen käyttöön sellaisenaan ([`user.py`][tljh-user],
  [Security considerations][tljh-sec]) **(lähde)**.
- **Admin-rooli on kaikkivoipa.** JupyterHubin oletusrooli `admin` sisältää
  muun muassa scopet `access:servers` (pääsy jokaisen käyttäjän palvelimelle,
  eli käytännössä hänen tiedostoihinsa ja kerneleihinsä), `tokens` ja
  `admin:users`, eikä roolia voi muokata ([`roles.py`][roles]) **(lähde)**.
  TLJH:ssa adminit lisätään ryhmään `jupyterhub-admins`, jolle annetaan
  `ALL = (ALL) NOPASSWD: ALL`. Ohjeen mukaan adminit voivat "look at other
  people's work, modify it", ja "if an admin's credentials are compromised …
  the entire JupyterHub is compromised" ([Security considerations][tljh-sec])
  **(lähde)**.
- **Pääsyn myöntäminen.** OAuthenticator 16:sta lähtien kukaan ei pääse
  sisään ilman nimenomaista `allow`-sääntöä. Säännöt laajentavat pääsyä
  toisistaan riippumatta (`allowed_users`, `allowed_organizations` …), ja
  `block_users` voittaa ne. Säännön poistaminen "only prevents future logins;
  it does not remove the user from the JupyterHub database" ([Allowing][allowing])
  **(lähde)**. Kirjautumiseväste on oletuksena voimassa 14 päivää
  (`cookie_max_age_days`, [`app.py`][app-cookie]) **(lähde)**, joten jo
  kirjautunut käyttäjä voi jatkaa siihen asti, ellei admin poista häntä
  **(päättely)**. GitHub-käyttäjän nimi otetaan oletuksena kentästä `login`
  (`username_claim`, [`github.py`][oa-github]) eli GitHubissa vaihdettavasta
  käyttäjänimestä, ei numeerisesta id:stä **(lähde)**.
- **Palveluntarjoajan tokenit.** Kun `enable_auth_state` on päällä, OAuth-
  access token ja refresh token tallennetaan hubin tietokantaan salattuna
  (`JUPYTERHUB_CRYPT_KEY`), ja ne voidaan välittää käyttäjän palvelimelle.
  OAuthenticator 17.2 lisäsi tokenien uusimisen `refresh_user`-mekanismiin
  (oletuksena viiden minuutin välein) ([Refreshing][refresh]) **(lähde)**.
- **Prosessien näkyvyys ja `/tmp`.** SystemdSpawner tarjoaa vaihtoehdot
  `isolate_tmp` ja `isolate_devices`, mutta molempien oletus on false
  ([README][sds-readme]) **(lähde)**. TLJH:n tietoturvasivun mukaan jaettu
  `/tmp` "has been a consistent source of security issues" ([Security
  considerations][tljh-sec]) **(lähde)**. JupyterHub ei itse piilota muiden
  käyttäjien prosesseja (hidepid); sitä ei mainita missään lukemassani
  lähteessä **(päättely)**.

### Yksi vai monta käyttäjää

JupyterHub on aidosti monen käyttäjän järjestelmä, ja jokaisella käyttäjällä
voi olla useita nimettyjä palvelimia. Versiosta 5 lähtien käyttäjä voi jakaa
oman palvelimensa toiselle (`shares`), mutta dokumentaation mukaan jakaminen
"by definition means users can serve each other files". Siksi se ei sovi
epäluotetuille käyttäjille ilman käyttäjäkohtaisia domaineja, eikä se ole
oletuksena päällä ([Security overview][websec]) **(lähde)**.

### Istunnot ja joutilaisuus

JupyterHubin perusyksikkö on käyttäjän palvelin. Se joko on käynnissä tai ei
ole, eikä sen sisäisiä kerneleitä tai terminaaleja säilytetä sammutuksen yli.
Dokumentti [JupyterHub and idleness][idle] on vertailun hyödyllisin yksittäinen
teksti joutilaisuudesta **(lähde)**:

- Joutilaisuudella on **kolme muotoa**: (1) selainta ei ole yhdistetty, (2)
  välilehti on auki mutta unohtunut taustalle ja (3) välilehti on auki ja
  fokuksessa. Toinen muoto on se, jonka ylläpitäjät useimmiten haluaisivat
  laskea joutilaaksi, mutta joka näyttää aktiiviselta, koska käyttöliittymä
  tekee kyselyjä taustalla.
- Aktiivisuutta tulee proxyn verkkoliikenteestä (karkea mittari: mikä tahansa
  pyyntö lasketaan), hubin API-pyynnöistä ja palvelimen omista ilmoituksista,
  joissa kernelit, terminaalit ja laajennukset ovat mukana. Tiedot
  päivittyvät viiden minuutin välein, joten sammutuksen aikarajan pitää olla
  vähintään kaksinkertainen.
- **jupyterhub-idle-culler** on erillinen hubin palvelu. Se lukee
  `last_activity`-kentän REST API:n kautta ja sammuttaa palvelimen, kun
  `--timeout` täyttyy (oletus 600 s). Valinnainen `--max-age` sammuttaa
  palvelimen tietyn iän jälkeen aktiivisuudesta riippumatta, ja
  `--cull-users` poistaa myös käyttäjän. JupyterHub 2.0:sta lähtien culler ei
  tarvitse admin-oikeuksia, vaan sille riittävät scopet `list:users`,
  `read:users:activity`, `read:servers` ja `delete:servers`
  ([README][culler]) **(lähde)**. TLJH:ssa culler on oletuksena päällä
  (600 s, tarkistus 60 s:n välein, ei max-agea) ([`configurer.py`][tljh-conf])
  **(lähde)**.
- Käyttäjälle on tarjottava **nimenomainen tapa pitää palvelin hereillä**
  (jupyter-keepalive), jotta hänen ei tarvitse keksiä keinotekoista
  aktiivisuutta, esimerkiksi jättää selainta auki yöksi ([idle][idle])
  **(lähde)**.

### Resurssit

[Capacity planning][capacity] tiivistää asian: "When tasks don't get enough
CPU, things are slow. When they don't get enough memory, things are broken."
Muistin ylimyynti, jossa varaus on pienempi kuin raja, johtaa siihen, että
"all kinds of hangs and crashes and weird errors. Very bad." **(lähde)**.
SystemdSpawner neuvoo asettamaan muistirajan, joka on 80–90 % fyysisestä
muistista, vaikka käyttäjien haluttaisiin käyttävän muistia vapaasti. Näin
yksi käyttäjä ei voi kaataa konetta. CPU jaetaan cgroupeittain, joten sadan
prosessin käyttäjä ei vie suoritinaikaa kahden prosessin käyttäjältä
([README][sds-readme]) **(lähde)**. TLJH:n oletuksena muistirajaa ei
kuitenkaan ole (`limits.memory: None`, [`configurer.py`][tljh-conf])
**(lähde)**. Levyn kiintiöistä JupyterHub ei huolehdi lainkaan.

### Miten selain pääsee natiiviin tilaan: yhteinen origin

Tämä on vertailun ydin. JupyterHub ajaa oletuksena hubin ja kaikkien
käyttäjien palvelimet samassa domainissa polkujen alla, ja sen
dokumentaatio sanoo seuraukset suoraan ([Security overview][websec])
**(lähde)**:

- "A user must **never** be able to write arbitrary HTML and serve it to
  another user on the Hub's domain." Suojana on se, että vain omistaja voi
  avata palvelimensa sivut. Tämä pitää kuitenkin vain, jos käyttäjä **ei voi
  muokata omaa palvelintaan**: hän ei saa asentaa paketteja sen ympäristöön,
  muuttaa sen `PATH`- tai muita ympäristömuuttujia eikä sen konfiguraatiota
  (`~/.jupyter`). Muuten käyttäjä voi poistaa suojaukset käytöstä omalta
  palvelimeltaan.
- Samassa originissa käyttäjän palvelimen sivu voi muuttaa Refereriä, tehdä
  täysin valtuutettuja pyyntöjä evästeineen ja lukea hubin tai toisen
  palvelimen sivuja popup-ikkunoiden kautta. Polkukohtaiset XSRF-tokenit eivät
  riitä, koska kaikkia pyyntöjä ne eivät suojaa ja toisten polkujen tokenit
  voidaan lukea.
- "**Subdomains are the only way to reliably isolate user servers from each
  other**", ja "JupyterHub makes no guarantees about protecting users from each
  other unless subdomains are enabled." Käyttäjäkohtaiset domainit
  (`subdomain_host`) vaativat wildcard-DNS:n ja -varmenteen, ja niitä ei
  siksi ole oletuksena päällä.
- **Cookie tossing:** palvelin vertais- tai alidomainissa voi asettaa evästeen,
  joka luetaan toisessa domainissa. Korjaus on `cookie_host_prefix_enabled`
  (`__Host-`-evästeet). Ohje suosittelee sitä vain käyttäjäkohtaisten domainien
  kanssa, koska samassa domainissa kaikki evästeet pitäisi silloin asettaa
  polulle `/`.
- Tokenia URL:ssa (`?token=`) ei hyväksytä versiosta 5.0 lähtien, koska
  käyttäjä pystyi sen avulla kirjaamaan toisen käyttäjän omalle
  palvelimelleen.
- CSP:n oletus on pelkkä `frame-ancestors 'none'`
  ([`handlers/base.py`][base-csp]). Tiukempi `sandbox allow-same-origin
  allow-scripts` jätetään pois, koska se rikkoo käyttöliittymän toimintoja.

Tiedotehistoria näyttää, mihin tämä on käytännössä johtanut
([GHSA-lista][ghsa-list]) **(lähde)**:

| Tiedote | Julkaistu | Vakavuus | Mitä |
|---|---|---|---|
| [GHSA-7r3h-4ph8-w38g][ghsa-7r3h] | 3/2024 | high | Self-XSS ja cookie tossing antoivat täyden pääsyn uhrin API:iin ja palvelimeen. Korjaus: käyttäjäkohtaiset domainit ja `__Host-`-evästeet |
| [GHSA-9x4q-3gxw-849f][ghsa-9x4q] | 8/2024 | high | Scope `admin:users` riitti tekemään itsestä täyden adminin |
| [GHSA-m68r-v472-jgq9][ghsa-m68r] | 5/2026 | medium | XSRF-suojaus tulkitsi `Sec-Fetch-Mode: no-cors` -pyynnöt saman originin pyynnöiksi, ja lomake-POSTit ohittivat sen |
| [GHSA-c4gm-pwx9-9w8j][ghsa-c4gm] | 8/2026 | high | Heijastettu XSS jakolinkissä (`/hub/accept-share`) |
| [GHSA-5jhc-4h3c-q97h][ghsa-5jhc] | 10/2026 | medium | Kun `setgroups()` epäonnistuu, käyttäjän prosessi perii hubin lisäryhmät |
| [GHSA-93gc-h923-mp36][ghsa-93gc] | 10/2026 | medium | Käyttäjien ja palvelujen nimiä ei validoitu riittävästi URL-osissa |
| [GHSA-hx46-2cv3-mh6g][ghsa-hx46] | 10/2026 | medium | Virheellinen spawner-valinta esti seuraavat käynnistykset ja vaati tietokannan käsin korjaamista |
| [GHSA-cg54-gpgr-4rm6][ghsa-cg54] (SystemdSpawner) | 12/2020 | high | Käyttäjien API-tokenit yksikön ympäristössä kaikkien luettavissa |
| [GHSA-384w-5v3f-q499][ghsa-384w] (OAuthenticator) | 11/2020 | high | Vanhentunut `whitelist`-asetus ohitettiin, ja kaikki tunnistautuneet pääsivät sisään |

Huomio: lähes kaikki vakavat tiedotteet koskevat joko yhteistä originia,
valtuuksien laajenemista roolin kautta tai sitä, että konfiguraatio oli eri
kuin ylläpitäjä luuli **(päättely)**.

## 3. Kypsyys ja lisenssi

Mittaukset GitHub API:sta ja pypistats.orgista 31.10.2026 **(lähde)**:

| Projekti | Luotu | Tähdet | Commitit | Tekijät | Uusin versio | PyPI-lataukset / kk |
|---|---|---|---|---|---|---|
| jupyterhub | 6/2014 | 8 360 | ~8 900 | ~400 | 6.1.1 (20.10.2026); 6.0.0 1.9.2026 | ~260 000 |
| oauthenticator | 9/2014 | 443 | ~1 900 | ~130 | 17.4.0 (26.3.2026) | ~90 000 |
| jupyterhub-idle-culler | 4/2020 | 117 | ~280 | ~25 | 2.0.0 (16.6.2026) | ~16 000 |
| systemdspawner | 9/2016 | 101 | ~270 | ~22 | v1.0.2 (20.10.2024) | ~3 200 |
| the-littlest-jupyterhub | 6/2018 | 1 147 | ~1 770 | ~93 | (repo päivitetty 8/2026) | – |

Kaikki ovat BSD-3-Clause-lisensoituja (idle-cullerin GitHub-merkintä on
"NOASSERTION", mutta sen `COPYING.md` on Modified BSD) **(lähde)**.
JupyterHub on Project Jupyterin ydinprojekti. Tietoturvaprosessi toimii:
tiedotteet julkaistaan GHSA:na ja korjaukset tuodaan myös edelliseen
pääversioon (6.1.0 ja 5.5.3) ([changelog][changelog]) **(lähde)**.
SystemdSpawner on selvästi hiljaisempi kuin ydin: viimeisin julkaisu on
vuodelta 2024, ja README:n lupaus "We will explore hardening approaches soon"
koskee root-vaatimusta **(lähde)**. TLJH kutsuu itseään betaksi, jota "should
not be used in security critical situations" ([Security
considerations][tljh-sec]) **(lähde)**. Hacker Newsissa toistuu sama
varaus: JupyterHubia ajetaan "selected *trustworthy* users" -ryhmille, koska
Jupyteriin pääsy vastaa shell-pääsyä ([HN 14034532][hn1]). Yksi käyttäjä
kuvasi SystemdSpawner-asennuksen ylläpitoa "kind of a pain" verrattuna
RStudio Serveriin ([HN 20181715][hn2]) **(lähde)**.

## 4. Rinnakkain Open Habitatin kanssa

Open Habitatin sarake perustuu tiedostoihin `docs/product.md`, juuren ja
`internal/`-hakemiston `AGENTS.md` sekä koodiin. Merkintä (havainto) viittaa
palvelimella `birch` tehtyyn mittaukseen.

| | JupyterHub + SystemdSpawner + OAuthenticator | Open Habitat |
|---|---|---|
| Julkinen kuuntelija | Proxy; selain puhuu käyttäjän palvelimelle suoraan | Gateway on jokaisen pyynnön välissä ja rakentaa daemonipyynnön itse |
| Kirjautuminen | Hub, OAuth GitHubiin, käyttäjänimi `login`-kentästä | Gateway, GitHub OAuth, numeerinen GitHub-id |
| Pääsypäätös | `allow_*`-säännöt konfiguraatiossa; poisto estää vain uudet kirjautumiset | Brokerin admission (root ja ajonaikainen). Poisto kirjaa ensin estomerkinnän ja poistaa istunnot |
| Istunnon kesto | Eväste 14 vrk | 90 vrk käyttämättömyys, 1 vuosi ehdoton |
| Unix-tunnuksen luonti | TLJH: spawner rootina, `useradd`, olemassa oleva tunnus otetaan käyttöön | Root-broker luo vain hyväksytylle; olemassa olevaa tunnusta ei koskaan oteta käyttöön |
| Kuka on root | Hub (SystemdSpawner, TLJH) | Vain broker, jolla ei ole verkkokuuntelijaa eikä yleistä komentorajapintaa |
| Kenellä on valtuus kaikkien käyttäjien puolesta | Hub (tokenit, spawn, `access:servers`) | Gateway: "A compromised gateway already acts as every bound person through their daemons" (ADR 0030); ei kuitenkaan rootina |
| Ylläpitäjä | `admin`-rooli pääsee jokaisen palvelimelle. TLJH:ssa lisäksi sudo ilman salasanaa | Hallitsee pääsyä, rooleja ja sivuston avaimia; ei pääse koteihin |
| Käyttäjän prosessi | Transientti järjestelmäyksikkö per käyttäjä, `MemoryMax`/`CPUQuota` konfiguroitavissa | Socket-aktivoitu `open-habitat-daemon@<user>.service`, jossa ei resurssirajoja; Pi-lapset ajetaan samassa yksikössä (havainto) |
| Muisti per ihminen | Yksikön `MemoryMax` (TLJH:n oletuksena ei rajaa) | Ei rajaa daemonille ja Pi:lle; opas neuvoo `user-<uid>.slice`, joka kattaa vain käyttäjäpalvelut (havainto) |
| Levy | Ei kiintiöitä | ext4-käyttäjäkiintiöt, kun sivusto ottaa ne käyttöön |
| `/tmp` | `isolate_tmp`, oletus false | Daemonilla `PrivateTmp`; terminaalit, editori ja Taskfleet näkevät koneen `/tmp`:n (havainto) |
| Muiden prosessit | Näkyvät | `hidepid=invisible` (havainto) |
| Joutilaat | idle-culler sammuttaa koko palvelimen (`last_activity`, 5 min tarkkuus) | Idle Pi pysäytetään 10 minuutin jälkeen ja jatkuu natiivista historiasta. Taustaprosessia tai Taskfleet-ajoa odottavaa ei pysäytetä. Enintään 4 elävää Pi:tä per ihminen. Editori sammuu 30 minuutin jälkeen |
| Käyttäjän sisältö selaimessa | Samassa originissa, ellei `subdomain_host` ole käytössä | Sovellusoriginilla vain gatewayn oma paketti ja daemonin JSON. Markdown sanitoidaan, esikatselu on `sandbox`-srcdoc. Editori ja näkymät ovat identiteetti- tai näkymäkohtaisilla hosteilla ja jaetut linkit omilla hosteillaan |
| Evästeet | `__Host-` valinnainen | `__Host-agent-host`, `__Host-oh-editor`, `__Host-oh-view` |
| Kirjoitusten suojaus | XSRF-tokenit; lomakkeiden ohitus korjattiin 2026 | Tarkka `Origin` ja CSRF-otsake jokaisessa kirjoituksessa |
| CSP sovellusoriginilla | `frame-ancestors 'none'` | `frame-ancestors 'none'; frame-src <näkymä- ja editorihostit>`, ei `script-src`:ia (havainto: `habitat.example.test`) |
| Palveluntarjoajan tokenit | `auth_state` hubin tietokannassa salattuna, refresh hubissa | GitHub-token on transientti, luovutetaan kerran `gh`:lle eikä sitä tallenneta |
| Kypsyys | 12 vuotta, satoja tekijöitä, GHSA-prosessi | Esijulkaisu, testipalvelin |

## 5. Suositukset

### Mitä Open Habitat voisi oppia tai ottaa käyttöön (tärkeysjärjestyksessä)

1. **Ihmiskohtainen resurssiraja, joka todella kattaa Pi:n ja sen työkalut.**
   Palvelimella `birch` Jarin selaimesta käynnistetyt Pi:t sekä niiden
   käynnistämät `npm run dev` ja `node` (1,7 Gt RSS) olivat cgroupissa
   `system.slice/system-open\x2dhabitat\x2ddaemon.slice/open-habitat-daemon@maintainer.service`.
   Cgroupin käyttö oli 8,7 Gt, ja `memory.max` oli `max`. Myös yläslicessä
   raja oli `max` **(havainto)**. `docs/operations.md` neuvoo: "Put resource
   budgets on user slices" ja "User resource budgets such as `MemoryMax=` …
   remain customer policy". `user-<uid>.slice` kattaa kuitenkin vain käyttäjän
   user managerin alla ajettavat prosessit (terminaalien tmux, editori,
   Taskfleet-workerit), ei daemonia. Host apply myös hylkää tuoteyksiköiden
   drop-init (`unitFragmentMatches` vaatii tyhjän `DropInPaths`-kentän,
   `internal/host/apply_units_linux.go`), joten ylläpitäjä ei voi asettaa
   ihmiskohtaista rajaa daemon-instanssille **(lähde: koodi)**. Raja
   `maxLiveConversations = 4` rajoittaa prosessien määrää, ei muistia.
   *Miksi:* periaatteen "Unix-käyttäjät ovat turvaraja" mukaan yhden ihmisen
   karannut agentti ei saa kaataa muiden työtä, ja JupyterHub sanoo saman
   suoraan: muistin loppuminen rikkoo kaiken. SystemdSpawnerin malli (oma
   yksikkö ihmistä kohden ja sille `MemoryMax`) on Open Habitatissa jo
   puoliksi olemassa, koska daemon on valmiiksi instanssikohtainen
   järjestelmäyksikkö. Valittavana on, ajetaanko Pi-lapset ihmisen
   `user-<uid>.slice`-slicessä (jolloin oppaan neuvo pitää paikkansa) vai
   antaako tuote daemon-instanssille rootin sivustomäärittelystä luetun
   ihmiskohtaisen `MemoryMax`/`TasksMax`-rajan. Kumpi tahansa on
   arkkitehtuuripäätös. Intake-issue: `daemon-pi-outside-user-slice`
   **(päättely)**.
2. **Tiukka `script-src`-CSP sovellusoriginille.** Sovellusoriginin CSP
   rajoittaa nyt vain kehyksiä (`appFramePolicy`, `internal/gateway/server.go`;
   live-otsake `habitat.example.test`:ltä on sama) **(havainto)**. Sivulla
   esitetään repojen, agenttien ja sähköpostien tekstiä. Sanitointi
   (`rehype-sanitize`, `skipHtml`) ja `sandbox`-srcdoc ovat hyviä, mutta
   JupyterHubin tiedotteet (heijastettu XSS jakolinkissä, self-XSS ja cookie
   tossing) osoittavat, että XSS-virheitä syntyy kypsässäkin koodissa.
   Ylläpitäjän sovellusistunto voi lisätä ihmisiä, nimetä ylläpitäjiä ja
   vaihtaa sivuston avaimia, joten XSS ylläpitäjän selaimessa olisi koko
   sivuston asia **(päättely)**. `web/index.html`:ssä ei ole inline-skriptejä
   (vain `/theme-bootstrap.js`, `/landing-bootstrap.js` ja moduuli)
   **(lähde: koodi)**, joten `script-src 'self'; object-src 'none';
   base-uri 'none'` näyttää toteutettavalta. Tyylien ja Viten
   kehityspalvelimen vaikutus on tarkistamatta **(päättely)**. *Miksi:* tämä
   on halpa toinen puolustuskerros juuri siihen originiin, jossa ihmisen
   kaikki valtuudet ovat.
3. **Sallittujen Content-Type-arvojen lista gatewayn proxyyn.** Gatewayn
   yleinen proxy välittää daemonin `Content-Type`-otsakkeen sellaisenaan
   sovellusoriginille (`internal/gateway/proxy_linux.go`, rivit ~296–303)
   **(lähde: koodi)**. Nykyiset daemonireitit ovat huolellisia: liitteistä
   vain PNG, JPEG, GIF ja WebP näytetään inline-muodossa, kaikki muu ladataan
   `octet-stream`-tiedostona ja `nosniff` on päällä. JupyterHubin pääsääntö on
   kuitenkin, että originille ei saa päätyä palvelua, joka "display[s]
   user-authored HTML that is neither sanitized nor sandboxed". Nyt sääntö
   pitää vain siksi, että jokainen daemonireitti noudattaa sitä. *Miksi:* jos
   gateway sallisi sovellusoriginilla vain JSONin, event-streamin ja
   nimetyt kuvatyypit ja muuttaisi muut muotoon `octet-stream` +
   `attachment`, tuleva daemonivirhe ei voisi muuttua XSS:ksi. Lisäksi gateway
   on se komponentti, joka omistaa selainturvan **(päättely)**.
4. **Käyttäjäkohtainen `/tmp` myös user managerin prosesseille.** Daemonilla
   on `PrivateTmp=yes`, mutta oma tmux-istuntoni (`user@32000.service/app.slice`)
   näki koneen yhteisen `/tmp`:n, jossa oli yli sata hakemistoa **(havainto)**.
   Terminaalit, editori ja Taskfleet ajavat työkaluja, jotka luovat
   `/tmp`-tiedostoja ennustettavilla nimillä. SystemdSpawner (`isolate_tmp`)
   ja TLJH (`PrivateTmp`) tekevät tästä nimenomaisen asetuksen, koska jaettu
   `/tmp` on vanha vuotojen ja symlink-kilpailujen lähde. *Miksi:* tämä on
   ihmisten erottamista samassa mielessä kuin kotihakemiston oikeudet.
   Toteutustapa (esimerkiksi `pam_tmpdir`/`TMPDIR`, `pam_namespace` tai
   systemd:n user-yksiköiden omat mahdollisuudet) on selvittämättä, ja se
   kuuluu asennuksen eli Fleetrepon konfiguraatioon **(päättely)**.
5. **Yläraja sille, kuinka kauan luonnos pitää Pi:tä hereillä.**
   `web/src/app/recapHold.ts` lähettää presence-ilmoituksen 30 sekunnin
   välein niin kauan kuin keskustelussa on lähettämätön luonnos
   **(lähde: koodi)**. Unohtunut välilehti, jossa on luonnos, pitää siis Pi:n
   elossa rajattomasti. Tämä on täsmälleen JupyterHubin "toinen
   joutilaisuuden muoto". *Miksi:* rajaa neljä elävää Pi:tä per ihminen
   lieventää tätä, mutta yhdessä suosituksen 1 kanssa nämä prosessit vievät
   rajatonta muistia. Luonnoksen aiheuttamalle pidolle kannattaisi asettaa
   katto (esimerkiksi tunti) tai sitoa se näkyvään välilehteen
   (`visibilityState`). Taustaprosessia ja Taskfleet-ajoa odottavat Pi:t ovat
   tarkoituksella eri asia, ja niitä tämä ei koske **(päättely)**.
6. **Kirjoitettu turvaraja originille sääntönä, ei vain koodina.**
   JupyterHubin dokumentaatio sanoo yhdellä lauseella, mikä pitää koko mallin
   kasassa: käyttäjä ei saa pystyä muokkaamaan sitä, mikä palvelee hänen
   originiaan. Open Habitatissa sama pätee (daemon on rootin omistama binääri
   ja sovellusoriginin sisältö tulee gatewaysta), ja editorista ja näkymistä on
   omat sääntönsä `internal/AGENTS.md`:ssä. Yleissääntö puuttuu kuitenkin: mikä
   tahansa ihmisen tai hänen agenttinsa muokattavissa oleva sisältö, joka voi
   suorittaa koodia selaimessa, kuuluu omalle hostilleen eikä koskaan
   sovellusoriginille. *Miksi:* uusi ominaisuus (esimerkiksi
   integraatioiden selainkirjautumiset tai tulevat esikatselut) tulee
   arvioiduksi tätä sääntöä vasten ennen koodia, ja juuri tällainen sääntö
   "joka ei näy koodista" kuuluu ohjeisiin **(päättely)**.
7. **"Pidä hereillä" ihmisen nimenomaisena tekona.** JupyterHub suosittelee
   jupyter-keepalivea, koska ilman sitä käyttäjät keksivät keinotekoista
   aktiivisuutta. Open Habitat on ratkaissut tämän osittain ja paremmin:
   taustaprosessia tai omaa Taskfleet-ajoa odottavaa Pi:tä ei pysäytetä.
   Jos jatkossa tulee pitkiä töitä, joita kumpikaan ehto ei tunnista, oikea
   vastaus on ihmisen nimenomainen ja aikarajattu "älä pysäytä" eikä pidempi
   aikaraja **(päättely)**.

### Missä Open Habitat on jo parempi

- **Yhteinen origin on ratkaistu siellä, missä sillä on väliä.** JupyterHub
  sanoo, että vain käyttäjäkohtaiset domainit suojaavat luotettavasti, mutta
  jättää ne oletuksena pois päältä. Open Habitat ajaa code-serverin
  identiteettikohtaisella hostilla, agentin HTML-näkymät näkymäkohtaisilla
  hosteilla `sandbox`-CSP:n kanssa (`connect-src 'none'`) ja jaetut linkit
  omilla hosteillaan ilman evästettä. Kaikki evästeet ovat `__Host-`-evästeitä,
  mikä torjuu cookie tossingin (GHSA-7r3h), ja kirjoitukset vaativat tarkan
  Originin ja CSRF-otsakkeen, mikä torjuu lomakeohituksen (GHSA-m68r).
- **Root on rajattu brokeriin.** SystemdSpawnerin ja TLJH:n hub on root.
  SudoSpawner on lähin vastine Open Habitatin mallille (etuoikeudeton hub ja
  kapea välittäjä), mutta sekin antaa hubille oikeuden käynnistää prosesseja
  kenä tahansa listatuista. Open Habitatin broker luo vain tunnuksen ja
  käynnistää hyväksytyn ihmisen daemonin.
- **Ylläpitäjä ei ole kaikkivoipa.** JupyterHubin `admin` pääsee jokaisen
  palvelimelle, ja TLJH antaa adminille sudon. Open Habitatin ylläpitäjä
  hallitsee pääsyä ja avaimia, mutta ei lue koteja eikä aja agentteja muiden
  puolesta.
- **Pääsyn peruminen on välitöntä ja identiteetti pysyvä.** JupyterHubissa
  säännön poisto estää vain uudet kirjautumiset, ja käyttäjänimi on GitHubin
  vaihdettava `login`. Open Habitat poistaa istunnot ennen brokerin kutsua ja
  sitoo kaiken numeeriseen id:hen. Lisäksi se ei koskaan ota käyttöön
  olemassa olevaa Unix-tunnusta, kun TLJH tekee niin hiljaisesti.
- **Ei tokenivarastoa.** JupyterHub tallentaa OAuth-tokenit (myös refresh
  tokenit) hubin tietokantaan ja uusii niitä. Open Habitat luovuttaa
  GitHub-tokenin kerran ihmisen omalle `gh`:lle eikä säilytä sitä.
- **Prosessit ja levy.** `hidepid=invisible` piilottaa muiden prosessit ja
  komentorivit, ja ext4-kiintiöt rajaavat levyn. JupyterHub ei tee kumpaakaan.
- **Joutilaisuus on hienojakoisempaa ilman työn menetystä.** JupyterHub
  sammuttaa koko palvelimen, jolloin kernelien tila katoaa. Open Habitat
  pysäyttää vain joutilaan Pi:n, jatkaa sitä natiivista historiasta, ei
  pysäytä odottavaa työtä eikä koske ihmisen tmux-istuntoihin.

### Mitä ei kannata kopioida

- **Root-hub ja `systemd-run` hubin käsissä.** Kuten SystemdSpawnerin README
  sanoo, rajaton `systemd-run` vastaa rootia. Ihmiskohtaisen resurssirajan voi
  toteuttaa ilman, että gateway tai daemon saa yhtään uutta valtuutta
  (suositus 1).
- **Kaikkivoipa admin-rooli ja admin-sudo.** Ne ovat juuri sitä, mitä Open
  Habitatin kolmen valtuuden jako estää. Ylläpitäjän pääsy toisen ihmisen
  työhön olisi tuotevirhe.
- **Polkupohjainen reititys yhteen originiin** (`/user/<nimi>/`) ja
  CSP-kompromissit, jotka sen kanssa ovat tarpeen.
- **Tokenit spawnerin ympäristöön ja `auth_state` tietokantaan.** Tämä on
  rinnakkainen tunnistetietovarasto ja ristiriidassa sen kanssa, että hosti ei
  pidä tokenkopioita.
- **Hubin tietokanta käyttäjien ja palvelinten rekisterinä.** Open
  Habitatissa brokerin sidonnat ovat ainoa välttämätön rekisteri, ja muu
  päätellään natiivista tilasta.
- **Käyttäjien poisto joutilaisuuden perusteella** (`--cull-users`) ja
  max-age, joka tappaa aktiivista työtä. Agentin työ voi kestää pitkään, ja
  tuhoaminen on Open Habitatissa aina nimenomainen teko.
- **Proxyn verkkoliikenne aktiivisuuden mittarina.** JupyterHub itse kutsuu
  sitä karkeaksi välineeksi. Open Habitatin malli (Pi:n havaittu työ ja
  ihmisen presence) on parempi.

## 6. Mitä en tavoittanut tai tarkistanut

- Yleistä verkkohakua (DuckDuckGo) en yrittänyt, koska aiempi ajo sai siitä
  haastesivun. Käytin GitHub API:a (`gh`, koska autentikoimattoman API:n
  60 pyynnön raja täyttyi kesken), repojen lähdekoodia, pypistats.orgia ja HN
  Algoliaa. Readthedocsin renderöityjä sivuja en hakenut, vaan luin samat
  tekstit repojen `docs/`-hakemistoista. Linkit osoittavat renderöityihin
  sivuihin tai GitHubiin.
- En asentanut JupyterHubia enkä toistanut tiedotteiden hyökkäyksiä.
- Open Habitatin CSP-otsakkeen tarkistin vain etusivulta. En kokeillut,
  rikkoisiko `script-src 'self'` jotakin (suositus 2).
- `/tmp`- ja cgroup-havainnot ovat yhdeltä palvelimelta (`birch`) ja yhdeltä
  hetkeltä. Aldern testipalvelinta en tarkistanut.

## Lähteet

- JupyterHub, commit [`5dd38327`][jh-commit] (27.10.2026)
- Security Overview: <https://github.com/jupyterhub/jupyterhub/blob/5dd3832731fd1b17ebdce2e8b4271440410d3ed4/docs/source/explanation/websecurity.md>
- JupyterHub and idleness: <https://github.com/jupyterhub/jupyterhub/blob/5dd3832731fd1b17ebdce2e8b4271440410d3ed4/docs/source/explanation/idle.md>
- Capacity planning: <https://github.com/jupyterhub/jupyterhub/blob/5dd3832731fd1b17ebdce2e8b4271440410d3ed4/docs/source/explanation/capacity-planning.md>
- Concepts: <https://github.com/jupyterhub/jupyterhub/blob/5dd3832731fd1b17ebdce2e8b4271440410d3ed4/docs/source/explanation/concepts.md>
- Oletusroolit, `roles.py`: <https://github.com/jupyterhub/jupyterhub/blob/5dd3832731fd1b17ebdce2e8b4271440410d3ed4/jupyterhub/roles.py#L32-L52>
- `cookie_max_age_days`, `app.py`: <https://github.com/jupyterhub/jupyterhub/blob/5dd3832731fd1b17ebdce2e8b4271440410d3ed4/jupyterhub/app.py#L516-L521>
- Hubin CSP, `handlers/base.py`: <https://github.com/jupyterhub/jupyterhub/blob/5dd3832731fd1b17ebdce2e8b4271440410d3ed4/jupyterhub/handlers/base.py#L218-L229>
- Changelog: <https://github.com/jupyterhub/jupyterhub/blob/5dd3832731fd1b17ebdce2e8b4271440410d3ed4/docs/source/reference/changelog.md>
- JupyterHubin tietoturvatiedotteet: <https://github.com/jupyterhub/jupyterhub/security/advisories>
- SystemdSpawner, commit `9a0a7f4e`: README <https://github.com/jupyterhub/systemdspawner/blob/9a0a7f4efe543f50517f84f9985c38269afc77c3/README.md>
- `systemdspawner.py`: <https://github.com/jupyterhub/systemdspawner/blob/9a0a7f4efe543f50517f84f9985c38269afc77c3/systemdspawner/systemdspawner.py>
- `systemd.py`: <https://github.com/jupyterhub/systemdspawner/blob/9a0a7f4efe543f50517f84f9985c38269afc77c3/systemdspawner/systemd.py>
- jupyterhub-idle-culler, commit `0b92132c`: <https://github.com/jupyterhub/jupyterhub-idle-culler/blob/0b92132cf9a1ba5f5c425c790e44246b2dfbfe52/README.md>
- OAuthenticator, commit `02344def`: Allowing <https://github.com/jupyterhub/oauthenticator/blob/02344def2a5e57b9fb25424dd806bcaff8de800d/docs/source/topic/allowing.md>
- OAuthenticator, Refreshing: <https://github.com/jupyterhub/oauthenticator/blob/02344def2a5e57b9fb25424dd806bcaff8de800d/docs/source/how-to/refresh.md>
- OAuthenticator, `github.py`: <https://github.com/jupyterhub/oauthenticator/blob/02344def2a5e57b9fb25424dd806bcaff8de800d/oauthenticator/github.py>
- SudoSpawner, commit `304be890`: <https://github.com/jupyterhub/sudospawner/blob/304be890e24a0d64c394ea26690a82bedb367681/README.md>
- TLJH, commit `05637a2f`: Security considerations <https://github.com/jupyterhub/the-littlest-jupyterhub/blob/05637a2fe4bb5b1e91bcdb0efc0059ab4b30d543/docs/topic/security.md>
- TLJH `user_creating_spawner.py`: <https://github.com/jupyterhub/the-littlest-jupyterhub/blob/05637a2fe4bb5b1e91bcdb0efc0059ab4b30d543/tljh/user_creating_spawner.py>
- TLJH `user.py`: <https://github.com/jupyterhub/the-littlest-jupyterhub/blob/05637a2fe4bb5b1e91bcdb0efc0059ab4b30d543/tljh/user.py>
- TLJH `configurer.py`: <https://github.com/jupyterhub/the-littlest-jupyterhub/blob/05637a2fe4bb5b1e91bcdb0efc0059ab4b30d543/tljh/configurer.py>
- TLJH `jupyterhub.service`: <https://github.com/jupyterhub/the-littlest-jupyterhub/blob/05637a2fe4bb5b1e91bcdb0efc0059ab4b30d543/tljh/systemd-units/jupyterhub.service>
- PyPI-lataukset: <https://pypistats.org/packages/jupyterhub>, <https://pypistats.org/packages/oauthenticator>, <https://pypistats.org/packages/jupyterhub-idle-culler>, <https://pypistats.org/packages/jupyterhub-systemdspawner>
- HN, "Did anybody succeed in deploying Jupyter into a multi-user environment?" (4.4.2017): <https://news.ycombinator.com/item?id=14034532>
- HN-kommentti SystemdSpawnerin ylläpidosta (14.6.2019): <https://news.ycombinator.com/item?id=20181715>
- Open Habitat: `internal/AGENTS.md`, `docs/operations.md`, `systemd/open-habitat-daemon@.service`, `internal/gateway/server.go`, `internal/gateway/proxy_linux.go`, `internal/gateway/views_linux.go`, `internal/daemon/pi_activity_linux.go`, `internal/daemon/attachments_linux.go`, `internal/host/apply_units_linux.go`, `web/src/app/recapHold.ts`, `web/index.html`, `docs/decisions/adr-0030-site-onboarding-authority.md`

[jh-commit]: https://github.com/jupyterhub/jupyterhub/tree/5dd3832731fd1b17ebdce2e8b4271440410d3ed4
[websec]: https://github.com/jupyterhub/jupyterhub/blob/5dd3832731fd1b17ebdce2e8b4271440410d3ed4/docs/source/explanation/websecurity.md
[idle]: https://github.com/jupyterhub/jupyterhub/blob/5dd3832731fd1b17ebdce2e8b4271440410d3ed4/docs/source/explanation/idle.md
[capacity]: https://github.com/jupyterhub/jupyterhub/blob/5dd3832731fd1b17ebdce2e8b4271440410d3ed4/docs/source/explanation/capacity-planning.md
[concepts]: https://github.com/jupyterhub/jupyterhub/blob/5dd3832731fd1b17ebdce2e8b4271440410d3ed4/docs/source/explanation/concepts.md
[roles]: https://github.com/jupyterhub/jupyterhub/blob/5dd3832731fd1b17ebdce2e8b4271440410d3ed4/jupyterhub/roles.py#L32-L52
[app-cookie]: https://github.com/jupyterhub/jupyterhub/blob/5dd3832731fd1b17ebdce2e8b4271440410d3ed4/jupyterhub/app.py#L516-L521
[base-csp]: https://github.com/jupyterhub/jupyterhub/blob/5dd3832731fd1b17ebdce2e8b4271440410d3ed4/jupyterhub/handlers/base.py#L218-L229
[changelog]: https://github.com/jupyterhub/jupyterhub/blob/5dd3832731fd1b17ebdce2e8b4271440410d3ed4/docs/source/reference/changelog.md
[ghsa-list]: https://github.com/jupyterhub/jupyterhub/security/advisories
[ghsa-7r3h]: https://github.com/jupyterhub/jupyterhub/security/advisories/GHSA-7r3h-4ph8-w38g
[ghsa-9x4q]: https://github.com/jupyterhub/jupyterhub/security/advisories/GHSA-9x4q-3gxw-849f
[ghsa-m68r]: https://github.com/jupyterhub/jupyterhub/security/advisories/GHSA-m68r-v472-jgq9
[ghsa-c4gm]: https://github.com/jupyterhub/jupyterhub/security/advisories/GHSA-c4gm-pwx9-9w8j
[ghsa-5jhc]: https://github.com/jupyterhub/jupyterhub/security/advisories/GHSA-5jhc-4h3c-q97h
[ghsa-93gc]: https://github.com/jupyterhub/jupyterhub/security/advisories/GHSA-93gc-h923-mp36
[ghsa-hx46]: https://github.com/jupyterhub/jupyterhub/security/advisories/GHSA-hx46-2cv3-mh6g
[ghsa-cg54]: https://github.com/jupyterhub/systemdspawner/security/advisories/GHSA-cg54-gpgr-4rm6
[ghsa-384w]: https://github.com/jupyterhub/oauthenticator/security/advisories/GHSA-384w-5v3f-q499
[sds-readme]: https://github.com/jupyterhub/systemdspawner/blob/9a0a7f4efe543f50517f84f9985c38269afc77c3/README.md
[sds-py]: https://github.com/jupyterhub/systemdspawner/blob/9a0a7f4efe543f50517f84f9985c38269afc77c3/systemdspawner/systemdspawner.py
[sds-systemd]: https://github.com/jupyterhub/systemdspawner/blob/9a0a7f4efe543f50517f84f9985c38269afc77c3/systemdspawner/systemd.py
[culler]: https://github.com/jupyterhub/jupyterhub-idle-culler/blob/0b92132cf9a1ba5f5c425c790e44246b2dfbfe52/README.md
[allowing]: https://github.com/jupyterhub/oauthenticator/blob/02344def2a5e57b9fb25424dd806bcaff8de800d/docs/source/topic/allowing.md
[refresh]: https://github.com/jupyterhub/oauthenticator/blob/02344def2a5e57b9fb25424dd806bcaff8de800d/docs/source/how-to/refresh.md
[oa-github]: https://github.com/jupyterhub/oauthenticator/blob/02344def2a5e57b9fb25424dd806bcaff8de800d/oauthenticator/github.py
[sudospawner]: https://github.com/jupyterhub/sudospawner/blob/304be890e24a0d64c394ea26690a82bedb367681/README.md
[tljh-sec]: https://github.com/jupyterhub/the-littlest-jupyterhub/blob/05637a2fe4bb5b1e91bcdb0efc0059ab4b30d543/docs/topic/security.md
[tljh-spawner]: https://github.com/jupyterhub/the-littlest-jupyterhub/blob/05637a2fe4bb5b1e91bcdb0efc0059ab4b30d543/tljh/user_creating_spawner.py
[tljh-user]: https://github.com/jupyterhub/the-littlest-jupyterhub/blob/05637a2fe4bb5b1e91bcdb0efc0059ab4b30d543/tljh/user.py
[tljh-conf]: https://github.com/jupyterhub/the-littlest-jupyterhub/blob/05637a2fe4bb5b1e91bcdb0efc0059ab4b30d543/tljh/configurer.py
[tljh-unit]: https://github.com/jupyterhub/the-littlest-jupyterhub/blob/05637a2fe4bb5b1e91bcdb0efc0059ab4b30d543/tljh/systemd-units/jupyterhub.service
[hn1]: https://news.ycombinator.com/item?id=14034532
[hn2]: https://news.ycombinator.com/item?id=20181715

# Vertailu: Cockpit (cockpit-project.org)

Tutkimusajo `01m68hqxjqfe0dxcbwrgve515e`, 31.10.2026. Lähteinä ovat Cockpitin
GitHub-repo ja sen lähdekoodi (luettu commitista [`f00c23a2`][commit],
30.10.2026), repon omat ohjeet (`doc/`, `src/tls/README.md`), GitHub API
(tähdet, julkaisut, tietoturvatiedotteet), NVD ja Hacker Newsin keskustelut
Algolia-rajapinnan kautta. Open Habitatin puoli on luettu tämän repon
tiedostoista `docs/product.md`, `AGENTS.md`, `internal/AGENTS.md`, `systemd/`
ja `tmpfiles.d/` sekä niistä koodin kohdista, jotka nimetään tekstissä.
Merkintä **(lähde)** tarkoittaa, että asia lukee lähteessä tai koodissa.
**(päättely)** on oma tulkintani.

En käyttänyt yleistä verkkohakua, koska DuckDuckGo palautti aiemmalle ajolle
estosivun. Julkaistuista ohjesivuista tarkistin vain, että
`cockpit-project.org/guide/latest/privileges.html` vastaa. Sisältö on luettu
samasta lähteestä repon `doc/modules/guide/`-hakemistosta. Red Hatin
Bugzilla-merkintää (CVE-2026-4631) en avannut. Tiedotteen sisältö on luettu
GitHubista ja NVD:stä.

## Tiivistelmä

Cockpit on Red Hatin vuodesta 2013 ylläpitämä selainkäyttöliittymä
Linux-palvelimen hallintaan. Se on lähin kypsä vastine Open Habitatin
perusratkaisulle: verkkopalvelu ei itse toimi käyttäjänä, vaan käyttäjän oma
prosessi tekee työn tavallisin Unix-oikeuksin, "exactly the same privileges as
if they logged in via SSH". Erottelu perustuu kolmeen asiaan. (1) Internetiin
näkyvä TLS-pää `cockpit-tls` on pieni (noin 2 750 riviä C:tä), ei tulkitse
HTTP:tä eikä sillä ole verkkoyhteyttä (`PrivateNetwork=yes`). (2)
HTTP-palvelin `cockpit-ws` ajetaan oikeudettomana dynaamisena käyttäjänä
tiukassa systemd-hiekkalaatikossa, ja asiakassertifikaatilla kirjautuvat saavat
kukin oman instanssinsa. (3) Jokaisen istunnon avaa root-apuohjelma
`cockpit-session`, joka vaatii tunnukset PAMin kautta ja ajaa koko
PAM-tilipinon. Ilman käyttäjän salasanaa, Kerberos-lippua tai sertifikaattia
`cockpit-ws` ei siis voi avata istuntoa kenenkään puolesta. Open Habitatin
tilanne on rakenteellisesti erilainen. Kirjautuminen on GitHub-OAuth, ja
agentin on jatkettava ilman ihmistä, joten gatewayn sana *on* tunnistus, ja
yksi gateway-prosessi pääsee jokaisen ihmisen daemonin socketiin. Cockpitin
oma dokumentaatio sanoo tällaisesta rakenteesta suoraan, että siinä mikä
tahansa haavoittuvuus johtaa "complete privilege escalation across all running
and future sessions". Halvimmat opit ovat gatewayn systemd-hiekkalaatikon
kiristäminen Cockpitin tasolle ja säännön kirjaaminen siitä, ettei gateway
koskaan käynnistä prosesseja. Cockpitin vuoden 2026 kriittinen haavoittuvuus
syntyi juuri tältä pinnalta ennen kirjautumista. Lisäksi Open Habitat voisi
noudattaa natiivia tilin tilaa (vanhentunut tili, `nologin`) samoin kuin SSH.
Suurin oppi on arkkitehtuurikysymys Jarille: pilkotaanko gatewayn suuri
internet-pinta ihmiskohtaisiin instansseihin Cockpitin `cockpit-tls`- ja
`cockpit-ws`-mallin mukaan. Open Habitat on jo Cockpitia edellä origin-erottelussa,
siinä ettei gateway käynnistä prosesseja, prosessien näkymättömyydessä
käyttäjien välillä ja siinä, että työ jatkuu selaimen sulkemisen jälkeen.

## 1. Mikä Cockpit on ja kenelle

Cockpit kuvaa itseään "web-based graphical interface for servers". Se on
palvelimen ylläpitäjän työkalu: lokit, palvelut, verkko, tallennus, päivitykset,
käyttäjät, virtuaalikoneet ja selaimen terminaali ([README][readme])
**(lähde)**. Koodin tekijänoikeusmerkinnät ovat Red Hatin ([`superuser.py`][su])
**(lähde)**. HN-keskusteluissa (esim. [47445599][hn1], 331 pistettä, 180
kommenttia, 19.3.2026) käyttäjät kertovat ajavansa Cockpitia kotilaboratoriossa
ja asiakaspalvelimilla Linuxia tuntemattomille. He myös sanovat, ettei sitä
avata internetiin: "I never expose my NAS to the internet, other than
wireguard/tailscale" ([HN 47454883][hn1a]) **(lähde)**.

Kohderyhmä on siis ylläpitäjä, joka hallitsee omaa konettaan. Monikäyttöisyys
tarkoittaa Cockpitissa, että kuka tahansa koneen Unix-tunnuksen haltija voi
kirjautua omalla salasanallaan ja saa oman istuntonsa. Istunnot eivät ole
pitkäikäisiä työtiloja vaan hallintakäyntejä **(lähde + päättely)**.

## 2. Arkkitehtuuri

### Prosessit ja niiden valtuudet

Ketju on kuvattu repon [`src/tls/README.md`][tlsreadme]-tiedostossa ja
[systemd-yksiköissä][units] **(lähde)**:

| Prosessi | Ajetaan käyttäjänä | Tehtävä | Hiekkalaatikko |
|---|---|---|---|
| `cockpit.socket` | systemd | Kuuntelee porttia 9090 | – |
| `cockpit-tls` | dynaaminen `cockpit-systemd-service` | TLS-pääte. Laskee asiakassertifikaatin SHA-256-sormenjäljen ja välittää tavut eteenpäin tulkitsematta HTTP:tä | `PrivateNetwork=yes`, `RestrictAddressFamilies=AF_UNIX`, `NoNewPrivileges`, `ProtectSystem=strict`, `MemoryDenyWriteExecute` |
| `cockpit-wsinstance-https-factory@` | root, lyhytikäinen | Lukee sormenjäljen ja pyytää systemd:tä käynnistämään `cockpit-wsinstance-https@<sormenjälki>`-parin | – |
| `cockpit-ws` (instanssi) | dynaaminen `cockpit-wsinstance-socket`-ryhmän käyttäjä | HTTP, WebSocket, kirjautumissivu, kanavien multipleksaus | `DynamicUser`, `ProtectSystem=strict`, `PrivateDevices`, `ProtectKernelTunables`, `ProtectControlGroups`, `MemoryDenyWriteExecute`, `SystemCallFilter=@system-service`, `PrivateIPC`, `Slice=system-cockpithttps.slice` (`TasksMax=200`, `MemoryMax=90%`) |
| `cockpit-session@` | root, yksi per kirjautuminen (`Accept=yes`) | Pyytää tunnukset ws:ltä, ajaa PAMin (auth, account, setcred, open_session), kirjaa utmp:n ja käynnistää bridgen käyttäjänä | Socket `/run/cockpit/session` `0660 root:cockpit-session-socket`, eli vain ws-instanssit voivat pyytää istuntoa |
| `cockpit-bridge` | kirjautunut käyttäjä, PAM-istunnossa (`XDG_SESSION_TYPE=web`) | Lukee tiedostot, D-Busin ja prosessit käyttäjän oikeuksin ja puhuu selaimelle ws:n välityksellä | Ei rajattu: tämä *on* käyttäjän istunto |

`cockpit-tls`:n README perustelee jaon näin: TLS:ää ei pureta `cockpit-ws`:ssä,
koska ws "is subject to external attacks through HTTP, does a *lot* of
interpretation of data streams, uses a lot of external dependencies, and
multiplexes sessions of different users in one process. Thus any vulnerability
can easily lead to complete privilege escalation across all running and future
sessions." Siksi jokainen asiakassertifikaatti saa oman ws-instanssinsa omassa
cgroupissaan, "so that one tampered session cannot affect the others"
([tls README][tlsreadme]) **(lähde)**.

Tärkeä rajaus: erillisen instanssin saa vain asiakassertifikaatilla
kirjautuva. Kaikki ilman sertifikaattia HTTPS:llä tulevat jakavat yhden
"https without certificate" -instanssin ([tls README][tlsreadme])
**(lähde)**. Tavallisessa salasanakirjautumisessa käyttäjät ovat siis samassa
`cockpit-ws`-prosessissa. **(päättely)**: kaapattu yhteinen instanssi näkisi
siellä elävät istunnot ja sen jälkeen syötetyt salasanat. Uutta istuntoa se ei
silti voisi avata käyttäjälle, joka ei kirjaudu, koska `cockpit-session` vaatii
PAM-tunnistuksen.

### Miten verkkopalvelu pidetään erillään istunnosta

1. **Istunnon avaa root, ei verkkopalvelu.** `cockpit-ws` ei voi vaihtaa
   käyttäjää. Se välittää selaimen `Authorization`-otsakkeen
   `cockpit-session`:lle, joka tarkistaa tunnukset PAMilla
   (`pam_authenticate`) tai GSSAPI:lla tai kysyy sertifikaatin käyttäjän
   sssd:ltä ([`authentication.md`][authmd], [`session.c`][session])
   **(lähde)**.
2. **Natiivi tilin tila ratkaisee.** Jokaisessa kirjautumisessa ajetaan
   `pam_acct_mgmt`, ja vanhentunut salasana pakotetaan vaihtamaan
   (`pam_chauthtok`). Lisäksi tarkistetaan, että käyttäjän login-shell osaa
   ajaa `exit 71`, joten `nologin`-tili ei saa istuntoa
   ([`session.c`][session], `user_has_valid_login_shell`) **(lähde)**.
   Cockpit ei pidä omaa listaa siitä, kuka saa kirjautua. Sen ratkaisevat
   PAM, `/etc/shells` ja tili itse.
3. **Sertifikaatin ja ws-instanssin sidonta tarkistetaan prosessista.** Kun
   kirjautuminen tehdään sertifikaatilla, `cockpit-session` lukee socketin
   vertaisprosessin `SO_PEERCRED`-tiedot, avaa sen `/proc/<pid>`-hakemiston,
   vertaa käynnistysaikaa (PID-kierrätyksen varalta) ja lukee prosessin
   cgroupin (vain cgroup v2). Näin se varmistaa, että pyytäjä on juuri sen
   sormenjäljen `cockpit-wsinstance-https@`-instanssi, ennen kuin se kysyy
   sssd:ltä, kenen sertifikaatti on ([`client-certificate.c`][clientcert])
   **(lähde)**. Pelkkä "olen ws-käyttäjä" ei siis riitä: pyytäjän on oltava
   oikea instanssi.
4. **Salasana annetaan kerran.** Jos käyttäjä haluaa ylläpito-oikeudet, ws
   pitää salasanan muistissa sen verran, että bridge voi ajaa sudon kerran
   (`plain1`-haaste). Sen jälkeen tunnus "myrkytetään" (`cockpit_creds_poison`):
   "we must not respond with the same password again"
   ([`cockpitauth.c`][auth], [`cockpitwebservice.c`][websvc]) **(lähde)**.
5. **Evästeet ja origin.** Istuntoeväste on `HttpOnly; SameSite=Strict` ja
   salatulla yhteydellä `Secure`. WebSocketin `Origin` tarkistetaan
   asetuksen `Origins` mukaan ([`cockpitauth.c`][auth],
   [`cockpitwebservice.c`][websvc]) **(lähde)**.

### Ylläpito-oikeudet ("Administrative access")

Istunnolla on käyttäjän tavalliset oikeudet. Jos käyttäjä voi korottaa
oikeutensa sudolla tai polkitilla, Cockpit tekee sen kirjautuessa
käyttäjän valinnan mukaan, ja yläpalkin "Administrative access" -kytkimellä
oikeudet voi pudottaa ja palauttaa. Korotus on natiivi: toinen bridge
käynnistetään `sudo`:lla tai `pkexec`:llä, ja säännöt ovat
`/etc/sudoers`-tiedostossa ja polkitin `rules.d`-hakemistossa
([privileges.adoc][priv], [`superuser.py`][su]) **(lähde)**. Cockpitilla ei
ole omaa roolijärjestelmää.

### Yksi vai monta käyttäjää, istuntojen elinkaari

- Monta käyttäjää samalla koneella, kukin omana Unix-tunnuksenaan ja omassa
  PAM-istunnossaan **(lähde)**.
- Istunto on lyhytikäinen. Kun viimeinen WebSocket katkeaa, ws odottaa 15
  sekuntia (`cockpit_ws_service_idle = 15`) ja purkaa istunnon. Bridge
  päättyy, ja `cockpit-session` sulkee PAM-istunnon. Lisäksi on
  valinnainen `[Session] IdleTimeout` minuutteina ([`cockpitauth.c`][auth],
  [cockpit.conf][conf]) **(lähde)**. **(päättely)**: bridgen lapsiprosessit,
  kuten selaimen terminaalin shell, päättyvät sen mukana. Pitkään ajettava
  työ vaatii käyttäjältä itseltään tmuxin tai systemd-yksikön.
- Kirjautumiset näkyvät natiivisti: `cockpit-session` kirjoittaa utmp- ja
  wtmp-merkinnät ja avaa logind-istunnon tyyppiä `web` ([`session.c`][session])
  **(lähde)**. Ne näkyvät siis komennoissa `who`, `last` ja `loginctl`
  **(päättely)**.

### Miten selain pääsee natiiviin tilaan

Bridge puhuu selaimelle JSON-kanavien protokollaa (tiedostot, D-Bus,
prosessien käynnistys, HTTP, metriikat). Käyttöliittymän osat ovat
"paketteja", jotka bridge lataa XDG-hakemistoista, myös käyttäjän kotoa
(`~/.local/share/cockpit/`), ja jotka tarjoillaan samasta originista
([packages.adoc][pkgs]) **(lähde)**. Kaikki on natiivia: Cockpit ei pidä omaa
tietokantaa, vaan näyttää systemd:n, journalin, NetworkManagerin ja muiden
tilan sellaisenaan **(lähde + päättely)**.

Monen koneen hallinta yhdessä istunnossa (SSH:n yli muihin koneisiin) on
**vanhentunut versiosta 322 alkaen**. Syy on origin: "Code from the local host
and all the remote hosts run at the same time, in the same browser context.
They are not isolated from each other in the browser." Asetus
`AllowMultiHost=false` estää sen ([multi-host.adoc][multihost],
[cockpit.conf][conf]) **(lähde)**.

### Missä erottelu on pettänyt

GitHubin tietoturvatiedotteet vuodelta 2026 **(lähde)**:

- **CVE-2026-4631, kriittinen (CVSS 9.8).** "Unauthenticated remote code
  execution due to SSH command-line argument injection." Etäkirjautuminen
  välitti selaimen antaman isäntä- ja käyttäjänimen SSH-komennolle
  tarkistamatta, "during the authentication flow before any credential
  verification takes place". Haavoittuvat versiot olivat yli 326, ja korjaus
  tuli versioon 360 ([GHSA-m4gv-x78h-3427][ghsa1], [NVD][nvd1]).
  Lähdekoodin mukaan `cockpit-ws` käynnistää SSH-kirjautumisen
  (`python3 -m cockpit.beiboot`) itse `g_spawn_async_with_pipes`-kutsulla, ei
  root-socketin kautta ([`cockpitauth.c`][auth]). **(päättely)**: koodi
  suoritettiin siksi ws-instanssin oikeudettomana dynaamisena käyttäjänä, ja
  hiekkalaatikko rajasi vahinkoa. Yhteisessä salasanainstanssissa hyökkääjä
  olisi silti päässyt muiden siellä olevien istuntoihin.
- **CVE-2026-4802, korkea.** Komentojen injektio lokisivun linkin
  parametreissa. Vaatii kirjautumisen, ja koodi ajetaan uhrin istunnossa,
  versioissa yli 240, korjattu versiossa 362 ([GHSA-6jmq-qw8f-w3r6][ghsa2]).
  Tämä on tyypillinen saman originin riski: linkki saa käyttäjän oman
  istunnon tekemään jotain **(lähde + päättely)**.

## 3. Kypsyys ja lisenssi

| Mittari | Arvo (GitHub API 31.10.2026) |
|---|---|
| Repo luotu | 1.11.2013 |
| Tähdet / forkit | 15 305 / 1 373 |
| Avoimet issuet ja PR:t | 501 |
| Uusin julkaisu | 370 (22.10.2026). Edellinen 369 (7.10.). Pitkäaikaishaara 310.x (310.10, 24.9.2026) |
| Tietoturvatiedotteet 2026 | 2 (yksi kriittinen, yksi korkea) |

Julkaisutahti on noin kahden viikon välein **(lähde: julkaisupäivät)**.
Pääosa koodista on LGPL-2.1-or-later. Repossa on lisäksi GPL-3.0-or-later
(esim. Python-bridge), BSD-3-, MIT- ja CC-BY-SA-3.0-osia ([README][readme],
`LICENSES/`). GitHub raportoi lisenssiksi `null`, koska lisenssejä on monta
**(lähde)**. Tuote on ilmainen.

HN-kommentit pitävät Cockpitia siistinä ja natiivina ("uses native users +
passwords", [HN 37903018][hn2a]). Kriittiset äänet koskevat lähinnä yhtä
avointa porttia lisää ("one more attack vector", [HN 37897320][hn2b]) ja
selaimen hyökkäyspintaa ([HN 47447728][hn1b]) **(lähde)**. OAuth- ja
Bearer-tunnistus on olemassa (`[bearer] command = …`), mutta se on
käyttäjän itse kirjoitettava komento, ja siihen liittyy avoimia issueita
([#17734][i17734], [#21327][i21327]) **(lähde)**.

## 4. Rinnakkain Open Habitatin kanssa

Open Habitatin sarake perustuu tiedostoihin `docs/product.md`, `AGENTS.md`,
`internal/AGENTS.md` ja `systemd/`.

| | Cockpit | Open Habitat |
|---|---|---|
| Tarkoitus | Palvelimen hallinta selaimessa | Agenttien työtilat selaimessa |
| Kirjautuminen | Salasana tai Kerberos tai sertifikaatti PAMin kautta, joka kerta | GitHub-OAuth gatewayssa, ylläpitäjän pääsypäätös, istunto 90 pv / 1 v |
| Kuka päättää, kuka käyttäjä on | Root-ohjelma `cockpit-session` PAMin ja sssd:n avulla | Gateway OAuthin perusteella. Broker luottaa gatewayn sanaan ja tarkistaa sidonnan |
| Internet-pinta | `cockpit-tls` (pieni, ei verkkoa, ei HTTP:tä) → `cockpit-ws` per sertifikaatti, salasanakäyttäjät yhdessä instanssissa | Yksi gateway-prosessi: TLS, OAuth, istunnot, CSRF, staattinen UI, välitys, terminaalin rele, editorin ja näkymien relet |
| Pääsy käyttäjän prosessiin | ws pyytää rootilta uutta istuntoa ja tarvitsee tunnukset. Sertifikaattitilassa instanssin cgroup tarkistetaan | Gateway-ryhmä saa yhdistää jokaisen daemonin socketiin (`0660 %i:open-habitat-gateway`). Daemon tarkistaa vertaisen UID:n |
| Käyttäjän prosessi | `cockpit-bridge` PAM-istunnossa, elää selainistunnon ajan + 15 s | Daemon systemd-palveluna (`User=%i`), pysyvä. Pi, tmux ja code-server sen kautta |
| Natiivi tilin tila | `pam_acct_mgmt`, salasanan vanheneminen, login-shell-tarkistus joka kirjautumisessa | Ei tarkisteta: daemonin yksikössä ei ole `PAMName`-asetusta, ja tilin vanhenemista ei lueta (`grep` repossa) |
| Oikeuksien korotus | Natiivi sudo/polkit, "Administrative access" -kytkin | Ei korotusta. Ylläpitäjäroolit koskevat vain gatewayn hallintaa |
| Prosessien näkyvyys käyttäjien välillä | Linuxin oletus | `hidepid=invisible` (`open-habitat-proc.service`) |
| Levytila | Ei rajata | Käyttäjäkohtaiset kiintiöt (ellei asennus toisin julista) |
| Origin | Yksi origin kaikille paketeille, myös kotihakemistosta ladatuille. Monen koneen tila vanhentunut origin-riskin vuoksi | Editori omalla, identiteettikohtaisella aliverkkotunnuksella, agenttinäkymät omilla hosteillaan |
| Prosessien käynnistys verkkopalvelussa | ws käynnistää SSH:n ennen kirjautumista (CVE-2026-4631) | Gateway ei käynnistä prosesseja (`internal/gateway` ei tuo `os/exec`-pakettia) |
| Natiivi kirjaus | utmp/wtmp, logind-istunto `web` | Diagnostiikka JSONL-muodossa, ei natiivia kirjautumismerkintää |
| Kypsyys | 13 vuotta, Red Hat, kahden viikon julkaisut | Esijulkaisu, testipalvelin |

Rivimäärät **(lähde: oma mittaus `wc -l`:llä, testit pois lukien)**:
`cockpit-tls` noin 2 750, `cockpit-session` noin 2 200 ja `cockpit-ws` noin
30 600 riviä C:tä. Open Habitatin `internal/gateway` on noin 11 500,
`internal/provision` noin 5 400 ja `internal/daemon` noin 52 000 riviä Go:ta.

**Keskeinen ero (päättely).** Cockpit voi pitää verkkopalvelun kyvyttömänä
esiintymään kenenäkään, koska jokainen istunto vaatii käyttäjän salaisuuden ja
koska istunto kuolee selaimen mukana. Open Habitat ei voi käyttää kumpaakaan
keinoa. Kirjautuminen on GitHubin, ei palvelimen, eikä palvelin näe
salaisuutta, josta root voisi tarkistaa ihmisen. Lisäksi agentin on jatkettava,
kun ihminen on poissa. Siksi daemon hyväksyy gatewayn yhteyden ihmisen
puolesta, ja gatewayn kaappaus vaikuttaisi kaikkiin daemoneihin, myös niiden
ihmisten, jotka eivät ole kirjautuneena. Cockpitin README nimeää juuri tämän
tilanteen pahimmaksi uhaksi. Open Habitatin säännöt (`internal/AGENTS.md`)
tiedostavat sen: "The broker trusts it to say who signed in, so it stays small
and unprivileged." Gateway ei kuitenkaan ole pieni: se on Open Habitatin suurin
yksittäinen internet-pinta.

## 5. Suositukset

### Mitä Open Habitat voisi oppia (tärkeysjärjestyksessä)

1. **Kiristä gatewayn systemd-hiekkalaatikko Cockpitin `cockpit-ws`:n
   tasolle.** Nyt `open-habitat-gateway.service` asettaa `NoNewPrivileges`,
   `ProtectSystem=strict`, `ProtectHome=yes`, `PrivateTmp` ja
   `PrivateDevices`. Cockpitin ws-instansseissa on lisäksi
   `SystemCallFilter=@system-service`, `MemoryDenyWriteExecute=yes`,
   `ProtectKernelTunables`, `ProtectControlGroups`, `PrivateIPC` ja
   `RestrictAddressFamilies` ([yksiköt][units]). Gatewaylle sopisivat samat
   sekä `CapabilityBoundingSet=` (tyhjä), `RestrictNamespaces`,
   `RestrictSUIDSGID`, `LockPersonality`, `ProtectKernelModules` ja
   `ProtectClock`. Osoiteperheiksi riittävät `AF_UNIX AF_INET AF_INET6`,
   koska gateway tarvitsee OAuthia varten lähtevän verkon ja Unix-socketit
   daemoneihin. *Miksi:* gateway on internet-pinta ja sillä on ryhmä, joka
   pääsee kaikkien daemonien socketteihin. Mitä vähemmän kaapattu gateway voi
   tehdä tämän pääsyn lisäksi, sitä paremmin pahin tapaus rajautuu yhteen
   reittiin. Go-ohjelma toimii `MemoryDenyWriteExecute`-asetuksen kanssa.
   Muutos on halpa, ja `scripts/vm-test.sh`:n vierailla sen voi testata
   **(päättely; asetusten yhteensopivuus gatewayn kanssa on testattava)**.
2. **Kirjaa sääntö: gateway ei koskaan käynnistä prosessia eikä anna
   kirjautumattoman pyynnön sisältöä natiiville työkalulle.** Gateway
   noudattaa tätä jo (`internal/gateway` ei tuo `os/exec`-pakettia), mutta
   sääntö ei ole kirjattuna `internal/AGENTS.md`:n "Rules the code cannot
   show" -osioon. Cockpitin CVE-2026-4631 syntyi juuri näin: kätevä
   ominaisuus (kirjautuminen toiseen koneeseen) toi prosessin käynnistyksen
   verkkopalveluun ennen tunnistusta. *Miksi:* koodi ei näytä, mitä ei saa
   koskaan rakentaa. Seuraava kätevä ominaisuus (esimerkiksi `gh`-kutsu
   gatewayssa tai avaimen tarkistus komentorivityökalulla) avaisi saman
   reitin. Sääntö sopii Open Habitatin periaatteeseen, että gateway
   tunnistaa eikä tee töitä **(päättely)**.
3. **Noudata natiivia tilin tilaa niin kuin SSH tekee.** Cockpit ajaa
   PAM-tilipinon joka kirjautumisessa: vanhentunut tili (`chage -E`),
   `pam_nologin` ja `pam_access` estävät istunnon, ja vanhentunut salasana on
   vaihdettava ([`session.c`][session]). Open Habitatin daemon on
   systemd-palvelu ilman `PAMName`-asetusta, eikä broker eikä gateway lue
   tilin vanhenemista. **(päättely)**: jos ylläpitäjä sulkee tilin
   natiivisti, SSH lakkaa toimimasta, mutta selain jatkaa. Open Habitatin oma
   pääsyn poisto (withdraw) toimii, mutta se on toinen totuus tilin tilasta.
   Kevein korjaus olisi, että broker tarkistaa kirjautumisen sidontaa
   varmistaessaan (`ensure`) tilin vanhenemisen ja login-shellin (shell
   tarkistetaan jo) ja kieltäytyy kuten PAMin account-vaihe. Toinen vaihtoehto
   on ajaa PAMin account-vaihe brokerissa. *Miksi:* tuote lupaa saman kuin
   SSH, ja "Unix-käyttäjät ovat turvaraja" tarkoittaa myös, että Unix-tili
   päättää, onko se käytössä. Ratkaisu vaikuttaa siihen, mitä brokerin
   valtuuteen kuuluu, joten se on Jarin päätös **(päättely; käytös ei ole
   testattu palvelimella)**.
4. **Arkkitehtuurikysymys Jarille: pilko gatewayn suuri pinta ihmiskohtaisiin
   instansseihin.** Cockpitin malli: pieni TLS-pää, joka ei tulkitse
   HTTP:tä, ohjaa yhteyden identiteettikohtaiseen ws-instanssiin, ja root
   tarkistaa instanssin cgroupista, että se on oikea, ennen kuin avaa
   istunnon ([tls README][tlsreadme], [`client-certificate.c`][clientcert]).
   Open Habitatissa vastine voisi olla tällainen **(päättely)**: jokaisella
   ihmisellä on oma app-host (kuten editorilla jo on identiteettikohtainen
   aliverkkotunnus). Pieni TLS-pää ohjaa yhteyden SNI:n perusteella
   ihmiskohtaiseen gateway-instanssiin (`open-habitat-gateway@<uid>`), joka
   pitää vain tämän ihmisen istunnot ja pääsee vain tämän ihmisen
   daemonin socketiin (socketin ryhmä ihmiskohtainen, ei yhteinen
   `open-habitat-gateway`). Daemon tarkistaa vertaisen cgroupista, että
   yhteys tulee juuri sen ihmisen instanssista, kuten `cockpit-session`
   tekee. OAuth-kirjautuminen jäisi yhteiselle kirjautumishostille, joka luo
   istunnon kertakäyttöisellä luovutuksella (kuten editorin handoff).
   *Miksi:* nyt yksi virhe gatewayn välityksessä, terminaalin releessä tai
   näkymien käsittelyssä vaikuttaisi kaikkiin ihmisiin. Jaon jälkeen se
   vaikuttaisi yhteen, ja kaikille yhteinen osa supistuisi
   kirjautumiseen. Kustannus on suuri (uusi prosessimalli, TLS-pää, hostit,
   sertifikaatit, upgrade-operaattori), ja itse Cockpit tekee jaon vain
   sertifikaattikäyttäjille. Tämä on valtuuden siirto komponenttien välillä,
   joten se kuuluu Jarille suosituksena ja ADR:nä, ei koodiin suoraan. Suosittelen
   sitä ennen kuin palvelimelle tulee ihmisiä, joiden välillä luottamus ei
   ole perhetason.
5. **Tee selainkirjautumisista natiivisti näkyviä (matala prioriteetti).**
   Cockpitin kirjautuminen näkyy komennoissa `last`, `who` ja `loginctl`
   ([`session.c`][session]). Open Habitatissa ihmisen selainistunnot näkyvät
   vain gatewayn tilassa. *Miksi:* ylläpitäjä voisi tarkistaa natiiveilla
   työkaluilla, kuka on käyttänyt tiliä. Toisaalta Open Habitatin istunto on
   pitkäikäinen eikä vastaa login-istuntoa, ja periaate "diagnostiikka ei
   ole audit trail" on tietoinen valinta. Ehdotan tämän vain harkittavaksi,
   en toteutettavaksi **(päättely)**.

### Missä Open Habitat on jo parempi

- **Origin-erottelu.** Cockpit tarjoilee kaikki paketit, myös käyttäjän
  kotihakemistosta ladatut, samasta originista, ja se luopui monen koneen
  tilasta, koska koodia ei voitu eristää selaimessa
  ([multi-host.adoc][multihost]). Open Habitat ajaa code-serverin omalla,
  identiteettikohtaisella aliverkkotunnuksellaan ja agenttinäkymät omilla
  hosteillaan, eikä sovelluksen eväste kelpaa niissä (`internal/AGENTS.md`).
- **Gateway ei käynnistä prosesseja.** Cockpitin kriittinen haavoittuvuus
  vuonna 2026 tuli juuri ws:n ennen kirjautumista käynnistämästä
  SSH-prosessista.
- **Salaisuudet eivät kulje verkkopalvelun kautta.** Cockpitin ws ottaa
  vastaan salasanan ja pitää sitä muistissa sudoa varten. Open Habitatin
  gateway käsittelee vain GitHubin kertakäyttöisen tokenin, jota se ei
  tallenna.
- **Työ jatkuu selaimen jälkeen.** Cockpit purkaa istunnon 15 sekuntia
  viimeisen yhteyden katkettua. Open Habitatin daemon pitää Pi:n käynnissä,
  ja tmux-shellit selviävät daemonin uudelleenkäynnistyksestä, kun
  ihmisen käyttäjämanageri lingeröi (`terminal_linux.go`).
- **Ihmiset näkymättömiä toisilleen.** `hidepid=invisible` piilottaa muiden
  prosessit, ja kiintiöt rajaavat levytilan. Cockpit hallintatyökaluna jättää
  nämä Linuxin oletuksiin.
- **Tilien luonti on rajattu.** Broker ei koskaan ota käyttöön olemassa
  olevaa tiliä eikä korjaa ajautumaa hiljaa. Cockpit ei luo tilejä
  kirjautumisessa lainkaan, joten vertailukohtaa ei ole, mutta Open Habitatin
  root-pinta on rajattu tarkemmin kuin Cockpitin root-apuohjelmat
  (`cockpit-session`, factory), jotka ajetaan jokaisella yhteydellä.

### Mitä ei kannata kopioida

- **Salasanakirjautuminen selaimessa ja PAM-auth gatewayn kautta.** Se toisi
  palvelimen salasanat verkkopalvelun muistiin. Open Habitatin valinta on,
  että GitHub tunnistaa ja ylläpitäjä päättää pääsystä.
- **Istunto, joka kuolee selaimen mukana.** Cockpitin eristys hyötyy
  lyhyestä elinkaaresta, mutta Open Habitatin koko lupaus on, että agentti
  jatkaa.
- **Oikeuksien korotus selaimesta ("Administrative access").** Open
  Habitatin ihmiset eivät ole palvelimen ylläpitäjiä, ja sudo agentin
  ulottuvilla rikkoisi Unix-tunnuksen rajan.
- **Käyttöliittymän laajennukset kotihakemistosta sovelluksen originissa.**
  Cockpitin `~/.local/share/cockpit` -paketit ovat juuri se, mitä Open
  Habitatin säännöt kieltävät: työtilan sisältö on dataa, ei ajettavaa
  koodia käyttöliittymässä.
- **Monen koneen hallinta samassa selainkontekstissa.** Cockpit itse
  vanhensi sen.
- **Itse kirjoitettava Bearer-komento tunnistuksena.** Cockpitin
  `[bearer] command` antaa ws:n käynnistämälle komennolle vallan päättää
  käyttäjästä ja avata istunnon. Se sekoittaisi Open Habitatin kolme
  valtuutta.

## Lähteet

- Cockpit, repo ja README: <https://github.com/cockpit-project/cockpit/blob/f00c23a2b067d0dbdc63140867e1887b84115655/README.md>
- `doc/authentication.md`: <https://github.com/cockpit-project/cockpit/blob/f00c23a2b067d0dbdc63140867e1887b84115655/doc/authentication.md>
- `src/tls/README.md`: <https://github.com/cockpit-project/cockpit/blob/f00c23a2b067d0dbdc63140867e1887b84115655/src/tls/README.md>
- systemd-yksiköt: <https://github.com/cockpit-project/cockpit/tree/f00c23a2b067d0dbdc63140867e1887b84115655/src/systemd>
- `src/session/session.c`: <https://github.com/cockpit-project/cockpit/blob/f00c23a2b067d0dbdc63140867e1887b84115655/src/session/session.c>
- `src/session/client-certificate.c`: <https://github.com/cockpit-project/cockpit/blob/f00c23a2b067d0dbdc63140867e1887b84115655/src/session/client-certificate.c>
- `src/ws/cockpitauth.c`: <https://github.com/cockpit-project/cockpit/blob/f00c23a2b067d0dbdc63140867e1887b84115655/src/ws/cockpitauth.c>
- `src/ws/cockpitwebservice.c`: <https://github.com/cockpit-project/cockpit/blob/f00c23a2b067d0dbdc63140867e1887b84115655/src/ws/cockpitwebservice.c>
- `src/cockpit/superuser.py`: <https://github.com/cockpit-project/cockpit/blob/f00c23a2b067d0dbdc63140867e1887b84115655/src/cockpit/superuser.py>
- Privileges and Permissions: <https://github.com/cockpit-project/cockpit/blob/f00c23a2b067d0dbdc63140867e1887b84115655/doc/modules/guide/pages/privileges.adoc> (julkaistuna <https://cockpit-project.org/guide/latest/privileges.html>)
- Packages: <https://github.com/cockpit-project/cockpit/blob/f00c23a2b067d0dbdc63140867e1887b84115655/doc/modules/guide/pages/packages.adoc>
- Multi-host: <https://github.com/cockpit-project/cockpit/blob/f00c23a2b067d0dbdc63140867e1887b84115655/doc/modules/guide/pages/multi-host.adoc>
- cockpit.conf(5): <https://github.com/cockpit-project/cockpit/blob/f00c23a2b067d0dbdc63140867e1887b84115655/doc/modules/man/pages/cockpit.conf.5.adoc>
- GHSA-m4gv-x78h-3427 (CVE-2026-4631): <https://github.com/cockpit-project/cockpit/security/advisories/GHSA-m4gv-x78h-3427>
- NVD, CVE-2026-4631: <https://nvd.nist.gov/vuln/detail/CVE-2026-4631>
- GHSA-6jmq-qw8f-w3r6 (CVE-2026-4802): <https://github.com/cockpit-project/cockpit/security/advisories/GHSA-6jmq-qw8f-w3r6>
- Issue #17734 (OAuth): <https://github.com/cockpit-project/cockpit/issues/17734>
- Issue #21327 (OAuth/Bearer): <https://github.com/cockpit-project/cockpit/issues/21327>
- HN, Cockpit (19.3.2026): <https://news.ycombinator.com/item?id=47445599>
- HN, Cockpit (16.10.2023): <https://news.ycombinator.com/item?id=37895446>

[commit]: https://github.com/cockpit-project/cockpit/tree/f00c23a2b067d0dbdc63140867e1887b84115655
[readme]: https://github.com/cockpit-project/cockpit/blob/f00c23a2b067d0dbdc63140867e1887b84115655/README.md
[authmd]: https://github.com/cockpit-project/cockpit/blob/f00c23a2b067d0dbdc63140867e1887b84115655/doc/authentication.md
[tlsreadme]: https://github.com/cockpit-project/cockpit/blob/f00c23a2b067d0dbdc63140867e1887b84115655/src/tls/README.md
[units]: https://github.com/cockpit-project/cockpit/tree/f00c23a2b067d0dbdc63140867e1887b84115655/src/systemd
[session]: https://github.com/cockpit-project/cockpit/blob/f00c23a2b067d0dbdc63140867e1887b84115655/src/session/session.c
[clientcert]: https://github.com/cockpit-project/cockpit/blob/f00c23a2b067d0dbdc63140867e1887b84115655/src/session/client-certificate.c
[auth]: https://github.com/cockpit-project/cockpit/blob/f00c23a2b067d0dbdc63140867e1887b84115655/src/ws/cockpitauth.c
[websvc]: https://github.com/cockpit-project/cockpit/blob/f00c23a2b067d0dbdc63140867e1887b84115655/src/ws/cockpitwebservice.c
[su]: https://github.com/cockpit-project/cockpit/blob/f00c23a2b067d0dbdc63140867e1887b84115655/src/cockpit/superuser.py
[priv]: https://github.com/cockpit-project/cockpit/blob/f00c23a2b067d0dbdc63140867e1887b84115655/doc/modules/guide/pages/privileges.adoc
[pkgs]: https://github.com/cockpit-project/cockpit/blob/f00c23a2b067d0dbdc63140867e1887b84115655/doc/modules/guide/pages/packages.adoc
[multihost]: https://github.com/cockpit-project/cockpit/blob/f00c23a2b067d0dbdc63140867e1887b84115655/doc/modules/guide/pages/multi-host.adoc
[conf]: https://github.com/cockpit-project/cockpit/blob/f00c23a2b067d0dbdc63140867e1887b84115655/doc/modules/man/pages/cockpit.conf.5.adoc
[ghsa1]: https://github.com/cockpit-project/cockpit/security/advisories/GHSA-m4gv-x78h-3427
[nvd1]: https://nvd.nist.gov/vuln/detail/CVE-2026-4631
[ghsa2]: https://github.com/cockpit-project/cockpit/security/advisories/GHSA-6jmq-qw8f-w3r6
[i17734]: https://github.com/cockpit-project/cockpit/issues/17734
[i21327]: https://github.com/cockpit-project/cockpit/issues/21327
[hn1]: https://news.ycombinator.com/item?id=47445599
[hn1a]: https://news.ycombinator.com/item?id=47454883
[hn1b]: https://news.ycombinator.com/item?id=47447728
[hn2a]: https://news.ycombinator.com/item?id=37903018
[hn2b]: https://news.ycombinator.com/item?id=37897320

# Ihmiskohtainen gateway: mitä erottelu oikeasti suojaisi?

**Suosittelen jatkosuunnitteluun ihmiskohtaista, omalla erillisellä palvelu-UID:llä ajettavaa HTTP-gatewayta ja ihmiskohtaista sovellusoriginia, mutta en nykyisen gatewayn monistamista sellaisenaan.** Hyöty syntyy vasta, kun yhden instanssin käyttöjärjestelmäoikeudet ulottuvat vain yhden ihmisen daemoniin eikä instanssi voi myöntää kirjautumista, ylläpito-oikeuksia tai palvelinavaimia muille. Nykyinen yhteinen gateway on jo oikeudeton ja tarkistaa istunnot, mutta sen haltuunotto antaa käytännössä reitin kaikkien daemonien toimintoihin. Pelkkä systemd-template, SNI-reititys tai uusi peer-tarkistus ei muuta tätä. Erottelu vaatii yhteisen kirjautumis- ja ylläpitovallan irrottamisen pieneksi osaksi, uuden istunnon luovutuksen sekä asennus- ja päivityspolitiikan muutoksen. Yhteinen TLS-pää ja kirjautumispalvelu jäävät koko sivuston luottamuspohjaksi. Halvempi gatewayn hiekkalaatikon kiristäminen kannattaa erillisenä työnä, mutta se ei ole ihmisten välinen turvaraja.

Tutkimus 31.10.2026, run `01m69grj9ybx8w9a8c52gnyr4n`. Tuotekoodi ja yksiköt luettu lähtöcommitista `6f81ff22`. **Fakta** tarkoittaa luettua koodia, ohjetta tai havaintoa; **päätelmä/ehdotus** omaa arviota. Tässä ei päätetä arkkitehtuuria eikä muuteta tuotetta tai käynnissä olevia palveluita.

## 1. Nykyisen mallin todellinen raja

**Fakta.** `systemd/open-habitat-daemon@.socket` tekee `daemon.sock`-socketin oikeuksilla `0660`, omistajana ihminen ja ryhmänä `open-habitat-gateway`. Brokerin binding-portti varmistaa rootin omistamat hakemistot ja nimetyt hakemiston läpikulku-ACL:t. `internal/transport/transport_linux.go`, `guardListener.Accept`, hyväksyy vain konfiguroidun `GatewayUID`:n. Tämä vertais-UID:n tarkistus on jo olemassa: sitä ei tarvitse keksiä uutena kovennuksena. Agenttilistenerin oma UID-raja on erillinen (`internal/transport/agent_linux.go`).

**Fakta.** `internal/gateway/session.go` ratkaisee evästeen paikallisesta istuntotilasta, tarkistaa kiellon ja vanhenemisen. `proxy_linux.go` rakentaa uuden pyynnön istunnon bindingin socketiin eikä hyväksy selaimelta Unix-identiteettiä. Gateway tarkistaa socketin root-ohjatun polun ja omistuksen (`internal/udssecure/socket_linux.go`). Systemd:n luoman kuuntelusocketin vertainen ei ole yhteyttä hyväksyvä daemon: siksi palvelinpään todentaminen pelkällä `SO_PEERCRED`:llä olisi väärä muutos. Daemon näkee puolestaan yhteyden avanneen gatewayn UID:n.

**Päätelmä.** Tavallinen käyttäjä A ei näillä oikeuksilla voi käskeä B:n daemonia. Mutta gateway-prosessissa suoritettava hyökkääjän koodi voi ohittaa gatewayn omat istunto- ja reittitarkistukset ja avata B:n socketin oikeana gateway-UID:nä. Daemonin peer-tarkistus hyväksyy sen oikein nykyisen mallin mukaan. `ProtectHome=yes` estää suoran kotihakemistoluvun, ei daemonin sallittujen toimintojen käyttämistä. Tämä on luottamusmallin ominaisuus, ei tässä tutkimuksessa löydetty hyväksikäyttö.

**Fakta.** Gatewayn yhteinen valta ei rajoitu HTTP-proxyyn. `auth.go` hoitaa OAuthin ja tokenin kertaluovutuksen; istuntovarasto, roolit ja revokaatio ovat gatewayn vastuulla. `internal/AGENTS.md` määrittelee lisäksi yhteiset AI-/Soniox-avaimet, niiden jakelun, käyttöönoton oletukset, integraatiosovellusten asetusten välityksen ja jaetut näkymälinkit. Ihmiskohtaiseen prosessiin ei voi antaa samaa yhteistä tilahakemistoa tai samoja broker-oikeuksia menettämättä tavoiteltua eroa.

**Historia.** Commit `b8280f63` (23.9.) tiukensi gatewayn peer-UID:n positiiviseksi ja tokenin luovutusrajaa; `da413270` kantoi kahden käyttäjän systemd-vierastodisteen. Nykyinen raja on tarkoituksellinen käyttöjärjestelmäraja, ei puuttuva vertaisvarmennus. Cockpit-vertailu tuli commitissa `bcdf585b`; sen ehdotus tarvitsee alla olevan rajauksen, jotta sertifikaattimalli ei muutu perusteettomasti OAuth-mallin lupaukseksi.

## 2. Mitä kypsistä järjestelmistä voi lainata?

### Cockpit: erillinen instanssi ei synny käyttäjänimestä

**Fakta, [C1].** Cockpit 370 erottaa TLS-pään HTTP-tulkinnasta. `cockpit-tls` valitsee ws-instanssin **asiakassertifikaatin** sormenjäljen perusteella; kaikki ilman sertifikaattia tulevat HTTPS-asiakkaat käyttävät yhtä instanssia. Tämä ei ole palvelimen wildcard-sertifikaatti eikä SNI:n hostname. Tavallinen GitHub-OAuth-käyttäjä ei tuo tällaista kryptografista asiakastodistetta TLS-kättelyyn.

**Fakta, [C2].** Sertifikaattikirjautumisessa rootin `cockpit-session` sitoo sertifikaatin ws-prosessin cgroupiin. Nykyinen lähde käyttää mahdollisuuksien mukaan peer-pidfd:tä, muuten PID-/käynnistysaikavarmistusta, avaa `/proc/<pid>`-hakemiston ja vaatii cgroup v2:n. Se ei usko ws:n ilmoittamaa cgroup-nimeä.

**Päätelmä.** Hyvä lainattava periaate on erottaa suuri syötteitä tulkitseva pinta tunnistusvallasta. Cockpitin factoryn tai cgroup-tarkistuksen kopiointi ei itsessään todenna Habitatin GitHub-käyttäjää. Cockpitin README:n pahimman tapauksen kuvaus on arkkitehtuuriperustelu, ei todiste siitä, että jokainen HTTP-bugi johtaisi kaikkien käyttäjien haltuunottoon.

### OpenSSH ja PAM: tarkista tunnistus erillään verkkoparserista

**Fakta, [S1].** OpenSSH 9.6p1:n `privsep_preauth` perustaa oikeudettoman verkkolapsen ja etuoikeutetun monitorin. Lapsi menettää yksityiset avaimet, siirtyy chrootiin ja pudottaa UID:n; sandbox rajaa sen toimintoja. Tunnistuksen jälkeen on erillinen käyttäjäprosessi. Yhteinen root-osa ei katoa, mutta koko protokollatulkinta ei aja sen oikeuksilla.

**Fakta, [P1].** `pam_acct_mgmt` tarkistaa tilin voimassaolon ja pääsyrajoitukset tavallisesti tunnistuksen jälkeen. Se ei ole GitHub-tunnistuksen korvike eikä tarkistus siitä, kuka browser-requestin lähetti. Tulokset riippuvat asennetusta PAM-pinosta.

**Päätelmä.** PAM tai SSH eivät ole tähän tarvittava uusi major-riippuvuus. PAM-account-politiikka olisi oma tuotevalintansa. Erityisesti `nologin`-tilin kieltäminen suoraan Cockpitin mallin mukaan rikkoisi Habitatin tarkoituksen: `docs/operations.md` määrittelee brokerin oletustilit nimenomaan `nologin`-tileiksi, joita käytetään selaimesta. SSH-kirjautuminen on erillinen rootin myöntämä oikeus.

### JupyterHub: prosessierottelu ja origin-erottelu ovat eri asioita

**Fakta, [J1–J2].** JupyterHubin LocalProcessSpawner käynnistää henkilöpalvelimen `Popen`illa UID/GID:n ja ryhmien vaihdon jälkeen. Sen tietoturvaohje sanoo erillisten käyttäjädomainien olevan välttämättömiä luotettavalle selainpuolen erottelulle epäluotettavien käyttäjien välillä. Saman hostin polut eivät saa selaimen same-origin-suojaa. Ohje käsittelee myös alidomainien evästeen asettamista toiselle hostille ja suosittelee `__Host-`-evästeitä.

**Päätelmä.** Habitatin ei pidä kopioida Hubin prosessinkäynnistysvaltaa gatewayhin. Hyödyllinen oppi on henkilöorigin, ei uusi rootina ajettava yleiskäynnistin. Habitat jo erottaa editori- ja HTML-view-origininsa; henkilökohtainen app-origin jatkaisi samaa periaatetta.

## 3. Vaihtoehdot, kustannus ja suoja

Arviot ovat suhteellisia, eivät työpäivälupauksia.

| Vaihtoehto | Todellinen suoja | Mitä jää auki | Kustannus |
|---|---|---|---|
| Yksi gateway, tiukempi systemd-sandbox | Vähemmän kernel-, tiedostojärjestelmä- ja prosessien käynnistyspintaa | Kaapattu gateway voi yhä käyttää kaikkia daemoneja | Pieni–keskisuuri; kvalifiointi molemmilla arkkitehtuureilla |
| Monta instanssia samalla gateway-UID:llä ja samoilla oikeuksilla | Virheiden ja resurssikäytön osittainen prosessierottelu | Sama UID/socket-oikeus, yhteiset salaisuudet ja mahdollinen prosessien välinen vaikutus; ei luvattavaa henkilöturvarajaa | Keskisuuri ilman olennaista hyötyä |
| Instanssi ihmisen omalla UID:llä | Unix erottaa ihmiset toisistaan | Gateway saa henkilön natiivioikeudet, ja henkilön oma koodi on samassa turvaidentiteetissä; browser-vallan ja agentin raja heikkenee | Keskisuuri–suuri; hylkään tähän tarkoitukseen |
| Erillinen vakaa palvelu-UID jokaiselle ihmiselle | DAC ja daemonin peer-UID rajaavat yhden instanssin yhteen daemoniin | Yhteinen TLS/tunnistus ja root ovat yhä luotettuja; app-origin ratkaistava erikseen | Suuri, mutta selkein todennettava malli |
| `DynamicUser` per instanssi | Eri elävät UID:t ja vahvat oletusrajaukset mahdollisia | UID-kierrätys, pysyvät bindingit, socket-oikeudet ja cgroup-todennus vaativat lisäsuunnittelua | Suuri ja vakaata palvelu-UID:tä monimutkaisempi |

**Suositeltu jatkosuunnittelun malli (ei päätös):** pieni yhteinen TLS-reititin, erillinen yhteinen kirjautumis-/ylläpitopalvelu ja erillinen HTTP-instanssi per ihminen. Jälkimmäinen ei saa OAuth client secretiä, yhteistä istuntoavainta, yhteisiä palvelinavaimia, toisten tilahakemistoja eikä yleistä provisioning- tai admin-rajapintaa. Palvelu-UID ei ole ihmisen oma UID eikä yhteisen gateway-ryhmän jäsen. Sen daemon-yhteys sallitaan vain juuri sen henkilön bindingiin, jonka root on asentanut. Ihmisen daemon toimii edelleen ihmisenä eikä saa tunnistusvaltaa.

Kirjautumispalvelu pysyy koko sivuston luotettuna osana: jos se saa itsenäisesti todeta GitHub-identiteetin ja myöntää istunnon, sen haltuunotto voi antaa hyökkääjälle istunnon kenenä tahansa. Ehdotus pienentää tämän vallan koodipintaa, ei poista valtaa. Rootin provisioning-brokerin nykyistä toimivaltaa ei saa hiljaisesti laajentaa yleiseksi prosessikäynnistimeksi.

## 4. Reititys, TLS ja selain

### SNI/Host on osoite, ei henkilöllisyys

**Päätelmä.** SNI voi valita yhteyden backendin ennen HTTP:tä, mutta hyökkääjä voi itse lähettää minkä tahansa SNI:n. `Host` tai HTTP/2:n `:authority` on yhtä lailla reititystietoa. Backendin on aina todennettava oma istuntonsa ja hyväksyttävä vain itselleen sidotut hostit. Tuntematon host ei saa luoda Linux-käyttäjää tai rajattomasti systemd-instansseja. Sallittu reittijoukko tulee jo hyväksytyistä bindingeistä, ei Internetin merkkijonoista.

**Polkureititys samalla originilla** voisi säilyttää URL:t ja yhteisen kirjautumisen, mutta etupää joutuisi tulkitsemaan istuntoevästeen tai polun. Käyttäjäinstanssin tuottama kaapattu sovellus-JavaScript toimisi edelleen yhteisen originin oikeuksilla. Evästeen `Path` ei ole turvaraja. Tästä saadaan käyttöjärjestelmätason osittainen parannus, ei itsenäisten henkilöpalvelujen täyttä erottelua.

**Henkilöhostit**, esimerkiksi `oh-app-<opaque-id>.example.org`, tekevät eron näkyväksi selaimelle. Ei Unix-nimeä URL:iin; nimeä ei kuitenkaan pidetä salaisena. Host-only `__Host-`-eväste, ei `Domain`-attribuuttia. Sama registrable domain tarkoittaa usein same-siteä, joten SameSite ei korvaa täsmällistä Origin-/CSRF-tarkistusta. Tarkistukset tarvitaan yhä, samoin hallintapalvelun erillinen origin ja tarkasti rajattu CORS.

**TLS-vaihtoehdot:**

- Yhteinen TLS-pää voi pitää yhden wildcard-avaimen ja välittää HTTP:n Unix-socketeille. Se näkee kaikkien istunnot ja liikenteen; sen kaappaus jää koko sivuston riskiksi. HTTP-reitittimellä pitää olla rajattu parseri, reittitaulu ja resurssirajat, ei daemon-yhteyttä.
- TLS passthrough SNI:n perusteella välttää HTTP-tulkinnan yhteisessä reitittimessä, mutta TLS päättyy henkilöinstanssissa. **Yhteistä wildcard-yksityisavainta ei pidä antaa jokaiselle instanssille:** yhden kaappaus vuotaisi muiden hostien palvelinidentiteetin. Erilliset hostikohtaiset avaimet/sertifikaatit ovat mahdollisia, mutta muuttavat uusinnan ja jakelun paljon raskaammaksi. Etureititys ei silti itsessään todista käyttäjää.
- Pelkkään SNI-yhteysreititykseen on lisäksi huomioitava HTTP/2-yhteyksien hostien välinen yhteiskäyttö: backend ei saa hyväksyä vierasta `:authority`-arvoa vanhan TLS-yhteyden perusteella. Väärän hostin pitää kieltäytyä, ei palvella vieraan henkilön reittiä. Tämä ja mahdollinen HTTP/3 ovat kvalifioitavaa työtä, eivät tässä testattuja ominaisuuksia.

### Yksi OAuth callback riittää edelleen

**Fakta.** Nykyinen callback on täsmälleen `https://<app>/auth/github/callback`; `auth.go` tarkistaa saman originin ja callback-polun. `__Host-agent-host`-eväste asetetaan app-hostille, eikä se siirry henkilöhostille automaattisesti.

**Ehdotus.** Säilytetään yksi rekisteröity callback kirjautumispalvelussa. Se todentaa GitHub-identiteetin, tarkistaa admissionin ja rootin bindingin ja luovuttaa kirjautumisen juuri sen henkilöhostille. Luovutus tarvitsee lyhytikäisen, kertakäyttöisen, vastaanottajaan ja aloittaneeseen selaimeen sidotun koodin. Henkilöinstanssi vaihtaa sen omaan host-only-istuntoonsa todennettua paikallista kanavaa pitkin. OAuth-token ei mene URL:iin tai selaimeen; nykyinen kertaluovutus `gh`:lle on säilytettävä. Vapaasti valittavaa paluu-URL:ia tai henkilöinstanssin esittämää admin-roolia ei hyväksytä. Tarkka protokolla, login-CSRF-suoja ja replay-esto kuuluvat ADR:n jälkeiseen suunnitteluun.

Nykyisten istuntojen 90 päivän idle / vuoden absoluuttinen ikä ja restartin yli säilyminen ovat tuotelupaus. Keskitetty varasto, jota jokainen instanssi voi lukea, kumoaisi erottelun. Tarvitaan joko eriytetyt henkilökohtaiset istuntovarastot tai rajattu keskitetty tarkistusrajapinta. Suosin ensimmäistä ja yhtä erillistä revokaatiovaltaa, en kahden rinnakkaisen istuntototuuden ylläpitoa. Käyttäjän pääsyn peruminen ja uloskirjautuminen katkaisevat myös jo auki olevat streamit, editorit ja terminaalit; pelkkä lyhyt tokenin TTL ei täytä tätä.

### Editorit, viewt ja pitkät yhteydet

**Fakta.** Nykyiset `editor_linux.go`, `views_linux.go`, `view_links_linux.go` erottavat henkilöeditorin, yksittäisen viewn ja julkisen linkkihostin. Editorin/viewn handoff ja väliaikaiset istunnot sidotaan app-istuntoon. Julkinen linkki voi lukea yhden jäädytetyn viennin ilman kirjautunutta ihmistä, mutta ei saa muuta daemon-valtaa.

**Ehdotus.** Näitä origineja ei yhdistetä uuteen henkilö-app-originiin. Reititin ohjaa henkilön editori- ja view-hostit hänen instanssiinsa vain rootin/luotetun hallinnan sidonnalla. Jaetut linkit tarvitsevat saman rajatun export-read-polun ja globaalin revokaation myös silloin, kun omistajan selain ei ole auki. Kaikkien henkilöiden linkkien tokenivarastoa ei kopioida joka instanssiin. Ylläpitäjän linkkilista ja peruminen jäävät yhteisen hallinnan erikseen valtuutetuiksi operaatioiksi.

WebSocket-upgrade ja SSE jäävät yhdelle backendille yhteyden ajaksi; etupään pitää välittää upgrade/backpressure ja katkos oikein. Se ei saa uusia kirjoittavia HTTP-pyyntöjä eikä WebSocket-komentoja backendin restartissa. Henkilöinstanssin pysäytys katkaisee selaimen yhteyden, ei ihmisen daemonia, Pi:tä tai natiiveja user-unitteja.

## 5. Systemd, UID:t ja cgroup-tarkistus

**Fakta, [D1–D2].** `DynamicUser=yes` varaa UID:n palvelun elinajaksi ja kierrättää sen myöhemmin; nimetty olemassa oleva staattinen käyttäjä ei muutu dynaamiseksi. `StateDirectory`/`RuntimeDirectory` on suunniteltu elinkaaren hallintaan. `Accept=no` antaa kuuntelusocketin yhdelle palvelulle, `Accept=yes` tekee instanssin **yhteyttä**, ei kirjautunutta ihmistä, kohti.

**Ehdotus.** Henkilökohtainen `.socket`/`.service`-pari käyttäisi `Accept=no`:ta. Palvelu käynnistyisi socket-yhteydestä; toimettomuus voisi pysäyttää vain henkilö-gatewayn. Aktiiviset WebSocketit/SSE ja keskeneräinen kertaluovutus estäisivät idle-stopin. Istunto ei saa kadota stopin mukana. Bindingin luonti perustaisi rajatun socketin, ei selainpyyntöä vastaavaa vapaavalintaista systemd-unitia. Pelkkä nykyisen binäärin käynnistäminen N kertaa ei riitä: nykyinen gateway avaa julkisen TCP-listenerin itse ja perii yksityisen hallintalistenerin, ei henkilökohtaista HTTP-socketia.

**Miksi vakaa erillinen palvelu-UID?** Daemon voi verrata kernelin antamaa peer-UID:tä rootin pysyvään henkilöbindingiin ilman vieraan prosessin tutkimista. Socket-ryhmä/ACL sallii vain tämän palvelun, eikä palvelu saa toisen henkilön ryhmää. Brokerin UID-pooliin ja installeriin tulee uusi identiteetti per henkilö. Sen hallinta on kustannus, mutta bindingin elinkaari on selkeä.

**Miksi DynamicUser ei ole tässä vain yksi rivi?** Nykyinen daemon-binding sisältää kiinteän `GatewayUID`:n. Dynaaminen UID muuttuu ja kierrättyy; sitä ei saa kirjata pysyväksi todisteeksi. Tarvitaan luotettu live-sidonta unitista UID:hen ja socket-oikeuksiin tai muu yhtä vahva yhteyskohtainen todiste. `SocketUser` ei itsessään ratkaise kylmän socketin ja vielä käynnistymättömän dynaamisen palvelun identiteettiä. Pysyvä shared-group palauttaisi kaiken kattavan socket-pääsyn. Mount-namespace, jossa vain oma socket näkyy, voi olla lisäraja, mutta read-only mount ei estä socketiin yhdistämistä eikä nimeämättömiä/perittyjä fd-reittejä.

**Cgroup-vaihtoehdon erityinen este:** Habitat piilottaa toisten käyttäjien prosessit `hidepid=invisible`-asetuksella, eikä daemonille tai gatewaylle saa antaa proc-poikkeusryhmää. Cockpitin root-sessionin `/proc/<peer>/cgroup`-luku ei siten siirry suoraan henkilödaemonille. Vertais-UID:n lisäksi tehtävä cgroup-tarkistus vaatisi uuden luotetun todentajan tai kvalifioidun muun mekanismin. PID:n kierrätys, prosessin poistuminen ja cgroupin hallintaoikeus on käsiteltävä; basename-/prefix-vertailu tai selaimen lähettämä unitin nimi eivät käy. Yhteisen gatewayn nykyisen cgroupin tarkistaminen ei estä sen sisällä jo ajavaa hyökkääjää. Älä heikennä proc-erottelua tämän takia.

## 6. Halvempi kovennus: hyödyllinen mutta eri lupaus

**Fakta.** Nykyinen gateway-unit sisältää `NoNewPrivileges`, `ProtectSystem=strict`, `ProtectHome=yes`, `PrivateTmp`, `PrivateDevices` ja yksityisen StateDirectoryn. Host-operaattori renderöi lisäksi portin mukaan tyhjän capability-setin tai ainoastaan `CAP_NET_BIND_SERVICE`:n (`internal/host/apply_units_linux.go`). Pelkkä template-tiedoston lukeminen ei siis kerro koko asennettua yksikköä. Tuotannon gateway-tiedostojen tarkastelussa prosessinkäynnistysosumat olivat testeissä, eivät proxy-/auth-toteutuksessa.

**Ehdotus.** Kirjataan ja testataan sääntö, ettei gateway käynnistä natiiviprosesseja. Selvitetään `ProtectKernelTunables`, `ProtectKernelModules`, `ProtectKernelLogs`, `ProtectControlGroups`, `RestrictSUIDSGID`, `LockPersonality`, `RestrictRealtime`, `PrivateIPC`, `SystemCallArchitectures=native`, `MemoryDenyWriteExecute` ja rajattu `SystemCallFilter`. Nämä eivät ole tässä kvalifioitu valmis unit-patch. Go tarvitsee säikeitä: `clone`-kutsun yleiskielto rikkoisi runtimen. `execve`-kielto tavallisessa systemd-ExecStart-suodatuksessa voi estää jo ohjelman käynnistämisen; sitä ei pidä luvata yksinkertaiseksi exec-estoksi.

Nykyinen gateway tarvitsee myös ulospäin GitHub-HTTPS/DNS:n, joten Cockpitin `PrivateNetwork=yes`/pelkkä `AF_UNIX` ei sovi sellaisenaan. Erottelun jälkeen henkilö-gateway voisi pärjätä paikallisilla socketeilla, jos kaikki sen ulkoiset vastuut todella poistuvat. Sandbox ei saa estää revokaatiota, hallintasocketia, OAuthia tai pitkiä yhteyksiä huomaamatta.

## 7. Turvalliset havainnot ja mitä ei mitattu

Kokeet tehtiin Birchlla tavallisena UID:nä 32000, Linux `6.8.0-147-generic`. Ei sudoa, uusia Unix-käyttäjiä, tuotantosocketiin kytkeytymistä, palvelurestartteja tai tuotannon autentikointipyyntöjä.

1. **Lähteet:** Pythonin `urllib.request.urlopen` haki kaikki kahdeksan alla nimettyä upstream-tiedostoa onnistuneesti `raw.githubusercontent.com`:sta. Yleistä web-hakua ei tarvittu. Versiot ovat tarkoituksella nimettyjä lähdeversioita, eivät väite uusimmasta upstreamista.
2. **Vertaisen identiteetti:** oma Python-prosessi loi Unix-stream-socketin yksityiseen scratch-hakemistoon; forkattu lapsi yhdisti ja lähetti `Host: person-b.example`. Palvelin luki `getsockopt(SOL_SOCKET, SO_PEERCRED, 12)` ja purki kolme int-arvoa. Tulos: peer-PID vastasi lasta, UID/GID olivat 32000/32000 ja payload oli edellä mainittu Host. Koe osoittaa vain kernelin identiteetin eron viestissä väitetystä hostista. Se ei testaa eri UID:iden eristystä, systemd-aktivointia tai proposed gatewayta. Socket ja hakemisto poistettiin kokeen jälkeen.
3. **Muisti, vain nykyinen prosessi:** `systemctl show open-habitat-gateway.service -p MainPID -p MemoryCurrent -p TasksCurrent -p ControlGroup` antoi PID 40197, `MemoryCurrent=19759104` (18,84 MiB), 13 taskia ja `/system.slice/open-habitat-gateway.service`. Tämä on tuotannossa jo käynnissä olleen yhteisen palvelun hetkellinen cgroup-laskenta, **ei idle-per-person-mittaus**, RSS/PSS eikä väite sen kuormasta. Ei luettu istuntoja tai salaisuuksia.
4. **Proc-näkyvyys:** saman gateway-PID:n `/proc/40197/cgroup`-luku tavallisena käyttäjänä vastasi ENOENT. Havainto sopii asennettuun hidepid-politiikkaan; yksittäinen ENOENT ei yksin todista syytä (prosessi voi myös poistua). Koodin `systemd/open-habitat-proc.service` ja `internal/host/prepare_session_linux.go` vahvistavat vaaditun hidepid-politiikan. Cgroup-varmennusta daemonin oikeuksilla ei toteutettu.

**Muistikustannuksen arvio:** N käynnissä olevaa instanssia lisää N Go-heapia, yhteyspuskureita ja systemd/cgroup-tilaa; levyltä mapatut binäärisivut voivat jakautua, joten RSS:ien summa on huono arvio. Jos inkrementaalinen kustannus olisi esimerkiksi 20 MiB/aktiivinen henkilö, 10 olisi noin 200 MiB ja 100 noin 2 GiB **vain gateway-osaan**. Tämä on herkkyyslasku, ei mittaustulos. Socket-aktivoidun pysäytetyn instanssin prosessimuisti on nolla, mutta socketit/unitit kuluttavat edelleen muistia. SSE-yhteys voi pitää ”joutilaankin” henkilön instanssin elossa.

**Ennen toteutuspäätöksen kustannuslukua tarvitaan disposable VM -koe:** 0/1/10/100 henkilöinstanssia, kylmä käynnistys, kirjautunut idle ilman virtaa, idle SSE:n kanssa, aktiivinen WS ja memory-pressure. Raportoidaan PSS, cgroup memory.current, kokonaiskoneen erotus ja p95-kylmäviive. Samassa kahden UID:n kokeessa yritetään A:sta B:n socketeihin, session-fileen, hallintaan ja vieraisiin hosteihin; todennetaan denied myös restartin, UID:n uudelleenkäytön, revokaation ja rebootin jälkeen. Tutkimus ei tehnyt tätä prototyyppiä eikä anna sen läpäisylupausta.

## 8. Päivitys ja Fleetrepo-asennus

**Fakta.** `docs/operations.md` ja `internal/AGENTS.md` pitävät product-unitit kiinteänä kvalifioituna politiikkana. Vieraita drop-ineja ei adoptoida. Upgrade aitaa HTTP:n ja native-entryn, pysäyttää product-system-unitit mutta jättää henkilöiden user-managerin työt rauhaan. Uusien politiikkapolkujen lisääminen ei kuulu nykyisen protocol 1:n sisältömuutostukeen.

**Päätelmä.** Muutos kuuluu ensin tuotteen host apply/upgrade/check- ja broker-binding-politiikkaan, ei Fleetrepon irralliseksi proxy- tai unit-paikkaukseksi. Tarvitaan henkilö-gatewayn UID/GID-varaus, hakemistot, socketit, tilan oikeudet, kylmäkäynnistys ja tarkistus; yhteisen auth-/TLS-osan salaisuuksien erottelu; declared DNS/TLS-originien validointi ja rootin ylläpitämä reittisidonta. Fleetrepo toimittaa julkaisun, sivustoasetukset, DNS/ingressin ja salaisuudet tuoteoperaattorin kautta, ei toista käyttäjärekisteriä. Tämän ajon aikana Fleetrepon omaa repositorya tai sen nykyisiä templateja ei tarkastettu.

Upgrade ei voi vain pysäyttää vanhaa singleton-nimeä. Aidan on estettävä myös kaikkien henkilö-socketien uusi aktivointi ja katkaistava tai hallitusti tyhjennettävä jo hyväksytyt yhteydet. Hyväksyttyjen instanssien inventaario tulee brokerin bindingeistä ja systemd:n havainnosta. Fail-closed on säilytettävä auth-, reititin- ja henkilöprosessien eri versioiden aikana. Henkilökohtainen gateway-restart voisi jatkossa pienentää selainkatkon yhteen ihmiseen, mutta nykyisen daemon-upgraden Pi-katkos ei katoa siitä itsestään.

## 9. Suositus ja ADR:n kysymykset

**Suositus:** ota yllä kuvattu erillisen vakaan palvelu-UID:n ja henkilö-app-originin malli seuraavan arkkitehtuurikeskustelun pohjaksi. Älä tee rinnakkaisia nyky-gateway-instansseja samalla valtuudella, älä siirrä gatewayta ihmisen UID:lle, äläkä laajenna proc-poikkeusryhmää cgroup-tarkistuksen helpottamiseksi. Yhteisen gatewayn lisäkovennus on hyödyllinen pienempi työ, ei vaihtoehtoinen todiste henkilövahingon rajautumisesta. Jos tällaista rakenteellista hyötyä ei nyt tarvita, on rehellisempää säilyttää yksi kovennettu gateway kuin rakentaa näennäiserottelu.

ADR:n pitäisi päättää nimenomaan:

1. **Uhkamalli:** luvataanko, että henkilö-gatewayn mielivaltainen koodinsuoritus ei pääse B:n daemoniin, B:n browser-istuntoihin eikä yhteiseen hallintavaltaan? Yhteinen TLS/auth/root jää luotetuksi; onko tämä riittävä hyöty?
2. **Valtuuksien jako:** mikä omistaa OAuthin, admission-/role-tarkistuksen, gh-tokenin kertaluovutuksen, palvelinavaimet, session-revokaation, julkiset view-linkit ja rootin admin-controlin? Mitä brokerin nykyisestä rajasta muuttuu?
3. **Identiteetti:** erillinen vakaa palvelu-UID ja henkilökohtaiset DAC-oikeudet vai dynaaminen UID ja erikseen todennettava elävä sidonta? Kuka saa perustaa ja aktivoida täsmälleen sallitun instanssin?
4. **Selain ja TLS:** hyväksytäänkö henkilökohtainen app-host ja sen URL-, PWA/service-worker-, ilmoituslupa- ja kirjautumiskokemusvaikutus? Yhteinen TLS-terminointi vai hostikohtaiset avaimet? Editorit ja viewt pysyvät erillisinä.
5. **Istuntoelinkaari:** yksi kertaluovutusprotokolla, yksi totuus per henkilöistunto, säilyminen restartin yli sekä välitön uloskirjautuminen/revokaatio kaikissa johdetuissa yhteyksissä. Vanhojen istuntojen siirto vai kerran tehtävä uusi kirjautuminen?
6. **Operointi ja hyväksyntä:** sallittu muistibudjetti, idle-stopin vaikutus SSE:hen, aktivointitulvan rajoitus ja uuden asennus-/upgrade-protokollan kahden käyttäjän turvatodiste ennen käyttöönottoa.

Tutkimus on valmis; nämä ovat päätettäviä kysymyksiä, eivät tämän raportin myöntämä toteutuslupa tai valmiiksi aikataulutetut uudet issuet.

## Lähteet ja rajaukset

Paikallinen lähdeviite tarkoittaa yllä mainittua lähtöcommittia; mainitut funktiot ja polut löytyvät siitä myös myöhemmän poistamisen jälkeen `git show`lla. Juuren `AGENTS.md`, `internal/AGENTS.md`, `docs/product.md` ja `docs/operations.md` luettiin. Yllä nimetyt gateway-/transport-/systemd-/host-tiedostot ovat nykytilan lähteet; historia ei korvaa niitä.

- [C1] [Cockpit 370: TLS-rakenne ja sertifikaattikohtaiset instanssit](https://github.com/cockpit-project/cockpit/blob/370/src/tls/README.md).
- [C2] [Cockpit 370: peer-pidfd, proc ja cgroup-sidonta](https://github.com/cockpit-project/cockpit/blob/370/src/session/client-certificate.c), `get_ws_proc_fd`, `get_ws_proc_fd_pid_time`, `cockpit_session_client_certificate_map_user`-polun cgroup-vertailu.
- [D1] [systemd v255 systemd.exec](https://github.com/systemd/systemd/blob/v255/man/systemd.exec.xml), `DynamicUser`, `BindPaths`, `RestrictAddressFamilies`, `SystemCallFilter`. Ubuntu 24.04:n systemd-perheen perusversiota vastaava upstream-ohje, ei jakelun kaikkien backporttien auditointi.
- [D2] [systemd v255 systemd.socket](https://github.com/systemd/systemd/blob/v255/man/systemd.socket.xml), `Accept`, `Service`, `SocketUser`, `SocketMode`.
- [P1] [Linux-PAM v1.5.3 pam_acct_mgmt](https://github.com/linux-pam/linux-pam/blob/v1.5.3/doc/man/pam_acct_mgmt.3.xml).
- [S1] [OpenSSH portable V_9_6_P1 sshd.c](https://github.com/openssh/openssh-portable/blob/V_9_6_P1/sshd.c), `privsep_preauth_child`, `privsep_preauth`, `privsep_postauth`. Rakenteellinen vertailu, ei ehdotus käyttää vanhaa SSH-versiota.
- [J1] [JupyterHub 5.2.1 websecurity](https://github.com/jupyterhub/jupyterhub/blob/5.2.1/docs/source/explanation/websecurity.md), user subdomains, same-origin ja cookie tossing.
- [J2] [JupyterHub 5.2.1 spawner.py](https://github.com/jupyterhub/jupyterhub/blob/5.2.1/jupyterhub/spawner.py), `set_user_setuid`, `LocalProcessSpawner`.

Työkalurajaus: yksi lähdehaku käytti olematonta globia `internal/host/proc*` ja tulosti polkuvirheen. Haku korjattiin `internal/host --glob '*.go'`:ksi; relevantti `prepare_session_linux.go` löytyi. Proc-lukukoe palautti yllä kerrotun ENOENT:n odotettuna kielteisenä havaintona. Upstream-hakuja ei jäänyt estyneeksi. Tuotetestejä ei ajettu, koska tuotetta ei muutettu; suunnitellun arkkitehtuurin turva- tai suorituskykytestejä ei väitetä tehdyiksi.

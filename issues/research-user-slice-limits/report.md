# Ihmiskohtaiset resurssirajat

**Tiivistelmä.** Suosittelen yhtä rootin hallitsemaa `user-<uid>.slice`-budjettia, jonka alle sijoitetaan myös ihmisen nykyinen järjestelmädaemon. Näin selain-Pi, sen työkalut, SSH-istunnot ja käyttäjämanagerin tmux/editori/Taskfleet jakavat saman katon, eikä daemonin tarvitse saada uusia valtuuksia. Pelkkä daemonin muistiraja ei kata ihmisen muuta työtä; pelkkä Pi:n siirtäminen käyttäjämanageriin jättää daemonin muut lapset ulkopuolelle. Resurssiraja ja Pi:n säilyminen päivityksessä ovat eri muutoksia: jälkimmäinen vaatii myös nykyisten putkien, kuolemasignaalin ja kirjoittajaomistajuuden uudelleensuunnittelun. Tässä tutkimuksessa ei muutettu tuotetta tai palvelimen pysyvää konfiguraatiota. Birchn rajatuilla transienttikokeilla todettiin sekä käyttäjäpalvelun rajoitus että järjestelmäpalvelun sijoitus olemassa olevan käyttäjäslicen alle.

Tutkimus 31.10.2026, ajo `01m69grh4ks5t0rpbg681171r8`, repon lähtötila
`6f81ff22`. **Fakta** tarkoittaa koodia/dokumentoitua toimintaa, **havainto** tässä
ajossa mitattua ja **päätelmä/suositus** vielä hyväksymätöntä ratkaisua.

## 1. Nykytila ja ongelman täsmennys

**Fakta:** `systemd/open-habitat-daemon@.service` asettaa `User=%i`, mutta ei
`Slice=`-arvoa. Instanssipalvelun oletus on templaatin oma alislice
`system.slice`-puussa [S1]. Unix-UID ei sijoita prosessia automaattisesti
samannumeroiseen cgroupiin. Pi käynnistetään `exec.Command`-lapsena
(`internal/daemon/pi_rpc_linux.go:129–238`), joten sen tavalliset lapset
perivät daemonin cgroupin. Tmux ja editori käyttävät jo `systemd-run --user`
-palveluita, kun käyttäjämanageri on saatavilla; vaihtoehtoinen käynnistys on
daemonin lapsi (`terminal_linux.go`, `editor_linux.go`).

**Fakta:** `internal/host/apply_units_linux.go:160–182` edellyttää tuotteen
yksiköiltä täsmälleen hyväksyttyä fragmenttia ja tyhjää `DropInPaths`-kenttää.
Testi `apply_units_linux_test.go:58` sallii käyttäjäslicen budjettitiedoston.
Ylläpito-opas ohjaa siis sallitulle konfiguraatiopinnalle, mutta sen katto ei
nykyisin kata daemonia. Asiakkaan omatekoinen daemon-drop-in ei ole tuettu
korjaus. Sama tiedostopolitiikka koskee myös tuotteen itse generoimaa uutta
ratkaisua: se on ensin lisättävä hyväksyttyyn politiikkaan.

**Havainto:** Birch, systemd `255.4-1ubuntu8.18`, UID 32000:

| Kohde | Cgroup | MemoryMax | TasksMax | OOMPolicy |
|---|---|---|---|---|
| daemon | `/system.slice/system-open\\x2dhabitat\\x2ddaemon.slice/open-habitat-daemon@maintainer.service` | infinity | 38297 | stop |
| ihmisen slice | `/user.slice/user-32000.slice` | infinity | 84254 | ei palveluasetus |
| käyttäjämanageri | edellisen alla `user@32000.service` | infinity | infinity | continue |

Luvut ovat `systemctl show`-tuloksia. Kernelin `memory.max`, `memory.high` ja
`memory.swap.max` olivat daemonissa ja käyttäjäslicessä `max`. `pids.max`
vastasi taulukon TasksMax-arvoja. Daemonin `memory.current` oli 1 778 307 072
tavua ja käyttäjäslicen 16 701 870 080 tavua. Nämä ovat hetkellisiä cgroupin
kulutuslukuja, eivät henkilöiden tyypillistä tarvetta tai pelkkää RSS:ää.

**Tärkeät korjaukset lähtöoletukseen:** tehtäväraja ei ole Birchlla kokonaan
poissa, vaan natiivi oletusraja on voimassa. Tuotekohtaista mitoitusta ei ole.
Repossa commit `4735064e` on jo vaihtanut daemonin, tmuxin ja editorin
`OOMPolicy=continue`-tilaan; Birchn ajossa oleva daemon oli yhä `stop`.
Tutkimus ei julkaissut muutosta eikä käynnistänyt daemonia uudelleen.
Käyttäjäslicen `memory.events` näytti historiallisesti `oom=2, oom_kill=2`,
daemonin kaikki laskurit nollaa. Niistä ei voi päätellä tapahtuma-aikaa,
syyllistä tai sitä, että juuri tämä rajaton yläslice olisi aiheuttanut OOM:n.

## 2. Mitä natiivit rajat todella lupaavat

**Faktat [S1, S2]:**

- `MemoryHigh` aiheuttaa takaisinperintää ja hidastusta; se ei ole ehdoton
  katto. `MemoryMax` on viimeinen raja: jos muistia ei voida vapauttaa,
  cgroupissa tulee OOM. Yläryhmän raja koskee kaikkia sen jälkeläisiä.
- `MemorySwapMax` rajaa swapin erikseen. Pelkkä RAM-katto ei päätä swapin
  käytöstä. Sivuvälimuisti ja muut cgroupiin laskettavat varaukset ovat mukana;
  neljän Pi-prosessin laskuri ei korvaa tätä.
- `TasksMax` rajoittaa myös säikeitä, ei vain näkyviä ohjelmia. Liian pieni
  katto estää uuden työkalun, shellin tai ohjausprosessin luomisen.
- `CPUWeight` jakaa CPU:ta suhteessa **saman vanhemman sisaruksiin**, kun on
  kilpailua. Se ei takaa prosenttia koneesta eikä estä käyttämästä vapaata
  CPU:ta. `CPUQuota` on kova aikaraja; se voi hidastaa myös yksin työskentelevää.
- Ihmisten kattojen summa voi ylittää koneen muistin. Yhden henkilön katto ei
  yksin estä koko hostin OOM:ää. Ylläpidon pitää jättää tilaa kernelille,
  gatewaylle ja brokerille sekä mitoittaa yhteiskäyttö; tarvittaessa myös
  yhteinen `user.slice`-katto on erillinen kapasiteettipäätös.

**Fakta [S3]:** `OOMPolicy=continue` estää systemd:tä pysäyttämästä koko
palvelua vain siksi, että yksi lapsi joutui OOM-tapon uhriksi. Se ei varaa
muistia, suojaa daemonia valinnalta eikä peruuta systemd-oomd:n jo tekemää
ryhmätappoa. `kill` asettaa `memory.oom.group=1`; tätä ei tule vahingossa
valita koko ihmisen ryhmään, jos tarkoitus on säästää hänen muu työnsä.
Daemonin oman pääprosessin kuolema voi edelleen käynnistää palvelun uudelleen.

**Päätelmä:** yhteinen ihmiskatto suojaa muita ihmisiä, ei kaikkia saman
henkilön töitä toisiltaan. Keskustelukohtainen alaraja voi myöhemmin rajata
vahinkoa lisää. Se ei saa korvata yhteistä kattoa: monta pientä yksikköä voi
muuten käyttää yhteensä rajattomasti. Ohjaustason käyttökelpoisuus
muisti-/tehtävärajan täyttyessä tarvitsee VM-kokeen; `MemoryLow`-suojaus tai
erilliset alibudjetit eivät ole tässä todennettu ratkaisu.

## 3. Vaihtoehdot ja niiden todellinen kattavuus

| Vaihtoehto | Mitä kattaa | Puute / muutoskustannus |
|---|---|---|
| Tuotteen generoima MemoryMax/TasksMax daemon-instanssille | daemon, selain-Pi, tavalliset lapset, integraatiot | ei SSH:ta, user-palveluita tai niihin käynnistettyjä töitä; kaksi erillistä budjettia ei ole yksi ihmiskatto |
| Pi transienttina käyttäjäpalveluna tai scopena | Pi ja sen tavalliset lapset user-slicen alla | daemon ja sen muut lapset jäävät ulos; käynnistys- ja RPC-omistajuus muuttuvat |
| **Nykyinen daemon samaan `user-UID.slice`:en** | daemon sekä nykyinen manageri ja PAM-istunnot saman katon alla | tuotteen on muodostettava luotetusta bindingistä numeerinen Slice ja hyväksyttävä oma generoitu politiikka |
| Uusi `habitat-UID.slice` daemonille ja käyttäjämanagerille | molemmat, jos kumpikin todella siirretään | logindin tavalliset SSH-session scopet jäävät alkuperäiseen `user-UID.slice`:en; ylimääräinen hierarkia ja natiivipolitiikan muutos |
| Delegate=yes daemonille ja oma cgroup-hallinta | daemonin oma alipuusto | ei siirrä mitään user-sliceen eikä kokoa muita reittejä; tekee daemonista uuden resurssimanagerin |
| PAMName/pam_systemd daemonin käynnistykseen | rekisteröi login-session ja voi sijoittaa session scopen | muuttaa session elinkaarta ja PAM-riippuvuuksia; ei ole pelkkä Slice-asetus eikä resurssiraja |

**Fakta [S1, S4]:** delegointi antaa hallittavaksi vain oman alipuuston.
Yläpuolen rootin rajaa ei voi nostaa sillä. Käyttäjämanagerilla on tämä
hallinta jo; oma cgroup-kirjoittaja daemonissa olisi päällekkäinen. Käyttäjä
voi puolestaan muuttaa omien user-yksiköidensä rajoja. Siksi ihmisen ehdoton
katto kuuluu system-managerin omistamalle slicelle, ei hänen muokattavaan
`~/.config/systemd/user`-tiedostoonsa.

**Fakta [S5]:** `Slice=user-%U.slice` **ei ole oikea korjaus** nykyiseen
järjestelmätemplateen: `%U` on palvelumanagerin UID, järjestelmämanagerilla
0, ei `User=%i`-kentän käyttäjän UID. `%i` on nyt käyttäjänimi, ei UID.
Tarvitaan joko tuotteen tuottama instanssikohtainen numeerinen sijoitus tai
laajempi yksikkönimeämisen muutos. Suosittelen ensimmäistä; olemassa oleva
brokerin binding on identiteetin lähde, ei uusi UID-rekisteri.

**Päätelmä:** rootin asennuspolitiikka voi sallia tarkasti tuotetun
instanssifragmentin/drop-inin ja edelleen torjua kaikki vieraat lisäykset.
Pelkkä nykyisen override-tarkistuksen poistaminen olisi väärä ratkaisu:
samalla sallittaisiin ExecStartPre- ja valtuusmuutokset.

## 4. PAM, OpenSSH ja Cockpit: miksi SSH toimii eri tavalla

**Fakta [S6]:** `pam_systemd` rekisteröi session logindiin, luo sille
session scopen käyttäjän slicen alle ja huolehtii käyttäjämanagerin
käynnistymisestä. PAMin session-kohtainen MemoryMax/TasksMax ei ole kaikkien
käyttäjän prosessien yhteinen raja; dokumentti mainitsee käyttäjämanagerin
erikseen sen ulkopuolella. UID:n vaihtaminen yksin ei tee tätä.

**Fakta [S7]:** OpenSSH:n `UsePAM yes` ajaa PAM account- ja session-moduulit
kaikilla tunnistautumistavoilla, myös avaimilla. **Havainto:** Birchn
`/etc/pam.d/common-session` sisältää `session optional pam_systemd.so`.
Tämä ei yksin todista jokaisen mahdollisen SSH-/cron-/sudo-reitin cgroupia;
sshd:n efektiivistä konfiguraatiota tai uutta SSH-kirjautumista ei tässä
muutettu eikä testattu.

**Fakta [S8]:** Cockpitin `src/session/session.c` kutsuu `pam_start("cockpit", …)`
ja `pam_open_session`; Debian-PAM-konfiguraatio sisällyttää `common-session`in.
Se hyödyntää käyttöjärjestelmän kirjautumisistuntoa sen sijaan, että pelkkä
bridge-prosessin UID olisi resurssiryhmä. Cockpit on ylläpitotyökalu, jonka
kirjautumis- ja korotusoikeuksia ei pidä siirtää Habitatin gatewaylle.

**Suositus:** säilytetään natiivi logind-hierarkia ja viedään daemon siihen.
Ei lisätä PAM-kirjautumista gatewayn tai daemonin vastuuksi vain resurssien
takia. Kaikki käynnistysreitit on silti auditoitava: cgroup ei ole globaali
UID-kiintiö. Root voi käynnistää saman UID:n työn myös muualla; sudo-oikeuksinen
käyttäjä voi muuttaa rajoja. Birchn Jarin sudo-grantti on tästä nimenomainen
poikkeus, ei tavallisen Habitat-käyttäjän malli.

## 5. JupyterHub ja Orca

**Fakta [S9]:** SystemdSpawner rakentaa transientin järjestelmäpalvelun,
asettaa `MemoryMax` arvosta `mem_limit`, `CPUQuota` arvosta `cpu_limit` ja
välittää valinnaisen `slice`-asetuksen. Tämä on hyvä esimerkki siitä, että
Unix-käyttäjä ja cgroup-budjetti ovat eri asioita. Sen palvelinkohtainen
raja ei kuitenkaan muutu koko UID:n rajaksi vain siksi, että palvelinta
kutsutaan single-user-palvelimeksi. Habitatin aiempi
[JupyterHub-vertailu](../benchmark-jupyterhub/report.md) kuvaa myös root-hubin
valtuudet; niitä ei tarvita tähän ratkaisuun.

**Fakta [S10]:** Orcan dokumentaatio sanoo terminaalien olevan omissa
systemd-user-scopeissaan. `ORCA_TERMINAL_MEMORY_MAX` ja
`ORCA_TERMINAL_MEMORY_SWAP_MAX` antavat niille rajat; oletuksena rajoja ei
aseteta. Jos host ei kykene toteuttamaan niitä, Orca lokittaa tilanteen ja
käynnistää terminaalin ilman rajaa. Tämä on dokumentoitu toimintalupaus,
ei tässä ajettu Orca-koe. **Päätelmä:** yksittäisen terminaalin alaryhmä on
hyödyllinen, mutta monen ihmisen hostissa luvattua ihmiskattoa ei saa pudottaa
hiljaisesti pois. Orcan yhden käyttäjän kompromissi ei ole Habitatin
asennuksen hyväksymisperuste.

## 6. Turvalliset kokeet Birchlla

Kokeet tehtiin tämän ajon omilla `oh-research-bg681171r8-*`-yksiköillä.
Ei OOM-kuormaa, fork-pommia, olemassa olevan slicen rajan laskemista,
pysyviä yksiköitä, daemon-restarttia tai muiden prosessien siirtämistä.
Kaikki komennot rajattiin `timeout`illa ja yksiköt kerättiin `--collect`illa.

**Koe A, user-palvelu:**

```sh
timeout 20s systemd-run --user --quiet --wait --pipe --collect \
  --unit=oh-research-bg681171r8-service \
  -p MemoryMax=64M -p TasksMax=16 -p CPUWeight=50 -p OOMPolicy=continue \
  /usr/bin/python3 -c '<lue /proc/self/cgroup ja sen kernel-rajat; käynnistä lukijalapsi>'
```

Havaittu polku:
`/user.slice/user-32000.slice/user@32000.service/app.slice/oh-research-bg681171r8-service.service`.
Python-lapsen polku oli sama. Kernelistä luettiin `memory.max=67108864`,
`pids.max=16`, `cpu.weight=50`, `memory.oom.group=0`.
Tämä todistaa rajojen asettamisen, ei kuormituksessa tapahtuvaa OOM-käyttäytymistä.

**Koe B, user-scope:** `timeout 20s systemd-run --user --quiet --scope
--collect --unit=oh-research-bg681171r8-scope -p MemoryMax=64M -p TasksMax=16`
sekä sama lyhyt cgroup-lukija. Polku päättyi
`user@32000.service/app.slice/oh-research-bg681171r8-scope.scope`.
Scope-reitti siis toimii tällä käyttäjämanagerilla. Se ei osoita Pi:n
omistuslukkojen tai RPC:n säilymistä.

**Koe C, järjestelmäpalvelu samaan user-sliceen:** Jarin ennestään hyväksytyllä
sudo-grantilla, käyttäjämanagerin lyhyen apuyksikön kautta:

```sh
timeout 25s systemd-run --user --quiet --wait --pipe --collect \
  --unit=oh-research-bg681171r8-launch /usr/bin/sudo -n \
  /usr/bin/systemd-run --quiet --wait --pipe --collect \
  --unit=oh-research-bg681171r8-system --uid=32000 --slice=user-32000.slice \
  -p MemoryMax=64M -p TasksMax=16 -p RuntimeMaxSec=10 \
  /usr/bin/python3 -c 'import pathlib; print(pathlib.Path("/proc/self/cgroup").read_text().strip())'
```

Tulos: `0::/user.slice/user-32000.slice/oh-research-bg681171r8-system.service`.
Järjestelmäpalvelu ja user-manageri voivat siis todella olla saman
käyttäjäslicen sisaruksia. Lopuksi sekä system- että user-managerin
`list-units 'oh-research-bg681171r8-*' --no-legend` olivat tyhjät.
Sudo oli vain kokeen käynnistysväline, ei ehdotus tuotteen daemonille.

## 7. Elinkaari, päivitys ja asennuksen omistajuus

**Fakta:** Pi:n nykyisessä käynnistyksessä on `Pdeathsig: SIGKILL`,
`Setpgid: true`, daemonin omistamat stdin/stdout-putket sekä `ExtraFiles`issa
periytyvä kirjoittajalukko ja työtilan descriptor. Lisäksi prosessikohtaisia
laajennustiedostoja luodaan daemonin temp-ympäristöön. Yksikössä on
`KillMode=mixed`. `docs/operations.md` lupaa päivityksessä user-yksiköiden
säilyvän, mutta kertoo selain-Pi:n katkeavan.

**Päätelmä:** yhteinen slice korjaa budjetin muuttamatta tätä lupausta.
`systemd-run --user --scope` ei yksin irrota prosessin vanhempaa, putkia eikä
elinkaarta. Transientissa servicessä manageri käynnistää ohjelman, mutta
`--pipe` ei tee RPC-yhteydestä uudelleenkytkettävää. Pi:n säilymiseen tarvitaan
erillinen päätös ohjauskanavasta, alkuperäisen kirjoittajalukon säilymisestä,
uuden daemonin omistusnäytöstä, vanhan sukupolven tiedostoista ja
katkenneen lähetyksen epävarmuudesta. Uutta historia- tai prosessirekisteriä
ei pidä ottaa sivuvaikutuksena. Samalla on säilytettävä nykyinen sandbox:
user-managerin käynnistämä service ei peri daemonin NoNewPrivileges- tai
PrivateTmp-asetuksia automaattisesti.

**Fakta:** `maxLiveConversations=4` ja kymmenen minuutin idle-stop ovat
sovelluksen käytäntöä (`pi_activity_linux.go`); ne eivät ole tavurajoja.
Taskfleet-työtä odottava Pi voidaan jättää eloon. **Suositus:** säilytetään
idle-politiikka eikä käytetä sitä resurssiturvan korvikkeena. Ihmisen tai
daemonin Pi-stop ei saa pysäyttää koko slicea ja sen mukana tmuxia/Taskfleetiä.

**Fakta:** levyn ext4-UID-kiintiö toimii eri mekanismilla eikä muutu cgroupia
vaihdettaessa. Muistiraja ei estä levyn täyttämistä quota-vapaassa asennuksessa.
`loginctl enable-linger` on brokerille jo sallittu valtuus. Systemd:n
logind-koodi hallitsee käyttäjämanagerin ja sessionien elinkaarta [S11].
**Suositus:** säilytetään linger ja testataan boot, viimeinen logout,
managerin restart sekä daemonin socket-aktivointi yhdessä; pelkkä koe C ei
ole näiden hyväksyntä.

**Suositus asennukselle:** rootin sivustomäärittely nimeää ihmisen yhteisen
budjetin; tuote julkaisee ja varmentaa sen hyväksytyt yksiköt. Fleetrepo toimittaa
sivustomäärittelyn ja kutsuu tuoteoperaattoria, ei kirjoita rinnakkaista
cgroup-totuutta. Jo sidottujen UID:iden muutokset kuuluvat `host apply`lle;
uuden henkilön sijoituksen ja budjetin on oltava voimassa ennen ensimmäistä
daemonia/user-managerin työkuormaa. Tähän tarvitaan brokerin nykyiseen
binding-transaktioon rajattu, rootin politiikasta johdettu julkaisu tai
ennalta asennettu vastaava kattava politiikka. Ei gatewayn antamaa UID:tä,
yleistä systemd-run-oikeutta tai asiakkaan valitsemia unit-ominaisuuksia.

Tämä uuden tilin julkaisuvaltuus on ADR:n asia. Myös mahdollisten uusien
policy-polkujen vaikutus host-upgraden yhteensopivuusprotokollaan täytyy
kvalifioida: nykyinen protokolla 1 hyväksyy sisältömuutoksia kiinteässä
polkujoukossa, ei mielivaltaista polkujoukon kasvua. Jo käynnissä olevaa
daemonia ei siirretä huomaamatta uuteen sliceen; siirtymä vaatii sen
hallitun uudelleenkäynnistyksen. Katon laskeminen voi puolestaan käynnistää
reclaimin/OOM:n heti, joten siitä tarvitaan vaikutusarvio ja hyväksyntä.

## 8. Suositus ja ADR:n päätettävät kysymykset

**Suositus:** tehdään ensin yksi ihmiskohtainen rootin omistama katto
olemassa olevaan `user-UID.slice`:en ja sijoitetaan daemon sinne. Ei omaa
cgroup-manageria, uutta root-ajorajapintaa eikä tässä yhteydessä lupausta
Pi:n jatkumisesta daemonin yli. Käyttäjämanagerin käytön laajentamista
Pi:hin voi tutkia tämän jälkeen elinkaaritarpeen, ei budjettiaukon vuoksi.

ADR:n on ratkaistava:

1. Onko luvattu budjetti koko ihmisen työ (suositus), ja mitkä ulkopuoliset
   root-/cron-/SSH-reitit installation qualification todella tarkistaa?
2. Mitkä ovat MemoryHigh/MemoryMax/MemorySwapMax/TasksMax/CPUWeight-oletukset,
   henkilökohtaiset poikkeukset ja hostille jätettävä tila? Tässä mitattu
   hetkellinen kulutus ei riitä numeroiden valintaan.
3. Miten rootin sivustomäärittely, UID-binding ja uuden käyttäjän julkaisu
   muodostavat yhden tarkistettavan politiikan ennen ensimmäistä prosessia?
   Saako broker rajatun uuden julkaisuvaltuuden, vai käytetäänkö ennakkoon
   asennettua politiikkaa? Kuka voi myöhemmin muuttaa budjettia?
4. Mikä on OOM:n haluttu vahinkoalue: yksittäinen prosessi, keskustelu vai
   henkilö? Miten ohjaus- ja palautumisreitti toimii TasksMaxin täyttyessä?
   Ei oletusarvoisesti koko käyttäjäpuun ryhmätappoa.
5. Miten muutos otetaan käyttöön vanhoille tileille, miten estetään
   rajoittamaton fallback, ja miten rajojen pienennys hyväksytään?
6. Rajataanko Pi:n säilyminen päivityksissä omaan myöhempään päätökseen
   (suositus)? Jos ei, tarvitaan ensin erillinen RPC/omistajuusprototyyppi.

Ennen toteutuksen hyväksyntää disposable-VM-testit vähintään kahdella UID:llä:
selain-Pi:n lapset, user-service, tmux, editori, SSH ja rootless-container
saman katon alla; yhden UID:n rajattu OOM ja tehtäväraja muiden jatkaessa;
rajankiertoyritys oman user-unitin kautta; boot/logout/linger; daemonin
restart ja upgrade; konfiguraatiodriftin torjunta sekä uuden bindingin
keskeytynyt julkaisu. Birchlla ei pidä tehdä näitä kuormakokeita muiden
workerien rinnalla.

## 9. Rajaukset ja lähteet

Ei tuotemuutoksia, käyttöönottoa, OOM-/fork-kuormaa tai Pi:n
restart-säilymisen koetta. Cockpitia, JupyterHubia ja Orcaa ei asennettu.
Yleistä verkkohakua ei käytetty. Cockpitin vanha oletettu lähdepolku palautti
404:n; GitHubin puulista johti nykyiseen `src/session/session.c`:hen.
Raw GitHub palautti yhden lisälähde-erän kohdalla 429:n; systemd.service ja
kernelin cgroup-dokumentti haettiin onnistuneesti `gh api contents` -reittiä.
Ensimmäinen paikallisen issuen luku käytti väärää `issue.md`-nimeä;
varsinainen `item.md` luettiin sen jälkeen. Nämä eivät jättäneet tutkimuksen
keskeistä lähdekohtaa tavoittamatta.

Lähteet luettu 31.10.2026. Systemd v255 vastaa tuetun Ubuntu 24.04:n
pääversiota; kernelin v6.8 on dokumentaatioviite, ei väite Birchn kernelversiosta.

- **S1:** [systemd v255: resource-control](https://github.com/systemd/systemd/blob/v255/man/systemd.resource-control.xml), MemoryHigh/Max, TasksMax, CPUWeight, Slice ja Delegate.
- **S2:** [Linux v6.8: cgroup v2](https://github.com/torvalds/linux/blob/v6.8/Documentation/admin-guide/cgroup-v2.rst), hierarkia, memory ja pids.
- **S3:** [systemd v255: service](https://github.com/systemd/systemd/blob/v255/man/systemd.service.xml), OOMPolicy.
- **S4:** [systemd v255: cgroup delegation](https://github.com/systemd/systemd/blob/v255/docs/CGROUP_DELEGATION.md).
- **S5:** [systemd v255: unit specifiers](https://github.com/systemd/systemd/blob/v255/man/systemd.unit.xml), `%u` ja `%U`.
- **S6:** [systemd v255: pam_systemd](https://github.com/systemd/systemd/blob/v255/man/pam_systemd.xml); [systemd-run](https://github.com/systemd/systemd/blob/v255/man/systemd-run.xml), scope vs service.
- **S7:** [OpenSSH 9.6p1: sshd_config](https://github.com/openssh/openssh-portable/blob/V_9_6_P1/sshd_config.5), UsePAM.
- **S8:** Cockpit main, luettaessa HEAD `f00c23a2b067d0dbdc63140867e1887b84115655`: [session.c](https://github.com/cockpit-project/cockpit/blob/f00c23a2b067d0dbdc63140867e1887b84115655/src/session/session.c), [Debian PAM](https://github.com/cockpit-project/cockpit/blob/f00c23a2b067d0dbdc63140867e1887b84115655/tools/cockpit.debian.pam).
- **S9:** [SystemdSpawner 9a0a7f4e](https://github.com/jupyterhub/systemdspawner/blob/9a0a7f4efe543f50517f84f9985c38269afc77c3/systemdspawner/systemdspawner.py), start ja slice.
- **S10:** [Orca b45d71bf: remote servers](https://github.com/stablyai/orca/blob/b45d71bf8dc5f2623d991bc659c64ef9ce9ec940/docs/site/content/docs/remote-servers.mdx), terminal memory limits.
- **S11:** [systemd v255: logind-user.c](https://github.com/systemd/systemd/blob/v255/src/login/logind-user.c), user_stop_service, user_stop ja linger.
- Paikalliset ensisijaislähteet: `systemd/open-habitat-daemon@.service`, `internal/host/apply_units_linux.go` ja testi, `internal/daemon/pi_rpc_linux.go`, `pi_activity_linux.go`, `terminal_linux.go`, `editor_linux.go`, `internal/AGENTS.md`, `docs/product.md`, `docs/operations.md`. Historiallinen OOM-muutos: `git show 4735064e`.
- Asennuksen vastuut ja Birchn rajatun kokeen korotusreitti: Fleetrepon `infra/birch/AGENT-ENVIRONMENT.md`; mitään Fleetrepo-tiedostoa ei muutettu.

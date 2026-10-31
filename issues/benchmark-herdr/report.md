# Vertailu: herdr

Tutkimusajo `01m68hr0fm3xr9bxkp5keaf3ph`, 31.10.2026. Syvyys kevyt, kuten
`issues/benchmark-candidates/report.md` ehdotti. Kysymys: mihin SSH- ja
tmux-polku on menossa, ja miten agentin tila päätellään terminaalista.

Lähteet: kolmen herdr-repon lähdekoodi ([`herdr`][h-commit] commitista
`ee5bfb50`, [`herdr-core`][c-commit] commitista `4a3591aa` ja
[`herdr-app`][a-commit] commitista `3130e416`, kaikki luettu 31.10.), herdr.dev:n
dokumentaatio, Pi:n lähdekoodi ja dokumentaatio (`earendil-works/pi`), OSC 7501
-spesifikaatio, tmuxin issue 5713, GitHub API ja HN Algolia. Merkintä
**(lähde)** tarkoittaa, että asia lukee lähteessä tai koodissa. **(päättely)**
on oma tulkintani.

En tavoittanut: yleistä verkkohakua en käyttänyt, koska aiemman ajon
DuckDuckGo-haku palautti varmennussivun. GitHub-, HN- ja dokumentaatiosivut
haettiin suoraan. Claude Coden OSC 7501 -toteutusta en lukenut, koska sen
lähdekoodi ei ole avoin. Ohjelmia en asentanut enkä ajanut.

## Tiivistelmä

herdr on Can Celikin Rust-ohjelma (Apache-2.0, noin 47 000 tähteä, YC F26).
Se aloitti "tmuxina agenteille": taustapalvelin pitää terminaalit elossa, TUI
liittyy siihen paikallisesti tai SSH:n yli, ja jokainen ruutu merkitään tilaan
*working*, *blocked* tai *idle*. Kysymykseen vastaus on, että **polku on juuri
nyt kääntymässä**. Herdr 1:n tila päätellään lukemalla ruudun alaosaa 22
agenttikohtaisella sääntötiedostolla, joita päivitetään verkosta, ja lisäksi
agenttiin asennettavilla hookeilla. 16.10. julkaistu uusi ydin `herdr-core`
(`hc`) kieltää tämän kokonaan: "Status comes only from OSC 7501. No screen
detection, no agent registry, no vendor-specific logic." OSC 7501 on Mitchell
Hashimoton 6.10. julkaisema avoin terminaaliprotokolla. **Pi tukee sitä jo**
(Pi 1.4.0, 21.10.): Pi raportoi itse tilat working, blocked, done, error ja
idle. **tmux ei vielä välitä raportteja.** tmuxin ylläpitäjä kuitenkin lupasi
30.10. toteuttaa yhden tilatietueen ruutua kohti. Open Habitatin kannalta
olennaista on kolme asiaa. Ensinnäkin herdrin kautta käynnistetyt Pi-istunnot
näkyvät Open Habitatissa jo nyt samoin kuin tmuxissa käynnistetyt, koska Open
Habitat lukee Pi:n natiivia historiaa ja `/proc`-tietoja eikä
multiplekseriä. Toiseksi kun tmux saa OSC 7501 -tuen, Open Habitat voi lukea
tmuxissa ajetun Pi:n *oman* tilan, esimerkiksi Taskfleet-workerin tai
selainterminaalin, eikä sen tarvitse arvata tilaa istuntotiedoston lopusta.
Kolmanneksi herdrin oma käännös ruudun tulkinnasta ohjelman ilmoittamaan tilaan
vahvistaa Open Habitatin periaatteen, että tila perustuu hostin tietoon.
Suositukset ovat lopussa tärkeysjärjestyksessä.

## 1. Mikä herdr on ja kenelle

README:n mukaan herdr on "the runtime your coding agents live on". Se pitää
terminaalit taustapalvelimessa, kun asiakas suljetaan tai SSH-yhteys katkeaa.
Saman ikkunan sivupalkkiin voi koota useita SSH-koneita. Jokainen ruutu
merkitään tilaan working, blocked tai idle, ja agentit voivat ohjata herdriä
CLI:n ja socket-rajapinnan kautta ([README][h-readme]) **(lähde)**. Herdr ei
kääri agentteja: "it owns their terminals." Tuettuja agentteja on noin 24, Pi
mukaan lukien ([Agents][d-agents]) **(lähde)**.

Kohderyhmä on yksittäinen kehittäjä, joka ajaa monta CLI-agenttia rinnakkain
omalla koneellaan ja VPS:illä, ja tmux-käyttäjä, joka haluaa paremmat
oletukset. HN:ssä moni kertoo vaihtaneensa tmuxista herdriin ([HN
50298436][hn-app]) **(lähde)**.

Kesäkuusta lokakuuhun 2026 tuote on jakautunut kolmeen osaan
([herdr.dev/faq][faq], [herdr-app #63][app63]) **(lähde)**:

- **Herdr TUI** (`herdrdev/herdr`): alkuperäinen terminaalisovellus ja sen oma
  palvelin.
- **herdr-core** (`hc`, 16.10.2026): "terminals for coding agents". Ydin ei
  piirrä mitään. Se pitää ohjelmat elossa, välittää terminaalien tavut
  katsojille, lukee tilan OSC 7501:stä ja antaa agenttien käynnistää ja
  odottaa toisiaan ([README][c-readme]).
- **Herdr-sovellus** (`herdr-app`, 16.10.2026): GPUI-pohjainen
  työpöytäsovellus herdr-coren päällä. Sen asettelut ja "modit" ovat
  JavaScriptiä, jota agentti voi muokata ([README][a-readme]).

TUI ja sovellus eivät jaa agentteja. Ylläpitäjän mukaan TUI:n siirtyminen
herdr-coren päälle on "still open" ([herdr-app #63][app63]) **(lähde)**.

## 2. Arkkitehtuuri kysymyksen kannalta

### Missä prosessit ajetaan ja miten ne säilyvät

- **Herdr 1:** taustapalvelin omistaa PTY:t. Asiakas irrotetaan näppäimillä
  `ctrl+b q`, ja palvelin ohittaa SIGHUP:n. Palvelimen uudelleenkäynnistyksen
  jälkeen herdr palauttaa asettelun ja jatkaa tuettujen agenttien natiiveja
  istuntoja. Pi:lle tämä tarkoittaa komentoa `pi --session <path-or-id>`.
  Alkuperäiset prosessit eivät säily. Kokeellinen `--handoff` siirtää elävät
  PTY:t uudelle palvelinversiolle ([Session state][d-state],
  [Persistence][d-persist]) **(lähde)**.
- **herdr-core:** jokainen terminaali on oman holder-prosessinsa hallussa,
  joten ytimen päivitys ei katkaise ohjelmia. Linuxissa ydin ja holderit
  ajetaan **systemd-käyttäjäpalveluina**: "They belong to the user, not to
  whatever started them: a desktop crash, a logout or an ssh login ending
  can't take them along". Palvelut käynnistetään asetuksilla
  `OOMPolicy=continue` ("a program killed for memory must not stop the whole
  service") ja `KillMode=process` ([`platform/systemd.rs`][c-systemd])
  **(lähde)**. Uudelleenkäynnistyksen jälkeen herdr-core ei jatka agentteja,
  vaan ruutuun tulee tyhjä shell ([FAQ][faq]) **(lähde)**.

### SSH-polku

- Herdr 1:ssä polkuja on kolme. Käyttäjä voi kirjautua palvelimelle SSH:lla ja
  ajaa herdriä siellä "tmux-style". Komento `herdr --remote host` piirtää
  käyttöliittymän paikallisesti ja tuo ruudut SSH:n yli. Tallennetut koneet
  kokoavat useita palvelimia samaan sivupalkkiin, ja jokaisella koneella on
  oma palvelimensa ([Connecting machines][d-machines]) **(lähde)**.
  Tunnistus on kokonaan OpenSSH:n. Herdr ei tallenna salasanoja eikä avaimia.
  Puuttuva tai yhteensopimaton herdr asennetaan etäkoneelle vasta
  vahvistuksen jälkeen **(lähde)**.
- herdr-coressa `hc machine add` ja `hc run --on box` tekevät saman
  rajapintatasolla. `hc connect` kuljettaa protokollan stdin- ja
  stdout-virroissa, myös SSH:n läpi ([README][c-readme]) **(lähde)**.
- Suunta: YC-blogin mukaan herdr haluaa yhdistää läppärin, kuuden tunnin
  työn VPS:n ja hiekkalaatikon ("those machines are disconnected. They should
  be connected"). TUI pysyy "first-class forever", koska se tulee mukana: "ssh
  in, and your UI is already there" ([YC-blogi][yc]) **(lähde)**. Herdr ei
  siis luovu SSH:sta. Se tekee SSH:sta kuljetuskerroksen, jonka päällä yksi
  asiakas näyttää monen koneen agentit. Kaupallinen tuote tulee todennäköisesti
  koneiden yhdistämisestä, ja HN:ssä arvaillaan pilvipalvelua **(päättely +
  [HN][hn-app])**.

### Eristys ja valtuudet

Kummassakin versiossa raja on yksi käyttäjätunnus. herdr-coren
turvallisuusdokumentti sanoo suoraan: "Anyone who can connect to its API can
run commands, read and change files, and control its terminals". Lisäksi:
"Other programs running as your account are part of the trust boundary", ja
istunnot "are not security boundaries" ([security.md][c-security])
**(lähde)**. Socket on käyttäjän `0700`-hakemistossa, eikä erillistä
salasanaa tai asiakaskohtaisia oikeuksia ole **(lähde)**. Ohjelma on siis
yhden ihmisen työkalu, eikä se yritä erottaa ihmisiä toisistaan. Se on
rehellinen siitä, että Unix-tunnus on ainoa raja **(päättely)**.

### Miten agentin tila päätellään

Tämä on vertailun ydin. Herdrissä on kolme kerrosta, ja niiden painotus
muuttuu.

**1. Ruudun tulkinta (herdr 1).** Herdr tunnistaa ruudun etualan prosessin
nimestä ja argumenteista, millä agentilla on kyse
([`src/detect/mod.rs`][h-detect]). Sen jälkeen se lukee ruudun "live bottom"
-alueen, ei käyttäjän vierittämää näkymää. Agenttikohtaiset TOML-säännöt
(`src/detect/manifests/*.toml`) päättävät tilan ([Agents][d-agents])
**(lähde)**. Pi:n sääntötiedosto tunnistaa vain työskentelyn (`Working...`
ja pyörivä merkki). Blocked-sääntöä siinä ei ole
([`pi.toml`][h-pitoml]) **(lähde)**. Sääntöjä päivitetään automaattisesti
herdr.dev:stä palvelinta käynnistämättä, ja ne voi ohittaa paikallisesti.
Komento `herdr agent explain` kertoo, mikä sääntö osui. Blocked on tarkoituksella
tiukka: jos mikään sääntö ei osu, tila on idle. Dokumentti varoittaa, että
"idle status is not authorization to approve an action" ([Agents][d-agents])
**(lähde)**. Siirtymää working → idle pidätetään kolmen tarkistuksen tai enintään
700 ms:n ajan, ja käynnistyksen jälkeen on kolmen sekunnin armonaika
([`pane/agent_detection.rs`][h-agentdet]) **(lähde)**. Sääntö on
evidenssipohjainen: "Do not match whole-pane incidental text" ([herdr
AGENTS.md][h-agents]) **(lähde)**.

**2. Agenttiin asennettava hook (herdr 1).** `herdr integration install pi`
asentaa Pi-laajennuksen ([`herdr-agent-state.ts`][h-piext]). Laajennus kuuntelee
Pi:n tapahtumia `session_start`, `agent_start` ja `agent_settled` ja lähettää
tilan sekä istuntotiedoston polun herdrin socketiin (`pane.report_agent`,
`pane.report_agent_session`) **(lähde)**. Se toimii vain TUI-tilassa:
"RPC/JSON/print modes are headless" **(lähde)**. Pi kuuluu agentteihin, joiden
hookilla on "full lifecycle authority", jolloin ruudun tulkinta ohitetaan
([`detect/mod.rs`][h-detect]) **(lähde)**. Blocked tulee vain tapahtumasta
`herdr:blocked`, jota Pi:n ydin ei lähetä **(lähde: GitHubin koodihaku
`earendil-works/pi`-repoon 31.10. ei löytänyt sitä)**. Pi:n kysymys tai dialogi näkyy siis herdr 1:ssä luultavasti
*working*-tilana **(päättely koodista, ei kokeiltu)**. Hookin raportoima
istuntopolku mahdollistaa Pi:n jatkamisen palvelimen uudelleenkäynnistyksen
jälkeen ([Session state][d-state]) **(lähde)**.

**3. Ohjelman oma raportti, OSC 7501 (herdr-core ja sovellus).** Ohjelma
kirjoittaa terminaaliin escape-sekvenssin, esimerkiksi
`ESC ] 7501 ; state=blocked:kind=permission:app=pi:msg=<base64> ESC \`.
Terminaali tallentaa sen tietueeksi. Tilat ovat idle, working, done, blocked
ja error. Blocked-tilalla on laji permission, question tai auth. Tukikysely
`OSC 7501 ; ?` kertoo, tukeeko terminaali protokollaa. Working ja blocked
pudotetaan, kun prosessi päättyy tai uusi shell-kehote alkaa (OSC 133 A), eikä
sykettä tarvita. Raportteja kohdellaan epäluotettavana syötteenä, ja niillä on
kovat kokorajat ([spesifikaatio][spec], [Hashimoto][mh]) **(lähde)**.
herdr-core tallentaa raportin "exactly as reported" eikä käännä mitään
([`status.rs`][c-status]), ja ohjelma, joka ei raportoi, "has no status"
([README][c-readme]) **(lähde)**. Sääntö on kirjattu ylläpitäjän ohjeeseen,
koska se on "the one most likely to be helpfully added; don't" ([herdr-core
AGENTS.md][c-agents]) **(lähde)**.

**Pi:n tuki.** Pi lisäsi OSC 7501 -tuen 7.10. (commit
[`503c6055`][pi-commit]), ja se julkaistiin Pi 1.4.0:ssa 21.10.
`ProgramStatusReporter` raportoi tilan *working* agenttiajon ja tiivistyksen
aikana, *blocked* kun laajennuksen dialogi tai kirjautuminen odottaa, ja
*done*, *error* tai *idle* kun ajo päättyy. Viestinä on istunnon nimi, dialogin
otsikko tai virheen ensimmäinen rivi: "prompts and assistant output are never
reported" ([`program-status-reporter.ts`][pi-reporter], [terminal-setup][pi-doc])
**(lähde)**. Pi lähettää raportteja vain, jos terminaali vastaa tukikyselyyn,
ja dokumentti toteaa: "tmux and screen do not forward them". Ympäristömuuttuja
`PI_PROGRAM_STATUS=1` pakottaa lähetyksen ([terminal-setup][pi-doc])
**(lähde)**.

**Ekosysteemi.** Protokollan jäsentävät Ghostty (libghostty-vt), SwiftTerm,
cmux, Rex ja herdr-core. Raportteja lähettävät Claude Code 2.1.295, Codex,
OpenCode ja Pi, ja PR:iä on avattu muun muassa Hugoon, Composeriin, Nixiin,
Docker Composeen ja Aspireen ([tmux #5713][tmux], GitHub-haku "OSC 7501"
31.10.) **(lähde)**. Orcan sisäinen OSC 9999 mainitaan spesifikaatiossa
aiempana yrityksenä ([spesifikaatio][spec]) **(lähde)**.

**tmux.** Issue [tmux #5713][tmux] pyysi tukea 9.10. Ylläpitäjä nicm piti sitä
ensin ennenaikaisena. 30.10. hän kirjoitti: "I do think this would be useful
for Claude and Codex, but I am not sold on the protocol … So, I think we
should just implement the one root record per pane for now" **(lähde)**.
Tmuxin commiteissa ei ollut 31.10. mennessä vielä mitään 7501:een liittyvää
(GitHub API) **(lähde)**. Issuessa mainitaan myös webtmux, joka arvaa tilan
ajamalla `capture-pane` -komennon kahden sekunnin välein, ja kertoo, että
tmuxin päällä toimivat valvojat "fall back to reading the screen, which breaks
between versions" **(lähde)**.

**Rajat.** herdr-sovellus ei näe Claude Codea macOS:llä, koska Clauden
taustadaemon ajaa käyttöliittymää omassa PTY:ssään eikä välitä raporttia
([herdr-app #158][app158]). Devin CLI ei näy lainkaan, koska se ei lähetä
OSC 7501:tä ([herdr #5700][h5700]) **(lähde)**. Puhdas ohjelman oma raportti
tarkoittaa siis, että tila puuttuu kokonaan aina, kun ketju katkeaa jossain
kohdassa: agentti, välissä oleva daemon tai tmux **(päättely)**.

### Yksi vai monta käyttäjää, ja selain

Yksi käyttäjä. Selainasiakasta herdr ei itse tarjoa. Kolmannen osapuolen
mobiili- ja verkkoasiakkaita on useita (Nenu, Collie, Heeler, cosyra,
herdr-mobile-relay), ja ne puhuvat herdrin socket-rajapintaa ([HN][hn-app],
[herdr-core #15][core15]) **(lähde)**. Nenu on "self-hosted phone and web
client". Sen siirto herdr-coreen odottaa sitä, että OSC 7501 osaisi kuljettaa
istuntoviitteen, jotta puhelimessa voisi näyttää keskustelun natiivin historian
([herdr-core #15][core15]) **(lähde)**. Sama tarve, eli natiivi historia
eikä ruudun kuva, on Open Habitatin lähtökohta **(päättely)**.

## 3. Kypsyys ja lisenssi

| Mittari (GitHub API 31.10.) | Arvo |
|---|---|
| `herdr` luotu | 27.3.2026 |
| Tähdet / forkit | 46 994 / 3 755 |
| Commitit | noin 1 880, joista ylläpitäjän noin 1 300 |
| Julkaisut | v0.9.5 (14.10.), esijulkaisuja usein |
| Latauksia GitHub-julkaisuista | noin 1,87 miljoonaa |
| `herdr-core` / `herdr-app` | luotu 16.10., 194 / 1 045 tähteä |
| Rust-koodia | herdr noin 329 000 riviä (sis. testit), herdr-core noin 24 000 |

Lisenssi on **Apache-2.0**. Se vaihtui AGPL:stä YC-ilmoituksen yhteydessä, ja
"The runtime … stays free" ([YC-blogi][yc]) **(lähde)**. Sovelluksessa
telemetria on oletuksena päällä ([herdr-app README][a-readme]) **(lähde)**.
Herdr 1 on vakaa ja laajasti käytetty. herdr-core ja sovellus ovat kahden
viikon ikäisiä, ja TUI:n tulevaisuus on auki ([herdr-app #63][app63])
**(lähde + päättely)**. HN:ssä VC-rahoitus herättää epäluuloa, mutta
vakautta kehutaan ([HN][hn-app]) **(lähde)**.

## 4. Rinnakkain Open Habitatin kanssa

Open Habitatin sarake perustuu tiedostoihin `docs/product.md` ja juuren
`AGENTS.md` sekä daemonin koodiin.

| | herdr | Open Habitat |
|---|---|---|
| Ensisijainen pääsy | TUI terminaalissa (paikallisesti tai SSH:lla), nyt myös työpöytäsovellus | Selain työpöydällä ja puhelimessa. SSH ja tmux rinnalla |
| Kuka omistaa prosessit | herdr-palvelin; herdr-coressa holder per terminaali systemd-käyttäjäpalveluna | Daemon omistaa selaimen Pi:t; selainterminaalit ovat tmuxissa systemd-käyttäjäpalveluna |
| Käyttäjiä | Yksi. API-yhteys vastaa shelliä | Monta ihmistä, kukin omalla Unix-tunnuksellaan |
| Usea kone | Ydinominaisuus (SSH-koneet samassa sivupalkissa) | Rajattu toistaiseksi pois |
| Agentit | ~24 CLI-agenttia terminaaleina | Pi, RPC:n kautta |
| Tila selaimen omalle Pi:lle | (ei selainta) | Pi:n RPC-tapahtumat: vuoro, kysymys, taustaprosessit, jonot |
| Tila terminaalissa ajetulle Pi:lle | Herdr 1: hook (+ ruutu muille agenteille). Core: vain OSC 7501 | Prosessilaskenta `/proc`-tiedoista (kirjoittaako jokin Pi istuntoa). Taskfleet-workerille istuntotiedoston lopun tulkinta |
| Historia | Ei omaa. Istuntoviite natiivia jatkamista varten. Valinnainen ruutuhistoria (pois oletuksena) | Pi:n natiivi historia, ei rinnakkaista varastoa |
| Jatkaminen uudelleenkäynnistyksen jälkeen | Herdr 1 käynnistää `pi --session` -komennon automaattisesti. Core ei jatka | Selainkeskustelu jatkuu natiivista historiasta seuraavalla viestillä |
| Lisenssi | Apache-2.0 | Repossa ei vielä lisenssiä |

**Näkyvätkö herdrissä ajetut Pi-istunnot Open Habitatissa?** Kyllä, samoin
kuin tmuxissa ajetut. Open Habitat löytää keskustelut Pi:n
istuntotiedostoista. `piWriter` tunnistaa kirjoittajat käyttäjän omista
prosesseista `/proc`-tiedoista, olipa Pi:n vanhempana tmux, herdr tai SSH-shell
([`pi_writer_linux.go`](../../internal/daemon/pi_writer_linux.go))
**(lähde: oma koodi)**. Herdrin vuoksi ei tarvita muutoksia **(päättely)**.

## 5. Suositukset

### Mitä Open Habitat voisi oppia tai ottaa käyttöön (tärkeysjärjestyksessä)

1. **Lue Pi:n oma OSC 7501 -tila tmuxista, kun tmux tukee sitä.** Taskfleet
   ajaa workerit tmuxissa, ja selainterminaali on tmux-sessio. Workerin tila
   päätellään nyt Pi:n istuntotiedoston lopusta. Esimerkiksi tila *blocked*
   tarkoittaa, että Pi on ollut käynnissä minuutin lähettämättä tehtäväänsä
   ([`spinoff_activity_linux.go`](../../internal/daemon/spinoff_activity_linux.go))
   **(lähde: oma koodi)**. Kun tmux tallentaa juuritietueen ruutua kohti,
   daemon voi kysyä sen tmuxilta käyttäjänä samaan tapaan kuin muutkin
   ruututiedot. Silloin tila on Pi:n oma ilmoitus eikä arvaus. *Miksi:* tämä on
   juuri sitä hostin tietoa, jota `docs/product.md` vaatii ("Esitys perustuu
   hostin tuntemiin tietoihin"). Se tulee natiivista komponentista (Pi + tmux)
   ilman uutta varastoa, ja sama tieto näkyy käyttäjän omassa terminaalissa.
   Käytännössä: seuraa [tmux #5713][tmux]-issueta. Kun tuki on julkaistu ja
   Fleetrepon tmux-versio sisältää sen, Pi:n tukikyselyn on päästävä tmuxin
   läpi, tai sen voi ohittaa asettamalla `PI_PROGRAM_STATUS=1` niiden Pi:iden
   ympäristöön, jotka Open Habitat tai Taskfleet käynnistää. Ennen sitä ei
   kannata rakentaa omaa PTY-kääriä **(päättely)**. Rajoitus: Pi raportoi
   blocked-tilan vain laajennusdialogeista ja kirjautumisesta. Kattaako tämä
   projektin luottamuskyselyn, jota Taskfleet-heuristiikka nyt arvaa, on
   tarkistamatta **(päättely)**.
2. **Lisää systemd-yksiköihin `OOMPolicy=continue`.** herdr-core asettaa sen
   jokaiselle palvelulleen, jotta muistin vuoksi tapettu ohjelma ei pysäytä
   koko palvelua ([`platform/systemd.rs`][c-systemd]) **(lähde)**. Open
   Habitatin `open-habitat-daemon@.service` ja selainterminaalien
   `open-habitat-tmux`-yksikkö eivät aseta sitä
   ([`terminal_linux.go`](../../internal/daemon/terminal_linux.go),
   [`systemd/`](../../systemd/)) **(lähde: oma koodi)**. systemd:n oletus on
   `stop`: jos ytimen OOM-tappaja tappaa yhdenkin prosessin yksikön
   cgroupissa, systemd pysäyttää koko yksikön. Yksi karannut build
   selainterminaalissa voisi siis katkaista kaikki saman ihmisen
   selainterminaalit, ja daemonin alla kaikki hänen Pi-keskustelunsa.
   `systemd.service(5)` kertoo, että oletus tulee asetuksesta
   `DefaultOOMPolicy=` ja on `stop`, paitsi yksiköissä, joissa on
   `Delegate=`. Open Habitatin yksiköissä `Delegate=` puuttuu
   **(lähde: man-sivu ja oma koodi; vaikutus on päättely, ei kokeiltu)**. *Miksi:* monen
   ihmisen palvelimella muistipaine on todennäköinen. Natiivit prosessit
   kuuluvat pitää hengissä silloinkin, kun yksi niistä kaatuu. Muutos on
   yksirivinen, ja sen oikeellisuuden voi testata.
3. **Pidä tila ja "ei tilaa" erillään.** herdr-core ei näytä mitään tilaa
   ohjelmalle, joka ei raportoi ("has no status"), ja herdr 1 merkitsee
   sääntöjen ohi pudonneen tilan erikseen nimellä
   `default_known_agent_idle_fallback` ([Agents][d-agents]) **(lähde)**. Herdr
   varoittaa myös, että virheellinen idle voi saada automaation kirjoittamaan
   hyväksyntädialogiin. *Miksi:* Open Habitatin "Sinun vuorosi" ja "Käynnissä"
   ohjaavat käyttäjän huomiota. Kun tila on päätelty, kuten workerin blocked
   minuutin hiljaisuuden perusteella, sen kuuluu näkyä erilaisena kuin Pi:n
   oma sana, tai se pitää jättää pois. Tämä on tarkennus olemassa olevaan
   periaatteeseen, ei uusi ominaisuus **(päättely)**.
4. **Usean koneen mallin pohja, jos rajaus joskus puretaan.**
   `docs/product.md` rajaa usean palvelimen navigoinnin toistaiseksi pois. Jos
   asia otetaan esiin, herdrin valinnat ovat hyvä lähtökohta. Jokaisella
   koneella on oma palvelimensa ja omat prosessinsa. Asiakas vain kokoaa ne
   näkyviin. Katkenneen koneen viimeisin tila näytetään himmennettynä ja
   välimuistitietona ilman syötettä. Luettelo ei tallenna salaisuuksia, ja
   tunnistus jää OpenSSH:lle ([Connecting machines][d-machines]) **(lähde)**.
   *Miksi:* malli säilyttää kunkin koneen natiivin totuuden eikä tarvitse
   keskusrekisteriä **(päättely)**.

### Missä Open Habitat on jo parempi

- **Monta ihmistä, Unix-tunnus rajana.** herdr-coren oma dokumentti sanoo,
  että API-yhteys vastaa shelliä ja että istunnot eivät ole turvarajoja. Open
  Habitatissa gateway, daemon ja broker ovat erillään, ja jokaisella ihmisellä
  on oma tunnus.
- **Selaimen Pi:n tila on rikkaampi kuin mikään terminaalin raportti.** RPC
  kertoo kysymyksen sisällön (siihen voi vastata selaimessa), jonot,
  taustaprosessit ja vuoron tilan. OSC 7501 kertoo vain tilan ja yhden rivin.
  Herdr 1 ei näe Pi:n kysymystä blocked-tilana lainkaan, ellei jokin laajennus
  lähetä `herdr:blocked`-tapahtumaa.
- **Natiivi historia keskustelun lähteenä.** Herdr näyttää terminaalin kuvan ja
  tallentaa halutessaan ruutuhistorian, joka voi sisältää salaisuuksia ja on
  siksi oletuksena pois päältä. Open Habitat esittää Pi:n historian
  rakenteisena. Herdrin päälle rakennettu Nenu tarvitsee juuri tätä
  ([herdr-core #15][core15]).
- **Ei automaattista toisen kirjoittajan käynnistystä.** Herdr 1 käynnistää
  palvelimen uudelleenkäynnistyksen jälkeen `pi --session <path>` -komennon
  oletuksena itse. Open Habitat tarkistaa kirjoittajat ennen jatkamista.
  Herdrin TUI-laajennus ei raportoi RPC-tilassa ajettuja Pi:itä, joten
  selaimen omat keskustelut eivät joudu sen palautuksen piiriin. Jos käyttäjä
  kuitenkin avaa saman istunnon herdrin ruudussa, se voi palata eloon
  myöhemmin toisena kirjoittajana. `docs/product.md` myöntää jo, että
  ehdotonta poissulkemista ei luvata **(päättely)**.

### Mitä ei kannata kopioida

- **Ruudun tulkinta agenttikohtaisilla säännöillä.** Herdr itse luopui siitä
  ytimessään. Säännöt rikkoutuvat agenttiversioiden mukana, ja niitä on
  pidettävä ajan tasalla verkosta ladattavilla päivityksillä. Ne olisivat
  myös toinen totuus agentin tilasta.
- **Agenttiin asennettava tilalaajennus.** Herdr 1:n Pi-laajennus on
  tarpeeton nyt, kun Pi raportoi itse standardilla protokollalla. Open
  Habitatin selainkeskusteluilla on jo RPC.
- **Herdrin tai herdr-coren käyttö Open Habitatin terminaalikerroksena.**
  herdr-core olisi luonteva "parempi tmux" (OSC 7501, holder per terminaali),
  mutta sen kaksi viikkoa vanha rajapinta, yhden käyttäjän turvamalli ja
  avoin suhde TUI:hin tekevät siitä riskin. tmux on kypsä natiivi komponentti,
  ja sen OSC 7501 -tuki on tulossa. Valinta kuuluu arkkitehtuuripäätöksiin, ja
  suositukseni on pysyä tmuxissa **(päättely)**.
- **Pane-screen-historian tallennus, agenttien keskinäinen viestintä
  (`hc send`/`wait`) ja trusted-code-modit.** Ensimmäinen on rinnakkainen
  varasto salaisuuksille. Toinen on Taskfleetin tehtävä. Kolmas on
  työpöytäsovelluksen piirre, joka ei kuulu monen ihmisen palvelimelle.

## Lähteet

- herdr, README: <https://github.com/herdrdev/herdr/blob/ee5bfb5041bb3e4a49d591c72308aae3c81ecdde/README.md>
- herdr, AGENTS.md: <https://github.com/herdrdev/herdr/blob/ee5bfb5041bb3e4a49d591c72308aae3c81ecdde/AGENTS.md>
- herdr, `src/detect/mod.rs`: <https://github.com/herdrdev/herdr/blob/ee5bfb5041bb3e4a49d591c72308aae3c81ecdde/src/detect/mod.rs>
- herdr, `src/detect/manifests/pi.toml`: <https://github.com/herdrdev/herdr/blob/ee5bfb5041bb3e4a49d591c72308aae3c81ecdde/src/detect/manifests/pi.toml>
- herdr, `src/pane/agent_detection.rs`: <https://github.com/herdrdev/herdr/blob/ee5bfb5041bb3e4a49d591c72308aae3c81ecdde/src/pane/agent_detection.rs>
- herdr, Pi-laajennus: <https://github.com/herdrdev/herdr/blob/ee5bfb5041bb3e4a49d591c72308aae3c81ecdde/src/integration/assets/pi/herdr-agent-state.ts>
- herdr docs, Agents: <https://herdr.dev/docs/agents/>
- herdr docs, Session state and restore: <https://herdr.dev/docs/session-state/>
- herdr docs, Persistence and remote access: <https://herdr.dev/docs/persistence-remote/>
- herdr docs, Connecting machines: <https://herdr.dev/docs/connecting-machines/>
- herdr.dev, FAQ (app vs TUI): <https://herdr.dev/faq/>
- YC-blogi, "Herdr is joining Y Combinator" (6.8.2026): <https://herdr.dev/blog/herdr-is-joining-y-combinator/>
- herdr-core, README: <https://github.com/herdrdev/herdr-core/blob/4a3591aa835c197f57a5d1b8e8951a75e2a79faa/README.md>
- herdr-core, AGENTS.md: <https://github.com/herdrdev/herdr-core/blob/4a3591aa835c197f57a5d1b8e8951a75e2a79faa/AGENTS.md>
- herdr-core, security.md: <https://github.com/herdrdev/herdr-core/blob/4a3591aa835c197f57a5d1b8e8951a75e2a79faa/docs/security.md>
- herdr-core, `status.rs`: <https://github.com/herdrdev/herdr-core/blob/4a3591aa835c197f57a5d1b8e8951a75e2a79faa/crates/herdr-core/src/status.rs>
- herdr-core, `platform/systemd.rs`: <https://github.com/herdrdev/herdr-core/blob/4a3591aa835c197f57a5d1b8e8951a75e2a79faa/crates/herdr-core/src/platform/systemd.rs>
- herdr-core issue 15 (resume-viite OSC 7501:ssä): <https://github.com/herdrdev/herdr-core/issues/15>
- herdr-app, README: <https://github.com/herdrdev/herdr-app/blob/3130e416ce3d1d39c83f64413728ea070a845424/README.md>
- herdr-app issue 63 (TUI ja app eivät jaa agentteja): <https://github.com/herdrdev/herdr-app/issues/63>
- herdr-app issue 158 (Claude Code ei näy): <https://github.com/herdrdev/herdr-app/issues/158>
- herdr issue 5700 (Devin CLI ei näy): <https://github.com/herdrdev/herdr/issues/5700>
- OSC 7501 -spesifikaatio (rev. 0.4, 10.10.2026): <https://www.superlogical.com/rex/docs/build/program-status>
- Mitchell Hashimoto, "A Terminal Protocol for Program Status (OSC 7501)" (6.10.2026): <https://mitchellh.com/writing/program-status-osc7501>
- Pi, OSC 7501 -commit: <https://github.com/earendil-works/pi/commit/503c605528>
- Pi, `program-status-reporter.ts`: <https://github.com/earendil-works/pi/blob/9b7a44c48d736125e63c4ba3f49a5a0377431111/packages/coding-agent/src/modes/interactive/program-status-reporter.ts>
- Pi, terminal-setup.md (Program status): <https://github.com/earendil-works/pi/blob/9b7a44c48d736125e63c4ba3f49a5a0377431111/packages/coding-agent/docs/terminal-setup.md>
- tmux issue 5713, OSC 7501: <https://github.com/tmux/tmux/issues/5713>
- HN, Herdr (2.7.2026): <https://news.ycombinator.com/item?id=48756578>
- HN, Herdr has released native app (30.10.2026): <https://news.ycombinator.com/item?id=50298436>

[h-commit]: https://github.com/herdrdev/herdr/tree/ee5bfb5041bb3e4a49d591c72308aae3c81ecdde
[c-commit]: https://github.com/herdrdev/herdr-core/tree/4a3591aa835c197f57a5d1b8e8951a75e2a79faa
[a-commit]: https://github.com/herdrdev/herdr-app/tree/3130e416ce3d1d39c83f64413728ea070a845424
[h-readme]: https://github.com/herdrdev/herdr/blob/ee5bfb5041bb3e4a49d591c72308aae3c81ecdde/README.md
[h-agents]: https://github.com/herdrdev/herdr/blob/ee5bfb5041bb3e4a49d591c72308aae3c81ecdde/AGENTS.md
[h-detect]: https://github.com/herdrdev/herdr/blob/ee5bfb5041bb3e4a49d591c72308aae3c81ecdde/src/detect/mod.rs
[h-pitoml]: https://github.com/herdrdev/herdr/blob/ee5bfb5041bb3e4a49d591c72308aae3c81ecdde/src/detect/manifests/pi.toml
[h-agentdet]: https://github.com/herdrdev/herdr/blob/ee5bfb5041bb3e4a49d591c72308aae3c81ecdde/src/pane/agent_detection.rs
[h-piext]: https://github.com/herdrdev/herdr/blob/ee5bfb5041bb3e4a49d591c72308aae3c81ecdde/src/integration/assets/pi/herdr-agent-state.ts
[d-agents]: https://herdr.dev/docs/agents/
[d-state]: https://herdr.dev/docs/session-state/
[d-persist]: https://herdr.dev/docs/persistence-remote/
[d-machines]: https://herdr.dev/docs/connecting-machines/
[faq]: https://herdr.dev/faq/
[yc]: https://herdr.dev/blog/herdr-is-joining-y-combinator/
[c-readme]: https://github.com/herdrdev/herdr-core/blob/4a3591aa835c197f57a5d1b8e8951a75e2a79faa/README.md
[c-agents]: https://github.com/herdrdev/herdr-core/blob/4a3591aa835c197f57a5d1b8e8951a75e2a79faa/AGENTS.md
[c-security]: https://github.com/herdrdev/herdr-core/blob/4a3591aa835c197f57a5d1b8e8951a75e2a79faa/docs/security.md
[c-status]: https://github.com/herdrdev/herdr-core/blob/4a3591aa835c197f57a5d1b8e8951a75e2a79faa/crates/herdr-core/src/status.rs
[c-systemd]: https://github.com/herdrdev/herdr-core/blob/4a3591aa835c197f57a5d1b8e8951a75e2a79faa/crates/herdr-core/src/platform/systemd.rs
[core15]: https://github.com/herdrdev/herdr-core/issues/15
[a-readme]: https://github.com/herdrdev/herdr-app/blob/3130e416ce3d1d39c83f64413728ea070a845424/README.md
[app63]: https://github.com/herdrdev/herdr-app/issues/63
[app158]: https://github.com/herdrdev/herdr-app/issues/158
[h5700]: https://github.com/herdrdev/herdr/issues/5700
[spec]: https://www.superlogical.com/rex/docs/build/program-status
[mh]: https://mitchellh.com/writing/program-status-osc7501
[pi-commit]: https://github.com/earendil-works/pi/commit/503c605528
[pi-reporter]: https://github.com/earendil-works/pi/blob/9b7a44c48d736125e63c4ba3f49a5a0377431111/packages/coding-agent/src/modes/interactive/program-status-reporter.ts
[pi-doc]: https://github.com/earendil-works/pi/blob/9b7a44c48d736125e63c4ba3f49a5a0377431111/packages/coding-agent/docs/terminal-setup.md
[tmux]: https://github.com/tmux/tmux/issues/5713
[hn-app]: https://news.ycombinator.com/item?id=50298436

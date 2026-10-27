# Miksi pääagentin Pi oli aamulla pysähtynyt (Birch, 26.–27.10.)

## Lyhyesti

Pi ei kaatunut eikä mikään tappanut sitä kesken odotuksen. Daemonin oma
tyhjäkäynnin pysäytys (idle reaper) pysäytti sen klo 20.20.52, kymmenen
minuuttia sen jälkeen, kun keskustelun viimeinen vuoro oli päättynyt. Silloin
käynnissä ei ollut yhtään taustaprosessia. Viimeinen `taskfleet run wait`
(proc_21aa, `--any`) oli palannut jo klo 20.10.23, kun `proto-agent-file-offer`
valmistui. Siitä herätetty vuoro päättyi klo 20.10.42 käynnistämättä uutta
odotusta. Kun viisi jäljellä ollutta workeria valmistui klo 20.12–20.41,
mikään ei odottanut niitä, joten mikään ei herättänyt agenttia. Sama olisi
tapahtunut, vaikka Pi olisi ollut koko yön käynnissä. Pysäytys ei aiheuttanut
katkosta, vaan teki sen näkyväksi aamun ilmoituksessa ”Agentti käynnistettiin
uudelleen”.

Tuotevikaa, jonka voisi korjata kapealla muutoksella, ei löytynyt. Pysäytys
toimi niin kuin se on suunniteltu (`internal/daemon/pi_activity_linux.go`):
taustaprosessi pitää Pi:n hengissä, ja vain täysin tyhjä Pi pysäytetään.
Varsinainen puute on, että pääagentin kierros jatkuu vain, jos agentti
virittää odotuksen joka herätyksen jälkeen itse uudelleen. Siihen kuuluu
jatkotyö `wake-agent-on-settled-wait`, ja suositus on alla.

## Aikajana (EET, +02:00)

Lähteet: `journalctl -u open-habitat-daemon@maintainer.service`, `systemctl
show`, Pi-istuntotiedoston rakennekentät (aikaleima, merkinnän tyyppi,
työkalun nimi, process-toiminto, prosessin tunnus ja ilmoituksen laji, ei
viestien sisältöä) sekä `taskfleet run show` -manifestien `updated_at`.

| Aika | Tapahtuma | Lähde |
|---|---|---|
| 26.10. 15.42.32–35 | Daemon pysäytetään ja käynnistetään (pilot.12-päivitys, commit 4c157a04). Tämä on yön ainoa daemonin uudelleenkäynnistys. | systemd-journal |
| 16.59.10 | `conversation_idle_stop` tälle agent_id:lle. Tämä tapahtui ennen keskustelun ensimmäistä tallennettua merkintää (19.45), joten pysäytetty Pi oli ennen ensimmäistä viestiä käynnistetty Pi, eikä mitään menetetty. | daemon-journal, istuntotiedoston otsake |
| 19.45.11 | Keskustelun ensimmäinen merkintä | istunto |
| 19.47–20.08 | Pääagentti käynnistää spinoffeja ja virittää `run wait` -odotuksen kuusi kertaa (proc_1230, bcef, d625, 6206, d723, 21aa). Jokainen odotus palaa, kun jokin worker valmistuu, ja seuraava vuoro virittää uuden. | istunto, taskfleet |
| 20.08.07 | proc_21aa käynnistyy: `taskfleet run wait … --any`, herättää vuoron | istunto |
| 20.10.22 | `proto-agent-file-offer` valmistuu | taskfleet-manifesti |
| 20.10.23 | proc_21aa päättyy onnistuneesti (`ad-process:notification success`), ja uusi vuoro alkaa | istunto |
| 20.10.33 | Vuoro kirjoittaa `oh-agent-notice`-merkinnän | istunto |
| 20.10.42 | Vuoro päättyy (`stopReason: stop`) käynnistämättä uutta odotusta | istunto |
| 20.12.28 | `agent-knows-site-origin` valmistuu | taskfleet |
| 20.13.39 | `start-page-ideation` valmistuu | taskfleet |
| 20.14.35 | `research-soniox-speech-input` valmistuu | taskfleet |
| 20.20.52 | `conversation_idle_stop`, `reason: idle_timeout`, `outcome: stopped`. Tämä on tasan 10 min (`piIdlePeriod`) ensimmäisestä tyhjäksi havaitusta minuutista. | daemon-journal |
| 20.31.20 | `live-gap-banner-returns` valmistuu | taskfleet |
| 20.41.31 | `worker-view-conversation` valmistuu | taskfleet |
| 27.10. 07.20.22 | Jarin viesti käynnistää Pi:n uudelleen. Kiinnikuromisviestin `processes` on tyhjä, eli katkenneita taustatöitä ei ollut, ja `spinoffs` luettelee nämä viisi tilassa `merged`. | ps, istunto |

## Mitä suljettiin pois

- **Koneen uudelleenkäynnistys:** uptime on 2 vrk, käynnistys 25.10. klo 06.21.
- **Daemonin kaatuminen tai uudelleenkäynnistys:** `ActiveEnterTimestamp`
  on 26.10. 15.42.35, `NRestarts=0` ja pää-PID on sama koko yön. Pi on
  daemonin cgroupissa (`KillMode=mixed`), joten daemonin uudelleenkäynnistys
  olisi pysäyttänyt sen, mutta sellaista ei ollut.
- **OOM tai muistipaine:** kernelin ja koko järjestelmän journalissa ei ole
  OOM-, killed process- tai oomd-merkintöjä. Yksikössä ei ole
  `MemoryMax`/`MemoryHigh`-rajaa, ja koneella on 32 Gt muistia, josta
  28 Gt on käytettävissä.
- **Päivitys tai apply:** Fleetrepon tunnin välein ajettava
  `fleetrepo-agent-converge` on käyttäjän oma yksikkö, eikä se koskenut
  daemoniin. Pilot.12:n jälkeen ei ole ajettu päivitystä.
- **Odotuksen tappaminen:** tyhjäkäynnin pysäytys kysyy ensin Pi:n
  prosessisillalta, onko jokin taustaprosessi käynnissä
  (`backgroundActivity`), ja jättää Pi:n rauhaan, jos on. Klo 20.10.42
  jälkeen istunnossa ei ole yhtään `process start` -merkintää, ja aamun
  kiinnikuromisviestin katkenneiden prosessien lista on tyhjä.

## Voiko sama pysäyttää muiden agentit?

Kyllä, mutta pysäytys itsessään ei vahingoita työtä. Tyhjäkäynnin pysäytys
koskee jokaisen käyttäjän daemonin kaikkia Pi-lapsia: Pi, jossa ei ole
vuoroa, kysymystä, jonoviestejä eikä käynnissä olevaa taustaprosessia,
pysäytetään 10 minuutin kuluttua. Natiivi historia säilyy, ja seuraava
viesti jatkaa keskustelua. Kaisan daemonissa ei ollut yöllä yhtään
pysäytystä. Työtä katkaisee vain daemonin uudelleenkäynnistys, eli päivitys
tai kaatuminen, koska Pi ja sen taustaprosessit ovat daemonin cgroupissa.
Sellainen ajo näkyy aamulla katkenneena taustatyönä.

## Syy

Kierroksen jatkuminen on yhden vuoron varassa. `run wait --any` palaa
ensimmäisen valmistuneen workerin kohdalla, ja jokaisen herätetyn vuoron on
viritettävä uusi odotus jäljellä oleville workereille. Klo 20.10 vuoro
päättyi virittämättä odotusta, vaikka viisi workeria oli kesken. En lukenut
vuoron sisältöä, joten en tiedä, miksi agentti päätti niin, esimerkiksi
oliko se tahallista. Tuotteessa mikään ei kuitenkaan huomaa, että
keskustelulla on omia keskeneräisiä workereita eikä yhtään odotusta.
Kiinnikuromisviesti osaa jo nyt koota keskustelun omat spinoffit sen
istuntotunnuksen perusteella (`readSpinoffs` tiedostossa
`process-extension.mjs`), mutta vasta ihmisen seuraavan viestin yhteydessä.

## Suositus jatkotyölle `wake-agent-on-settled-wait`

1. Herätteen ei pidä riippua elävästä `run wait` -prosessista. Daemon tietää
   keskustelun omat Taskfleet-ajot samalla tavalla kuin kiinnikuromisviesti
   (istuntotunnus ja työhakemisto). Kun yksi niistä valmistuu ja keskustelu
   on tyhjä tai pysäytetty eikä sillä ole odotusta, joka sen jo huomaisi,
   daemon käynnistää Pi:n tarvittaessa ja aloittaa vuoron samalla
   kiinnikuromisviestillä. Tämä kattaa sekä tämän yön tapauksen (vuoro
   päättyi ilman odotusta) että daemonin uudelleenkäynnistyksen.
2. Rajat: kukin valmistuminen herättää korkeintaan kerran (sama
   `run_id:state`-avain kuin kiinnikuromisviestin `reported`-joukossa).
   Ihmisen tekemä pysäytys tai keskeytys estää herätteet, kunnes ihminen
   kirjoittaa taas. Herätteitä on rajallinen määrä aikaikkunaa kohti.
   Herätetty Pi lasketaan neljän elävän keskustelun rajaan, eikä heräte
   pysäytä kiireistä keskustelua tilan tekemiseksi.
3. Tyhjäkäynnin pysäytystä ei tarvitse muuttaa. Pi:n pitäminen käynnissä ei
   olisi auttanut, koska elävä mutta tyhjä Pi ei myöskään herää ilman
   odotusta.
4. Pienempi erillinen huomio: aamun merkki ”Agentti käynnistettiin
   uudelleen” näyttää samalta riippumatta siitä, pysäyttikö Pi:n
   tyhjäkäynti vai kaatuminen, vaikka tyhjäkäynnin pysäytyksessä ei
   menetetty mitään. Siksi tämä näytti viasta. Jos jatkotyö herättää agentin itse, merkin voi
   samalla muotoilla kertomaan, mikä herätti.

## Päätökset myöhempää tarkistusta varten

- **Pi-istuntotiedoston rakennekenttien lukeminen.** Luin ohjeen ”vain
  metatietoa” mukaisesti merkintöjen aikaleimat, tyypit, työkalujen ja
  toimintojen nimet, prosessitunnukset, ilmoitusten lajit ja
  kiinnikuromisviestin run-tunnukset ja tilat, mutta en viestien, komentojen
  enkä ilmoitusten tekstiä. Ainoa komentoa koskeva tieto on totuusarvo
  ”vastaako komento muotoa `taskfleet run wait`”. Ilman näitä kenttiä
  kysymystä ”katkaistiinko odotus” ei olisi voinut ratkaista, koska
  daemonin journal ei kirjaa prosessien alkuja ja loppuja. Vaihtoehto olisi
  ollut jättää syy auki.
- **Ei koodimuutosta.** Tyhjäkäynnin pysäytys toimi suunnitellusti. Sen
  muuttaminen, esimerkiksi niin, että keskeneräiset omat workerit pitäisivät
  Pi:n hengissä, ei olisi korjannut puuttuvaa herätettä ja pitäisi turhaan
  muistia varattuna. Korjaus kuuluu jatkotyöhön, jossa sen suunnitellaan
  laukaisimineen ja rajoineen.
- **Klo 16.59 pysäytyksen tulkinta.** Pysäytys osui samalle agent_id:lle
  ennen istuntotiedoston syntyä. Tulkitsin sen ennen ensimmäistä viestiä
  käynnistetyksi Pi:ksi (daemon antaa tunnuksen `--session-id`-valitsimella),
  mutta en selvittänyt, mikä sen käynnisti. Yön tapahtumiin sillä ei ole
  merkitystä.

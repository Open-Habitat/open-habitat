# Tulos: käyttöjärjestelmän päivitys ei enää käynnistä daemoneja uudelleen

## Mitä tehtiin

- **Needrestart-ohitus.** Uusi tiedosto `needrestart/open-habitat.conf`
  (upotettu binääriin `policy.go`:ssa) asennetaan polkuun
  `/etc/needrestart/conf.d/open-habitat.conf`. Se asettaa
  `$nrconf{override_rc}{qr(^open-habitat-.+\.service$)} = 0`: needrestart
  listaa palvelut uudelleenkäynnistystä odottaviksi mutta ei käynnistä niitä
  itse, ei automaattitilassa eikä oletusvalintana kyselyssä.
- **Asennus ja tarkistus.** `finishGeneration` asentaa tiedoston, joten sekä
  `host apply` että `host upgrade` (valitsimien vaihdon jälkeen) kirjoittavat
  sen. `verifyStructure` vaatii sen tavu tavulta, joten olemassa olevan
  asennuksen seuraava `host apply` ei ole `no_change` vaan ajaa kierroksen,
  joka asentaa tiedoston, ja muutettu tai poistettu tiedosto palautetaan.
  Tarkistus ei ole `generationMatches`issa, jotta vanha asennus kelpaa yhä
  päivityksen lähtökohdaksi. Myöhäisestä vaiheesta jatkettu apply asentaa
  tiedoston `recoverGateway`ssa, koska jatko ohittaa staging-vaiheen.
- **Paketointi.** `scripts/package-release.sh` vie `needrestart/`-hakemiston
  käännösrepoon (upotus vaatii sen), ja `scripts/test-ui-reference.py`
  kopioi sen testirepoon.
- **Ohje.** `docs/operations.md`, Daily operation: miksi tiedosto on, miten
  päivitys silti tavoittaa agentit ja miten ylläpitäjä näkee ja tekee
  odottavat uudelleenkäynnistykset.

Yksikköjoukko ei muuttunut: Homebasen testiasennukseen ei tarvita
yksikkömuutosta. Testiasennus tarvitsee vain yhden `host apply`n (tai
seuraavan nimetyn päivityksen), jotta tiedosto asentuu.

## Decisions for later review

1. **Kaikki `open-habitat-*`-palvelut ohitetaan, ei vain daemonit.**
   - Daemonin uudelleenkäynnistys katkaisee henkilön käynnissä olevat vuorot.
   - Gateway, broker ja daemon-prosessi itse ajavat staattisesti linkattua
     binääriä (`CGO_ENABLED=0`): kirjastopäivitys ei anna niille mitään
     uusittavaa, joten ohitus ei pidätä tietoturvapäivitystä.
   - Proc-, storage- ja binding-yksiköt ovat oneshot-tarkistuksia ilman
     käynnissä olevia prosesseja.
   - Brokerin (`Restart=no`, kirjanpito) ja gatewayn uudelleenkäynnistys
     kuuluu `host upgrade`lle, joka pitää huoltolukon; apt-koukun ei pidä
     ohittaa sitä.
2. **Mekanismi, jolla libc-korjaus silti tulee voimaan: ei uutta koodia.**
   - Vuoroja ajava Pi on daemonin lapsi, ja daemon jo pysäyttää keskustelun
     Pin kymmenen minuutin joutilaisuuden jälkeen. Seuraava vuoro käynnistää
     uuden Pin päivitetyillä kirjastoilla. Käynnissä oleva vuoro ei katkea.
   - Muut daemonin pitkäikäiset lapset (integraatioiden synkronointiohjelmat,
     ei-lingeröivän henkilön selainkuori tai editori) jäävät vanhaan
     kirjastoon seuraavaan nimettyyn päivitykseen tai uudelleenkäynnistykseen
     saakka, tai kunnes ylläpitäjä käynnistää daemonin itse. `needrestart -r l`
     näyttää odottavat palvelut, ja needrestart tulostaa ne jokaisen apt-ajon
     lopuksi kohdassa "Service restarts being deferred". Tämä vastaa sitä,
     miten Ubuntu kohtelee henkilöiden omia `user@`-palveluja (SSH-istunnot).
   - Hylätyt vaihtoehdot: (a) isännän ajastin, joka käynnistää daemonin
     uudelleen kun henkilö on joutilas — se olisi uusi root-toimija, jonka
     pitäisi päätellä henkilön tila daemonin ulkopuolelta, eli
     arkkitehtuurimuutos (`host` on harkittua huoltoa, ei palvelu); (b)
     daemonin oma uudelleenkäynnistys joutilaana — tappaisi myös terminaalit
     ja editorit niiltä, joilla ei ole lingeriä, ja vaatisi joutilaisuustiedon
     keskusteluohjaimesta, jota toinen työ parhaillaan muuttaa; (c) ilmoitus
     ylläpitäjän näkymään Habitatissa — gateway ei voi ajaa needrestartia
     (root, `hidepid`), joten se vaatisi uuden root-raportointireitin.
     Jos ylläpitäjän näkymään halutaan ilmoitus, se on oma työnsä.

## Validointi

- `umask 077; scripts/test-focused.sh --area go --go-package ./internal/host`:
  ok. `go test .` (sis. uusi `TestNeedrestartOverride`, joka ajaa tiedoston
  Perlillä needrestartin tapaan ja tarkistaa osumat): ok.
- `scripts/test-host-initialization-uids.sh` (root-kontti, sis.
  `TestApplyProfilePublicationAndUpgrade`, joka nyt tarkistaa ohituksen):
  kaikki PASS.
- `python3 scripts/test-ui-reference.py`: ok.
- Ei ajettu: VM-/pilvikvalifiointi (`vm-test.sh`, cloud qualify) eikä
  todellinen unattended-upgrades-kierros libc-päivityksellä.
- Riippumaton katselmointi (GPT-6 Astra etsijänä, Claude Fable 5.2
  kohdennettuna tarkistajana) löysi kaksi vikaa: myöhäisen vaiheen apply-jatko
  olisi jäänyt aidatuksi, ja paketointitesti puuttui kansiosta. Molemmat
  korjattu.

Live check: not run on a live installation; the override's effect was
verified against the installed needrestart 3.6 source (override matching in
`/usr/sbin/needrestart` and its UI modules) and by evaluating the file the way
needrestart's conf.d loader does.

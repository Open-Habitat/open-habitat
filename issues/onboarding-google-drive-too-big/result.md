# Tulos: liian iso Google Drive käyttöönotossa

Korjattu kaikki neljä kohtaa. Tarkistettu ensin mainia vasten (db3fbe08,
tilitasot, myönnön luku ja peili mukana): kaikki neljä toistuivat yhä.

1. **Koko ennen valintaa.** Googlen kansiovalinta tarjoaa *Koko Google
   Driven* Googlen oman tilalaskennan arviolla (`rclone about`: Drivessa
   olevat tiedostot ilman roskakoria) ja Driven ylimmän tason kansiot
   (`rclone lsjson --dirs-only`, vain juuri, joten nopea). Daemon laskee
   kunkin kansion koon (`rclone size`, kolme kerrallaan) ikkunan ollessa
   auki, ja koko Drive saa tarkan summan, kun kaikki on laskettu. Rivillä
   lukee *noin 25,0 Gt*, *Lasketaan kokoa…* tai luku; *Ei vielä laskettu*
   on poissa.
2. **Virhesivu kuuluu asiaan.** Korostettu laatikko (aksenttireunus,
   tavallinen tekstikoko, lihavoitu otsikko) sekä ennen Googlen avaamista
   että liittämislomakkeessa.
3. **Liian iso Drive.** Ehdotusta, jonka tunnettu tai arvioitu koko ei mahdu
   vapaaseen tilaan, ei tehdä (yleinen relay-sääntö). Valinnan yläpuolella
   kerrotaan, ettei koko Drive mahdu, ja ohjataan valitsemaan kansiot tai
   jatkamaan ilman tiedostoja. Osajoukko synkronoidaan rclonen omalla
   suodatintiedostolla (`~/.config/rclone/open-habitat-google/<tili>.filter`,
   bisync `--filters-file`, peili `--filter-from`). Uusi `skip_folders`
   viimeistelee kirjautumisen ilman tiedostoja; Drive-rivi kertoo silloin
   *Ei synkronoida* (`not_chosen`), ja *Jatka* toimii. Kiintiöhylkäyksen
   ikkuna kertoo, että muut palvelut toimivat jo.
4. **"Tilaa ei saatu selville".** Syy: `catalog.check` piti epäonnistunutta
   ensimmäistä synkronointia yhä käynnissä olevana (`a.syncing` jäi päälle
   `failed`-tilassa), joten se ei kysynyt työkalulta mitään ja merkitsi
   *kaikki* palvelut tuntemattomiksi niin kauan kuin epäonnistunut yritys
   oli relayssä. Nyt epäonnistunut yritys ei estä tarkistusta, ja vain
   tiedostopalvelu kantaa virheen. Lisäksi asetusnäkymä ei ladannut listaa
   uudelleen, kun epäonnistunut ikkuna suljettiin; nyt lataa, joten tili
   ja *Jatka* näkyvät heti.

Uutta varastoa ei tullut: koot ovat yrityksen muistissa, valinta on
rclonen oma suodatin, ja *ei valittu* päätellään tyhjästä bisync-työhakemistosta.
Kiintiötarkistus säilyy: valinnan jälkeen kansiot lasketaan aina uudelleen ja
vapaa tila luetaan uudelleen ennen kopiointia.

## Katselmointi

Riippumaton `/llm-review` (etsijä gpt-6-astra, varmistaja claude-fable-5-1,
kaksi kutsua) ja `/assess-findings`. Kaksi vahvistettua löydöstä, molemmat
korjattu testeineen: (1) taustalla laskettu koko ohitti hyväksynnän
uudelleenlaskennan, joten minuutteja vanha luku olisi kelvannut; nyt lasketaan
aina uudelleen. (2) `skip_folders` Microsoftin uusinnassa olisi jättänyt
olemassa olevan synkronoinnin käyntiin; nyt se hylätään, kun tiedostot jo
synkronoituvat, eikä painiketta näytetä uusinnassa. Mallien suorituskykyä ei
kirjattu aldern korpukseen (työntekijä ei kirjoita ulos).

## Testit

- Go: `go test -race ./internal/daemon/integrations ./test/browser-host`
  (umask 077). Uudet: iso Drive (arvio, laskenta, kokonaisuus+kansio
  hylätään, liian iso kansio 422, suodatin ja sen escape, poisto vie
  suodattimen), ohitus (muut palvelut ok, Drive `not_chosen`, aloitettu
  pass on yhä `initial_sync_incomplete`), hylätty ensimmäinen synkronointi
  (muut palvelut ok; kaatuu ilman korjausta: `mail state:unknown`) ja
  ohituksen hylkäys, kun tiedostot jo synkronoituvat.
- `go test ./internal/daemon`: yksi kaatuminen, `TestProcessCatchUpLogic`,
  kaatuu myös pohjacommitilla db3fbe08 (irrallinen worktree). Kirjattu
  intakeen, mutta main oli jo kirjannut ja korjannut saman (434e0c88), joten oma kirjaus jätettiin pois. Ei liity tähän muutokseen.
- Sopimukset: `test-focused.sh --area contracts` ok (81 skeemaa).
- Web: `test-focused.sh --area web` ok; uudet komponenttitestit.
- Selain (OH_BROWSER_WORKERS=2, oma porttipohja): uusi
  `onboarding-google-drive.spec.ts` (2), `integrations.spec.ts` (11),
  `onboarding-route-map.spec.ts` (5) ok. Uusi spec kaatuu ilman kohdan 4
  korjausta (`Received: "unknown"`). Koko selainsarjaa ei ajettu.
- rclonen suodatinsyntaksi (escape `\[ \] \*`, välilyönti nimen lopussa,
  `.filter.md5` suodattimen viereen) kokeiltu oikealla rclone 1.71.2:lla
  paikallisella taustalla.

Ei todennettu: oikea Google Drive (about-, lsjson- ja size-tulosteet ja
suodatin drive-taustalla), vain synteettiset testit.

## Päätöksiä myöhempää tarkistusta varten

- **Kansiot ovat Driven ylimmän tason kansioita, valittuina nimellä.**
  Vaihtoehdot: syvempi puu tai yksi rclone-remote kansiota kohden
  (`--drive-root-folder-id`). Ylin taso riittää rajaamaan ison Driven, ja
  yksi bisync-pari suodattimella pitää nykyisen yhden työhakemiston
  rakenteen. Seuraus: jos valittu kansio nimetään Drivessa uudelleen, se
  putoaa suodattimen ulkopuolelle ja paikallinen kopio poistuu seuraavalla
  kierroksella (bisyncin `--max-delete 50` -suoja koskee yhä); Driveen ei
  koske.
- **Kansioita tarjotaan enintään 63** (sopimuksen 64:stä yksi on koko
  Drive), nimijärjestyksessä; kansio, jonka ID tai nimi ei kelpaa
  sopimukseen, on mukana vain koko Driven kautta. Juuren irtotiedostot
  synkronoituvat vain koko Driven mukana.
- **Kokojen laskenta alkaa ennen hyväksyntää.** Aiempi periaate oli, että
  rekursiivinen inventaario kuuluu hyväksyttyyn taustatyöhön; Villen
  palaute ja issue pyysivät kokoa ennen valintaa. Laskenta lukee vain
  henkilön omaa Driveä hänen omalla tokenillaan, ei estä valintaa ja
  perutaan valinnan tai ikkunan sulkemisen myötä. Dropbox ja Microsoft eivät
  laske ennen hyväksyntää (ennallaan).
- **Arvio ei estä aloittamista.** Arvio (Googlen tilalaskenta) voi olla
  liian suuri (Google-dokumentit, muualla olevat omat tiedostot) tai pieni
  (muiden omistamat tiedostot omissa kansioissa). Ylittävä arvio varoittaa
  mutta ei lukitse nappia; tarkka laskenta korvaa arvion ja lukitsee, jos
  ylittää. Hyväksynnän jälkeen lasketaan aina tarkasti.
- **Ohitus säilyttää rclonen kirjautumisen.** Vaihtoehto oli poistaa Driven
  rclone-asetus, mutta silloin Drive-rivi olisi taas tuntematon eikä
  uudelleenkirjautuminen tarjoaisi valintaa yhtä suoraan. Kansiot valitaan
  myöhemmin *Kirjaudu uudelleen* -toiminnolla (uusi Google-suostumus);
  erillistä *Valitse kansiot* -toimintoa ilman kirjautumista ei tehty.
- **`not_chosen` päätellään tyhjästä työhakemistosta.** Kattaa myös
  tapauksen, jossa ensimmäinen pass hylättiin ennen kopiointia tai daemon
  pysähtyi ennen passia (ennen `initial_sync_incomplete`); korjaus on sama.
  Vain Googlelle; Dropbox ja Microsoft näyttävät yhä
  `initial_sync_incomplete`.
- **Ohitusta ei tarjota uusinnassa** (eikä daemon salli sitä, kun tiedostot
  jo synkronoituvat), koska se ei pysäytä olemassa olevaa synkronointia.

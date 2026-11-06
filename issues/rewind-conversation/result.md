# Tulos: Palaa tähän (kokeellinen)

Toteutettu prototyyppikierroksen 3 **C Pieni arkki** ja kierroksen 2 **C
Valitse mitä** mukaan. Kokeellinen valinta *Palaa tähän*
(`rewind-conversation`).

## Miten se toimii

- **Daemonin oma Pi-laajennus** `internal/daemon/rewind-extension.mjs`
  (upotettu binääriin, ladataan daemonin Pi-lapseen recapin ja
  prosessikumppanin rinnalle). Talteenotto ja palautus on mukautettu
  better-pi-rewindistä (raine, MIT, commit e42fa9c, lisenssi tiedoston
  alussa ja `licenses/DEPENDENCIES.md`:ssä). Kun agentti alkaa vastata
  henkilön viestiin, seuratut tiedostot kopioidaan; ennen kuin `edit` tai
  `write` koskee uuteen tiedostoon ensi kertaa, se kopioidaan. Kopiot
  `~/.pi/agent/file-history/<istunto>/`, nimettynä sisällön mukaan;
  metatieto Pi:n istuntoon `custom`-merkintöinä (`oh-rewind-checkpoint`).
- **Palaaminen** on Pi:n oma `navigateTree` samassa istuntotiedostossa
  (kuten `/tree`), ja laajennus kirjoittaa kohtaan merkinnän `oh-rewind`,
  joka tekee kohdasta pysyvän ja on historian rivi *Aiempi jatko*. Ennen
  tiedostojen palautusta laajennus kopioi tiedostot nykytilassaan, joten
  korvattuun jatkoon voi palata tiedostoineen (*Jatka tästä jatkosta* ›
  *Palauta myös sen tiedostot*) ja pelkkien tiedostojen palautuksen voi
  perua (*Peru palautus*). Pelkistä tiedostoista ja perumisesta agentille
  kerrotaan mallille näkyvällä, selaimessa piilotetulla viestillä.
- **Daemon** vain lukee: `GET …/rewind?entry=` (esikatselu: viestit ja
  vastaukset, palautuvat tiedostot +/−, komennot), `GET …/rewind?branch=`
  (korvattu jatko historian projektiona) ja kirjoittaa vain pyytämällä
  laajennusta (`POST …/rewind`, sama tapa kuin recapissa:
  `/oh-rewind`-komento ja tulos `notify`-kanavalla). Daemon ei kirjoita
  istuntoa eikä tiedostoja. Sopimus `contracts/v1/rewind.schema.json`,
  historian merkintälaji `rewind`.
- **Selain**: oman viestin ⋯ › *Palaa tähän…*, arkki kentän yllä,
  valittu viesti ja sen jälkeinen osa himmenevät. Levossa oleva
  keskustelu herätetään ensin kuten lähetys; työssä oleva agentti
  pysäytetään (*Pysäytä ja palaa*). Viesti palaa kenttään.

## Todisteet

- `internal/daemon/rewind_native_linux_test.go`: kiinnitetty Pi 1.3.0 ja
  synteettinen malli, jonka `write`-kutsut muuttavat oikeita tiedostoja:
  talteenotto (vain valinnan ollessa päällä), esikatselu, palaaminen
  tiedostoineen, korvatun jatkon luku, paluu siihen tiedostoineen, pelkät
  tiedostot, peruminen ja toinen peruminen kielletty, paluu ensimmäistä
  viestiä edeltävään kohtaan, ei-aktiivisen merkinnän kielto; vastaukset
  validoidaan sopimusta vasten.
- `internal/daemon/pi-device-test/rewind.test.mjs`: polut, kopioiden
  nimeäminen, palautus (muutettu, luotu, poistettu), symlinkin kautta ei
  kirjoiteta, epäturvallinen säilön nimi hylätään, valinnan luku.
- `web/tests/rewind-conversation.spec.ts` (1440 ja 390, axe): koko
  selainpolku oikealla gatewaylla ja daemonilla, synteettinen Pi
  laajennuksen sijaisena (`test/browser-host/rewind.go`).
- Komponentti- ja tilatestit: `Rewind.test.tsx`,
  `conversationStore.test.tsx` (haaran vaihto korvaa vanhan jatkon),
  `sentMessages.test.ts`; gatewayn reittitesti.

## Decisions for later review

1. **Valinta ohjaa myös talteenottoa.** Kopioita ei tehdä, ellei
   *Palaa tähän* ole päällä (laajennus lukee valinnan joka vuorolla).
   Vaihtoehto: kopioida aina. Valittu, koska kokeellinen ominaisuus ei
   saa kuluttaa levyä niiltä, jotka eivät sitä käytä; seuraus on, että
   ennen valintaa lähetetyistä viesteistä voi palauttaa vain keskustelun
   (arkki sanoo *Tästä viestistä ei ole kopioita*).
2. **Kopiot nimetään sisällön mukaan** (better-pi-rewind: polku + UUID).
   Muuttumaton tiedosto on yksi kopio, vaikka sitä seurataan monta
   vuoroa. Kopioita ei siivota automaattisesti (ei automaattista
   poistoa); keskustelun poisto ei vielä poista niitä.
3. **Oma merkintätyyppi** `oh-rewind-checkpoint`, ei better-pi-rewindin
   `better-pi-rewind.file-history`: jos henkilöllä on myös
   better-pi-rewind, tallenteet eivät tuplaannu toistensa sisään.
4. **Vastauksia lasketaan yksi vuoroa kohden** (teksti työkalujen välissä
   kuuluu samaan vastaukseen), kuten aikajana näyttää vuoron.
5. **Korvattu jatko näytetään luettavana** (uusin 200 merkintää), ilman
   pitkien lohkojen lisälukua ja ilman omaa ⋯-valikkoa; siihen palataan
   rivin painikkeesta.
6. **Jarin omat muutokset** samoihin tiedostoihin agentin jälkeen
   korvautuvat palautuksessa (kuten better-pi-rewindissä); ne kuitenkin
   kopioidaan ennen palautusta, joten *Jatka tästä jatkosta* tiedostoineen
   tai *Peru palautus* tuo ne takaisin. Erillistä varoitusta ei tehty.
7. **Pelkkä keskustelu** ei kerro agentille, että tiedostot jäivät
   (Pi:n `/tree` ei kerro); pelkät tiedostot ja peruminen kertovat.
8. **Polut esikatselussa**: työtilan sisällä suhteellisina, muualla
   kotihakemistossa `~/…`, muuten sellaisenaan; kotipolkua ei lähetetä.
9. Sivuhuomio: välilehden lähettämä viestikupla poistuu nyt, kun Pi:n
   viesti on korvannut sen; muuten palaaminen toi kuplan takaisin.

## Katselmointi

Riippumaton `/llm-review` (etsijä gpt-6-astra, tarkistaja claude-fable-5-1)
ja `/assess-findings`: 9 vahvistettua löydöstä, kaikki korjattu tässä
haarassa testeineen (mm. peruminen ei enää poista palautuksen jälkeen
syntyneitä tiedostoja eikä ylikirjoita kopioimattomia muokkauksia,
kopioimaton polku ei palaa vanhempaan kopioon, Pi:n työkalupolut
ratkaistaan kuten Pi ne ratkaisee, palaaminen pitää Pi:n varattuna
kapasiteettipysäytykseltä). Kolme harvinaista pudotettiin: vanhemman
hakemiston vaihto symlinkiksi saman käyttäjän sisällä, ei-yhtenäinen
uudelleenyhdistyssivu selaimen tilassa ja kopioimattoman polun
vuoronylittävä muunnelma.

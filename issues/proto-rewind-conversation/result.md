# Kierros 1: keskustelun palauttaminen aiempaan viestiin

## Faktat: mitä Pi tekee

Lähde: Pi 1.3.0, jonka daemon ajaa (`pi-device-test/package-lock.json`,
`/opt/open-habitat/core`); luettu `dist/modes/rpc/rpc-mode.js`,
`dist/core/agent-session-runtime.js` (`fork`), `dist/core/agent-session.js`
(`navigateTree`, `getUserMessagesForForking`) ja
`dist/core/session-manager.js` (`branch`, `createBranchedSession`,
`_buildIndex`). `fork`, `clone` ja `get_fork_messages` ajettiin myös RPC:llä
käsin kirjoitettua istuntoa vasten kertakäyttöisessä HOMEssa
(`/var/tmp/rewind-rpc.*`, `--no-extensions`, ei mallia).

Pi:n istunto on JSONL-tiedosto, jonka rivit muodostavat puun (`id`,
`parentId`). Malli näkee vain aktiivisen haaran: polun nykyisestä lehdestä
juureen. Kolme tapaa palata:

| | Mitä natiivi istunto tekee | Myöhemmät viestit | RPC |
|---|---|---|---|
| `/tree` (`navigateTree`) | Samassa tiedostossa siirretään lehti aiempaan kohtaan. Käyttäjän viestiin palatessa lehti on sen *edellinen* merkintä ja viestin teksti palaa kenttään; muuhun merkintään palatessa jatketaan sen perästä tyhjällä kentällä. | Jäävät samaan tiedostoon toiseksi haaraksi. Mallille ne eivät näy, ellei haarasta pyydetä yhteenvetoa (`branch_summary`, joka maksaa mallikutsun). | **Ei RPC-verbiä.** Vain laajennuksen komento (`ExtensionCommandContext.navigateTree`) tai TUI. |
| `/fork` (`fork entryId`) | Uusi istuntotiedosto, johon kopioidaan polku valitun käyttäjän viestin *edelliseen* merkintään asti, otsakkeessa `parentSession` = alkuperäinen. RPC-prosessi siirtyy uuteen istuntoon. Vastaus palauttaa valitun viestin tekstin. | Alkuperäinen tiedosto pysyy ennallaan kaikkine viesteineen (todettu: vain Pi:n oma käynnistysmerkintä lisättiin). Uudessa niitä ei ole. | `fork` |
| `/clone` | Kuten fork, mutta nykyiseen kohtaan asti: kopio koko aktiivisesta haarasta. | Kopioituvat. | `clone` |

`get_fork_messages` palauttaa käyttäjän viestit (`entryId`, teksti)
**kaikista haaroista**, ei vain aktiivisesta, tiedostojärjestyksessä.
`get_tree` ja `get_entries` antavat koko puun ja `leafId`:n.
Merkintöjen tunnisteet säilyvät forkissa samoina.

**Agentin tekemät tiedostomuutokset jäävät.** Pi ei kirjaa eikä palauta
tiedostoja missään näistä; se siirtää vain keskustelun kohtaa. Haaran
yhteenveto luettelee luetut ja muutetut tiedostot (`details.modifiedFiles`),
mutta ei koske niihin.

**Käynnissä oleva vuoro.** `fork` ja `clone` keskeyttävät käynnissä olevan
vuoron ensin (`teardownCurrent` → `abort`), ja keskeytetty vuoro tallentuu
vanhaan istuntoon. `navigateTree` kieltäytyy, kun vuoro on käynnissä
("Wait for the current response to finish…") tai tiivistys on kesken.

**Kohta ilman uutta viestiä ei ole pysyvä.** Lehti on Pi:n muistissa;
tiedostoa avattaessa lehti on viimeinen rivi (`_buildIndex`). Pelkkä
`navigateTree` ilman yhteenvetoa tai nimilappua ei kirjoita mitään, joten jos
Pi käynnistyy uudelleen ennen seuraavaa viestiä, keskustelu on taas vanhassa
kohdassa. Haaran yhteenveto tai `label`-merkintä kirjoittaa rivin uuteen
kohtaan ja tekee siitä pysyvän.

**RPC ei sarjoita komentoja.** Peräkkäin lähetetyt `fork` ja `clone`
vastasivat epäjärjestyksessä, ja `clone` kopioi vanhan istunnon, koska se
luki tilan ennen kuin `fork` oli vaihtanut istunnon. Kutsuja odottaa
`fork`-vastauksen ennen seuraavaa komentoa.

## Mitä host tarvitsisi

- **Historian projektio kulkee jo aktiivista haaraa** (`history_linux.go`,
  `history_window_linux.go`): viimeisen rivin esivanhemmat. Toisen haaran
  viestit eivät näy. Paikallaan palaamisen jälkeen (ilman pysyvää riviä)
  daemon näyttäisi vielä vanhan haaran, kunnes uusi viesti on lähetetty.
- **Paikallaan palaaminen (Pi:n `/tree`)** tarvitsee daemonin laajennukseen
  komennon, joka kutsuu `ctx.navigateTree` ja kirjoittaa kohdan pysyväksi
  (nimilappu tai yhteenveto). Daemon lataa jo omia laajennuksiaan samalla
  tavalla (`recap-extension.mjs`, `oh-conversation-recap`). Lisäksi
  sopimukseen tarvitaan haaran merkki historiaan ("tästä haarautuu toinen
  jatko") ja luku, joka antaa toisen haaran viestit (lehden tunnisteella), jotta
  jätetty osa voidaan näyttää.
- **Uusi keskustelu (Pi:n `/fork`)** on valmis RPC-verbi. Daemon tarvitsee
  kirjoituskomennon, joka ajaa `fork`in keskustelun prosessissa ja siirtää
  prosessin omistuksen uudelle istunnolle (se kirjoittaa nyt eri tiedostoon).
  Uusi istunto ilmestyy sivupalkkiin omana keskustelunaan; `parentSession`
  kertoo, mistä se haarautui, mutta daemon ei lue sitä vielä
  (vain spinoffit käyttävät omaa vanhempi-tietoaan). Alkuperäinen keskustelu
  jää ennalleen ilman prosessia.
- **Muokattu viesti** on molemmissa sama kuin palaaminen ennen viestiä ja
  uusi lähetys: Pi palauttaa viestin tekstin (`fork` → `text`,
  `navigateTree` → `editorText`), selain laittaa sen kenttään ja tavallinen
  lähetys jatkaa uudesta kohdasta.
- **Käynnissä oleva vuoro** on pysäytettävä ensin; selain tarjoaa
  *Pysäytä ja palaa* tai odottaa vuoron loppumista.
- **Tiedostoja ei palauteta.** Selain voi kertoa, mitä tiedostoja jätetty osa
  muutti (tool-kutsut tai haaran yhteenvedon `modifiedFiles`), mutta
  palauttaminen olisi uusi oma toimintonsa (esim. Git), ei Pi:n.

## Prototyyppi

Kierros: `design-system/prototypes/rounds/2026-11-03-palaa-aiempaan/`
(muistiinpanot ja rakennuskomento `NOTES.md`:ssä). Tuotannon komponentit
synteettisellä keskustelulla: toinen pyyntö (*lisää tunti käsin*) oli väärä
suunta, ja sen jälkeen agentti muutti kolmea tiedostoa.

Akseli: mistä palaaminen aloitetaan ja mitä siitä seuraa.

- **A Palaa tähän**: oman viestin ⋯-valikosta palataan ennen viestiä; sama keskustelu jatkuu, ja jätetty osa jää taitetuksi riviksi, jonka voi avata.
- **B Uusi alku**: otsakkeen ⋯ › Palaa aiempaan avaa listan omista viesteistä; valinnasta alkaa uusi keskustelu sivupalkkiin, ja alkuperäinen jää ennalleen.
- **C Muokkaa**: oman viestin kynästä viesti muuttuu kentäksi paikallaan; muutettu lähetys jatkaa siitä, ja viestissä on versiot ‹ 1/2 ›.

Kaikissa vahvistus kertoo ennen valintaa, montako viestiä ja vastausta jää
taakse ja että agentin muuttamat tiedostot (nimettyinä) jäävät ennalleen.
Käynnissä oleva vuoro pysäytetään ensin, ja painike sanoo sen
(*Pysäytä ja palaa*). Muokattu viesti on kaikissa sama polku: viesti palaa
kenttään (A, B) tai on kenttä paikallaan (C).

Mitä kukin päättää:

- *A* pitää yhden keskustelun ja näyttää Pi:n puun sellaisenaan: jätetty
  jatko on rivi haarautumiskohdassa, ja jatkot voi vaihtaa keskenään. Host
  tarvitsee eniten: laajennuksen komennon, pysyvän kohdan ja haarojen luvun.
- *B* tekee Pi:n forkin: uusi keskustelu sivupalkkiin, vanha koskematon.
  Pi:ssä valmis RPC-verbi; host siirtää prosessin uudelle istunnolle ja lukee
  `parentSession`in, jotta keskustelut viittaavat toisiinsa. Sivupalkki kasvaa
  jokaisesta palaamisesta.
- *C* on tuttu chat-sovelluksista: versiot viestin kohdalla. Sama Pi-mekaniikka
  kuin A:ssa, mutta useampi palaaminen samaan viestiin tai eri viesteihin
  tekee versioista sisäkkäisiä, ja jätetty jatko näkyy vain viestin kautta.

## Suositus

**A Palaa tähän.** Se vastaa sitä, mitä Pi itse tekee `/tree`llä: sama
keskustelu jatkuu, eikä mitään katoa. Jätetty osa näkyy yhtenä rivinä juuri
siinä kohdassa, josta palattiin, joten sen löytää ilman versioiden
selaamista, ja sivupalkki ei kasva. Viestin oma ⋯ on se paikka, josta
"palaa tähän viestiin" etsitään, ja muokkaus syntyy luontevasti, koska viesti
tulee kenttään. B:n *Jatka uutena keskusteluna* sopii myöhemmin samaan
valikkoon toiseksi kohdaksi, kun halutaan erillinen työ (Pi:n `/fork`).

Host-työ A:lle: daemonin laajennukseen komento, joka kutsuu
`ctx.navigateTree` ja kirjoittaa kohdan pysyväksi; kirjoituskomento
sopimukseen; historian projektioon haarautumiskohdan merkki ja toisen haaran
luku lehden tunnisteella; käynnissä olevan vuoron pysäytys ennen palaamista.

## Kysymykset Jarille

1. Kelpaako A, jossa sama keskustelu jatkuu ja jätetty osa jää riviksi, vai
   haluatko palaamisen tekevän aina uuden keskustelun sivupalkkiin (B)?
2. Pitäisikö jätetyn jatkon rivillä tarjota pelkkä katselu vai myös
   *Jatka tästä jatkosta* (vaihto takaisin)? Prototyypissä vaihto on mukana.
3. Riittääkö tiedostoista toteamus *jäävät ennalleen*, vai haluatko
   vahvistukseen myös tavan palauttaa ne (Git-muutosten peruminen olisi oma
   toimintonsa, ei Pi:n)?

## Todisteet

`evidence/`: jokaisesta suunnasta sisäänkäynti (0), valinta (1), tulos (2),
jätetty osa tai alkuperäinen (3), muutettu viesti lähetetty (4) ja agentti
työssä (5); 1440 vaalea ja tumma sekä 390 vaalea, kertoimella 2.
`check.mjs`: 162 tarkistuspistettä, konsoli puhdas. Synteettinen
komponenttilabra, ei hostia vasten ajettu.

## Näyttäminen

```
node design-system/prototypes/rounds/2026-11-03-palaa-aiempaan/build.mjs
open-habitat agent view offer --current \
  --source design-system/prototypes/dist/palaa-aiempaan/offline.html \
  --title "Palaa aiempaan – kierros 1" \
  --idempotency-key "$(uuidgen)" --json
```

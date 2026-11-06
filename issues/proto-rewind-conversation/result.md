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

# Kierros 2: Palaa tähän ja tiedostojen palautus

Jari 6.11.: suunta Palaa tähän; korvattu jatko jää saman keskustelun sisään
kuten Pi:n omassa historiassa. Tiedostojen palautus selvitetään ja riffataan.

## Pi:n historia, jota peilataan

Lähde: Pi 1.3.0 (`docs/sessions.md`, `docs/session-format.md`,
`dist/modes/interactive/components/tree-selector.js`,
`dist/modes/interactive/interactive-mode.js`). `/tree` liikkuu samassa
istuntotiedostossa: käyttäjän viestiin palatessa viestin teksti palaa
kenttään, ja muutettu lähetys tekee uuden haaran samaan puuhun. Puunäkymä
näyttää aktiivisen haaran ensin ja muut sisarhaaroina (`├─`, `└─`), aktiivinen
polku merkitään `•`:llä, ja merkintöihin voi antaa nimilapun. Haarasta
poistuttaessa Pi kysyy *Summarize branch?* (*No summary* / *Summarize* /
*Summarize with custom prompt*); yhteenveto liitetään uuteen haaraan
`branch_summary`-merkintänä. Pi ei koske tiedostoihin missään näistä.

Prototyyppi peilaa tätä: sama keskustelu, korvattu jatko yhtenä rivinä
haarautumiskohdassa, viesti kenttään, jatkojen vaihto. Yhteenvetoa ei
tarjota (se maksaa mallikutsun; Pi:ssäkin oletus voi olla *No summary*).

## Tiedostojen palautus: mitä on olemassa

| Työkalu | Mitä talteen ja milloin | Mitä palauttaa | Kattavuus ja rajat | Lisenssi |
|---|---|---|---|---|
| **better-pi-rewind** (GitHub `raine`, workmuxin tekijä; npm 0.4.0, 12.9.2026) | Kun vastaus alkaa käyttäjän viestiin, kopio jo seuratuista tiedostoista; ennen kuin `edit`/`write` koskee uuteen tiedostoon ensi kertaa, sen sisältö kopioidaan saman viestin checkpointiin. Puuttuva tiedosto kirjataan, jotta luodun voi poistaa. Lisäksi Git-juuri, haara ja `HEAD`. Metatieto Pi:n istunnon JSONL:ään omina `custom`-merkintöinä (kulkee puun mukana), kopiot `~/.pi/agent/file-history/<session-id>/`. | `/rewind` (tai Esc Esc): *Restore code and conversation*, *conversation only*, *code only*, sekä Git-vaihtoehdot `git reset --hard` checkpointin `HEAD`iin, kun haara ja repo täsmäävät. Keskustelu palautetaan samassa istunnossa `ctx.navigateTree`llä (0.1.1: "instead of creating a new branch"). Koukuttaa myös Pi:n omat `/tree` ja `/fork`: *Restore code with conversation?* | Vain `edit`/`write`-työkalujen muuttamat tiedostot; komennot, muut työkalut ja ulkoiset muokkaukset eivät tuo uusia tiedostoja seurantaan (jo seuratun tiedoston tila otetaan joka viestissä). Palautus tiedosto kerrallaan, paras yritys, ei transaktio. Ei tilannekuvaa nykytilasta palautushetkellä, joten palautusta ei voi perua eikä korvattuun jatkoon palata tiedostoineen. `/rewind` vaatii TUI:n (`ctx.mode !== "tui"` → ilmoitus); talteenoton koukut (`message_start`, `tool_call`) toimivat myös RPC:ssä. | MIT |
| **pi-rewind** (`arpagon`, npm 0.5.0) | Git-pohjainen tilannekuva koko työpuusta vuoron jälkeen (`write-tree` väliaikaisella `GIT_INDEX_FILE`:llä, `commit-tree`), refit `refs/pi-checkpoints/…` repoon. | Tiedostot ja keskustelu, vain tiedostot tai vain keskustelu; diff-esikatselu; *Undo last rewind* -pino; koukut `/fork`iin ja `/tree`hen. | Kattaa myös komentojen muutokset, mutta vain Git-repossa; kirjoittaa refit käyttäjän repoon; suodattaa isot hakemistot (`node_modules`, yli 10 MiB). | MIT |
| **Pi:n esimerkki `git-checkpoint.ts`** (`examples/extensions/`) | `git stash create` jokaisen vuoron alussa, muistissa. | `/fork`issa kysyy *Restore code state?* ja ajaa `git stash apply`. | Häviää uudelleenkäynnistyksessä ja nollautuu jokaisen ajon jälkeen; vain Git. | MIT (Pi) |
| Muut Pi-laajennukset: `prateekmedia/pi-hooks` (checkpoint), `nicobailon/pi-rewind-hook` | Edeltäjiä, joihin pi-rewind viittaa. | | pi-rewind-hookilla ei ole lisenssiä. | MIT / ei lisenssiä |
| **Claude Code checkpointit** (vertailu; `code.claude.com/docs/en/checkpointing`) | Tila ennen jokaista vuoron aloittavaa viestiä; 100 viimeisintä; tallessa keskustelun mukana; poistuu n. 30 päivän siivouksessa. | `/rewind` tai Esc Esc: *Restore code and conversation*, *Restore conversation*, *Restore code*, *Summarize from here/up to here*. Viestin teksti palaa kenttään. | Vain omien muokkaustyökalujen muutokset; komennon muuttama tiedosto, jota ei ole muokattu työkalulla, jää. Ei korvaa versionhallintaa. | Suljettu (Anthropicin ehdot) |

Lähteet: `gh api repos/raine/better-pi-rewind` (README, CHANGELOG,
`extensions/rewind.ts`, `src/restore-actions.ts`, `src/host-adapter.ts`),
`npm view better-pi-rewind`, `gh api repos/arpagon/pi-rewind` (README,
`src/core.ts`), Pi 1.3.0:n `examples/extensions/git-checkpoint.ts`,
Claude Coden dokumentaatio 6.11.2026.

## Mitä host tarvitsisi tiedostojen palautukseen

- **Paras pohja on better-pi-rewindin malli**: tiedostokohtaiset kopiot
  käyttäjän omassa kotihakemistossa hänen omana käyttäjänään (Unix-raja
  pysyy), metatieto natiivissa istunnossa puun mukana (ei rinnakkaista
  varastoa), toimii ilman Gitiä eikä kirjoita käyttäjän repoon. Sitä ei voi
  käyttää sellaisenaan: `/rewind` vaatii TUI:n, ja `/tree`-koukku kysyy
  `ctx.ui.select`illä, joka RPC:ssä olisi selaimen vastattava
  laajennuskysely. Daemonin oma laajennus (kuten `recap-extension.mjs`)
  ottaisi talteenoton ja palautuksen MIT-koodista lisenssimerkintöineen ja
  tarjoaisi kirjoituskomennon *palaa tähän {tiedostot: kyllä/ei}*.
- **Peruttava palautus ja jatkon vaihto tiedostoineen** (B:n vaihto, C:n
  *Peru palautus*) vaativat tilannekuvan seuratuista tiedostoista juuri ennen
  palautusta. better-pi-rewind ei ota sitä; pi-rewindin redo-pino ottaa.
  Sama talteenotto kuin viestin alussa, kirjattuna korvatun jatkon lehteen.
- **Kattavuus kerrotaan**: palautettavat ovat agentin `edit`/`write`-tiedostot;
  komentojen (`bash`) muutokset jäävät. Selain saa listan ja +/−-määrät
  checkpointin ja nykytilan vertailusta.
- **Vain tiedostot** (C) jättää keskustelun ennalleen, joten agentti luulee
  muutosten olevan yhä paikallaan. Host kirjoittaa siitä mallille näkyvän
  viestin (laajennuksen `custom_message`).
- **Jarin omat muutokset** samoihin tiedostoihin agentin jälkeen
  ylikirjoittuvat palautuksessa (better-pi-rewind vertaa vain checkpointiin).
  Prototyyppi ei näytä tätä tapausta; toteutus voisi varoittaa, kun tiedosto
  on muuttunut agentin viimeisen muokkauksen jälkeen.
- Keskustelun puolelle sama kuin kierroksella 1: `ctx.navigateTree`,
  pysyvä kohta (nimilappu), haarautumiskohdan merkki ja toisen haaran luku
  historiaan, käynnissä olevan vuoron pysäytys ensin. Git-commitien
  peruminen (`git reset --hard`) jätettiin pois: se on eri vaaraluokka kuin
  tiedostojen palautus.

## Prototyyppi

Kierros: `design-system/prototypes/rounds/2026-11-06-palaa-tahan/`
(`NOTES.md`). Sama keskustelu kuin kierroksella 1; kolmannessa vuorossa
myös komento `python scripts/taulukko.py`. Ero kierrokseen 1 näkyy
oletusnäkymässä: vahvistuksen tiedosto-osa.

Akseli: kuinka paljon tiedostojen palautusta Palaa tähän tarjoaa.

- **A Vain keskustelu**: Palaa tähän siirtää vain keskustelun; vahvistus nimeää tiedostot, jotka jäävät agentin muuttamiksi (Pi:n /tree sellaisenaan).
- **B Tiedostot mukana**: vahvistuksessa Palauta myös tiedostot, oletuksena päällä; aiemman jatkon rivi kertoo palautuksen, ja jatkon vaihto palauttaa sen tiedostot.
- **C Valitse mitä**: vahvistuksessa keskustelu ja tiedostot, vain keskustelu tai vain tiedostot; tiedostojen palautuksen voi perua.

Mitä kukin päättää:

- *A* ei tarvitse hostilta mitään tiedostoille, mutta väärän suunnan koodi jää,
  ja agentti jatkaa sen päältä, vaikka ei näe keskustelua, joka sen teki.
- *B* tekee yhden päätöksen: tavallinen tarkoitus (peru väärä käänne
  kokonaan) on oletus, ja valinnan pois ottaminen antaa A:n. Tarvitsee
  talteenoton, palautuksen ja vaihtoa varten tilannekuvan palautushetkellä.
- *C* on Claude Coden ja better-pi-rewindin valikko. *Vain tiedostot*
  lisää tilan, jossa keskustelu ja tiedostot ovat eri kohdassa ja agentille
  on kerrottava erikseen.

## Suositus

**B Tiedostot mukana.** Kun palaa ennen väärää pyyntöä, tarkoittaa
melkein aina myös sitä, mitä agentti sen jälkeen teki; yksi valinta pitää
vahvistuksen lyhyenä ja näyttää täsmälleen, mitkä tiedostot palaavat ja mikä
jää (komennot). C:n *Vain tiedostot* on harvinainen ja saa keskustelun ja
koodin eri kohtiin; sen voi lisätä myöhemmin. Toteutus: daemonin oma
laajennus better-pi-rewindin talteenotosta (MIT) sekä tilannekuva ennen
palautusta, jotta korvattuun jatkoon voi palata tiedostoineen.

## Kysymykset Jarille

1. B vai C: riittääkö *Palauta myös tiedostot*
   (`r2-b-tiedostot-mukana-1-vahvistus-1440-light`), vai haluatko myös
   *Vain tiedostot* (`r2-c-valitse-mita-1b-vain-tiedostot-1440-light`,
   `r2-c-valitse-mita-2-tulos-vain-tiedostot-1440-light`)?
2. Onko tiedostojen palautus oletuksena päällä (`r2-b-…-1-vahvistus`) vai
   pois (`r2-b-tiedostot-mukana-1b-ilman-tiedostoja-1440-light`)?
3. Kun vaihdat takaisin aiempaan jatkoon, palautuvatko sen tiedostot
   (`r2-b-tiedostot-mukana-5-jatkon-vaihto-1440-light`), vai vaihtuuko vain
   keskustelu?

## Todisteet

`evidence/r2-*`: jokaisesta suunnasta sisäänkäynti viestin valikosta (0),
vahvistus (1, B:ssä myös ilman tiedostoja ja C:ssä vain tiedostot 1b),
tulos (2), aiempi jatko tai C:n peruttu palautus (3), muutettu viesti
lähetetty (4), jatkon vaihto tiedostoineen (5, B ja C) ja agentti työssä (6);
1440 ja 390, vaalea ja tumma, kertoimella 2. `check.mjs`: 248
tarkistuspistettä, konsoli puhdas. Synteettinen komponenttilabra, ei
hostia vasten ajettu; better-pi-rewindiä ei ajettu, vaan se luettiin
lähdekoodista.

## Näyttäminen

```
node design-system/prototypes/rounds/2026-11-06-palaa-tahan/build.mjs
open-habitat agent view offer --current \
  --source design-system/prototypes/dist/palaa-tahan/offline.html \
  --title "Palaa tähän – kierros 2: tiedostot" \
  --idempotency-key "$(uuidgen)" --json
```

# Kierros 3: tiivis vahvistus

Jari 6.11.: kierroksen 2 **C Valitse mitä** on suunta; better-pi-rewind
(raine, MIT) on malli. Vahvistus oli ison näköinen, ja riffataan myös,
onko tiedostojen palautus oletuksena päällä vai pois.

## Prototyyppi

Kierros: `design-system/prototypes/rounds/2026-11-06-palaa-tahan-vahvistus/`
(`NOTES.md`). Sama keskustelu, samat kolme valintaa ja sama tulos kuin
kierroksen 2 C:ssä; vain vahvistuksen muoto vaihtuu. Kaikista on poistettu
valintojen selitteet, tiedostot ovat yhdellä rivillä (*3 tiedostoa palautuu,
komennon muutokset jäävät · Näytä*), ja lista on Näytä-painikkeen takana.
Yläpalkin *Tiedostot* vaihtaa oletuksen: mukana = Keskustelu ja tiedostot,
pois = Vain keskustelu.

Akseli: missä ja minkä kokoisena vahvistus näkyy.

- **A Ponnahdus**: pieni ikkuna viestin ⋯-painikkeen alla, kolme valintaa allekkain ilman selitteitä; tiedostot yhdellä rivillä, lista Näytä-painikkeen takana.
- **B Ohut palkki**: yksi rivi viestin alla: Palaa tähän, valikko mitä palautetaan ja painikkeet; määrät ja tiedostot pienellä toisella rivillä.
- **C Pieni arkki**: matala paneeli kentän yllä, kaksi valintaa Keskustelu ja Tiedostot rinnakkain; viesti ja sen jälkeinen osa himmenevät keskustelussa.

Korkeus oletusnäkymässä: A 255 px, B 88 px, C 148 px (puhelimessa 263,
140, 209); kierroksen 2 kortti oli 499 px (puhelimessa 593).

Mitä kukin päättää:

- *A* pitää kolme valintaa näkyvissä kuten better-pi-rewindin valikko ja
  on lähellä viestiä, mutta peittää myöhemmän osan, jonka se juuri jättää
  sivuun.
- *B* on pienin ja pysyy keskustelun virrassa viestin alla; valinta on
  valikon takana, joten muut kaksi vaihtoehtoa näkyvät vasta avattuna.
- *C* jättää koko keskustelun näkyviin ja on aina samassa paikassa kentän
  yllä; kaksi valintaa ilmaisee kolme vaihtoehtoa ilman sanaa *vain*, mutta
  vahvistus on kauempana viestistä, josta se avattiin.

## Mitä host tarvitsee

Sama kuin kierroksella 2; muoto ei lisää mitään. Vahvistus on selaimen
oma näkymä. Daemonilta se tarvitsee kirjoituskomennon *palaa tähän
{viesti, mitä: molemmat | keskustelu | tiedostot}* ja luvun, joka antaa
ennen vahvistusta jätettävien viestien määrän, checkpointin tiedostot
+/−-määrineen ja komennot, joiden muutoksia ei palauteta. Oletus (mukana tai
pois) on selaimen vakio; henkilökohtaista asetusta ei tarvita, ellei Jari
halua sellaista.

## Suositus

**B Ohut palkki, tiedostot oletuksena mukana.** Se on puolet C:stä ja
kolmasosa A:sta, ei peitä mitään ja on juuri siinä kohdassa, johon
keskustelu palaa, joten näkee samalla, mikä jää sivuun (himmennetty osa
alla). Tavallisin valinta on valmiina, ja harvinaisemmat ovat yhden
painalluksen päässä valikossa selitteineen. Oletus mukana, koska ennen
väärää pyyntöä palaaminen tarkoittaa melkein aina myös agentin sen jälkeen
tekemiä muutoksia; rivi sanoo silti suoraan, että 3 tiedostoa palautuu.

## Kysymykset Jarille

1. Mikä muoto: A (`r3-a-ponnahdus-1-oletus-mukana-1440-light`), B
   (`r3-b-ohut-palkki-1-oletus-mukana-1440-light`) vai C
   (`r3-c-pieni-arkki-1-oletus-mukana-1440-light`)?
2. Tiedostot oletuksena mukana (`r3-b-ohut-palkki-1-oletus-mukana-1440-light`)
   vai pois (`r3-b-ohut-palkki-1b-oletus-pois-1440-light`)?
3. Riittääkö tiedostoista rivi ja Näytä, vai pitääkö lista olla heti auki
   (`r3-b-ohut-palkki-1c-tiedostot-auki-1440-light`)?

## Todisteet

`evidence/r3-*`: jokaisesta riffistä oletusnäkymä tiedostot mukana (1),
oletus pois (1b), tiedostolista auki (1c), B:n valikko auki (1d), vain
tiedostot (1e), tulos (2), sisäänkäynti viestin ⋯-valikosta (0) ja agentti
työssä (6); 1440 ja 390, vaalea ja tumma, kertoimella 2. `check.mjs`: 344
tarkistuspistettä, konsoli puhdas, vahvistus kokonaan kentän yläpuolella.
Synteettinen komponenttilabra, ei hostia vasten ajettu.

## Näyttäminen

```
node design-system/prototypes/rounds/2026-11-06-palaa-tahan-vahvistus/build.mjs
open-habitat agent view offer --current \
  --source design-system/prototypes/dist/palaa-tahan-vahvistus/offline.html \
  --title "Palaa tähän – kierros 3: vahvistus" \
  --idempotency-key "$(uuidgen)" --json
```

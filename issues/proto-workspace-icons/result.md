# Työtilan kuvake sivupalkissa: mistä se tulee ja miten sen vaihtaa

Kierros: `prototypes/tyotilan-kuvake/tyotilan-kuvake.html` (yksi offline-HTML,
rakennettu käsin kirjoitetusta `source.html`:stä komennolla
`node issues/proto-workspace-icons/prototypes/tyotilan-kuvake/build.mjs`).
Kokeiluohje on [NOTES.md](prototypes/tyotilan-kuvake/NOTES.md) ja
ruutukaappaukset `evidence/`-hakemistossa (DSF 2, AVIF).

## Akseli ja suunnat

Akseli on se, **mistä kuvake tulee ja miten sen vaihtaa**. Kaikissa
suunnissa Käynnissä-osion toistuva työtilan otsikkorivi (kuvakaappauksen
*open-habitat 1*) on poistettu, ja jokaisen keskustelun edessä on työtilan
kuvake. Sama kuvake on myös Sinun vuorosi -riveillä, Hiljaiset-taitoksissa,
Työtilat-listassa (kansiokuvakkeen tilalla), kapeassa kaistaleessa
nimikirjainten tilalla, työtilasivun otsikossa ja keskustelun yläpalkissa.
Ryhmittely säilyy: saman työtilan rivit ovat yhä peräkkäin, ja ryhmien välissä
on 5 px:n väli.

1. **Hymiö.** Kuvake on emoji. Se luetaan repon `.workmux.yaml`-tiedoston
   `window_prefix`-kentästä, eli siitä samasta paikasta, josta tmux-ikkunat ja
   Telegram-ilmoitukset sen saavat. Jos kenttää ei ole, emoji johdetaan nimestä
   48 emojin joukosta. Joukossa ei ole ympyröitä, neliöitä eikä rasteja, jotta
   kuvaketta ei lueta tilamerkiksi. Nimi näkyy työpöydällä emojin työkaluvihjeenä
   ja puhelimessa rivin toisena rivinä. Kuvake vaihdetaan työtilasivulla
   (kuvake tai kynä). Vaihto **kirjoittaa repoon** `window_prefix`-kentän, ja
   työtilasivu näyttää muutoksen Gitissä, kunnes se commitoidaan.
   Tämä ratkaisee sen, että terminaali ja selain näyttävät saman tunnuksen
   kaikilla koneilla. Hintana on, että selaimesta tehty vaihto muuttaa repon
   tiedostoa ja luo tarvittaessa toisen työkalun asetustiedoston.
2. **Monogrammi.** Kuvake on värillinen kirjaintunnus. Kirjaimet johdetaan
   nimestä niin, että yleisnimet kuten `monorepo`, `cli` ja `app` ohitetaan
   (`northwind-monorepo` → 3D, `open-habitat` → OH), ja väri tulee nimen
   tiivisteestä kahdeksasta teemasävystä. Jos repossa on logo (`favicon.svg`
   tai `logo.svg`), käytetään sitä. `.workmux.yaml`-tiedostoa ei lueta. Tilapallo
   on tunnuksen kulmassa samaan tapaan kuin nykyisessä kaistaleessa. Työpöydällä
   tunnuksen päälle vieminen avaa siitä nimen näyttävän pillerin, ja puhelimessa
   saman tekee napautus. Kirjaimet, väri ja logon käyttö vaihdetaan
   työtilasivulla, ja valinta **tallennetaan paikallisesti**
   `.agent-host/workspace.json`-tiedostoon näyttönimen viereen. Logo vaihtuu
   vain repossa. Tämä ratkaisee rauhallisen, aina luettavan ilmeen, joka toimii
   myös ihmisille, joilla ei ole hymiöperinnettä. Hintana on, että Jarin
   terminaalihymiöt eivät näy, ja 16 px:n kirjaimet ovat pieniä.
3. **Lähdeketju.** Kuvake luetaan ketjusta: terminaalin hymiö
   (`.workmux.yaml`), sitten repon logo ja viimeisenä nimestä johdettu
   kirjaintunnus. Kuvake on oma painikkeensa rivin edessä, ja se avaa kortin,
   jossa ovat koko nimi, kuvakkeen lähde ja toiminnot *Avaa työtilasivu*,
   *Uusi keskustelu* ja *Vaihda kuvake…*. Puhelimessa sama kortti avautuu
   alapaneelina. Vaihtoikkuna listaa kaikki ehdokkaat lähteineen, myös *Oma
   hymiö*. Valinta **tallennetaan paikallisesti**
   `.agent-host/workspace.json`-tiedostoon, eikä repon tiedostoihin kosketa.
   Tämä ratkaisee sen, että jokainen olemassa oleva lähde kelpaa ja ihminen
   näkee, mistä kuvake tuli. Hintana on rivin seka-ilme (hymiöitä, logoja ja
   kirjaimia rinnakkain) ja yksi painike lisää jokaisella rivillä.

## Suositus

**Hymiö, mutta niin, että kirjoitus menee sinne, missä hymiö jo on.**

- Luetaan järjestyksessä `.agent-host/workspace.json` `icon`, sitten
  `.workmux.yaml` `window_prefix`, ja muuten käytetään nimestä johdettua emojia.
- Vaihto kirjoittaa `.workmux.yaml`-tiedostoon vain, jos repo jo kantaa
  hymiönsä siellä. Silloin muutos tehdään lähteeseen, ja tmux, Telegram ja
  muut koneet saavat saman. Muuten vaihto kirjoittaa
  `.agent-host/workspace.json`-tiedostoon. Open Habitat ei luo toisen
  työkalun tiedostoa repoon, johon kukaan ei ole sitä pyytänyt.
- Logoja ei käytetä ainakaan nyt.

Perustelut:

- Jarin repoista 14/17:llä on jo `window_prefix` (luettu 30.10. hakemistosta
  `~/src`). Hymiöt ovat valmiiksi opittuja ja eroavat toisistaan 13 px:n
  koossa selvästi paremmin kuin kaksikirjaiminen tunnus.
- Kaisan ja pilottikäyttäjien repoissa ei ole `.workmux.yaml`-tiedostoa.
  Heille nimestä johdettu emoji riittää, ja oman valinnan voi tallentaa
  Open Habitatin omaan työtilatiedostoon.
- Logot (`favicon.svg`) on piirretty selainvälilehteä varten. Rivissä ne
  sekoittuvat emojien joukkoon (katso Lähdeketju), ja repon SVG:n
  näyttäminen vaatii oman tarjoilureitin (katso alla).

## Faktat hostista ja koodista

Miten sivupalkki ryhmittelee ja nimeää keskustelut nyt:

- `web/src/components/Navigation.tsx:893` `RunningGroups` ryhmittelee
  Käynnissä-osion `workspaceId`:n mukaan ja järjestää ryhmät nimen mukaan.
  Jokaisella ryhmällä on `<h3 className="ah-now-group-head">` nimellä ja
  rivimäärällä (rivi 934). Tämä on kuvakaappauksen toistuva otsikko.
  Ryhmä, jonka kaikki rivit ovat yli tunnin hiljaisia, siirtyy Hiljaiset-osioon
  työtilan nimen sisältävän taittorivin alle.
- `Navigation.tsx:985` `NowSections`: Sinun vuorosi -rivit eivät näytä
  työtilaa lainkaan. Työtila on vain rivin kuvauksessa ja työkaluvihjeessä
  (`detail`, joka muodostetaan `web/src/app/railNow.ts:176`). Kuvake toisi
  näille riveille tiedon, jota niissä nyt ei näy.
- `Navigation.tsx:818` `initials()` ja `:825` `NowDot`: kapea kaistale näyttää
  jo nyt työtilan nimikirjaimet ja tilapallon. Ne ovat tämän kierroksen
  monogrammin esiaste ilman väriä. Jarin repoilla ne törmäävät:
  `northwind-monorepo` 3M, `4dcube-monorepo` 4M, `tailspin-monorepo` IM,
  `ergona-monorepo` EM, `kunnollavauhtiin-monorepo` KM ja `fabrikam-monorepo` FM.
  Kaikki päättyvät M-kirjaimeen.
- Kaistale on käytössä editorin vieressä: `web/src/app/App.tsx:266`
  `railCompact = editorShown ? !railBesideEditor : collapsed`.
- Työtilat-listan rivillä on kansiokuvake (`Navigation.tsx:802`), ja
  kuvakkeelle on siinä valmis paikka. Keskustelun yläpalkki näyttää työtilan
  jo linkkinä (`AgentHeader`, `workspaceLabel`, `Navigation.tsx:1340`).
- Nimeäminen: `web/src/app/WorkspaceRailView.tsx` antaa nimeksi
  `display_name ?? name`. Uudelleennimeäminen on työtilasivun kynäpainike
  (`web/src/components/WorkspaceActions.tsx:105`). Se avaa
  *Näyttönimi*-ikkunan (`web/src/app/WorkspacePage.tsx`, noin rivi 400), ja
  kuvakkeen vaihto sopii luontevasti samaan ikkunaan.

Mitä daemon tietää työtilasta:

- `contracts/v1/snapshot.schema.json` `$defs.workspace`: `workspace_id`,
  `name` (hakemiston nimi), `display_name`, `kind`, `path`, `visibility`,
  `git_summary` (sisältää `github_repo`-kentän), `git_remote` (vain luokitus),
  `gitea_origin`, `gitlab_origin` ja `worktrees`. Kuvakkeeseen sopivaa kenttää
  ei ole.
- `internal/daemon/discovery_linux.go:244` `metadata()` lukee jokaisesta
  työtilasta tiedoston `<työtila>/.agent-host/workspace.json` (enintään
  4096 tavua). `parseMetadata` (`:266`) on tiukka: se hyväksyy vain kentät
  `schema_version` (1), `workspace_id` ja `display_name`, ja tuntematon kenttä
  tekee koko tiedostosta virheellisen.
- `internal/daemon/workspace_files_linux.go:93` `writeWorkspaceSettings`
  kirjoittaa saman tiedoston atomisesti (tilapäistiedosto, fsync ja
  uudelleennimeäminen). Sitä kutsuu `workspace_manage_linux.go`:n `settings`-
  toiminto (`:364`).
- `workspace_manage_linux.go:518` lisää `.agent-host/`-rivin repon
  `.git/info/exclude`-tiedostoon. Tiedosto on siis paikallinen: se ei näy
  Gitissä eikä siirry kloonin mukana.
- Käyttäjäkohtainen tila (arkistointi ja piilotus) on
  `~/.local/state/open-habitat/user-state.json`-tiedostossa
  (`workspace_manage_linux.go:57`, `:107`). Kuvakevalinta kuuluu kuitenkin
  työtilalle eikä tilille, joten tämä tiedosto ei ole oikea paikka.

Repon sisältö, joka voi kantaa kuvakkeen (ei uutta varastoa):

| Lähde | Missä | Kenen | Havainto |
|---|---|---|---|
| `.workmux.yaml` `window_prefix` | repossa, commitoitu (tarkistettu: open-habitat, fleetrepo, northwind-monorepo, issuectl, taskfleet) | repo | 14/17 Jarin repoista. Tiedosto voi olla 5 kt (fleetrepo), joten lukurajan pitää olla vähintään 16 KiB. Arvossa on perässä välilyönti (`"🤖 "`). |
| `.agent-host/workspace.json` | repohakemistossa, git-exclude | tämä palvelin | Open Habitatin oma olemassa oleva työtilatiedosto. Uusi `icon`-kenttä sopisi näyttönimen viereen. |
| `favicon.svg` / `logo.svg` | repossa | repo | Vain 3/17:llä (`open-habitat/design-system/favicon.svg`, `out-of-context/static/favicon.svg`, `deutschpad/public/favicon.svg`). Polut vaihtelevat, joten ne pitäisi etsiä tietystä polkulistasta. |
| GitHub-omistajan avatar | github.com | ulkoinen | Hylätty. Kaikilla Jarin repoilla on sama omistaja, joten kuvake olisi kaikissa sama. Lisäksi se vaatisi kolmannen osapuolen pyynnön jokaisella näkymällä, ja daemon tietää vain `github_repo`-nimen. |
| tw `projects.conf` | Fleetrepon konfiguraatio, koneen tiedosto | kone | Hylätty. Tiedosto ei ole repossa eikä Birchn kaltaisella hostilla. `.workmux.yaml` on sen repossa kulkeva kopio. |
| Nimestä johdettu | ei tallennusta | — | Deterministinen: FNV-1a nimestä. Toistaiseksi samaan emojiin tai sävyyn osuva siirtyy seuraavaan vapaaseen. |

Suunnat erittelynä:

| Suunta | Luetaan | Oletus | Vaihto kirjoittaa |
|---|---|---|---|
| Hymiö | `.workmux.yaml` | johdettu emoji | repoon: `.workmux.yaml` |
| Monogrammi | logo, `.agent-host/workspace.json` | johdetut kirjaimet ja väri | paikallisesti: `.agent-host/workspace.json` |
| Lähdeketju | `.agent-host/workspace.json` → `.workmux.yaml` → logo | johdettu tunnus | paikallisesti: `.agent-host/workspace.json` |

## Luonnos palvelinpuolesta (suositeltu suunta)

- **Lukeminen** tapahtuu `discovery_linux.go`:n `scan`-silmukassa
  `metadata()`:n vieressä samalla avatulla hakemistokahvalla (`child`) ja samalla
  `readSmall`-lukijalla (O_NOFOLLOW, RESOLVE_BENEATH). Uusi lukija
  `workmuxPrefix(op, child)` lukee enintään 16 KiB ja etsii vain ylimmän tason
  rivin `window_prefix: "…"`. Se ei ole YAML-kirjasto. Arvo hyväksytään,
  kun siinä on 1–2 graafeemiklusteria ja enintään 32 tavua eikä
  ohjausmerkkejä. Lopun välilyönti poistetaan. Monta riviä tai jokin muu
  muoto tarkoittaa, ettei hymiötä ole.
- **`parseMetadata`** saa valinnaisen `icon`-kentän, jolla on sama
  validointi. Tiedoston skeema pysyy versiossa 1, koska yhteensopivuutta ei
  tarvitse säilyttää.
- **Snapshot** (`snapshot_linux.go:296`) ja `snapshot.schema.json` saavat
  valinnaisen kentän `icon: { "value": "🤖", "source": "workspace" | "workmux" }`.
  Kun kenttää ei ole, selain johtaa emojin nimestä. Johtamissääntö on
  selaimessa, koska se riippuu kaikista näkyvistä työtiloista (törmäysten
  siirto) eikä ole tieto yksittäisestä työtilasta.
- **Kirjoittaminen** tapahtuu nykyisen `settings`-toiminnon kautta
  (`workspace_manage_linux.go`), jonka syötteeseen tulee `icon`-kenttä
  `display_name`-kentän rinnalle. Daemon päättää kohteen itse: jos
  `.workmux.yaml`-tiedostossa on täsmälleen yksi `window_prefix`-rivi, daemon
  korvaa vain sen rivin atomisesti (tilapäistiedosto ja uudelleennimeäminen
  samassa hakemistossa, tiedoston tila säilyy). Muuten se kirjoittaa
  `.agent-host/workspace.json`-tiedostoon `writeWorkspaceSettings`-funktiolla.
  Kirjoittaja on daemon käyttäjän omana Unix-käyttäjänä hänen omaan repoonsa.
  Gatewayn, daemonin ja provisionin auktoriteetit pysyvät ennallaan.
- **Logo** (jos se joskus otetaan mukaan): repon SVG on agentin
  kirjoitettavissa, eli epäluotettavaa sisältöä. Daemon tarjoilisi sen vain
  `<img>`-kontekstiin (skriptit eivät aja), kokorajattuna ja
  `image/svg+xml`-tyyppisenä omalla CSP:llään tai rasteroisi sen. Tätä ei
  ehdoteta nyt.

## Päätökset myöhempää tarkastelua varten

- **Toistuva otsikko poistetaan, mutta ryhmittely säilyy.** Vaihtoehto olisi
  ollut järjestää Käynnissä pelkän ajan mukaan, jolloin kuvake olisi ainoa
  ryhmittelijä. Valitsin ryhmittelyn, koska `RunningGroups`-funktion hiljaisten
  taitokset ja Hiljaiset-osio nojaavat siihen, ja kuvakesarake näyttää
  ryhmän rajan yhä.
- **Hiljaiset-taittoriveillä nimi säilyy.** Ne ovat työtilan rivejä eivätkä
  keskustelujen rivejä, joten nimeä ei toisteta.
- **Nimestä johdettu oletus väistää törmäykset.** Jos johdettu emoji tai sävy
  on jo toisen työtilan käytössä, se siirtyy seuraavaan vapaaseen
  aakkosjärjestyksessä. Vaihtoehto oli sallia törmäykset: 48 emojia ja 17
  työtilaa antavat melkein varmasti ainakin yhden parin. Väistön hinta on se,
  että johdettu kuvake voi vaihtua, kun toinen työtila valitsee sen. Tämä näkyy
  prototyypissä: kun tailspin-monorepo saa 🦔:n, 4dcube-monorepo vaihtuu
  🐢:ksi, ja vaihtoikkuna kertoo ennalta, kenen emoji on kyseessä. Kuvake on
  pysyvä vasta, kun ihminen valitsee sen.
- **Emojijoukosta on rajattu pois ympyrät, neliöt ja rastit.** Ne
  sekoittuisivat tilapalloihin. Jarin omaa 🟥-hymiötä (out-of-context)
  kunnioitetaan silti.
- **Rivin järjestys:** Hymiö-suunnassa järjestys on pallo, emoji ja otsikko,
  jotta tilasarake pysyy vasemmassa reunassa kuten nyt. Lähdeketjussa
  järjestys on kuvake ja pallo, koska kuvake on painike. Monogrammissa pallo
  on tunnuksen kulmassa. Tämä on sommitteluvalinta, jonka voi vaihtaa
  suunnasta riippumatta.
- **Suosituksen kirjoituskohde** (`.workmux.yaml` vain, jos hymiö on jo siellä,
  muuten `.agent-host/workspace.json`) poikkeaa Hymiö-suunnan prototyypistä,
  joka kirjoittaa aina repoon. Prototyyppi näyttää puhtaan suunnan. Suositus
  välttää sen, että Open Habitat luo workmux-tiedoston repoihin, joissa
  workmuxia ei käytetä.

## Kysymykset Jarille

1. Kirjoitetaanko selaimesta tehty hymiön vaihto `.workmux.yaml`-tiedostoon
   (sama hymiö tmuxissa ja kaikilla koneilla, mutta muutos näkyy Gitissä) vai
   vain Open Habitatin paikalliseen tiedostoon?
2. Riittääkö kuvake erottamaan ryhmät, vai haluatko ryhmien väliin vielä
   näkyvämmän välin tai viivan?
3. Pidetäänkö kaistaleen nimikirjaimet ennallaan, kunnes kuvake toteutetaan?
   Nyt kuusi monorepoa näkyy siinä muodossa *xM*.

## Rakentaminen ja tarkistus

- `node issues/proto-workspace-icons/prototypes/tyotilan-kuvake/build.mjs`
  upottaa tokenit ja fontit `design-system/`-hakemistosta.
- `check.mjs` käy kaikki kolme suuntaa läpi vaaleana ja tummana työpöydällä,
  kaistaleessa ja puhelimessa. Se klikkaa vaihdon ja tallennuksen sekä
  nimen näyttävät toiminnot ja kirjoittaa 34 kuvaa. Konsolissa ei ollut
  virheitä 30.10.:
  `PLAYWRIGHT_BROWSERS_PATH=~/.cache/ms-playwright NODE_PATH=~/src/open-habitat/web/node_modules node check.mjs <hakemisto>`.
- Tuotantokoodia ei muutettu.

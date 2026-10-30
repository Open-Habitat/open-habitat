# Työtilan kuvakkeen asettaminen työtilasivulla

Kierroksen sivu on `prototypes/kuvakkeen-asetus/kuvakkeen-asetus.html`. Se on
yksi offline-HTML, joka rakennetaan käsin kirjoitetusta `source.html`:stä
komennolla `node issues/proto-workspace-icon-setting/prototypes/kuvakkeen-asetus/build.mjs`.
Kokeiluohje on [NOTES.md](prototypes/kuvakkeen-asetus/NOTES.md), ja
ruutukaappaukset ovat `evidence/`-hakemistossa (DSF 2, AVIF). Sivu on kirjoitettu
käsin issuen omaan hakemistoon samalla tavalla kuin edellinen
kuvakekierros (`proto-workspace-icons`). Syy on se, että
`design-system/prototypes/lib/` on keskustelunäkymän kirjasto eikä sisällä
työtilasivua.

Konffi on Jarin 30.10. päätöksen mukaisesti **`.open-habitat.yaml`** repon
juuressa, ja kuvake on sen kenttä `icon`. Sivupalkki lukee kuvakkeen
Lähdeketjun järjestyksessä: konffin `icon`, sitten repon logo ja viimeisenä
nimestä johdettu kirjaintunnus. Prototyypin sivupalkki päivittyy heti
valinnan jälkeen.

## Akseli ja suunnat

Akseli on se, **missä ja miten kuvake valitaan työtilasivulla ja mitä sivu
sanoo commitoinnista**. Valitsimen sisältö on kaikissa suunnissa sama:
*Automaattinen* (konffiin ei kirjoiteta mitään, ja ketju jatkuu), repon logo,
kirjaintunnus muokattavine kirjaimineen, emojiruudukko ja oma emoji.

1. **Otsikko.** Kuvake on työtilan nimen vieressä otsikossa. Se on painike,
   joka avaa ankkuroidun valitsimen, puhelimessa alapaneelin. Otsikon
   alarivi kertoo lähteen (*Kuvake: Repon logo · design-system/favicon.svg*).
   Valinta kirjoitetaan heti. Sen jälkeen otsikon alle tulee ilmoitus
   *`.open-habitat.yaml` luotu, ei commitoitu*, jossa sanotaan, että kuvake
   näkyy jo tässä selaimessa mutta muut kloonit näkevät sen vasta commitin ja
   lähetyksen jälkeen. Ilmoituksessa on painikkeet **Kumoa** ja **Commitoi
   tiedosto**. Commit sisältää vain konffin. Jos repossa on muita muutoksia,
   ilmoitus kertoo niiden määrän ja sen, että ne jäävät ennalleen. Commitin
   jälkeen ilmoitus näyttää tiivisteen, viestin ja tiedon, että commit on vielä
   lähettämättä (↑1).
   Ratkaisu on nopein ja ilmeisin: kuvaketta muutetaan kuvakkeesta. Hinta on
   se, että selaimesta syntyy commit, eli uusi Git-toiminto, jota sivulla ei
   nyt ole.
2. **Ulkoasu.** Aloitussivun alla on oma *Ulkoasu*-osio, jossa näkyvät iso
   kuvake ja ketjun kolme porrasta. Käytössä oleva porras on korostettu, ja
   puuttuva on yliviivattu. *Vaihda…* avaa välilehdet *Automaattinen / Logo /
   Kirjaimet / Emoji*, esikatselun kolmessa koossa (rivi, kaistale, otsikko)
   sekä diffin otsikolla **Kirjoitetaan repoon**. Muutos tallennetaan vasta
   *Tallenna repoon* -painikkeesta. Sivu **ei tarjoa commitia**. Osioon
   tulee merkintä *commitoimatta*, selitys ja painike *Näytä Git-muutokset*.
   Ratkaisu on läpinäkyvin, koska ihminen näkee ketjun ja tiedoston ennen kuin
   mitään kirjoitetaan, eikä uutta Git-toimintoa tarvita. Hinta on se, että
   osio vie tilaa kerran asetettavalle asialle. Lisäksi muutos voi jäädä
   commitoimatta tai päätyä agentin seuraavaan committiin, jonka aihe on aivan
   muu.
3. **Ehdotus.** Jos konffissa ei ole kuvaketta, sivu näyttää otsikon alla
   ehdotuksen. Siinä ovat logo (jos sellainen on), tunnus ja kolme nimestä
   johdettua emojia sekä *Muu…*. Yksi klikkaus tallentaa kuvakkeen ja oletuksena
   myös **commitoi** sen (*Commitoi heti (vain `.open-habitat.yaml`)*). *Ei nyt*
   piilottaa ehdotuksen. Kun kuvake on asetettu, ehdotusta ei näy. Kuvake
   vaihdetaan silloin kynästä tai kuvakkeesta avautuvassa *Nimi ja kuvake*
   -ikkunassa, jossa näyttönimi ja kuvake ovat yhdessä. Ikkuna kertoo, että
   nimi tallentuu vain tälle palvelimelle (`.agent-host/workspace.json`) ja
   kuvake repoon.
   Ratkaisu tuo kuvakkeen käyttöön niille, jotka eivät sitä etsisi. Hinta on
   se, että jokainen kuvakkeeton repo näyttää kehotteen, vaikka ketjun oletus
   on usein riittävä. Lisäksi oletuksena tehtävä commit tekee repon
   historiaan merkinnän ilman erillistä päätöstä.

Kaikissa suunnissa: hakemistossa ilman Gitiä (`muistiinpanot`) commitia ei
tarjota, ja sivu sanoo, että tiedosto jää vain tähän hakemistoon. Työtilat-
listan rivillä on pieni oranssi piste, kun konffi on commitoimatta.
Git-sirun luku kasvaa yhdellä, ja sirussa on sama piste.

## Suositus

**Otsikko**, mutta Ulkoasun lähderivillä. Prototyyppi tekee jo näin:
otsikon alla lukee, mistä kuvake tulee.

- Kuvake vaihdetaan harvoin, ja sitä etsitään luontevimmin kuvakkeesta
  itsestään. Kokonainen osio (Ulkoasu) on raskas kerran asetettavalle asialle,
  ja jatkuva kehote (Ehdotus) on melua 17 repolle, joista useimmilla ketjun
  oletus kelpaa.
- Commitin tarjoaminen ratkaisee sen, minkä takia kuvake laitettiin repoon:
  muiden kloonien ja koneiden pitää nähdä se. Ilman tarjousta konffi jää
  helposti roikkumaan tai päätyy agentin seuraavaan committiin, jonka aihe
  on muu. Tarjous on painike eikä oletus, joten historiaan ei synny
  merkintää ilman päätöstä.
- Commit koskee vain konffitiedostoa (`git commit --only --
  .open-habitat.yaml`). Agentin samaan aikaan tekemät muutokset ja
  sen indeksi jäävät ennalleen.
- Lähettämistä (push) ei tarjota. Se kuuluu Git-kerroksen ja ihmisen
  päätettäväksi, ja ilmoitus sanoo, että commit on vielä vain tällä koneella.

## Faktat hostista ja koodista

Työtilasivu nyt:

- `web/src/app/WorkspacePage.tsx:227` on otsikko. Siinä ovat `h1`
  (`data-testid="workspace-title"`), polku `code`-elementissä ja
  `WorkspaceActions`-toimintorivi (`web/src/components/WorkspaceActions.tsx`).
  Rivillä ovat kopioi polku, GitHub, kynä (*Muuta näyttönimeä…*), arkistoi,
  poista, uusi worktree ja uusi keskustelu. Otsikossa ei ole kuvaketta. Uusi
  kuvake tulee `h1`:n eteen, samaan kohtaan kuin `.ah-workspace-page-title`.
- `WorkspacePage.tsx:391` on kynän avaama *Muuta näyttönimeä* -`Dialog`.
  Ehdotuksen *Nimi ja kuvake* laajentaisi sitä.
- `web/src/app/WorkspaceLanding.tsx` ja `web/src/components/WorkspaceIntro.tsx`
  ovat aloitussivu (`.agents/start-page.md`). Kun sivua ei ole, näkyy
  katkoviivainen `ah-workspace-intro-line`, ja Ehdotus käyttää samaa
  ilmettä.
- `WorkspacePage.tsx:175` on Git-siru (`WorkspaceGitLayer` ja
  `GitStatusDetails`). Sen nimiö muodostetaan rivillä 165 muodossa
  `main · N muutosta ↑a`. Git-tila luetaan `useGitStatus(workspace, csrf,
  { eager: true })` -kutsulla. `web/src/app/ConversationGitStatus.tsx`
  kertoo, että tilaa **ei kysellä toistuvasti**, vaan se luetaan
  latauksessa ja agentin vuoron päättyessä. Kuvakkeen kirjoituksen ja
  commitin jälkeen sivun on siksi luettava tila itse
  (`gitStatus.details.onReread`), muuten siru näyttää vanhaa tilaa.
- Sivun asetukset ovat käytössä vain, kun `csrf` on olemassa ja
  `workspace.mutation_state === "allowed"`
  (`WorkspacePage.tsx:265`). Kuvakkeen valinnan on noudatettava samaa
  ehtoa.

Mitä daemonissa on valmiina:

- `internal/daemon/workspace_manage_linux.go:364` on `settings`-toiminto.
  Se kirjoittaa näyttönimen `.agent-host/workspace.json`:iin
  (`writeWorkspaceSettings`, `workspace_files_linux.go:93`, atomisesti) ja
  vaatii `ObservationToken`in (rivi 250). Tiedosto on paikallinen
  (git-exclude), joten kuvake **ei** kuulu tähän tiedostoon vaan omaan
  repotiedostoonsa. Kirjoitus voi kuitenkin käyttää samaa
  toimintoa ja samaa havaintotunnistetta.
- `internal/daemon/start_page_linux.go:109` lukee repon juuren tiedoston
  `os.OpenRoot`-kutsulla työtilan avatusta hakemistokahvasta. Polku pysyy
  siis työtilan sisällä, eikä symlinkki vie ulos. `.open-habitat.yaml`
  luetaan ja kirjoitetaan samalla tavalla.
- `internal/daemon/workspace_worktrees_linux.go:1079` `saveToBranch` on ainoa
  commit, jonka daemon tekee nyt. Se ajaa gitin käyttäjänä, ilman hookeja,
  ilman allekirjoitusta ja aikarajalla, ja tarkistaa sen jälkeen haaran ja
  tiivisteen. Viestin muoto on `worktreeSaveMessage`
  `"Tallennettu ennen worktreen poistoa (open-habitat)"`. Kuvakkeen commit
  olisi saman mallin kapeampi versio: `add --all` korvataan `commit --only --
  .open-habitat.yaml` -komennolla, ja viesti on `"Työtilan kuvake: 🦔
  (open-habitat)"`.
- **Auktoriteetti ei muutu.** Daemon kirjoittaa ja commitoi käyttäjänä
  käyttäjän omaan repoon, kuten se jo tekee worktreen tallennuksessa.
  Gatewayn, daemonin ja provisionin rajat pysyvät ennallaan.

Kirjoituksen yksityiskohdat, joita prototyyppi olettaa:

- YAML kirjoitetaan **rivitasolla**: ylimmän tason `icon:`-rivi korvataan,
  poistetaan tai lisätään. Muut rivit ja kommentit säilyvät, kuten
  fleetrepon esimerkissä. YAML-kirjastoa, joka kirjoittaisi tiedoston
  uudelleen, ei käytetä, koska se hävittäisi kommentit. Jos tiedostossa on
  useampi `icon:`-rivi tai jokin muu muoto, sivu kieltäytyy kirjoittamasta
  ja kertoo syyn.
- *Automaattinen* poistaa `icon`-rivin. Jos sivu itse loi tiedoston eikä
  siinä ole muuta, tiedosto poistetaan, jotta repoon ei jää tyhjää konffia.
- Commit epäonnistuu, jos Git on varattu (`index.lock` agentin
  commitin aikana), tai jos konffissa on jo ennestään commitoimattomia
  muutoksia, jotka eivät ole tämän sivun tekemiä. Ilmoitus kertoo silloin
  syyn eikä commitoi mitään. Prototyyppi ei näytä näitä tiloja.

## Päätökset myöhempää tarkastelua varten

- **`icon`-arvon muoto.** Arvo voi olla emoji (`icon: "🦔"`), repon polku
  kuvaan (`icon: design-system/favicon.svg`, eli arvo, jossa on `/` tai `.`)
  tai 1–3 kirjainta tai numeroa (`icon: "OH"`) kirjaintunnukseksi. Muut
  arvot ohitetaan, ja ketju jatkuu. Vaihtoehtoina olivat sisäkkäiset
  avaimet (`icon: { emoji: … }`) tai pelkkä emoji. Valitsin litteän muodon,
  koska se on luettavin käsin kirjoitettuna ja kattaa kaikki kolme
  ketjun lähdettä. Lukijan toteuttaa `workspace-icon-chain`, joten muodon
  on oltava siellä sama.
- **Kirjaintunnuksen väri** johdetaan nimestä eikä sitä tallenneta.
  Vaihtoehto oli `icon_hue`-kenttä. En lisännyt sitä, koska Jari valitsi
  Lähdeketjun eikä Monogrammia, jossa väri oli valittavissa.
- **Commit ilman hookeja ja allekirjoitusta**, kuten `saveToBranch`.
  Vaihtoehto oli ajaa repon pre-commit-hookit. Valitsin saman linjan kuin
  nykyinen commit, koska hookit voivat olla hitaita tai interaktiivisia eivätkä
  koske yhtä YAML-riviä.
- **Commit-viesti on suomeksi ja päättyy merkintään `(open-habitat)`**, kuten
  `worktreeSaveMessage`. Vaihtoehto oli englanti, jota Jarin repot muuten
  käyttävät. Valitsin olemassa olevan käytännön.
- **Push jätetään pois.** Vaihtoehto oli *Commitoi ja lähetä*. Lähettäminen
  on erillinen päätös ja kuuluu Git-kerrokselle. Ilmoitus kertoo, että commit
  on vielä vain tällä koneella.
- **Ehdotuksen *Ei nyt*** piilottaa ehdotuksen vain tämän käynnin ajaksi.
  Pysyvä piilotus vaatisi tallennuspaikan. Uutta varastoa ei
  lisätä ehdotusta varten, ja suositus on joka tapauksessa Otsikko.
- **Logoehdokkaat** ovat prototyypissä repon tunnetut logopolut
  (`favicon.svg` ja `logo.svg` muutamasta tavallisesta hakemistosta). Lista
  on `workspace-icon-chain`-issuen asia, ja valitsin näyttää ne logot, jotka
  lukija löytää.

## Kysymykset Jarille

1. Saako selain tehdä commitin (Otsikko ja Ehdotus), vai jätetäänkö commit
   aina sinulle tai agentille (Ulkoasu)?
2. Kelpaako litteä `icon`-muoto (emoji, polku tai kirjaimet) myös käsin
   kirjoitettavaksi?

## Rakentaminen ja tarkistus

- `node issues/proto-workspace-icon-setting/prototypes/kuvakkeen-asetus/build.mjs`
  upottaa tokenit ja fontit `design-system/`-hakemistosta.
- `check.mjs` käy kaikki kolme suuntaa läpi vaaleana ja tummana
  työpöydällä ja puhelimessa. Se klikkaa kunkin suunnan valinnan, tallennuksen
  ja commitin sekä Git-kerroksen, *Nimi ja kuvake* -ikkunan ja
  Gitittömän hakemiston, ja se epäonnistuu, jos jokin odotettu tila puuttuu.
  30.10. se otti 48 kuvaa, eikä konsolissa ollut virheitä:
  `PLAYWRIGHT_BROWSERS_PATH=~/.cache/ms-playwright NODE_PATH=~/src/open-habitat/web/node_modules node check.mjs <hakemisto>`.
  `evidence/`-hakemistoon tallennettiin 22 kuvaa niistä.
- Tuotantokoodia ei muutettu.

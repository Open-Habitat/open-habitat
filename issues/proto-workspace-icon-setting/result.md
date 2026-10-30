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

## Kierros 2: ehdotukset ja sparraus mallin kanssa

Kierroksen sivu on `prototypes/ehdotus-sparraus/ehdotus-sparraus.html`. Se on
yksi offline-HTML, joka rakennetaan `source.html`:stä komennolla
`node issues/proto-workspace-icon-setting/prototypes/ehdotus-sparraus/build.mjs`.
Kokeiluohje on [NOTES.md](prototypes/ehdotus-sparraus/NOTES.md). Kuvat ovat
`evidence/k2-*.avif` (DSF 2).

Pohja on Jarin 30.10. päätös kaikissa suunnissa. Otsikon kuvake avaa
valitsimen, ja valinta kirjoitetaan `.open-habitat.yaml`:n `icon`-kenttään ja
commitoidaan heti. Commit koskee vain tätä tiedostoa, eikä siitä kysytä tai
ilmoiteta. Otsikon alla on *Ehdotus*-rivi, kun konffissa ei ole kuvaketta.
Hyväksyntä tapahtuu yhdellä klikkauksella. Kuvake vaihtuu otsikossa ja
sivupalkissa, rivi katoaa ja Git-sirun luku muuttuu. Muuta palautetta ei ole.

## Akseli ja suunnat (kierros 2)

Akseli on se, **missä ja missä muodossa ihminen sparraa mallin kanssa**.
Ehdotusten sisältö, viiveet ja virhetilat ovat kaikissa suunnissa samat.

1. **Sirut.** Koko sparraus tapahtuu rivillä. Rivillä on viisi sirua
   perusteluineen (*🪺 pesä agenteille*), vapaa toivekenttä ja pikatoiveet
   (*Leikkisämpi*, *Asiallisempi*, *Kirjaimet*, *Toisia*). Uusi vastaus
   korvaa sirut, ja aiempiin kierroksiin pääsee nuolilla (‹ 2/3 ›).
   Perustelut näkyvät aina, ja jokainen toive on yhden askeleen päässä.
   Hinta on se, että rivi vie kuvakkeettomalla repolla työpöydällä noin 200 pikseliä
   aloitussivun yläpuolelta, ja puhelimessa se täyttää lähes koko ensimmäisen
   näkymän.
2. **Keskustelu.** Rivi on yksi rivi, jossa on kolme kuvaketta ja painike
   *Sparraa…*. Painike avaa ankkuroidun keskustelun, joka on puhelimessa
   alapaneeli. Malli vastaa lauseella ja ruuduilla, ja ihminen vastaa sanoin.
   Koko keskustelu pysyy näkyvissä, joten minkä tahansa kierroksen
   ehdotuksen voi valita. Tällainen tarkennus (*kettu → tummempi*) on luontevin
   tässä muodossa. Hinta on se, että keskustelu on raskas muoto yhdestä
   kolmeen toiveeseen. Lisäksi otsikon valitsin ja keskustelu ovat kaksi
   erillistä paikkaa saman kuvakkeen valintaan.
3. **Valitsimessa.** Rivi on sama kuin Keskustelussa, mutta *Lisää
   ehdotuksia…* ja otsikon kuvake avaavat saman valitsimen. Valitsimen
   välilehdet ovat *Ehdotukset* (ruudut perusteluineen, toive, pikatoiveet ja
   kierrokset) ja *Valitse itse* (kierroksen 1 valitsin: automaattinen, logo,
   kirjaimet ja emoji). Kuvake valitaan siis aina yhdestä paikasta, ja rivi
   pysyy yhtenä rivinä. Hinta on se, että rivillä perustelut näkyvät vain
   työkaluvihjeinä ja sparraus vaatii yhden klikkauksen lisää.

Yhteistä kaikille:

- **Lataus.** Rivi näkyy heti. Siinä on luurankosirut ja teksti *Malli lukee
  README:n ja aloitussivun…* kolmen pisteen animaatiolla, joka on sama
  tuotannon `ah-title-dots` kuin otsikoinnissa. Kolmen sekunnin jälkeen
  näkyy sekuntilaskuri. Toivekenttään voi kirjoittaa odottaessa, mutta
  *Ehdota* on pois käytöstä, kunnes vastaus tulee. Uuden toiveen aikana
  edelliset ehdotukset näkyvät himmennettyinä.
- **Ei kirjautumista** (`model_unavailable`). Rivi kertoo: *Ehdotuksiin ei
  löytynyt mallia, johon on kirjautuminen. Kirjaudu mallipalveluun
  asetuksista.* Rivillä on linkki *Avaa asetukset*, ja ehdotukset tulevat
  ilman mallia: ketjun logo, kirjaintunnus ja kolme nimestä arvottua emojia.
  Nämä on merkitty katkoviivalla ja nimetty (*nimestä arvottu*).
  Toivekenttää ei näytetä, koska uusi toive ei auttaisi.
- **Aikakatkaisu** (`model_timeout`, 15 s). *Malli ei vastannut 15
  sekunnissa.* ja *Yritä uudelleen*. Aiemmat ehdotukset säilyvät, tai jos
  niitä ei ole, näytetään samat vaihtoehdot ilman mallia. Vastaus, josta ei
  saa kelvollista kuvaketta (`model_invalid_response`), näytetään samoin
  kuin aikakatkaisu. Otsikointi tekee samoin
  (`BrowserConversation.tsx:1752`).
- **Fallback.** Jos mitään ei valita, ketjun oletus jatkuu: logo tai
  nimestä johdettu tunnus. *Ei nyt* piilottaa rivin tämän käynnin ajaksi.
  *Automaattinen* valitsimessa on myös päätös ja piilottaa rivin.
- **Läpinäkyvyys.** Rivin alalaidassa lukee, mitä malli näkee (*nimi,
  README:n alku, aloitussivu, kielet (Go 58 %, TypeScript 36 %, Shell 4 %),
  logon polku*), ja kun vastaus on tullut, myös mallin tunniste.
- **Toiveet**, joihin simuloitu malli reagoi: sävy (leikkisämpi,
  asiallisempi), eläin (kettu, pöllö, siili…), väri, kirjaimet, logo, toisia
  ja mahdoton pyyntö (*lataa kuva netistä*). Mahdottomaan pyyntöön malli
  vastaa, että se voi ehdottaa vain emojia, 1–3 kirjainta tai repossa jo
  olevaa kuvaa. Malli ei ehdota muiden työtilojen kuvakkeita (🏠 📋 🎬 🪟 🧭).

## Suositus (kierros 2)

**Valitsimessa.**

- Kuvakkeen valinta pysyy yhdessä paikassa. Otsikon valitsin on jo
  toteutuksessa (`workspace-icon-setting`), ja ehdotukset tulevat siihen
  ensimmäiseksi välilehdeksi eikä uudeksi pinnaksi. Rivi on vain pikatie
  sinne ja yhden klikkauksen hyväksyntä.
- Rivi pysyy yhtenä rivinä. Kierroksella 1 huoleni oli, että kehote on
  melua repoille, joille ketjun oletus riittää. Sirut-suunnan 200 pikselin
  rivi pahentaisi sitä jokaisella kuvakkeettomalla repolla.
- Sparraus on lyhyt, yhdestä kolmeen toivetta. Siihen riittävät toivekenttä,
  pikatoiveet ja kierrosnuolet. Keskusteluhistoria toisi chat-pinnan, jolla
  ei ole muuta käyttöä. Tarkennus (*kettu, mutta tummempi*) toimii
  valitsimessakin, koska selain lähettää aiemmat kierrokset mallille joka
  kerta.
- Puhelimessa valitsin on jo alapaneeli, joten sparraukselle ei tarvita
  omaa paneelia.

Jos perustelujen pitää näkyä jo rivillä, Sirujen tiivis muoto (kolme sirua
perusteluineen, ei toivekenttää) on kompromissi. Sitä en rakentanut omaksi
suunnakseen.

## Faktat hostista: miten tuote ajaa pieniä mallitehtäviä nyt

- **Otsikointi** (`internal/daemon/title_linux.go:52` `generateTitle`) on
  malli, jota kannattaa seurata. Daemon ajaa ihmisen valitseman
  Pi-asennuksen Nodella `node --input-type=module -e title-helper.mjs`
  -apurin. Ympäristönä on vain `HOME`, `PATH` ja `USER`, ja aikaraja on
  15 sekuntia (`context.WithTimeout`). Syöte menee stdiniin (enintään
  4 KiB), ja stderr nielaistaan, koska palveluntarjoajan virheissä voi olla
  tunnuksia. Vastaus saa olla enintään 512 tavua JSONia. Virheet ovat
  kiinteitä koodeja (`model_unavailable`, `model_timeout`,
  `model_invalid_response`), eikä palveluntarjoajan tekstiä välitetä.
- **Apuri** (`internal/daemon/title-helper.mjs`) luo Pin oman
  `ModelRuntime`n (`allowModelNetwork: false`, rivi 20) ja käyttää Pin
  mallirekisteriä ja ihmisen omia kirjautumisia. Se kutsuu
  `completeSimple`:a ilman sessiota, extensioneita tai työkaluja
  (`toolChoice: 'none'`, `maxTokens: 256`), ja sen oma aikaraja on 12
  sekuntia (rivi 6), jotta se ehtii palauttaa varavastauksen.
- **Mallin valinta** (`internal/daemon/background-model.mjs:38`
  `backgroundModels`) on yhteinen otsikoinnille ja katsaukselle. Se valitsee
  palveluntarjoajan keskitason mallin (Sonnet, Luna, Flash, Medium, Mini)
  eikä koskaan Fable- tai Opus-luokkaa. Ilman keskustelua (työtilasivulla ei
  ole keskustelua) valitaan ensimmäisen kirjautuneen palveluntarjoajan
  keskitaso. Apuri saa käytännön data-URL:na
  (`background_model_linux.go`). **Varoitus:** otsikkoapuri ei lataa
  `pi-claude-bridge`ä (`background-model.mjs:53`). Jos ihmisellä on vain
  Claude-tilaus sillan kautta, sama polku antaa `model_unavailable`.
  Ehdotus näyttää silloin ei kirjautumista -tilan, ellei toteutus lataa
  siltaa. Katsaus lataa sen (`recap_linux.go:29`).
- **Katsaus** (`recap-extension.mjs`) ajetaan käynnissä olevan Pin sisällä
  extensionina keskustelun RPC:n kautta. Se ei sovi työtilasivulle, koska
  siellä ei ole keskustelua eikä Pitä.
- **Viive.** Katsauksen Sonnet sillan kautta 16k tokenin otteella kesti
  Birchn mittauksessa 3–11 sekuntia (kommentti, `recap-extension.mjs:86`).
  Ehdotuksen syöte on noin 1–2 KiB ja vastaus noin 200 tokenia, joten
  suoralla API-kirjautumisella arvioin 1,5–3 sekuntia. **En mitannut sitä.**
  Prototyyppi käyttää 2,6 sekuntia ensimmäiseen ja 1,7–2,6 sekuntia
  seuraaviin vastauksiin. Sillan kautta jokainen kutsu käynnistää
  Claude Code -prosessin ja kestää selvästi kauemmin.
- **Virhetekstit** seuraavat nykyisiä: otsikoinnin
  (`web/src/app/BrowserConversation.tsx:1752`) ja katsauksen *ei löytynyt
  mallia, johon on kirjautuminen* (`web/src/components/RecapCard.tsx:47`).
- **Repon lukeminen.** `internal/daemon/start_page_linux.go:108`
  `readStartPageFile` lukee työtilan avatusta hakemistokahvasta
  `os.OpenRoot`illa, joten polku pysyy työtilan sisällä. README ja
  aloitussivu luetaan samalla tavalla. `WorkspaceStartPage`
  (`start_page_linux.go:53`) on jo `ConversationController`in käsittelijä,
  ja työtilan käsittelijä saa saman ohjaimen
  (`workspace_manage_linux.go:189`). Ehdotus-endpoint sopii samaan paikkaan.

## Palvelinluonnos (ei toteutettu)

```
POST /api/v1/workspaces/{id}/icon-suggestions          (CSRF, trusted, kuten regenerateTitle)
{ "schema_version": 1, "wish": "leikkisämpi",
  "history": [ { "wish": "", "icons": ["🪺","🏡","🐚","OH"] } ] }      // enintään 3 kierrosta, toive ≤ 200 merkkiä
→ { "schema_version": 1, "state": "done", "model": "anthropic/…",
    "reply": "Leikkisämpiä, samasta aiheesta:",
    "suggestions": [ { "icon": "🦦", "why": "pitää kotinsa järjestyksessä" }, … ] }
→ { "schema_version": 1, "state": "failed", "reason": "model_unavailable" | "model_timeout" | "model_invalid_response" }
```

1. Daemon kokoaa faktat työtilan avatusta kahvasta `os.OpenRoot`illa:
   nimen, `README.md`:n ensimmäiset 2 KiB, aloitussivun otsikon ja
   ensimmäisen kappaleen (`readStartPageFile`) ja kielijakauman. Jakauma
   lasketaan `git ls-files -z` -tiedostopäätteistä rajattuna ja
   aikarajalla, ja ilman Gitiä hakemistolistauksesta. Lisäksi daemon antaa
   ketjun lukijan löytämät logopolut ja muiden työtilojen kuvakkeet, jotta
   malli ei toista niitä. Syöte on enintään 4 KiB, kuten otsikoinnissa.
2. `icon-helper.mjs` on `title-helper.mjs`:n sisar. Siinä on sama runtime,
   sama `backgroundModels(available, undefined)`, 12 sekunnin oma aikaraja,
   `maxTokens` noin 400 ja `toolChoice: 'none'`. Ohje käskee käsitellä
   README-tekstiä datana. Daemonin aikaraja on 15 sekuntia.
3. Daemon tarkistaa jokaisen ehdotuksen Go:lla. Ehdotus kelpaa, jos se on
   yksi graafeemiklusteri, jossa on `Extended_Pictographic`-merkki eikä
   ohjausmerkkejä, tai `^[A-Z0-9ÅÄÖ]{1,3}$`, tai täsmälleen yksi löydetyistä
   logopoluista. `why` on enintään 40 merkkiä ja `reply` enintään 200.
   Kaksoiskappaleet ja muiden työtilojen kuvakkeet poistetaan. Jos yhtään ei
   jää, vastaus on `model_invalid_response`. Repon teksti voi siis yrittää
   ohjata mallia, mutta pahin seuraus on huono emoji.
4. Mitään ei tallenneta. Keskustelu elää sivun tilassa selaimessa ja katoaa,
   kun sivulta poistutaan. Välimuistia tai varastoa ei ole.
5. Hyväksyntä käyttää `workspace-icon-setting`in kirjoitus- ja
   commit-polkua. Uutta kirjoitusta ei tule.

**Auktoriteetti ei muutu.** Daemon ajaa apurin käyttäjänä ja käyttäjän
omilla Pi-kirjautumisilla, kuten otsikoinnissa. Gateway, daemon ja provision
pysyvät ennallaan, eikä uutta palveluntarjoajan asiakasta tule.

## Päätökset myöhempää tarkastelua varten (kierros 2)

- **Ehdotukset pyydetään automaattisesti**, kun rivi tulee näkyviin, kerran
  käyntiä kohden. Vaihtoehto oli pyytää vasta painikkeesta (*Ehdota
  mallilla*). Valitsin automaattisen pyynnön, koska Jarin päätöksen mukaan
  rivi ehdottaa ja yksi pyyntö on pieni (noin 1–2 KiB sisään ja 200 tokenia
  ulos keskitason mallilla). Jos 17 repon käynnit tuntuvat tuhlaukselta,
  painike on helppo palauttaa.
- **Ehdotuksia ei tallenneta** (ei välimuistia). Seuraus on, että uusi
  käynti tuottaa uudet ehdotukset. Vaihtoehto oli tallentaa ne
  `.agent-host/`-hakemistoon. En tallentanut niitä, koska repon periaate
  kieltää spekulatiiviset välimuistit eikä vaihtuvuudesta ole haittaa.
- **Malli valitaan ilman keskustelua** jaetulla taustamallikäytännöllä.
  Katsauksen asetuksissa ihmisen valitsemaa mallia ei käytetä. Vaihtoehto
  oli käyttää samaa `preferred`-arvoa kuin katsaus. Valitsin otsikoinnin
  polun, koska tehtävä on yhtä pieni.
- **Malli näkee** nimen, README:n alun, aloitussivun, kielijakauman,
  logopolut ja muiden työtilojen kuvakkeet. Rivi kertoo tämän (muiden
  kuvakkeita lukuun ottamatta). Vaihtoehtona oli antaa lisäksi
  tiedostopuu. En antanut sitä, koska puu ei kerro aiheesta juuri mitään
  uutta ja kasvattaa syötettä.
- **Mallin tunniste näytetään** rivin alalaidassa. Vaihtoehto oli jättää se
  pois, kuten otsikoinnissa. Näytin sen, koska ihminen voi ihmetellä, minkä
  palvelun tunnuksilla repon README luettiin.
- **Ilman kirjautumista** rivi näkyy silti, ja siinä on syy, linkki
  asetuksiin ja vaihtoehdot ilman mallia. Vaihtoehto oli piilottaa rivi.
  Näytin sen, koska muuten ominaisuus vain puuttuisi selittämättä.
- **Hyväksyntä on hiljainen.** Otsikon kuvakkeessa on 180 ms:n
  ilmestymisanimaatio, mutta ilmoitusta ei ole. Git-sirun ↑-luku kertoo
  commitista kysyttäessä.
- **Pikatoiveet** ovat *Leikkisämpi*, *Asiallisempi*, *Kirjaimet* ja
  *Toisia*. Ne on valittu tavallisimmista suunnista. Väri ja eläin jäävät
  vapaaseen kenttään.

## Kysymykset Jarille (kierros 2)

1. Mikä suunta: Sirut, Keskustelu vai Valitsimessa? Suosittelen
   Valitsimessa.
2. Palaako rivi jokaisella käynnillä repoon, joka jätettiin ketjun
   oletukselle (*Ei nyt* tai *Automaattinen*)? Pysyvä *ei kiitos* vaatisi
   konffiin arvon, esimerkiksi `icon: auto`, joka tarkoittaa ketjua ilman
   ehdotusta. Silloin litteä `icon`-muoto saisi neljännen arvon.
   Prototyypissä piilotus kestää vain käynnin.
3. Ladataanko `pi-claude-bridge` ehdotusapuriin, jotta pelkällä
   Claude-tilauksella saa ehdotuksia? Silta käynnistää prosessin jokaista
   kutsua kohden, joten vastaus tulee hitaammin.

## Rakentaminen ja tarkistus (kierros 2)

- `node issues/proto-workspace-icon-setting/prototypes/ehdotus-sparraus/build.mjs`.
- `check.mjs` käy kaikki kolme suuntaa läpi vaaleana ja tummana
  työpöydällä ja puhelimessa. Se tarkistaa latauksen, ensimmäiset
  ehdotukset, toiveen ja hyväksynnän. Hyväksynnän jälkeen rivin pitää
  kadota ja otsikon vaihtua, ilmoitusta ei saa tulla, ja Git-tasolla pitää
  näkyä commit. Lisäksi se käy läpi tilat ei kirjautumista (ei
  toivekenttää), aikakatkaisu, hidas, hakemisto ilman Gitiä (ei Git-sirua)
  ja asetettu kuvake (ei riviä). Viiveet ajetaan nopeutettuna
  (`speed=0.2`). 30.10. se otti 42 kuvaa, eikä konsolissa ollut virheitä:
  `PLAYWRIGHT_BROWSERS_PATH=~/.cache/ms-playwright NODE_PATH=~/src/open-habitat/web/node_modules node check.mjs <hakemisto>`.
  `evidence/k2-*`-tiedostoiksi tallennettiin 22 kuvaa niistä.
- Tuotantokoodia ei muutettu.

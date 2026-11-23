# Toteutus: C2a kokeellisena ominaisuutena (23.11.2026)

Toteutus `d0f4ab3d7`: `workspace-header-c2a` on oletuksena pois.
Asetusten Kokeelliset ominaisuudet -kortti kytkee päälle valitun C2a:n:
Kuvake, Nimi ja Ääni ovat yläosa, toiminnot niiden oikealla puolella.
Puhelimessa nimi on ylhäällä, kaksi muuta laattaa sen alla ja toiminnot
viimeisenä rivinä. Pois palauttaa aiemman otsikon ja erillisen nauhan.

Toimintojen käsittelijät ja sallittavuus säilyivät. Uusi worktree säilyttää
sanansa työpöydällä; puhelimen ikonilla on sama saavutettava nimi ja vihje,
jotka sanovat **Uusi worktree-agentti**. Explain käyttää vanhoja kortteja,
myös T07:ää. Kopiointi on polun vieressä, ja Arkistoi/Palauta vaihtaa tekoa
ilman painettu-tilaa C2a:ssa. Pienten painikkeiden hyväksytyt säännöt ovat
`design-system/design.md`:n Painikkeet-kohdassa.

## Tarkistus

Tarkistettu toteutus on yllä nimetty commit; myöhempi tuloskirjaus ei muuta
ajettavaa koodia. Kaikki alla olevat tarkistukset menivät läpi:

- `./scripts/test-focused.sh --area web`: Biome, TypeScript ja **2197 testiä,
  260 tiedostoa**.
- `OH_BROWSER_WORKERS=2 OH_PORT_BASE=15200 ./scripts/test-focused.sh --area browser`
  ja kuusi `--spec`-valintaa: `lab-workspace-header-c2a.spec.ts`,
  `lab-workspace-page.spec.ts`, `lab-explain-mode.spec.ts`,
  `lab-explain-coverage.spec.ts`, `lab-explain-follow.spec.ts`,
  `settings-experimental.spec.ts`: **48 lab-testiä ja 4 asetustestiä**.
- Muutetut ja lisätyt specit lisäksi `npx playwright test --repeat-each 3`:
  `--config playwright.lab.config.ts tests/lab-workspace-header-c2a.spec.ts`
  sekä `tests/settings-experimental.spec.ts`, kaksi workeriä ja 0–60 ms
  vastausviive: **12 + 12 läpi**. Molemmat ajoivat uuden tuotantobuildin.
- `python3 scripts/generate-ui-reference.py --check`,
  `python3 scripts/validate-project-view.py`, `issuectl doctor --json` ja
  `git diff --check`.

Uusi spec kokeilee oletuksena pois, päälle ja takaisin pois, sekä
nimenmuutoksen säilymisen vaihdossa. Se mittaa asettelun 1280/390-leveyksillä
suomeksi ja englanniksi, testaa puhelimen 44 px osuma-alueen selaimen
osumatestauksella, poiston erottavan välin, vihjeet myös estetyllä
GitHub-painikkeella, saavutettavuuden, pitkän äänen nimen rajauksen,
Explain-kortit, poistoikkunan sulkemisen ja fokuksen sekä molemmat
keskustelun aloitusreitit. Nimenmuutoksen testissä seurataan hostin palauttamaa
työtilan tunnistetta eikä oleteta vanhan reitin pysyvän voimassa.

Kuvat ja rinnakkaiset staattiset HTML:t (synteettinen ympäristö, ei repossa):
`/var/tmp/agent-keep/workspace-header-c2a/`. Nimet ovat
`fi-FI|en-US-1280|390-off|on|on-dark|on-contrast|explain`;
`*-1280-explain-1440` näyttää T07:n 1440 px leveydellä.
Samassa hakemistossa `web-final.log`, `browser-final.log`,
`browser-repeat.log` ja `issue-doctor.json`. Kuvat katsottiin: laattojen ja
painikkeiden asettelu, Päivä/Yö/Korkea kontrasti sekä T07 suomeksi ja
englanniksi työpöydällä ja puhelimessa. Englannin UK-teksti käyttää tässä
samaa katalogitekstiä; erillistä UK-selainajoa ei tehty.

Näyttö on host-backed synteettinen selainnäyttö, ei asennetun palvelimen,
erillisten Unix-käyttäjien tai oikean Pi-palveluntarjoajan hyväksyntä.
Koko selaintestistöä, clean gatea tai käyttöönottoa ei ajettu; ne eivät olleet
tämän rajatun käyttöliittymämuutoksen worker-tarkistuksia.

## Katselmointi

Rajattu oma diff-katselmointi: oletushaaran säilyminen, samat callbackit ja
estoedellytykset, pysyvät Explain-tunnisteet, lomakkeen/h1:n rakenne,
fokuksen palautus vasta DOM-commitissa, tooltipit, osuma-alueet ja
käännökset. Pitkä äänen nimi rajattiin, ettei se valu toimintojen päälle.
Ei istunto-, sopimus-, daemonin tilakone- tai valtuutusmuutoksia, joten
erillistä mallikatselmointia ei tarvittu. Yhteisen ControlButtonin lisäys on
valinnainen tooltip myös tekstille, joka muuttuu kapealla ikoniksi;
vanhat kutsut eivät muuta käytöstään.

Ohjeviitteiden generointi löysi myös aiemman active-device-äänimuutoksen
vanhentuneet viitteet. Ne päivitettiin erillisessä commitissa `a10d85d7b`;
äänen ajettava koodi ei muuttunut tässä työssä.

## Decisions for later review

- **Pitkä äänen nimi ja oletusliite rajautuvat ellipsiin**, saavutettava nimi
  ja valitsin kertovat koko valinnan. Vaihtoehto oli leventää laattaa tai
  kasvattaa sen korkeutta; C2a:n kiinteä rytmi säilytettiin.
- **Englannin New conversation saa rivittyä 390 px:ssä.** Vaihtoehto oli
  lyhentää se New chatiksi tai piilottaa sana; nykyinen termi säilyy eikä
  worktree-ikonin koko kutistu.
- **Polun kopiointi käyttää olemassa olevaa inline-roolia**, ei prototyypin
  omaa kiinteää minipainiketta. Näin koko ja vihje tulevat tuotantoprimitiivistä;
  toimintoryhmän pienet painikkeet seuraavat hyväksyttyä 40/44 px sääntöä.

## Live check

Odottaa käyttöönottoa ja käyttäjän kokeilua, ei tehty tässä workerissa:

1. Asetukset › Kokeelliset ominaisuudet › Työtilan yläosa: laatat ja painikkeet
   päälle. Avaa työtila työpöydällä ja puhelimella.
2. Muuta nimeä, avaa kuvake- ja äänivalitsin, kokeile polun kopiointia.
3. Kokeile toimintojen vihjeitä ja ?-tilan Uusi worktree-agentti -korttia;
   avaa uusi worktree-agentti. Poisto avaa vahvistuksen, ei poista suoraan.
4. Kytke kokeilu pois: vanha yläosa palaa ja työtilan asetukset säilyvät.

---

# Tulos, kierros 3: C2:n toimintoryhmä ja pienet painikkeet (23.11.)

Kierros `design-system/prototypes/rounds/2026-11-23-workspace-page-header-3/`
(rakennus ja tarkistus sen `NOTES.md`:ssä). Jarin 23.11. päätöksen mukaan
C2 Toiminnot sivulla jatkoon: GitHub, Arkistoi ja Poista ovat nyt pieniä
painikkeita (toissijaisen painikkeen pinta ja reuna, ei tekstiä), ryhmää
kokeillaan myös toisella puolella, ja **Pienet painikkeet** -paneeli
näyttää ehdotetut säännöt ja tilat Päivä- ja Yö-teemassa. Tuotannon
tokenit ja komponentit (`ControlButton` vihjeineen, `QuickTooltip`,
`DisabledTooltipTrigger`), työpöytä 1280 ja puhelin 390. Sivu toimii
Habitat-näkymänä: ei iframeja, ei navigointia, ei verkkoa (tarkistettu).
Tuotantokoodi ei muuttunut. `check.mjs`: 578 tarkistusta läpi, konsoli
puhdas.

Kuvat (DPR 2), ei repossa: `/var/tmp/agent-keep/workspace-page-header-round-3/`
(`v<n>-<suunta>-<tilanne>-<leveys>-<teema>.png`; `vihje`, `fokus`,
`eiorigin`, `lukittu`, `saannot`, `saannot-tilat`; `heights.json`).

| Suunta | Mitä se päättää | 1280 px | 390 px |
|---|---|---|---|
| **C2a Oikealla** | Ryhmä laattojen oikealla: Uusi keskustelu ja Uusi worktree sanoin, kolme pientä painiketta alla, Poista oikeassa reunassa erillään. Puhelimessa Uusi keskustelu vasemmalla, pienet (myös worktree) oikealla. | 134 | 240 |
| **C2b Vasemmalla** | Sama ryhmä ennen Kuvaketta. Puhelimessa peilattu: pienet vasemmalla (Poista reunimmaisena), Uusi keskustelu oikeassa reunassa. | 134 | 240 |
| **C2c Yksi ryhmä** | Vain Uusi keskustelu sanoin; Uusi worktree, GitHub, Arkistoi ja Poista pieninä yhdellä rivillä sen alla. Puhelimessa Uusi keskustelu venyy rivin leveyteen. | 134 | 240 |

## Ehdotetut pienten painikkeiden säännöt

1. **Koko roolista**: rivin painike, työpöydällä 32 × 32 (ikoni 16),
   puhelimessa 40 × 40 (nykyinen token) ja näkymätön osuma-alue 44 × 44;
   väli `--ah-control-gap` (6 px), joten osumat ja fokusrenkaat eivät mene
   päällekkäin (tarkistettu: piste 1 px napin ulkopuolella osuu nappiin).
2. **Näyttää painikkeelta**: sanoin nimettyjen vieressä pienellä
   painikkeella on toissijaisen pinta ja reuna; pelkkä ikoni ilman pintaa
   vain rivien ja kenttien sisällä (Kopioi polku).
3. **Nimi ja vihje**: `aria-label` on teko ja kohde; vihje hoverista ja
   näppäimistöfokuksesta sanoo saman tai yhden rivin enemmän (Arkistoi).
   Kosketuksessa ei vihjettä, joten puhelimessa ikonin pitää olla tuttu.
4. **Estetty kertoo syyn**: pysyy paikallaan, saa fokuksen, vihje kertoo
   syyn (Ei GitHub-originia, Muutokset estetty).
5. **Ryhmä ja järjestys**: yksi `role=group`; päätoiminto ensin, sitten
   luo, avaa muualla, piilota, viimeisenä Poista vähintään 12 px erillään,
   punainen ikoni toissijaisella pinnalla.
6. **Vaihtava painike** (Arkistoi/Palauta) vaihtaa nimeä ja ikonia ilman
   `aria-pressed`ia.
7. **Tilat** ovat tuotannon tiloja (hover ja painettu sävyinä, fokus 2 px
   rengas, Korkea kontrasti mustereuna).

## Suositus: C2a Oikealla

Otsikko luetaan ensin ja toiminnot sen jälkeen, sekä silmällä että
ruudunlukijalla. Uusi worktree pitää sanansa työpöydällä, ja Poista on
kauimpana päätoiminnosta. C2b laittaa toiminnot sivun ensimmäiseksi
asiaksi ennen otsikkoa ja vie katseen pois laatoista; sen puhelimen
peilaus (päätoiminto peukalon alla oikealla) on silti kokeilemisen arvoinen
erikseen. C2c on siistein, mutta worktree-ikoni ei ole tuttu ilman sanaa,
mikä rikkoo säännön 3 puhelimessa.

## Decisions for later review (kierros 3)

- **"Kolme muuta toimintoa" = GitHub, Arkistoi ja Poista**, eli ne, jotka
  C2:ssa olivat pintoja vailla olevia ikoneita. Vaihtoehto olisi ollut
  lukea se laatoiksi; laatat valittiin kahdesti, joten ne pysyivät.
- **Pienet painikkeet ovat `secondary`-pinnalla**, eivät `quiet`.
  Vaihtoehto oli pitää tuotannon hiljaiset ikonit. Jarin pyyntö oli tehdä
  niistä painikkeita, ja pinta on se, mikä sen näyttää.
- **Poisto on toissijainen pinta punaisella ikonilla**, ei `danger-subtle`
  -täyttö. Täysi punainen säästyy vahvistukseen, ja ryhmä pysyy yhtenäisenä.
- **Arkistoi/Palauta ilman `aria-pressed`ia.** Tuotanto käyttää nyt sekä
  nimen vaihtoa että `aria-pressed`ia, jolloin ruudunlukija sanoo
  "Palauta työtila, painettu". Toteutuksessa korjattava.
- **Puhelimessa Uusi worktree on pieni painike kaikissa suunnissa**, kuten
  kierroksilla 1–2; sana ei mahdu riville.
- **Osuma-alue toteutetaan näkymättömällä `::after`-alueella**, ei
  kasvattamalla nappia 44 px:iin. Vaihtoehto oli `--ah-control-row` 44 px
  puhelimessa, mikä kasvattaisi kaikki rivit; 40 px näkyvä + 44 osuma
  pitää nykyisen rytmin.
- **C2b:n DOM-järjestys on sama kuin näkyvä** (toiminnot ennen h1:tä),
  jotta fokus kulkee näkyvässä järjestyksessä; tämä on C2b:n hinta.
- **Puhelinasettelu ei näy työpöydän Habitat-näkymässä**, koska iframeja ei
  voi käyttää; se näkyy kapeassa ikkunassa tai puhelimella, ja
  sääntöpaneeli näyttää puhelinkoon staattisesti.

## Kysymys Jarille

C2a vai C2c? Ratkaisee, saako Uusi worktree pitää sanansa työpöydällä
(C2a) vai riittääkö ikoni vihjeen kanssa (C2c, kapeampi ryhmä). Ja:
hyväksytäänkö pienten painikkeiden säännöt yleisiksi (design-systemiin)?

---

# Tulos, kierros 2: C:n muunnelmat (23.11.)

Kierros `design-system/prototypes/rounds/2026-11-23-workspace-page-header-2/`
(rakennus ja tarkistus sen `NOTES.md`:ssä). Jarin 23.11. päätöksen mukaan
vain C Laattojen muunnelmia: kolme valitsimen takana, yksi rivi kustakin
sivun yläreunassa ja suositus niiden alla. Tuotannon tokenit ja komponentit,
työpöytä 1280 ja puhelin 390, Päivä, Yö ja Korkea kontrasti. Tuotantokoodi
ei muuttunut. Tarkistus `check.mjs`: 245 tarkistusta läpi, konsoli puhdas.

Kuvat (DPR 2), ei repossa: `/var/tmp/agent-keep/workspace-page-header-round-2/`
(`v<n>-<muunnelma>-<tilanne>-<leveys>-<teema>.png`, `heights.json`).

| Muunnelma | Mitä se muuttaa C:stä | 1280 px | 390 px |
|---|---|---|---|
| **C1 Matala** | Laatat 88 px, Kuvakkeen ja Äänen kuva arvonsa vieressä; toiminnot rivinä alla. | 142 | 220 |
| **C2 Toiminnot sivulla** | Laatat ennallaan (120 px), toiminnot sarakkeena laattojen oikealla puolella; yläosa on yksi kaista. | 134 | 240 |
| **C3 Sanat näkyvissä** | Nimi 30 px ja lihavampi, ja jokainen laatta sanoo tekonsa (Vaihda, Muokkaa). | 174 | 238 |

Korkeus on otsikkoalue sivun sisältöön asti (kierroksen 1 C: 174 / 232).

## Suositus: C2 Toiminnot sivulla

C2 pitää laatat sellaisina kuin ne valittiin, eikä kuva pienene
tunnistamattomaksi kuten C1:ssä. Silti se on kolmesta matalin, koska
toimintorivi poistuu laattojen alta. Puhelimessa C2 on sama
kuin kierroksen 1 C (toiminnot rivinä laattojen alla), joten sen etu näkyy
vain työpöydällä. Pitkä nimi mahtuu kahdelle riville kapeampaan Nimen
laattaan.

C1 on hyvä, jos tiheys painaa enemmän kuin kuvan koko. C3:n sanat voi
lisätä C2:een erikseen, jos Jari kokee, ettei laattojen muokattavuus näy
ilman hoveria; tämän kierroksen perusteella nimetyt laatat (Kuvake, Nimi,
Ääni) riittävät ilman niitäkin.

## Decisions for later review (kierros 2)

- **C2:n siivoustoiminnot ovat sarakkeen alarivillä** Uuden keskustelun ja
  Uuden worktreen alla. Vaihtoehto oli ne Nimen laatan oikeassa
  yläkulmassa. Valitsin sarakkeen, koska silloin kaikki toiminnot ovat
  yhdessä ryhmässä eikä Nimen laatta saa ylimääräisiä painikkeita.
- **C1:n laatat ovat 88 px eivätkä 80 px.** Nimen laattaan pitää mahtua
  nimike, h1 ja polku; 80 px:ssä polku leikkautuisi.
- **C3:n Muokkaa on oma painike**, Kuvakkeen ja Äänen Vaihda on osa laatan
  painiketta. Nimi muuttuu jo h1:stä klikkaamalla, joten Muokkaa on toinen
  reitti samaan; Kuvakkeen ja Äänen koko laatta on jo painike.
- **Arkistoitu-merkintä on kaikissa muunnelmissa laattojen alla omalla
  rivillään**, ei toimintorivillä, jotta C2:ssa ja C1:ssä se on samassa
  paikassa.

## Kysymys Jarille

C2 vai C1? Ratkaisee, kumpi painaa enemmän: laattojen kuvan koko (C2) vai
yläosan tiheys myös puhelimessa (C1).

---

# Tulos: työtilan sivun yläosa, yksi kierros

Kierros `design-system/prototypes/rounds/2026-11-22-workspace-page-header/`
(rakennus ja tarkistus sen `NOTES.md`:ssä). Kolme suuntaa valitsimen takana,
yksi rivi kustakin sivun yläreunassa ja suositus niiden alla. Tuotannon
tokenit ja komponentit (`AppShell`, sivupalkki, `WorkspaceIcon`,
`WorkspaceIconPicker`, `SoundEmblem`, `ControlButton`), työpöytä ja puhelin,
Päivä, Yö ja Korkea kontrasti. Tuotantokoodi ei muuttunut.

Kuvat (DPR 2), ei repossa:

- nykytila labista: `/var/tmp/agent-keep/workspace-page-header-round/current/`
  (`current-1280-light.png`, `current-390-light.png` ja koko sivut);
- kierros: `/var/tmp/agent-keep/workspace-page-header-round/round/`
  (`v<n>-<suunta>-<tilanne>-<leveys>-<teema>.png`, `heights.json`).

## Lähtötilanne

Labissa (attention-sound päällä) yläosa on kaksi kerrosta: otsikko
(kuvake, nimi, polku ja kuusi ikonitoimintoa) ja sen alla nauha, jossa
on kolme 128 px:n laattaa. Kuvake ja nimi näkyvät kahdesti, puhelimessa
nimi kolmesti, kun mukaan lasketaan yläpalkki. Otsikkoalue vie
kuvakaappauksesta mitattuna noin 220 px työpöydällä ja noin 240 px
puhelimella ennen sivun sisältöä. Uusi keskustelu on nimetön plus-ikoni.

## Akseli ja suunnat

Akseli: **missä työtilan tunnistetiedot näkyvät ja muuttuvat.**
Sisältö on sama kaikissa suunnissa. Otsikkoalueen korkeus sisältöön
asti (`heights.json`):

| Suunta | Mitä se päättää | 1280 px | 390 px |
|---|---|---|---|
| **A Otsikko** | Otsikko on editori. Kuvake on tuotannon kuvakevalitsimen painike kynämerkkeineen, nimi muuttuu paikallaan otsikosta, kopiointi on polun vieressä ja Ääni on siru polun rivillä. Laatat poistuvat. | 74 | 150 |
| **B Asetusrivi** | Otsikko ja toiminnot ovat kuten nyt, ja otsikon kuvake on pelkkä kuva. Laattojen tilalla on yksi 40 px:n rivi kolmea nimettyä sirua (Kuvake, Nimi, Ääni). Nimi-siru muuttaa otsikon kentäksi. | 112 | 196 |
| **C Laatat** | Laatat ovat otsikko. Nimen laatassa on h1 ja polku kopiointeineen, ja Kuvake ja Ääni ovat sen vierellä. Toiminnot ovat laattojen alla: Uusi keskustelu ja Uusi worktree sanoin, arkistointi, GitHub ja poisto ikoneina oikealla. Puhelimessa Nimi on omalla rivillään ja Kuvake ja Ääni puolikkaina (64 px). | 174 | 232 |

Kaikissa suunnissa nimi on sivulla kerran (h1), ja nimi muokataan
paikallaan (Jarin 21.11. valinta B Paikallaan): Enter ja muualle klikkaus
tallentavat, Esc peruu ja tyhjä nimi palauttaa kansion nimen. Kuvake avaa
tuotannon editorin, ja valinta päivittyy otsikkoon ja sivupalkkiin.
Ääni avaa ponnahduksen, joka pysyy näkymän sisällä.

## Suositus: C Laatat

C pitää 21.11. valitut laatat, niiden nimetyt sanat ja paikallaan
muokattavan nimen, joten opittu paikka ei muutu. Kaksoisotsikko poistuu,
koska Nimen laatta on itse otsikko. Uusi keskustelu saa sanan, ja
harvinaiset siivoustoiminnot väistyvät oikealle. C on kolmesta korkein,
mutta silti noin 45 px matalampi kuin nykyinen yläosa.

A on matalin ja siistein. Siinä kuitenkin jokainen muutettava asia on
nimeämätön (kynämerkki, klikattava otsikko, siru), ja se on juuri se
löydettävyys, jota laatat korjasivat. B on kompromissi, joka jättää
kaksoisnäkymän (kuva otsikossa, sama kuva sirussa).

## Mitä näkymä olettaa hostilta

Ei mitään uutta. Samat tiedot kuin nyt: näyttönimi ja kansio, kuvakeketju
(`icon`, `icon_auto`, logo), ääniasetus, `git_summary.github_repo`,
`visibility` sekä toimintojen sallittuus (`mutation_state`, csrf).

## Decisions for later review

- **Uusi worktree näkyy C:ssä sanoin työpöydällä ja ikonina puhelimessa.**
  Vaihtoehdot olivat sana kummassakin (rivi ei mahdu 390 px:iin) tai ikoni
  kummassakin. Valitsin näin, koska työpöydällä on tilaa ja nimetty toiminto
  on selkeämpi; puhelimella sana katkaisisi rivin kahtia.
- **Kopioi polku siirtyi A:ssa ja C:ssä polun viereen** pois toimintoriviltä.
  Toinen vaihtoehto oli pitää se toimintorivillä. Valitsin näin, koska
  kopiointi koskee polkua, ja polun vieressä on selvää, mitä kopioidaan.
- **B:n Nimi-siru näyttää arvona "Kansion nimi" tai "Oma"** eikä nimeä
  uudestaan. Vaihtoehto oli nimi itse, mutta se toistaisi otsikon.
- **Äänen ponnahdus on kierroksessa lyhyt lista.** Tuotannon valitsin
  (kortit, ▶, Valmis) on päätetty eikä kuulu tähän akseliin, joten se
  pysyy ennallaan.
- **B:n sirut näyttävät puhelimessa vain ikonin ja arvon**, ilman sanaa.
  Vaihtoehto oli sana kahdella rivillä. Valitsin näin, koska tällä
  tavalla kolme sirua mahtuu kahdelle riville.

## Kysymykset Jarille

1. C vai A? Ratkaiseva kysymys on, painaako laattojen löydettävyys
   enemmän kuin otsikon matala korkeus.
2. Saako Uusi keskustelu C:n tapaan sanan myös silloin, kun valittu suunta
   on A tai B?

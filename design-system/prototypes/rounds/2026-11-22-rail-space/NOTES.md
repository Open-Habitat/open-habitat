# Sivupalkki läppärin näytöllä – minne kiinteät kohteet menevät

Akseli: **minne sivupalkin kiinteät kohteet (Etusivu, Tuotokset, Oma selain,
Agentin käytössä ja haku) siirtyvät**, jotta keskustelut ja työtilat saavat
tilan. Luku on keskustelu- ja työtilarivit, jotka näkyvät kokonaan
1280 × 720 -ikkunassa tavallisessa arjessa (4 / 2 / 12, 18 työtilaa).

- **A Tiivis** (9 riviä): kiinteät kohteet ja haku yhdellä kuvakerivillä
  palvelimen nimen alla. Tuotoksilla on määrämerkki ja selaimella tilapiste.
  Työtilojen suodatin näkyy vasta yli 12 työtilalla, Päivitä on Työtilat-otsikossa.
- **B Muualle** (11 riviä, suositus): sivupalkissa ovat vain keskustelut ja
  työtilat. Etusivu on palvelimen nimi, ja haku on kuvake otsikkorivillä (⌘K).
  Tuotokset, Agentin käytössä ja Oma selain ovat henkilövalikossa, ja selain on
  lisäksi keskustelun sirussa. Työtilojen suodatin aukeaa otsikon
  suurennuslasista.
- **C Yksi vieritys** (6 riviä): koko sivupalkki vierii yhtenä listana. Sen
  ensimmäinen ryhmä on kiinteät kohteet neljänä taitettavana ruutuna. Haku ja
  osioiden otsikot jäävät yläreunaan.
- **Nyt** (4 riviä): tuotannon sivupalkki vertailuksi.

Issue `rail-space-small-screens`. Mittaukset, sijoitustaulukot, suositus ja
kysymykset ovat issuen `result.md`:ssä. Sivun yläpalkki kertoo valitun suunnan
sijoitukset kohde kohteelta.

Sivu on tuotannon kehys: `AppShell`, `WorkspaceRail`, `NowSections`,
`QuietSection`, `WorkspaceNavRow`, `WorkspaceActions`, `SearchDoor`,
`BrowserRailRow`, `AccountShelf` ja tuotannon `Menu`, sekä avoin keskustelu
`ConversationFrame`, `AgentHeader`, `ConversationTimeline`, `BrowserChip`
ja `Composer`. Hiljaiset taittuu itsestään ahtaassa sivupalkissa kuten
tuotannossa. C:ssä se alkaa taitettuna, koska siinä ei ole alueita, joiden
ahtautta mitata. Kierroksen omia osia ovat A:n kuvakerivi (`Dock`), B:n
otsikkorivin haku ja henkilövalikon uudet kohdat (`PersonMenuB`), C:n
ruuturyhmä (`Group`) ja yhden vierityksen CSS, Työtilat-otsikon Päivitä- ja
suodatinkuvakkeet (`HeadTools`, portaalina tuotannon otsikkoon) sekä ilmoitus
siitä, mitä painallus avaisi. Tuotannossa Tuotokset ja Oma selain käyttävät
samaa maapallokuvaketta. Kierroksen Tuotokset saa linkkikuvakkeen, koska
pelkkinä kuvakkeina ne erottuisivat vain työkaluvihjeestä.

Katselmoinnin palkissa valitaan tilanne (tavallinen arki, kuvakaappauksen
kaltainen 3 / 0 / 5 ja 6 työtilaa, ruuhka 6 / 4 / 30 ja 40 työtilaa),
ikkuna (1280 × 720, 1440 × 800, 1920 × 1080 tai selaimen ikkuna),
Oman selaimen tila (valmiina tai pyytää sinua), teema ja kieli. Samat
valinnat saa osoitteella: `?world=like|crowded`, `?frame=1440x800`,
`?browser=ask`, `?theme=dark|contrast`, `?lang=en` ja `?d=0..3`. `?bare=1`
piilottaa palkin ja valitsimen, jolloin kehys täyttää ikkunan. Tarkistus
mittaa tällä tavalla.

Puhelin on rajattu pois: siellä sivupalkki on laatikko, joka avataan
erikseen ja jossa on koko näytön korkeus. Kiinteät kohteet eivät siellä
kilpaile keskustelupaneelin kanssa. Valitun suunnan puhelinversio katsotaan
toteutuksen yhteydessä.

## Rakentaminen ja tarkistus

```
npm ci --prefix web     # kerran, lukitiedoston mukaan
node design-system/prototypes/rounds/2026-11-22-rail-space/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright timeout 900 \
  node design-system/prototypes/rounds/2026-11-22-rail-space/check.mjs \
  design-system/prototypes/dist/rail-space/offline.html <kuvahakemisto> [--quick]
```

Linuxissa komennot ajetaan scratch-leasen alla yksityisellä `TMPDIR`:llä ja
`umask 077`:llä repositoryn työohjeen mukaisesti. Rakennus kirjoittaa
`design-system/prototypes/dist/rail-space/`:een `offline.html`:n (fontit
upotettuina) ja `index.html`:n (ilman fontteja). `check.mjs`:n alussa
kerrotaan, mitä se tarkistaa. Se kirjoittaa `rows.json`-taulukon, josta
`text.ts`:n `ROWS_1280` ja `result.md`:n luvut tulevat, ja tarkistus
epäonnistuu, jos sivun luku ja mittaus eroavat. `--quick` ajaa vain
1280 × 720 -ikkunan tavallisessa arjessa.

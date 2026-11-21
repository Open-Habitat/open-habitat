# Etusivu, kierros 5 – sisältö: Alicen päivä, roolit ja kyvyt (21.11.2026)

Jatkoa kierrokselle `2026-11-21-monta-agenttia`. Jari valitsi sieltä
**Sivupalkki**-suunnan, ja siitä tuli sivun periaate: tuotteen oma näkymä
kertoo tarinan, ja vieritys siirtää aikaa eteenpäin. Kaistat ja Hetket on
pudotettu. Hero on kierroksen 2 kiinteä hero, alla lyhyt tynkä.

Sivu on demo ja markkinointimateriaalia: se näyttää, mihin hyvin käytetty ja
konfiguroitu ympäristö kykenee, myös sen, mitä ei tule mukana (Alicen oma
taito, agentin rakentama sovellus, jälkikäteen asennettu ohjelma), mutta ei
mitään, mihin ympäristö ei kykene. Sivu ei vertaa eikä perustele. Päivässä ei
ole käyttöönottoa, asennusta eikä AI-tilauksen kytkemistä, ei ajastettuja
ajoja eikä Trelloa, Slackia, Teamsia, Jiraa, Confluencea tai
SharePoint-kirjoitusta, eikä mitään lähde ulos ilman ihmisen lupaa.

## Kierroksen kysymys

Sisältö, ja erityisesti se, miten roolit näytetään: miten sama ympäristö
toimii toimitusjohtajalle, myyjälle, kirjanpitäjälle, opettajalle,
tutkijalle, henkilöstöasioille ja taiteilijalle ilman, että sivu venyy
lukukelvottomaksi. Alicen päivä (12 välähdystä) ja kyvykkyysosio (56 kykyä)
ovat samat kaikissa kolmessa; vain roolien esitys vaihtuu.

## Suunnat (akseli: missä muut roolit näkyvät)

1. **Oma osio.** Alicen päivän jälkeen osio ”Same place, other work”:
   kuusi roolia (Bob myynti ja tilaukset, Kirsi kirjanpitäjä, Grace opettaja,
   Mira tutkija, Nora klinikan henkilöstö- ja toimistoasiat, Theo
   taidegraafikko), kullakin kolme välähdystä omassa tahmeassa näkymässään
   omine sivupalkkeineen. Alussa henkilöpikalinkit.
2. **Rinnakkaiset päivät.** Alicen päivä on pääraita, ja sen askelten väliin
   tulee kuusi ”Meanwhile”-välähdystä samalta tunnilta (Bob 08:20 ja 13:10,
   Mira 10:00 ja 14:40, Kirsi 12:50, Grace 13:30). Tahmea näkymä vaihtuu
   kollegan omaksi (avatar, nimi, organisaatio, oma sivupalkki, oranssi
   reunus), ja vihreä rivi kertoo, kun tiedosto siirtyy Alicelle tai
   Alicelta (Bobin kuvat Alicen uutiskirjeeseen, Alicen kuitit Kirsille,
   Gracen ryhmäkoot ja Miran tulokset Alicelle).
3. **Valitse kenen päivä.** Päiväosion yläreunassa valitsin (radioryhmä,
   nuolet liikkuvat sen sisällä eivätkä käännä valitsinta): Alice
   oletuksena, ja valinta vaihtaa koko päivän Bobin (7), Kirsin (6), Gracen
   (6) tai Miran (6) päiväksi samassa muodossa. Päivän lopussa ”Next:
   X’s Thursday →” vie seuraavaan.

Nora ja Theo ovat vain suunnassa 1 (kolme välähdystä kumpikin). Toimitusjohtajan
roolin kantaa Alice (pienen yrityksen omistaja); erillistä toimitusjohtajaa
en tehnyt.

## Alicen päivä: Example Studio, torstai 19.11.

Kymmenen keskustelua. Samanaikaisuus: 08:34 kaksi käynnissä ja yksi juuri
palannut; lounaalla kolme odottaa (kuitit, muistio, tilaussivu) ja palautukset
käyvät välilehti kiinni; 13:35 kolme kohdassa Your turn. Illalla uutiskirje
odottaa lupaa ja tilaussivu on yhä käynnissä.

| # | Aika | Keskustelu | Välähdys | Pinon etu (VIESTI A) | Ominaisuus (VIESTI B) |
|---|---|---|---|---|---|
| 1 | 08:04 | What’s waiting today | Eilisen muistiinpanot, posti ja kalenteri yhdeksi listaksi | 8, 11 | sivupalkki, yhteydet |
| 2 | 08:34 | Northside prices | Viime viikolla kirjoitettu katetarkistin uudelle hinnastolle | 4, 2 | rakenna omaa päälle |
| 3 | 08:41 | October receipts | 1 284 viestiä, 23/26 kuittia ohjelmalla täsmättynä | 1, 2, 5 | yhteydet |
| 4 | 09:02 | Market video | ffmpeg puuttuu, asennetaan omaan tiliin, 30 s video tekstityksin | 3 | oma tietokone, näkymä, tarjottu tiedosto |
| 5 | 09:44 | Shipping banner | Sivun historia: Bobin agentti tiistaina; julkaisu Alicen ”Yes”-sanalla | 9b | jokaisella omansa, Gitea |
| 6 | 11:24 | Planning memo (**uusi**) | Tunnin nauhoite litteroidaan palvelimella puhujat nimettyinä, muistio, ja tehtävät oikeisiin listoihin (`notes/open.md`, `team/tasks.md`) | 3, 5 | tarjottu tiedosto, näkymä |
| 7 | 12:38 | October receipts (puhelin) | Lounaalla: tilannekatsaus, saneltu vastaus, toinen postilaatikko | 6, 11 | puhelin, sanelu, yhteenveto |
| 8 | 13:35 | Returns: 30 days | Viisi workeria: luku, kolme kirjoittajaa, tarkistaja toisella mallilla | 7 | workerit, välilehti kiinni |
| 9 | 14:30 | December newsletter | Mieli muuttuu kesken; 386 vastaanottajaa tiedostosta; kuvat Bobin agentilta | 2, 12 | jonotettu viesti, tarjottu tiedosto |
| 10 | 15:30 | Returns: 30 days | Yksi sivu takaisin ennalleen, peruminen kirjautuu | 9 | muutos ja Undo |
| 11 | 16:50 | Wholesale order page (**uusi**) | Keskipäivällä rakennettu tilaussivu tukkuasiakkaille pyörii Alicen tilillä omassa osoitteessaan; illalla kolme kauppaa on tilannut; koodit lähtivät Alicen ”Yes”-sanalla | 4, oma palvelin | rakenna omaa päälle, välilehti kiinni |
| 12 | 17:28 | Before I go | Alicen lokakuussa kirjoittama kolmen lauseen taito `before-i-go`: opit omiin ja tiimin ohjeisiin | 10 | jokaisella omansa, yhteinen kansio |

Kaksitoista mahtui; välähdystä 9 (Undo) ei tarvinnut taittaa välähdykseen 7.
Uusien lähteet: muistio K20, tilaussivu K56 (K = karsittavan listan numero).
Markkinavideo pysyy arkisena (ffmpeg ja lyhyt tekstitetty klippi); Blender on
kyvykkyysosiossa.

## Roolien välähdykset ja lähteet

Numerot viittaavat yksityiseen aineistoon: K = karsittavan käyttötapauslistan
rivi, L = kyvykkyysraportin numero. Esimerkit on kirjoitettu keksittyyn
kehykseen.

| Henkilö | Välähdykset (kellonaika: lähde) | V1 näyttää |
|---|---|---|
| Bob, myynti ja tilaukset, Example Studio | 08:20 L27 · 09:30 L13 · 10:40 L55 · 11:50 K29 · 13:10 L3 · 14:20 L25 · 16:10 K15 | 08:20, 09:30, 13:10 |
| Kirsi, kirjanpitäjä, Ledger & Co | 08:10 K2 · 09:20 K53 (pyydetty, ei ajastettu) · 10:30 K4 · 11:40 L40 · 12:50 K1 · 14:30 L52 | 08:10, 10:30, 12:50 |
| Grace, kuvataideopettaja, Maple Lane School | 07:52 K44 · 09:10 L4 · 10:20 K48 · 12:00 L29 · 13:30 K45 · 15:10 L49 | 07:52, 10:20, 13:30 |
| Mira, tutkija, Riverside University | 08:40 L8 · 10:00 L38 · 11:45 L6, L27 · 14:40 (uusi: tulokset Alicelle) · 15:50 L42 · 16:40 L10 | 08:40, 10:00, 14:40 |
| Nora, henkilöstö ja toimisto, Brightwater Clinic | 08:45 K38 · 11:10 K39, L2 · 14:20 K6 | kaikki |
| Theo, taidegraafikko, oma pieni kauppa | 09:50 L20 · 11:15 L11 · 14:50 L41, L21 | kaikki |

## Kyvykkyysosio (sama kaikissa)

Kaikki 56 kykyä kahdeksassa ryhmässä. Jokainen ryhmä on oma vieritettävä
tarinansa: kaksi näytetään kokonaan tahmeassa näkymässä (pyyntö, työ ja tulos
näkymänä vieressä), loput ovat avattavassa listassa (yksi rivi, avattuna
pyyntö ja tulos). Näytöstuotteet (Blender-pyörähdys, litterointi, taustan
poisto, drone-kartta) ovat kokonaisina.

| Ryhmä | Kokonaan | Listassa |
|---|---|---|
| Video and sound (8) | L2 litterointi, L24 säestys erilleen | L1, 4, 9, 22, 31, 45 |
| Pictures (7) | L3 taustan poisto, L11 logo vektoriksi | L12, 28, 29, 46, 47 |
| 3D and making (3) | L5 Blender-pyörähdys, L14 varaosa | L10 |
| Paper and files (10) | L6 skannit arkistoksi, L30 sopimusversiot | L8, 26, 27, 42, 43, 52, 54, 55 |
| Maps and routes (4) | L18 drone-kartta, L16 tilaukset kartalla | L13, 17 |
| Documents and print (11) | L21 todistukset, L23 kuoron stemmat | L20, 32, 33, 40, 41, 48, 49, 50, 51 |
| Data and numbers (9) | L15 lukujärjestys, L19 ennuste | L7, 36, 37, 38, 39, 53, 56 |
| The web (4) | L35 sivuston tarkastus, L34 sivusto teksteistä | L25, 44 |

Nimiä vaihdettu, jotta henkilöt pysyvät johdonmukaisina roolipäivien kanssa:
L3 Bob → Ruth (Harbour Gifts), L4 Grace → Ivan, L1 Alicen mukit → Lenan
esiliinat (Example Studio myy pellavaa), L24 ”music teacher” → Sara,
L40/43/52/54 Olivia → Kirsi (Ledger & Co), L8 Bob → Mira.

### Kirjasto-intro

”Tens of thousands of programs, a sentence away.” Tämän koneen (Ubuntu
24.04.5) `apt-cache pkgnames | wc -l` antoi 94 629 pakettinimeä (saatavilla,
ei asennettuna; mukana kirjastot ja alipaketit), joten sivu sanoo ”tens of
thousands of packages” eikä väitä niitä asennetuiksi: ylläpitäjä voi asentaa
minkä tahansa kaikille, ja agentti hakee monet omaan tiliinsä. Rivin ”Also in
the archive” ohjelmat on tarkistettu `apt-cache show`lla tältä koneelta
(Blender, LibreOffice, Pandoc, ImageMagick, Tesseract, OCRmyPDF, Inkscape,
Scribus, LilyPond, MuseScore, darktable, Hugin, GDAL, R, OpenSCAD, Graphviz,
calibre, Hugo). Typst, DuckDB ja Whisper eivät ole arkistossa, joten sivu
sanoo, että agentti hakee ne projektilta.

## Claims to verify

Alan johtajuutta väitetään vain lähteen kanssa; lainaus on sivulla
sellaisenaan. Lähteet luettiin 21.11.2026.

| Ohjelma | Väite sivulla | URL | Lause, johon väite nojaa |
|---|---|---|---|
| FFmpeg | ”FFmpeg is the leading multimedia framework” | https://ffmpeg.org/about.html | ”FFmpeg is the leading multimedia framework” |
| SQLite | ”SQLite is the most widely deployed database in the world” | https://sqlite.org/about.html | ”SQLite is the most widely deployed database in the world” (varovaisempi muoto sivulla https://sqlite.org/mostdeployed.html: ”SQLite is likely used more than all other database engines combined.”) |
| QGIS | ”QGIS is the leading Free and Open Source Desktop GIS.” | https://www.osgeo.org/projects/qgis/ | sama lause; lähde on OSGeo, projektin kattosäätiö, ei qgis.org (siellä ei vastaavaa väitettä) |
| Git | ”Git is widely used” (vain tämä) | https://git-scm.com/about | sivun väliotsikko ”Git is widely used” ja lause ”According to the 2022 Stack Overflow developer survey, 96% of professional developers use Git.” Ei tue ”standardia” eikä ”eniten käytettyä”. |

Ei väitettä, koska lähde ei tue sitä: Blender (blender.org/about palautti
403; GitHubin README: ”Blender is the free and open source 3D creation
suite.”), Pandoc (”pandoc is your swiss-army knife”), ImageMagick (”a
powerful open-source software suite”), Tesseract (README kertoo kielistä, ei
asemasta), LibreOffice (”tested and used daily by a large and devoted user
community”). Inkscapen sivu palautti 403, joten sitä ei voitu lukea. Johdannon
lause ”Some of them lead their field” nojaa kolmeen ensimmäiseen.

## Mitä ruudut olettavat tuotteesta

- Valmiit yhteydet: Gmail ja kalenteri (`gog`), IMAP (`himalaya`), Gitea,
  oma kone (`computer`-rivi, Bobin selainistunto kuriirin sivulla). Ledger &
  Co lukee Example Studion kuittikansiota jaetun Drive-kansion kautta
  (`rclone`).
- **Tilaussivu (välähdys 11) ja Gracen sekä Bobin sivut** olettavat, että
  käyttäjän agentti voi julkaista palvelun osoitteeseen, jonka käyttäjä
  hallitsee (`publish`-rivi), ja että palvelu pyörii käyttäjän omana
  systemd-user-yksikkönä uloskirjautumisen jälkeen (lingering on päällä
  hyväksytyille tileille). Tarkistettava ennen kuin sivu väittää.
- Asennukset: ffmpeg staattisena `~/.local/bin`iin; whisperx, demucs ja
  rembg `uv tool install` -komennolla omaan tiliin; Blender purettuna
  `~/apps`iin; OpenDroneMap ”installed by the administrator”. Nämä
  seuraavat kyvykkyysraportin asennusmuistiinpanoja, eikä niitä ole
  kokeiltu oikealla tilillä.
- Mitään ei ajeta ajastetusti: jokainen keskustelu alkaa ihmisen pyynnöstä
  (Kirsin säädösmuutokset: hän kysyy, agentti vertaa viime kuun tallennettuun
  kopioon). Tilaussivu on palvelu, ei ajastus.
- Mitään ei lähetetä ilman lupaa: Bobin viesti, tilaussivun koodit kaupoille,
  Gracen ja Miran viestit Alicelle lähtevät ”Yes / Send it” -vastauksen
  jälkeen; muistion tehtävät menevät tiedostoihin, eivät viesteinä.
- Workerin ”toinen malli” olettaa, että worker voi käyttää eri mallia.
- Komentorivit ovat havainnollisia. Ruudut on piirretty prototyypin
  kirjastolla, ei kaapattu.
- Ihmiset, yritykset, koulut, kerhot, tiedostot ja osoitteet ovat keksittyjä
  (`example.org`).

## Päätöksiä, joita Jari voi haluta katsoa

- **Tahmea näkymä avautuu uusimpaan kohtaan** (alas), kuten keskustelu, ei
  ylös kuten kierroksessa 4. Sivupalkin vieressä näkymä on kapea, ja tulos
  (tilaussivu, muistio, video) jäi muuten taitteen alle; kysymys näkyy jo
  vasemman sarakkeen otsikossa.
- **Alicen taito** on `before-i-go`, ”written by Alice, 2 Oct”, ja se
  näkyy vain käyttäjän kuplan alla ja ensimmäisessä työrivissä.
- Kyvykkyysosion ruudun yläpalkki näyttää esimerkin henkilön (ei omaa
  sivupalkkia), koska esimerkit ovat eri ihmisten.
- Sivu on pitkä: suunta 1 on noin 46 vieritysaskelta. Tämä on tarkoituksella
  karsittavaksi; kyvykkyyslistat ovat kiinni oletuksena.

## Rakentaminen ja tarkistus

```
TMPDIR=<oma scratch> node design-system/prototypes/rounds/2026-11-21-etusivu-kierros-5/build.mjs <out.html>
PROTO_WEB=<web-hakemisto, jossa node_modules> \
  node design-system/prototypes/rounds/2026-11-21-etusivu-kierros-5/check.mjs <out.html> <kuvahakemisto>
```

`build.mjs` lukee kierroksen koodin neljästä tiedostosta (`round.js`
moottori ja Alicen päivä, `caps.js`, `roles.js`, `variants.js`) ja tarvitsee
ImageMagickin heron kuvaan. Tulos on noin 0,6 Mt. `check.mjs`:n tarkistukset
on lueteltu sen alussa: jokainen suunta 1440 ja 390 px:n leveydellä
vähennetyllä liikkeellä, jokainen vuorovaikutus klikattuna, sivu loppuun asti
ja konsoli puhtaana.

# Workerien merkit – kierros 1: yksi merkistö tilalle ja odotukselle

- **Nyt**: tuotanto tänään. Odotettu = rengas ja keskus, ei odotettu = katkoviivarengas; muut tilat omilla merkeillään, sivupalkki ei erota odotusta.
- **1 Pallot**: workerin merkki on sivupalkin pallo (työ sykkii, vuorosi keltainen, valmis vihreä, kesken punainen salmiakki); odotettu saa ympärilleen kehän.
- **2 Kotelo**: merkki kertoo vain workerin tilan; odotetut kootaan sirussa, paneelissa ja sivupalkissa yhteen koteloon, jonka alussa on yläpalkin odotusmerkki.
- **3 Täyttö**: elävä worker on aina rengas (pyörii = työssä, keltainen = vuorosi, ohut = odottaa pääagenttia); täytetty keskus = agentti odottaa, tyhjä = ei.

Issue `proto-worker-badges`. Jari 7.11. (pilot.612): workerin merkki näytti
katkoviivarengasta (*ei odoteta*), vaikka agentti odotti workeria. Jari
pyysi miettimään merkistön uudelleen. Tunnistusvika korjataan erikseen
(`worker-badge-misses-expanded-wait`). Akseli on merkistö: mikä merkki
kertoo workerin oman tilan ja mikä sen, odottaako agentti sitä. Sanat,
paneelin rakenne, Lopeta odotus ja Kerro agentille ovat kaikissa samat.

## Sivu

Valitsimessa on neljä kohtaa: **Nyt** ja kolme suuntaa. Jokaisen
oletusnäkymässä on tuotannon keskustelu, jossa Workerit-paneeli on auki
(viisi elävää ja kahdeksan päättynyttä workeria), siru sen alla ja
sivupalkki vasemmalla. Oikealla on **merkistö**: jokainen tila riveittäin,
ja sarakkeina siru, paneelin rivi (merkki ja tuotannon sana) ja
sivupalkki. Puhelimessa merkistö aukeaa yläpalkin *Merkistö*-painikkeesta
ja sivupalkki valikosta.

Yläpalkin **Odotus**-valinta näyttää 7.11. tapauksen paikallaan: *kohde
ei luettavissa* tarkoittaa, että agentti odottaa, mutta daemon ei saanut
odotuksen tunnuksia (komentotulkki laajensi ne tiedostosta). Tuotannossa
odotus näkyy silloin tavallisena prosessina (kello Prosessit-välilehdellä),
ja workerin merkki on katkoviivarengas.

## Nykyinen merkistö (Nyt)

Inventaario on tehty tuotannon koodista (`BackgroundStrip.tsx`,
`Navigation.tsx`, `railNow.ts`), ja Nyt-näkymä on tuotannon komponentit
muuttamattomina.

- **Siru**: haaraikoni ja yksi merkki jokaista elävää workeria kohden
  (yli viisi: merkki ja lukumäärä lajeittain), sitten päättyneistä vain
  ne, jotka tarvitsevat henkilöä: punainen pallo (kesken, työ tallessa),
  pyörivä rengas (pyyntö agentilla) ja paikallaan oleva rengas (odottaa
  vastaustasi). Ilman merkkejä siru näyttää lukumäärän.
- **Elävän workerin merkki** valitsee yhden asian järjestyksessä: odottaa
  sinua (paikallaan oleva aksenttirengas) > agentti odottaa (rengas ja
  keskus, sama kuin yläpalkin *Odottaa taustatyötä*) > työskentelee ilman
  odotusta (katkoviivarengas) > muu (ohut harmaa rengas).
- **Paneelin rivi**: sama merkki 14 px:n paikassa; päättyneillä
  merge-kuvake vihreänä (laskeutui, myös worktree jäljellä), punainen
  pallo (kesken), punainen rasti (epäonnistui, ei mitään tallessa),
  punainen varoituskolmio (ei mergetty, ei mitään tallessa; sana on
  silti harmaa), vihreä väkänen (haara poistettu, hetken).
- **Sivupalkki**: keskustelurivin pallo kertoo keskustelun tilan; jos sen
  worker työskentelee tai agentti odottaa workeria, rivin perässä on
  sykkivä haaraikoni. Worker, joka odottaa sinua, näkyy vain sanana
  (*Worker odottaa sinua*) ja vihreänä *valmis*-pallona; epäonnistunut
  worker punaisena salmiakkina.

Havainnot:

1. Katkoviivarengas on väite (*kukaan ei odota*). Kun odotusta ei
   tunnisteta, väite on väärä, ja juuri se näkyi 7.11.
2. Merkki näyttää vain yhden asian: odotettu worker, joka odottaa sinua,
   menettää odotusmerkin, ja odotettu pääagenttia odottava näyttää samalta
   kuin odotettu työskentelevä.
3. Työskentely ei näy merkissä lainkaan (vain odotus); pyörivä rengas
   tarkoittaa pyyntöä agentilla, ei työtä.
4. *Odottaa pääagenttia* ja *tila ei tiedossa* ovat sama harmaa rengas.
5. *Odottaa sinua* on sirussa aksenttiväri, sivupalkissa vuorovärinen
   (keltainen) pallo.
6. Päättyneillä on neljä muotoa ja kaksi tapaa sanoa punainen.
7. Sivupalkki ei erota odotettua ja odottamatonta workeria.

## Suunnat

Kaikki suunnat korjaavat havainnot 2–7 samalla tavalla: tila ja odotus
näkyvät yhtä aikaa, *odottaa sinua* on kaikkialla vuoroväri (keltainen),
pääagenttia odottava ja tuntematon erottuvat, ja sivupalkin rivillä on
workerin merkki. Ero on siinä, miten odotus merkitään.

- **1 Pallot** lainaa sivupalkin pallot workerin tilaksi: työ = sykkivä
  aksenttipallo, vuorosi = keltainen, odottaa pääagenttia = harmaa,
  tuntematon = avoin rengas, laskeutui = vihreä, kesken = punainen
  salmiakki (sama kuin sivupalkin *epäonnistui*), ei mitään tallessa =
  ontto salmiakki. Odotus on kehä pallon ympärillä; työskentelevä odotettu
  näyttää siis täsmälleen yläpalkin odotusmerkiltä. Odottamaton on pallo
  ilman kehää: puuttuva odotus ei väitä mitään, joten tunnistamaton odotus
  ei näytä väärää. Sivupalkissa haaraikoni ja sama pallo.
- **2 Kotelo** pitää merkit pelkkänä tilana (sykkivä piste, keltainen
  rengas, harmaa piste, kuvakkeet päättyneille) ja kokoaa odotetut
  koteloon, jonka alussa on yläpalkin odotusmerkki. Paneelissa odotetut
  rivit ovat ylimpänä omassa lohkossaan otsikolla *Agentti odottaa näitä*.
  Sivupalkissa haaraikoni on kotelossa, kun agentti odottaa.
- **3 Täyttö** on nykyisen rengaskielen johdonmukainen versio: elävä
  worker on aina rengas (pyörii = työssä, keltainen = vuorosi, ohut =
  odottaa pääagenttia, pisteviiva = tuntematon), täytetty keskus = agentti
  odottaa, tyhjä = ei odota. Päättyneet ovat täysiä kiekkoja (vihreä,
  punainen); pyyntö agentilla on punainen keskus pyörivässä renkaassa.
  Tunnistamaton odotus tarvitsee oman merkin (harmaa keskus), koska tyhjä
  keskus väittäisi, ettei kukaan odota. Sivupalkin haaran päätesolmu
  täyttyy, kun agentti odottaa.

## Mistä sivu on tehty

Tuotannon `AppShell`, `WorkspaceRail`, `AgentNavItem`, `AgentHeader`,
`ConversationTimeline`, `Composer` ja `BackgroundStrip` muuttamattomina,
tilat tuotannon `backgroundFacts`- ja `stateWord`-funktioista. Suunnat
piilottavat tuotannon merkit ja piirtävät omansa samoihin paikkoihin
(sirun, rivin merkkipaikan ja sivupalkin rivin loppuun). Kaikki on
synteettistä; odotus on prosessirajapinnan vastaus, jossa on agentin
herättävä `taskfleet run wait`.

## Rakentaminen ja tarkistus

```
ln -s ~/src/open-habitat/web/node_modules web/node_modules   # tai: cd web && npm ci
node design-system/prototypes/rounds/2026-11-07-workerimerkit/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
  node design-system/prototypes/rounds/2026-11-07-workerimerkit/check.mjs \
  design-system/prototypes/dist/workerimerkit/offline.html <kuvahakemisto>
```

`check.mjs` käy Nyt-näkymän ja jokaisen suunnan läpi 1440 px:n ja 390 px:n
leveydellä (kosketus) vaaleana ja tummana: oletusnäkymä, lähikuva
nauhasta, tunnistamaton odotus ja puhelimessa merkistö ja sivupalkki.
Se tarkistaa tuotannon merkit Nyt-näkymässä (kaksi odotettua, yksi
katkoviiva; tunnistamattomana kaksi katkoviivaa), suuntien yhdeksän
sirumerkkiä, kaksi odotettua, kotelon, rivien ja sivupalkin merkit sekä
ettei sivu vuoda leveyssuunnassa. Konsoli pysyy puhtaana (224
tarkistuspistettä). `index.html` on sama sivu ilman upotettuja fontteja.

# Keskustelun näkymät ja tiedostot – kierros 2: siru kentän luona

- **Nyt**: tuotanto tänään. Kentän yllä on vain Workerit-siru; yläpalkin tiedostopainike avaa Tiedostot-paneelin, näkymillä ei ole listaa.
- **1 Oma siru**: Workerit-sirun vieressä on oma siru, jossa näkymien ja tiedostojen määrät; se avaa listan kenttää kohti samaan paikkaan kuin Workerit-paneeli.
- **2 Yhteinen**: workerit ja aineisto ovat yhdessä sirussa; sen paneelissa on välilehdet Workerit ja Näkymät ja tiedostot.
- **3 Kasvava**: pieni siru pelkin merkein; kun agentti tarjoaa uuden, siru kasvaa ja näyttää sen nimen hetken, sitten jää pisteeksi kunnes katsot.

Issue `proto-conversation-assets`. Jari valitsi 8.11. kierroksen 1 Sirun ja
kysyi, olisiko siru parempi alhaalla kirjoituskentän luona, siellä missä
Workerit-siru ja muut taustatyön sirut ovat. Akseli on se, miten siru elää
tässä palkissa. Lista, sen rivit ja versioiden kokoaminen ovat kierroksen 1
Sirusta sellaisinaan.

## Sivu

Sama keskustelu kuin kierroksella 1 (*Q3-myyntikatsaus johtoryhmälle*:
kuusi näkymätarjousta, neljä tiedostotarjousta), ja lopuksi agentti
käynnistää kaksi workeria, `pdf-luvut-tarkistus` ja
`kysely-avoimet-luokittelu`. Tuotannon `BackgroundStrip` näyttää ne
Workerit-sirussa kahtena pisteenä. Oletusnäkymässä lista on kiinni, joten
ero näkyy sirussa itsessään.

Kaikissa suunnissa lista avautuu taustatyön paneelin paikkaan: kentän yllä
koko keskustelupalstan levyisenä kelluvana paneelina. Vain yksi paneeli on
auki kerrallaan: Workerit-paneeli sulkee listan ja päinvastoin. Lista
sulkeutuu valinnasta, ulkopuolisesta painalluksesta ja Escistä.

Rivin painallus avaa kohteen tarjouskortin paikkaan
(`proto-offer-cards-consistent` kierros 2): oikean reunan paneeliin, jonka
yläpalkissa on *Näytä keskustelussa*, *Avaa omalle välilehdelle*, *Lataa*
ja *Sulje* sekä *Julkinen*-kytkin. Puhelimessa paneeli peittää
keskustelun. Arviointipalkin *Kohde avautuu: ikkunaan* näyttää toisen
vaihtoehdon, jota tarjouskorttien kierros 2 kokeilee: sama paneeli
ikkunana keskustelun päällä, Esc sulkee. Kumpi paikka valitaan, ratkaistaan
siellä; tämä kierros käyttää sitä sellaisenaan.

## Suunnat

- **1 Oma siru**: tuotannon Workerit-siru muuttumattomana ja sen vieressä
  samannäköinen siru `</> 3 ▯ 4` (raportit ja tiedostotarjoukset).
  Yläpalkista tiedostopainike poistuu.
- **2 Yhteinen**: yksi siru `⑂ 2 | </> 3 ▯ 4` korvaa Workerit-sirun.
  Paneelissa on kaksi välilehteä; Workerit-välilehden sisältö on tuotannon
  oma Workerit-paneeli sellaisenaan. Siru avautuu viimeksi valitulle
  välilehdelle, aluksi aineistoon. Workerien odotuspisteet vaihtuvat
  sirussa luvuksi, koska kahden lajin merkit samassa sirussa eivät mahdu
  puhelimessa.
- **3 Kasvava**: siru on levossa vain merkit `</> ▯` ilman lukuja. Kun
  agentti tarjoaa uuden kohteen, siru kasvaa korostettuna:
  *Uusi Myynnin kvartaalikatsaus – tumma versio*. Kuuden sekunnin päästä se
  kutistuu takaisin merkeiksi ja jättää pisteen, joka häviää, kun lista
  avataan. Arviointipalkin *Uusi kohde saapuu* toistaa saapumisen.

## Mistä sivu on tehty

Tuotannon `AppShell`, `WorkspaceRail`, `AgentHeader`,
`ConversationTimeline`, `Composer`, `BackgroundStrip` (kahdella
synteettisellä workerilla), `ViewOfferCard`, `FileOfferCard`, `ViewSplit`,
`ViewPanel` ja `FileShelf` muuttamattomina. Aineistosiru, lista, Yhteisen
välilehdet ja avatun kohteen paneeli ovat kierroksen omia; paneeli on
piirretty tarjouskorttien kierroksen 1 Kortin paneelin mukaan. Yhteisen
Workerit-välilehti näyttää tuotannon paneelin kierroksen CSS:llä ilman sen
omaa välilehtiriviä ja siruja.

## Rakentaminen ja tarkistus

```
ln -s ~/src/open-habitat/web/node_modules web/node_modules   # tai: cd web && npm ci
node design-system/prototypes/rounds/2026-11-08-keskustelun-aineisto-2/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
  node design-system/prototypes/rounds/2026-11-08-keskustelun-aineisto-2/check.mjs \
  design-system/prototypes/dist/keskustelun-aineisto-2/offline.html <kuvahakemisto>
```

`check.mjs` käy Nyt-näkymän ja jokaisen suunnan läpi 1440 px:n ja 390 px:n
leveydellä (kosketus) vaaleana ja tummana. Se tarkistaa, että siru on
Workerit-sirun kanssa samalla rivillä (Yhteinen: ainoana), että lista
avautuu palkin yläpuolelle oikeassa järjestyksessä, että Yhteisen
Workerit-välilehdellä on tuotannon workeririvit, että Kasvava kutistuu ja
piste häviää katsottaessa, että CSV avautuu viereen ja uusin näkymä
ikkunaan, eikä sivu vuoda sivuttain. Konsoli pysyy puhtaana (356
tarkistuspistettä). `index.html` on sama sivu ilman upotettuja fontteja.

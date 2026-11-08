# Keskustelujen arkisto – kierros 1: missä arkisto on ja miten sieltä löytää

- **Nyt**: tuotanto tänään. Työtilan sivun Arkisto: alleviivatut otsikot ja Palauta näkyviin -painikkeet, avustajien tilalohkot välissä, ei päiviä eikä järjestystä.
- **1 Lista**: arkisto pysyy työtilan sivulla, mutta päivän mukaan ryhmiteltynä ja suodatettavana; rivillä otsikko, päivä, mitä jäi jälkeen ja hiljainen palautus.
- **2 Oma näkymä**: työtilan sivulla on yksi rivi, joka vie arkiston omalle sivulle; haku otsikoista ja yhteenvedoista, valitun esikatselu yhteenvetoineen ja avustajineen.
- **3 Sivupalkki**: arkisto on sivupalkissa työtilan alla kuten käynnissä olevat; valittu keskustelu aukeaa pääpalstaan luettavaksi, ja palautus on sen alalaidassa.

Issue `proto-conversation-archive`. Akseli on se, missä arkisto asuu ja
miten sieltä löytää keskustelun.

## Tarina

Jarin 13 arkistoitua keskustelua pilot.657:n `open-habitat`-työtilasta
samoilla otsikoilla kuin hänen kuvassaan, illalla su 8.11. klo 19.30
(kiinteä hetki, jotta päivät ja ryhmät pysyvät samoina). Kahdella on
avustaja, jonka yhdistämistä ei ole vahvistettu (`testaaja`,
`testiavustaja`), kuten Jarin sivulla. Lisäksi yhdellä on yhdistetty worker
ja yhdellä yhdistämätön, jotta näkyy, mitä keskustelu tuotti. Päivät,
yhteenvedot ja viestit on keksitty otsikoiden mukaan.

## Mitä kaikki suunnat tekevät samoin

- Järjestys on arkistointihetki, uusin ensin, ja jokaisella rivillä on päivä
  (*klo 18.40*, *eilen 21.40*, *pe 6.11.*, *28.10.*).
- Avustajan tai workerin tilalohkon tilalla on rivillä merkki ja kaksi sanaa
  (*avustaja testaaja*, *työ yhdistetty*, *työ haarassa*). Tarkka tila,
  haara ja *Avaa haara* ovat siellä, missä keskustelu luetaan.
- Otsikko avaa keskustelun luettavaksi: tuotannon `AgentHeader` arkistoidun
  tilan Palauta-toiminnolla ja viestit; kentän paikalla on *Arkistoitu su
  8.11. klo 16.10. Luettavissa; palauta jatkaaksesi.*, keskustelun
  avustajat tuotannon `HelperArchiveRows`-riveinä ja *Palauta*.
- Palautus on hiljainen (ikoni rivillä, painike luettaessa). Palautettu
  siirtyy Käynnissä-listaan, ja ilmoitus kertoo, että avustajat palasivat
  käynnistämättä.

## Suunnat

- **1 Lista**: työtilan sivulla Avoimet-osion alla *Arkisto 13* ja
  *Etsi otsikosta*. Ryhmät *Tänään*, *Eilen*, *Aiemmin tällä viikolla*,
  *Vanhemmat*. Rivi: otsikko ja jäljet, päivä, palautusikoni. Puhelimessa
  päivä otsikon alla.
- **2 Oma näkymä**: työtilan sivulla vain *Arkisto · 13 keskustelua ·
  viimeksi klo 18.40 ›*. Arkiston sivulla haku otsikoista ja
  yhteenvedoista, rajaus *Kaikki / Jätti jotain*, kortit (otsikko, päivä,
  yhteenvedon ensimmäinen rivi tai viimeisin viesti, jäljet) ja oikealla
  valitun esikatselu: päivät, yhteenveto ja *Seuraavaksi*, avustajat ja
  työt, *Avaa luettavaksi* ja *Palauta*. Puhelimessa esikatselu korvaa
  listan.
- **3 Sivupalkki**: sivupalkissa työtilan alla *Arkisto · open-habitat 13*
  ryhmiteltynä kuten 1. Sivupalkin olemassa oleva *Suodata työtiloja* löytää
  myös arkistoidut otsikot. Työtilan sivulla ei ole arkistoa. Oletusnäkymä
  on valittu keskustelu luettavana.

## Mistä sivu on tehty

Tuotannon `AppShell`, `WorkspaceRail`, `AgentNavItem`, `WorkspaceNavRow`,
`AgentHeader`, `ConversationTimeline`, `TextField`, `Button`,
`ControlButton`, `WorkerMark`, `HelperArchiveRows` ja `HelperBranchDialog`
muuttamattomina. Nyt on tuotannon `App.tsx`:n arkisto-osion merkintä
(`ah-workspace-archive`, `LinkRow` + `Palauta näkyviin`, `ArchivedHelpers`
-riveinä `HelperArchiveRows`) Jarin kuvan järjestyksessä. Työtilan sivun
Avoimet on pelkistetty kuten edellisillä kierroksilla. Listat, kortit,
esikatselu, sivupalkin arkisto ja lukunäkymän alalaita ovat kierroksen omia
tuotannon tokeneilla.

## Rakentaminen ja tarkistus

```
cd web && npm ci && cd ..
node design-system/prototypes/rounds/2026-11-08-keskustelujen-arkisto/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
  node design-system/prototypes/rounds/2026-11-08-keskustelujen-arkisto/check.mjs \
  design-system/prototypes/dist/keskustelujen-arkisto/offline.html <kuvahakemisto>
```

`build.mjs` on edellisen kierroksen rakennus, jossa on lisäksi
`.avif`/`.png`-lataaja. Tuotanto tuo nyt AVIF-kuvia
(`MicrosoftLevels`), eikä rakennus muuten onnistu.
`check.mjs` käy Nytin ja suunnat läpi 1440 px:n ja 390 px:n (kosketus)
leveydellä vaaleana ja tummana. Se tarkistaa: tuotannossa 13 *Palauta
näkyviin* -painiketta ja 2 avustajalohkoa; 1:ssä 13 riviä neljässä ryhmässä,
uusin ensin, ei tilalohkoja, suodatus, lukunäkymä avustajineen ja palautus;
2:ssa esikatselu, workerin rivi, haku yhteenvedoista (3 osumaa),
lukunäkymä ja työtilan yksi rivi; 3:ssa sivupalkin 13 riviä, sivupalkin
suodatus ja palautus. Konsoli pysyy puhtaana eikä sivu vuoda sivusuunnassa
(176 tarkistuspistettä). `index.html` on sama sivu ilman upotettuja fontteja.

# Avustajien arkistointi – kierros 1: miten arkistointi kerrotaan

- **Nyt**: tuotanto tänään. Arkistointi tapahtuu heti, ja yläpalkin ilmoitus kertoo yhdellä pitkällä rivillä avustajat ja keskeneräisen kierroksen; ilmoitus häviää 8 sekunnissa.
- **1 Vahvistus**: arkistointi kysyy ensin ja luettelee avustajat tiloineen ja sen, mikä jää haaraan; sen jälkeen tavallinen lyhyt ilmoitus.
- **2 Ilmoitus**: arkistointi tapahtuu heti; lyhyt ilmoitus pysyy, kunnes suljet sen, kun työtä on haarassa, ja siinä on Avaa haara ja Palauta.
- **3 Arkistossa**: arkisto näyttää avustajat keskustelun alla omina riveinään tiloineen; ilmoitus vie arkistoon, ja palautus kertoo keskustelussa, mitä sillä välin tapahtui.

Issue `proto-helper-archive-notice`. Jari hyväksyi 8.11. säännön
(`named-workers-in-habitat`): arkistointi ei yhdistä mitään, valmiit
kierrokset on jo yhdistetty, kesken oleva kierros jää avustajan haaraan,
ja avustajat palaavat pääkeskustelun mukana arkistoituina eli
käynnistämättä. Akseli on se, milloin ja missä henkilö saa tämän tietää:
ennen arkistointia, heti sen jälkeen vai arkistossa.

## Tarina

Keskustelu *Kotisivun uudistus* työtilassa `kotisivu`. Avustajia on kaksi:

- **Prototyyppari** · Etusivun suunnat: odottaa, kolme kierrosta, kaikki
  yhdistetty (harmaa pallo).
- **Katselmoija** · Saavutettavuuskatselmointi: kierros 2 työn alla
  haarassa `wt/katselmoija-saavutettavuus` (hengittävä pallo).

Henkilö arkistoi keskustelun. Arkistoinnin aikana Katselmoija saa
kierroksen 2 valmiiksi, mutta kukaan ei yhdistä sitä. Kun keskustelu
palautetaan, Katselmoijalla on avaamaton raportti (rengas pisteellä) ja
työ on haarassa.

Oletusnäkymä on hetki heti arkistointipainalluksen jälkeen, koska siinä
suunnat eroavat: Nyt ja 2 ja 3 ovat työtilan sivulla ilmoituksen kanssa,
1 kysyy vielä keskustelun päällä. *↺ Alusta keskustelusta* aloittaa
alusta ennen arkistointia, ja koko kulku on klikattavissa: arkistoi
(yläpalkin arkistokuvake, puhelimessa ⋯-valikko), arkisto, Palauta ja
Avustajat-siru.

## Suunnat

- **Nyt**: tuotannon `ArchiveNotice` ja tuotannon oma teksti
  (`helpersArchiveDetail`): *Arkistoitu Kotisivun uudistus · Avustajat
  arkistoitiin mukana (Prototyyppari, Katselmoija): ne odottavat …
  Kierros on vielä kesken (Katselmoija) …*. Ilmoitus häviää 8 sekunnissa,
  arkistossa on pelkkä keskustelurivi, eikä palautus kerro mitään;
  avustajat näkyvät vain sirussa.
- **1 Vahvistus**: arkistokuvake avaa kysymyksen *Arkistoi Kotisivun
  uudistus*: avustajat Pallot-merkein, kummankin tila ja Katselmoijan
  haaran nimi, sekä *Arkistointi ei yhdistä mitään. Kun palautat
  keskustelun, avustajat palaavat sen mukana käynnistämättä.* Peruuta /
  Arkistoi. Sen jälkeen tavallinen lyhyt ilmoitus. Palautus sanoo
  *Palautettu · avustajat palasivat odottamaan*.
- **2 Ilmoitus**: ei kysymystä. Ilmoitus on lyhyt, *2 avustajaa mukana ·
  1 kierros jää haaraan*, ja pysyy, kunnes sen sulkee (työtä on haarassa).
  *Avaa haara* näyttää haaran: avustaja, haaran nimi → `main`, työpuu ja
  muutokset sekä *Kopioi haaran nimi*. Palautuksen ilmoitus kertoo, mitä
  tapahtui: *Katselmoija raportoi kierroksen 2 arkistoinnin aikana; työ on
  haarassa, ei yhdistetty* ja taas *Avaa haara*.
- **3 Arkistossa**: ilmoitus on lyhyt, *2 avustajaa mukana*, ja siinä on
  *Näytä arkistossa*. Arkisto aukeaa, ja keskustelun alla ovat avustajat
  omina riveinään tiloineen. Palautus on *Palauta avustajineen*. Palautetun
  keskustelun loppuun tulee kerran rivi *Palautettu arkistosta*, jossa on
  avustajien tila palautushetkellä.

Kaikissa suunnissa avustajarivi on sama: Pallot-merkki, nimi · tehtävä
ja sanoin, missä työ on (✓ *kaikki yhdistetty* tai haaraikoni ja
*jää haaraan* sekä haaran nimi monospacella).

## Mistä sivu on tehty

Tuotannon `AppShell`, `WorkspaceRail`, `AgentNavItem`, `AgentHeader`
arkistokuvakkeineen, `ConversationTimeline`, `Composer`,
`BackgroundStrip` Avustajat-siruineen (`SpinoffContext`, `helpers`),
`ArchiveNotice`, `WorkerMark`, `CopyButton` ja `helpersArchiveDetail`
muuttamattomina; Nyt on niistä koottu tuotanto. Työtilan sivu on
pelkistetty: sama otsikko ja tuotannon `ah-workspace-archive`-arkisto,
mutta avoimet keskustelut ovat yksinkertaisia rivejä tuotannon korttien
sijaan. Kysymys, haaran ikkuna, arkiston avustajarivit ja palautusrivi
ovat kierroksen omia tuotannon tokeneilla. 2 Ilmoituksen ilmoitus pysyy,
koska kierros ohittaa tuotannon ilmoituksen ajastimen sulkemisen ja
sulkee vain ×-painalluksesta.

## Rakentaminen ja tarkistus

```
ln -s ~/src/open-habitat/web/node_modules web/node_modules   # tai: cd web && npm ci
node design-system/prototypes/rounds/2026-11-08-avustajien-arkistointi/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
  node design-system/prototypes/rounds/2026-11-08-avustajien-arkistointi/check.mjs \
  design-system/prototypes/dist/avustajien-arkistointi/offline.html <kuvahakemisto>
```

`check.mjs` käy Nyt-näkymän ja jokaisen suunnan kulun läpi 1440 px:n ja
390 px:n leveydellä (kosketus) vaaleana ja tummana: oletusnäkymä,
keskustelu ennen arkistointia, arkistointi (puhelimessa ⋯-valikosta),
arkisto, palautus ja palautetun keskustelun avustajat. Se tarkistaa, että
tuotannon teksti nimeää molemmat avustajat ja kesken olevan kierroksen,
että Nytin ilmoitus on poissa 8 sekunnin jälkeen ja 2 Ilmoituksen pysyy,
että 3 Arkistossa näyttää kaksi avustajariviä arkistossa ja palautuksessa,
ja että palautettu Katselmoija sanoo työnsä olevan haarassa. Konsoli pysyy
puhtaana eikä sivu vuoda sivusuunnassa (352 tarkistuspistettä).
`index.html` on sama sivu ilman upotettuja fontteja.

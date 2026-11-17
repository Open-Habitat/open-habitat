# Mikä sivupalkissa vierii, kun se on täynnä – kierros 1

- **Työtilat** (1): keskusteluosiot ovat yhdessä alueessa ylhäällä ja saavat kaiken tilan paitsi Työtilojen minimin (otsikko, suodatin ja noin kolme riviä). Vain Työtilat vierii omassa alueessaan. Jos keskustelut eivät mahdu, niiden alue vierii erikseen, ja alueen reunat nimeävät näkymättömiin jääneet osiot ("↑ Sinun vuorosi 4", "↓ Käynnissä 1 · Hiljaiset 30"). Nimen napsautus vierittää osioon.
- **Laatikot** (2): jokaisella osiolla on oma enimmäiskorkeutensa ja oma vierityksensä, ja otsikko pysyy laatikon yläreunassa. Työtilat saa loput tilasta.
- **Katto** (3): osioista näkyy muutama rivi (4/3/3 900 px:n ikkunassa, 3/2/2 700 px:n ja 2/1/1 sitä matalammassa), ja "Näytä kaikki · n lisää" avaa loput paikalleen. Avoin keskustelu ei koskaan jää katon taakse. Työtilat vierii kuten 1:ssä.

Issue `rail-scroll-region`. Suunnat, mittaukset, suositus ja kysymykset
ovat issuen `result.md`:ssä.

Sivu on tuotannon kehys: `AppShell`, `WorkspaceRail`, `SearchDoor`,
`NowSections`, `QuietSection`, `WorkspaceNavRow` ja `WorkspaceActions`
(rivin + uusi keskustelu), sekä avoin keskustelu `ConversationFrame`,
`AgentHeader`, `ConversationTimeline` ja `Composer`. Kierroksen omaa on
`.rs-convs`-kääre keskusteluosioiden ympärillä, suuntien CSS
(`round.css`), vierityksen reunavarjo (`updateEdges`), suunnan 1
reunanimet (`rowsBeyond`, `Beyond`), suunnan 3 katto ja Näytä kaikki
(`applyCaps`, `ShowAll`) sekä ⌥↑/⌥↓, joka tuo avatun rivin näkyviin
siinä alueessa, jossa rivi on. Tuotannon näppäimet eivät tällä hetkellä
vieritä kohdetta näkyviin.

Katselmoinnin palkissa valitaan tilanne (ruuhka 6 / 5 / 30 ja 40
työtilaa tai tavallinen 2 / 1 / 5 ja 24 työtilaa), korkeus (selaimen
ikkuna, 900, 700 tai 560 px; kehys on silloin juuri niin korkea), teema
ja kieli. Samat valinnat saa osoitteella: `?world=modest`,
`?height=h700`, `?quiet=folded`, `?theme=dark|contrast`, `?lang=en` ja
`?d=0|1|2`.

## Rakentaminen ja tarkistus

```
node design-system/prototypes/rounds/2026-11-16-rail-scroll/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright timeout 580 \
  node design-system/prototypes/rounds/2026-11-16-rail-scroll/check.mjs \
  design-system/prototypes/dist/rail-scroll/offline.html <kuvahakemisto> [--quick]
```

`web/node_modules` tarvitaan lukitiedoston mukaisena (`npm ci --prefix web`).
Tarkistus kirjoittaa kuvat (koko sivu ja `rail-*.png` pelkkä sivupalkki)
sekä `rows.json`-taulukon, joka kertoo, montako riviä kustakin osiosta
näkyy. Se taulukko on `result.md`:n mittausten lähde.

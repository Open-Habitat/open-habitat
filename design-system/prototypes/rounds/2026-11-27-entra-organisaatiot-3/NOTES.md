# Microsoft 365 usealle organisaatiolle – kierros 3

Issue `passably-subdued-sticks`. Jarin valinta, muutokset, suositus ja
kysymykset ovat issuen `result.md`:n kohdassa "Kierros 3".

Kierros jatkaa kierroksen 2 suuntaa A2: Microsoft-rivin Organisaatiot-painike
Tasot-painikkeen vieressä. Painike avaa ikkunan samalla tavalla kuin tuotannon
Tasot (`MicrosoftLevelsDialog`): keskitetty modaali samalla overlaylla, pysyvä
otsikko ja vaiheet ikkunan sisällä. Hyväksyntä, lisäys ja poisto ovat ikkunan
vaiheita, jotka palaavat listaan, ja fokus palaa riville, jolta vaihe avattiin.
Rivin oma *Mitä tasot sallivat* on piilotettu. A2a ja A2b eroavat vain listan
rivin asettelulta (kaksi riviä tai yksi). Henkilön näkymä on kierroksen 2.

Tuotannon `ServerIntegrations`, `IntegrationsOverview`, `ConnectDialog` ja
`AccountCard` ovat muuttamattomia; kierros lisää osansa portaaleilla tai
rakentaa ikkunat tuotannon palasista. Tekstit ovat `text.ts`:ssä suomeksi ja
englanniksi. Organisaatiot, henkilö ja tunnisteet ovat synteettisiä.

URL: `?v=` suunta (1 Nyt, 2 A2a, 3 A2b), `?view=admin|person`, `?s=`
tilanne (ylläpitäjä: `lista`, `auki`, `lisaa`, `hyvaksynta`, `poisto`;
henkilö: `henkilo`, `taso`, `koodi`, `valmis`, `kielto`; Nyt: `lista`,
`henkilo`, `taso`), `?lang=en`, `?theme=dark`. Näkymä ja tilanne säilyvät,
kun suuntaa vaihdetaan valitsimesta. Laitekoodivaiheen katkoviivainen palkki
on kierroksen ohjaus, jolla valitaan kirjautumisen tulos.

## Rakentaminen ja tarkistus

```
npm ci --prefix web
node design-system/prototypes/rounds/2026-11-27-entra-organisaatiot-3/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright timeout 590 \
  node design-system/prototypes/rounds/2026-11-27-entra-organisaatiot-3/check.mjs \
  design-system/prototypes/dist/2026-11-27-entra-organisaatiot-3/offline.html <kuvahakemisto>
```

`offline.html` on yksi itsenäinen tiedosto fontteineen; `index.html` on
sama ilman upotettuja fontteja. `check.mjs`:n alku kertoo, mitä se
tarkistaa; `--quick` ajaa vain 1440 vaalean suomeksi.

# Microsoft 365 usealle organisaatiolle – kierros 2

Issue `passably-subdued-sticks`. Suunnat, suositus, sanamäärät ja kysymykset
ovat issuen `result.md`:n kohdassa "Kierros 2".

Kierros jatkaa kierroksen 1 suuntaa A: organisaatiot kuuluvat
Microsoft-riville, mutta lista on oletuksena kiinni. Akseli on, miten kiinni
oleva lista avautuu (A1 yhteenveto ja avaus rivin alle, A2 painike ja
ponnahdusikkuna, A3 sirut ja Hallitse…-ikkuna). Henkilön näkymä on
yläpalkin oma näkymä ja sama kaikissa suunnissa: kierroksen 1 C-rivit.

Tuotannon `ServerIntegrations`, `IntegrationsOverview`, `ConnectDialog` ja
`AccountCard` ovat muuttamattomia; kierros lisää osansa portaaleilla
(Microsoft-rivin nimisolu ja loppusolu, rivin perään lisätty listarivi,
yhdistämisikkunan `.ig-flow`, kortin otsake ja loppu) tai rakentaa ikkunat
tuotannon palasista (`Modalish`, `TextField`, `Badge`, `ControlButton`,
`ProviderMark`, react-aria-componentsin `Popover` kuten `GitStatus`).
Tekstit ovat `text.ts`:ssä suomeksi ja englanniksi; selitykset ovat yhden
Lisätietoja-avauksen takana (`more*`). Organisaatiot, henkilö ja tunnisteet
ovat synteettisiä.

URL: `?v=` suunta (1 Nyt, 2 A1, 3 A2, 4 A3), `?view=admin|person`, `?s=`
tilanne (ylläpitäjä: `lista`, `auki`, `lisaa`, `hyvaksynta`, `poisto`;
henkilö: `henkilo`, `taso`, `koodi`, `valmis`, `kielto`; Nyt: `lista`,
`henkilo`, `taso`), `?lang=en`, `?theme=dark`. Näkymä ja tilanne säilyvät,
kun suuntaa vaihdetaan valitsimesta. Laitekoodivaiheen katkoviivainen palkki
on kierroksen ohjaus, jolla valitaan kirjautumisen tulos.

## Rakentaminen ja tarkistus

```
npm ci --prefix web
node design-system/prototypes/rounds/2026-11-27-entra-organisaatiot-2/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright timeout 590 \
  node design-system/prototypes/rounds/2026-11-27-entra-organisaatiot-2/check.mjs \
  design-system/prototypes/dist/2026-11-27-entra-organisaatiot-2/offline.html <kuvahakemisto>
node design-system/prototypes/rounds/2026-11-27-entra-organisaatiot-2/wordcount.mjs
```

`offline.html` on yksi itsenäinen tiedosto fontteineen; `index.html` on
sama ilman upotettuja fontteja. `check.mjs`:n alku kertoo, mitä se
tarkistaa; `--quick` ajaa vain 1440 vaalean suomeksi. `wordcount.mjs`
tulostaa result.md:n sanamäärätaulukon ja tarvitsee kierroksen 1
`text.ts`:n vertailukohdaksi.

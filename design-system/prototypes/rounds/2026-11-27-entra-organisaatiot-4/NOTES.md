# Microsoft 365 usealle organisaatiolle – kierros 4

Issue `passably-subdued-sticks`. Jarin päätökset, muutokset, välien
korjaukset ja kysymykset ovat issuen `result.md`:n kohdassa "Kierros 4".

Kierros on A2a:n viimeistely. Microsoft-rivillä ovat vain *Organisaatiot* ja
*Tasot*, kummassakin luku samassa pillerissä (*Organisaatiot 3*, *Tasot 4/4*).
Asetettujen tasojen nimet ovat Tasot-painikkeen saavutettavassa nimessä ja
vihjeessä sekä Tasot-ikkunassa. Tuotannon oma Tasot-painike on rivillä
piilotettuna, ja kierroksen painike avaa sen kautta tuotannon ikkunan.
Organisaatiot avautuu kuten kierroksella 3: keskitetty ikkuna, jonka vaiheet
(lisäys, hyväksyntä, poisto) palaavat listaan. Henkilön näkymä on kierroksen 2.

Tuotannon `ServerIntegrations`, `IntegrationsOverview`, `ConnectDialog` ja
`AccountCard` ovat muuttamattomia; kierros lisää osansa portaaleilla, ja
tuotannon osien välikorjaukset ovat `round.css`:ssä vain A2a:lle
(`html[data-rq-direction="1"]`). Tekstit ovat `text.ts`:ssä suomeksi ja
englanniksi. Organisaatiot, henkilö ja tunnisteet ovat synteettisiä.

URL: `?v=` suunta (1 Nyt, 2 A2a), `?view=admin|person`, `?s=` tilanne
(ylläpitäjä: `lista`, `osittain` eli Tasot 2/4, `auki`, `lisaa`,
`hyvaksynta`, `poisto`; henkilö: `henkilo`, `taso`, `koodi`, `valmis`,
`kielto`; Nyt: `lista`, `henkilo`, `taso`), `?lang=en`, `?theme=dark`.
Näkymä ja tilanne säilyvät, kun suuntaa vaihdetaan valitsimesta.
Laitekoodivaiheen katkoviivainen palkki on kierroksen ohjaus, jolla valitaan
kirjautumisen tulos.

## Rakentaminen ja tarkistus

```
npm ci --prefix web
node design-system/prototypes/rounds/2026-11-27-entra-organisaatiot-4/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright timeout 590 \
  node design-system/prototypes/rounds/2026-11-27-entra-organisaatiot-4/check.mjs \
  design-system/prototypes/dist/2026-11-27-entra-organisaatiot-4/offline.html <kuvahakemisto>
```

`offline.html` on yksi itsenäinen tiedosto fontteineen; `index.html` on
sama ilman upotettuja fontteja. `check.mjs`:n alku kertoo, mitä se
tarkistaa, myös välit: kaksi näkyvää kontrollia eivät ole lähempänä kuin
`--ah-control-gap`, ja poisto on vähintään `--ah-s4` edellisestä. `--quick`
ajaa vain 1440 vaalean suomeksi.

# Microsoft 365 usealle organisaatiolle – kierros 1

Issue `passably-subdued-sticks`. Suunnat, suositus ja kysymykset ovat
issuen `result.md`:ssä.

Nyt näyttää tuotannon `ServerIntegrations`-sivun (Microsoft-rivin Tasot-
painike avaa tuotannon `MicrosoftLevelsDialog`in), `IntegrationsOverview`n,
`ConnectDialog`in ja `AccountCard`in muuttamattomina yhdellä organisaatiolla.
Suunnat A, B ja C käyttävät samoja komponentteja muuttamattomina ja lisäävät
omat osansa portaaleilla (Microsoft-rivin nimisolu, yhdistämisikkunan
`.ig-flow`, kortin otsake ja loppu) tai omina ikkunoinaan tuotannon
palasista: `Modalish`, `Progress`, `Val`, `Copy`, `TextField`,
`PeopleList`, `PeopleRow`, `SectionCard`, `SectionLead`, `Badge`,
`ProviderMark`. Organisaatiot, henkilö, osoitteet, tenant- ja client ID:t
ovat synteettisiä. Kaikki kierroksen tekstit ovat `text.ts`:ssä suomeksi ja
englanniksi; tuotannon tekstit vaihtuvat `setPersonalLanguage`lla.

Yläpalkissa valitaan tilanne (ylläpitäjä tai henkilö), kieli ja teema.
URL: `?v=` suunta (1 Nyt, 2 A, 3 B, 4 C), `?s=` tilanne (`lista`, `opas`,
`lisaa`, `hyvaksynta`, `poisto`, `henkilo`, `organisaatio`, `koodi`,
`yhdistetty`, `kiellot`; Nyt: `yllapito`, `henkilo`), `?lang=en`,
`?theme=dark`. Laitekoodivaiheen katkoviivainen palkki on kierroksen ohjaus,
jolla valitaan kirjautumisen tulos.

## Rakentaminen ja tarkistus

```
npm ci --prefix web
node design-system/prototypes/rounds/2026-11-27-entra-organisaatiot/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright timeout 590 \
  node design-system/prototypes/rounds/2026-11-27-entra-organisaatiot/check.mjs \
  design-system/prototypes/dist/2026-11-27-entra-organisaatiot/offline.html <kuvahakemisto>
```

`offline.html` on yksi itsenäinen tiedosto fontteineen; `index.html` on
sama ilman upotettuja fontteja. Tarkistus: 944 tarkistusta (1440 ja 390,
vaalea ja tumma, fi ja en, vähennetty liike, kulut klikattuina), konsoli
puhdas. `--quick` ajaa vain 1440 vaalean suomeksi.

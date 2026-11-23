# Verkkohaun avain – kierros 2

Issue `proto-web-search-key`. Suunnat, host-tiedot, päätökset ja kysymykset
ovat issuen `result.md`:n Kierros 2 -osiossa.

Sivu on tuotannon kehys (`AppShell`, `WorkspaceRail`) ja koko tuotannon
`AccountSettings` muuttamattomana. Host on `fetch`-sijainen, joka vastaa
sopimusten esimerkeillä (`server`, `server/speech-key`,
`server/integrations`, `integrations`, `server/onboarding`, `ai-key/copies`,
`speech/key`, `pi/*`). Yläpalkin *Näkymä* vaihtaa ylläpitäjän ja henkilön
välillä, ja ylläpitäjä on oletus. Hakuavaimen kaksi riviä (`SiteSearchKey`,
`PersonSearchKey`) ovat tuotannon saneluavaimen rivien kopiot
(`app/SpeechSettings.tsx`), ja niissä on vain hakuavaimen omat erot. Ne on
koottu tuotannon palasista ja viety portaalilla oikealle paikalleen
(`useSlot`). A:n osiota ei ole tuotannon luettelossa, joten A seisoo
sanelun reitillä: oma linkki tulee sanelun linkin perään ja saa
nykyisyysmerkin, ja tuotannon sivu sen alla piilotetaan.

`text.ts` on kierroksen sanasto suomeksi ja englanniksi.
`?view=admin|person`, `?s=<tilanne>` ja `?theme=dark` valitsevat alkutilan.
Avain, joka alkaa `huono` tai `bad`, epäonnistuu koehaussa. Muut vähintään
20 merkin avaimet kelpaavat.

## Rakentaminen ja tarkistus

```
node design-system/prototypes/rounds/2026-11-23-hakuavain-2/build.mjs <out>
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright timeout 580 \
  node design-system/prototypes/rounds/2026-11-23-hakuavain-2/check.mjs \
  <out>/offline.html <kuvahakemisto>
```

`web/node_modules` tarvitaan lukitiedoston mukaisena (`npm ci --prefix web`).
`offline.html` on yksi itsenäinen tiedosto fontteineen. `index.html` on sama
ilman upotettuja fontteja glasspadia varten. Tarkistus: 427 tarkistusta,
konsoli puhdas.

# Atlassian- ja Trello-yhteys – kierros 1

Issue `proto-mcp-connect-dialog`. Suunnat, suositus, host-tiedot, päätökset
ja kysymykset ovat issuen `result.md`:ssä.

Sivu on tuotannon `IntegrationsOverview` muuttamattomana synteettisellä
listalla (Googlen tili, Trello tai Atlassian ja tiilet). Nyt-suunta käyttää
myös tuotannon `ConnectDialog`ia ja `AccountCard`ia. Muut suunnat korvaavat
vain dialogin ja valitun palvelun tilikortin. Ne on koottu tuotannon
palasista (`ControlButton`, `controlClassName`, `Icon`, `StatusMark`,
`TextField`, `ProviderMark`, react-arian ikkuna ja radioryhmä) ja
`Integrations.css`:n luokista (`ig-levels`, `ig-steps`, `ig-notice`,
`ig-expect`, `ig-result`, `ig-card`, `ig-grant`). Kortti viedään
portaalilla tuotannon kortin paikalle (`display: contents` -paikka heti
piilotetun tuotannon kortin jälkeen).

Yläpalkissa valitaan palvelu (Trello tai Atlassian), tilanne, teema, liike
ja kieli; `?p=`, `?s=`, `?theme=dark` ja `?lang=en` valitsevat alkutilan.
Paluuosoitteeksi kelpaa mikä tahansa `http://127.0.0.1:45678/callback`-alkuinen
osoite, ja muu osoite torjutaan. `text.ts` on kierroksen sanasto suomeksi ja
englanniksi. Henkilö, sivusto (`contoso-demo.atlassian.net`) ja Workspacet
(`Kotiremontti`, `Contoso Markkinointi`) ovat synteettisiä.

## Rakentaminen ja tarkistus

```
npm ci --prefix web          # jos web/node_modules puuttuu
node design-system/prototypes/rounds/2026-11-23-mcp-connect-dialog/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright timeout 590 \
  node design-system/prototypes/rounds/2026-11-23-mcp-connect-dialog/check.mjs \
  design-system/prototypes/dist/mcp-connect-dialog/offline.html <kuvahakemisto>
```

`offline.html` on yksi itsenäinen tiedosto fontteineen; `index.html` on sama
ilman upotettuja fontteja glasspadia varten. Tarkistus: 812 tarkistusta,
konsoli puhdas. `--quick` ottaa vain 1440 vaalean kierroksen.

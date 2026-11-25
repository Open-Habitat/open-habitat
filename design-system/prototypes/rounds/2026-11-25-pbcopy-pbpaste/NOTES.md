# pbcopy ja pbpaste – kierros 1

Issue `pbcopy-pbpaste-every`. Jari 25.11.2026: `pbpaste` ja `pbcopy` kaikkiin
asennuksiin, silta selaimen leikepöytään. Akseli: missä agentin kopiointi
(`pbcopy`) ja pyyntö lukea leikepöytä (`pbpaste`) näkyvät.

- Nyt: komentoja ei ole (`exit 127`). Agentti kirjoittaa tekstin
  vastaukseensa koodilohkoon, ja leikepöydän sisältö tulee henkilön omana
  viestinä. Avaimesta ei varoiteta.
- A Kortti: Habitatin kortti agentin vuorossa heti komentorivin jälkeen.
  Kopioi-painike; pyyntökortissa Liitä leikepöydältä / Älä anna, sen jälkeen
  esikatselu ja Anna agentille. Ratkennut pyyntö jää yhdeksi riviksi.
- B Kenttä: Chromiumissa (fokus) kopiointi menee suoraan, ja aikajanalla on
  rivi "Kopioitu…"; Safarissa ja Firefoxissa sama rivi saa Kopioi-painikkeen.
  Pyyntö telakoituu kentän yläpuolelle, liitetty teksti on muokattava ennen
  antamista.
- C Ilmoitus: tuotannon `WarningBannerView` sivuilmoituksena; aikajanalla
  vain komennon rivi ja ratkennut rivi.

Kaikissa lukeminen vaatii painalluksen, annettava teksti näytetään ennen kuin
se lähtee, avaimen näköinen teksti saa varoituksen ja Älä anna on silloin
ensisijainen. Oikealla (puhelimessa alla) näkyy, mitä agentti saa: tuloste,
viesti ja exit-koodi (0, 1 `clipboard_declined`, 4 `clipboard_timeout`).
Selainvalinta näyttää Chromiumin ja eleen vaativien selainten eron.

Tarina: 1 agentti kopioi, 2 kopioitu, 3 pyyntö, 4 liitetty mutta ei annettu,
5 annettu, 6 leikepöydällä avain, 7 ei annettu, 8 kukaan ei vastannut
(pyyntö vanheni). Kortin painikkeet vievät tarinaa.

Tuotannosta: `ConversationFrame`, `AgentHeader`, `ConversationTimeline`,
`UserMessage`, `AssistantMessage`, `ToolRow`, `Composer`, `Markdown`, `Icon`,
`WarningBannerView` ja Habitat-rivin ja -kortin luokat (`ah-mp-line`,
`ah-mp-card`). Kierroksen omia ovat kortit, telakka, esikatselu ja varoitus
tokenien päällä. Tuotantokomponentteja ei muutettu. Sisältö on keksittyä;
avain on `OH_DEMO_TOKEN=demo-…-not-a-real-key`.

## Rakentaminen ja tarkistus

```
ln -s <open-habitat>/web/node_modules web/node_modules   # tai: cd web && npm ci
node design-system/prototypes/rounds/2026-11-25-pbcopy-pbpaste/build.mjs [<out>]
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
  node design-system/prototypes/rounds/2026-11-25-pbcopy-pbpaste/check.mjs \
  design-system/prototypes/dist/pbcopy-pbpaste/offline.html <kuvahakemisto>
```

Oletustulos on `design-system/prototypes/dist/pbcopy-pbpaste/` (`offline.html`
fontteineen, `index.html` ilman fontteja Glasspadin hiekkalaatikkoon).
`check.mjs` tarjoilee sivun näkymän hiekkalaatikon CSP:llä ja käy neljä
suuntaa Päivä-, Yö- ja Korkea kontrasti -teemassa 1440 ja 390 px vähennetyllä
liikkeellä suomeksi ja kahdesti englanniksi. Konsolin pitää pysyä puhtaana.
Linuxissa ajetaan scratch-leasen alla omalla TMPDIR:llä.

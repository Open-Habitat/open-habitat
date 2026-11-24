# Ajat keskustelussa – kierros 1

Issue `times-conversations-prototype`. Jari 24.11.2026: keskusteluissa ja
viesteissä ei näy aikoja lainkaan. Host-tiedot ja suositus ovat issuen
`result.md`:ssä.

Akseli: kuinka paljon aikaa oletusnäkymä näyttää. Nyt (nykytila), A Päivät,
B Kello, C Tauot. Keskustelu alkaa perjantaina 20.11., jatkuu maanantaina
aamulla ja illalla ja päättyy tiistaiaamuun; ”nyt” on ti 24.11. klo 10.12
Helsingin aikaa. Lyhyitä vaihtoja (12 s, 41 s) ja pitkiä vuoroja (6 min,
23 min). Yläpalkin valinnat: teema, kieli (suomi/English), laitteen
aikavyöhyke (Helsinki/New York) ja viimeinen vuoro (Valmis/Käynnissä).
Sivupalkissa on tuotannon rivi ikineen (”4 min”, ”17 t”, ”1 pv”).

Tuotannosta: `ConversationFrame`, `AgentHeader`, `ConversationTimeline`,
`UserMessage` (sen olemassa oleva `time`-props), `AgentTurn` (työrivin kesto,
välivastaus, elävä kello), `ToolRow`, `Markdown`, `Composer` ja
`AgentNavItem`. Kierroksen omia ovat päiväerotin, taukomerkki ja C:n
vuoron loppurivi tokenien päällä. Tuotantokomponentteja ei muutettu.
`AgentTurn`in vastauskortilla ei ole `time`-propsia, joten A ja B asettavat
tallennetun ajan sen otsakkeeseen ulkoa (`TimedTurn`); toteutuksessa
`StageReply` saisi ajan propsina.

## Rakentaminen ja tarkistus

```
ln -s <open-habitat>/web/node_modules web/node_modules   # tai: cd web && npm ci
node design-system/prototypes/rounds/2026-11-24-times-conversations/build.mjs <out>
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
  node design-system/prototypes/rounds/2026-11-24-times-conversations/check.mjs \
  <out>/offline.html <kuvahakemisto>
```

`check.mjs` tarjoilee sivun näkymän hiekkalaatikon CSP:llä ja käy kaikki
neljä suuntaa Päivä-, Yö- ja Korkea kontrasti -teemassa 1440 ja 390 px
vähennetyllä liikkeellä suomeksi ja kahdesti englanniksi: mitkä ajat
oletusnäkymä näyttää, päiväerottimet ja taukomerkit, A:n osoitin ja
napautus, C:n loppurivi, käynnissä olevan vuoron kello, aikavyöhykkeen
vaihto ja sivupalkin iät. Selaimen oma vyöhyke on tarkoituksella Tokio,
jotta mikään ei nojaa siihen. Konsolin pitää pysyä puhtaana.

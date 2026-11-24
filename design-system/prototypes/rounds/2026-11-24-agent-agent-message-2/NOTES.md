# Agentin viesti toiselle keskustelulle – kierros 2

Issue `agent-agent-message`. Jari 24.11.2026 kierroksesta 1: ei pyyntö- ja
vastausprotokollaa. Kaksi agenttia vaihtaa tasavertaisia viestejä kuin kaksi
ihmistä; viesti takaisin on viesti, ei "vastaus viestiin X". Vastaanottajan
puoli on kierroksen 1 A Kirje; lähettäjän puoli ajatellaan virtana ajassa.

Akseli: miltä edestakainen vaihto näyttää ajan mittaan kummallakin puolella.
Nyt (nykytila), A Kirjeet, B Säie, C Nauha. Sama tarina kaikissa viidessä
vaiheessa, jotka kertyvät: viesti lähtee, yksi takaisin, viesti tulee kesken
lähettäjän vuoron (odottaa jonossa lähettäjä nimettynä), useita takaisin,
lainaus aiemmasta viestistä (m4 lainaa m3:a, m5 lainaa m4:ää). Keskustelun
nimi viestissä vie toiseen paneeliin samaan viestiin; lainaus ja säikeen
osoitinrivi vievät alkuperäiseen samassa paneelissa (vähennetyllä liikkeellä
liikkumaton reunus). Sivun alla näkyy, mitä kummankin Pi sai viimeksi.
Aikaleimoja ei suunniteltu (oma issuensa `times-conversations-prototype`).

Tuotannosta: `ConversationFrame`, `AgentHeader`, `ConversationTimeline`,
`UserMessage`, `AssistantMessage`, `ToolRow`, `Composer` jonoineen,
`Markdown`, `Icon`, Habitat-rivin luokat (`ah-mp-line`) ja lainauksen
pinta (`ah-reply-sent`, `quotePlain`). Kierroksen omia ovat kirjeet,
säie, osoitinrivi ja nauharivi tokenien päällä. Tuotantokomponentteja ei
muutettu.

## Rakentaminen ja tarkistus

```
ln -s <open-habitat>/web/node_modules web/node_modules   # tai: cd web && npm ci
node design-system/prototypes/rounds/2026-11-24-agent-agent-message-2/build.mjs <out>
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
  node design-system/prototypes/rounds/2026-11-24-agent-agent-message-2/check.mjs \
  <out>/offline.html <kuvahakemisto>
```

`check.mjs` tarjoilee sivun näkymän hiekkalaatikon CSP:llä ja käy kaikki
neljä suuntaa Päivä-, Yö- ja Korkea kontrasti -teemassa 1440 ja 390 px
vähennetyllä liikkeellä suomeksi ja kahdesti englanniksi, vaiheet läpi.
Konsolin pitää pysyä puhtaana.

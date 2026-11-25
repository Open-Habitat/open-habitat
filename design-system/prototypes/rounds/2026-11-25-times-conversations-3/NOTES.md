# Ajat keskustelussa – kierros 3

Issue `times-conversations-prototype`. Jari 25.11.2026 kierroksesta 2:
A Otsake (aika heti nimen perässä kummankin viesteissä). Tämä kierros
tutkii sen päällä kahta asiaa: milloin vuoron kesto näkyy ja miten
pysäytetty vuoro kertoo, kauanko se kesti. Suositus ja päätökset ovat
issuen `result.md`:ssä.

Suunnat: Nyt (= kierroksen 2 A), A Jokainen pitkä, B Vain uusi tieto ja
C Loppurivi. Kynnys on kaikissa 5 min; suunnat eroavat siinä, mihin
vuoroihin kesto tulee ja mihin kohtaan. Keskustelu on kierroksen 2 oma,
ja siihen on lisätty neljän vaiheen vuoro (48 min), henkilön kesken
työkalun pysäyttämä vuoro (12 min), henkilön pysäyttämä kaksivaiheinen
vuoro (8 min) ja palvelimen uudelleenkäynnistyksen katkaisema vuoro
(11 min). Samat valinnat kuin aiemmin (teema, kieli, laitteen
aikavyöhyke, viimeinen vuoro Valmis/Käynnissä).

Tuotannosta: `ConversationFrame`, `AgentHeader`, `ConversationTimeline`,
`UserMessage` (`time`-props), `AgentTurn` (työrivit kestoineen,
välivastaukset, pysäytetyn vuoron rivi, elävä kello), `ToolRow`
(`.ah-ordered-blocks`-kääreessä kuten `HistoryView`), `Markdown`,
`Composer`, `AgentNavItem` sekä `agentTurnText`- ja
`conversationEventsText`-sanastot. Tuotantokomponentteja ei muutettu.
Vastauskortilla ei ole aika-propsia eikä pysäytetyn vuoron rivillä
kestoa, joten `Timed` asettaa ajan, keston ja A–C:n uudelleen
muotoillun pysäytysrivin ulkoa; tuotannon oma pysäytysteksti jää
DOMiin piilotettuna, jotta React omistaa yhä solmunsa.

Aikavyöhykevalinta esittää laitteen vyöhykettä. Tuotannon pysäytysrivi
muotoilee ajan selaimen oletusvyöhykkeessä, joten sivu tekee valitusta
vyöhykkeestä `Intl.DateTimeFormat`in oletuksen eikä muuta tuotantoa.

## Rakentaminen ja tarkistus

```
ln -s <open-habitat>/web/node_modules web/node_modules   # tai: cd web && npm ci
node design-system/prototypes/rounds/2026-11-25-times-conversations-3/build.mjs <out>
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
  node design-system/prototypes/rounds/2026-11-25-times-conversations-3/check.mjs \
  <out>/offline.html <kuvahakemisto>
```

Oletus-`<out>` on `design-system/prototypes/dist/times-conversations-3`.
`check.mjs` tarjoilee sivun näkymän hiekkalaatikon CSP:llä ja käy kaikki
neljä suuntaa Päivä-, Yö- ja Korkea kontrasti -teemassa 1440 ja 390 px
vähennetyllä liikkeellä suomeksi ja kahdesti englanniksi: jokainen aika
nimen perässä, päiväerottimet, mitkä vuorot saavat keston ja mihin
(vastauksen otsake, pysäytysrivi, loppurivi), kesto alas pyöristettynä,
tuotannon pysäytysrivi Nyt-suunnassa ja uudelleen muotoiltu muissa,
katkennut ja kesken työkalun pysäytetty vuoro, käynnissä olevan vuoron
kello ilman kestoa, aikavyöhykkeen vaihto ja sivupalkin iät. Selaimen
oma vyöhyke on tarkoituksella Tokio. Konsolin pitää pysyä puhtaana.

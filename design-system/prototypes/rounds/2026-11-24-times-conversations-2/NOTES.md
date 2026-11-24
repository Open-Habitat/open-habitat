# Ajat keskustelussa – kierros 2

Issue `times-conversations-prototype`. Jari 24.11.2026 kierroksesta 1:
B Kello (aika jokaisessa viestissä) ja päiväerottimet. Tämä kierros tutkii
B:n päällä kahta asiaa: pitkän vuoron loppua (”Valmis 17.03 · vuoro kesti
23 min”) ja ajan paikkaa viestissä. Suositus ja päätökset ovat issuen
`result.md`:ssä.

Suunnat: Nyt (= kierroksen 1 B), A Otsake, B Kuplan alla, C Marginaali.
Jokainen yhdistää yhden paikan ja yhden loppusäännön (kynnys 5, 2 ja
10 min). Sama keskustelu ja samat valinnat kuin kierroksella 1 (teema,
kieli, laitteen aikavyöhyke, viimeinen vuoro Valmis/Käynnissä). Sivupalkin
ikä on tuotannon kulunut aika (päätetty).

Tuotannosta: `ConversationFrame`, `AgentHeader`, `ConversationTimeline`,
`UserMessage` (sen `time`-props Nyt- ja A-suunnissa), `AgentTurn` (työrivin
kesto, välivastaus, elävä kello), `ToolRow`, `Markdown`, `Composer` ja
`AgentNavItem`. Kierroksen omia ovat päiväerotin, kuplan alla oleva rivi,
marginaali ja kesto tokenien päällä. Tuotantokomponentteja ei muutettu.
`AgentTurn`in vastauskortilla ei ole `time`-propsia, joten `Timed` asettaa
ajan ulkoa otsakkeeseen, kortin alle tai marginaaliin; C siirtää ajan
sivuttain reunaan (`placeMargins`), mutta se pysyy otsakkeessa, joten
ruudunlukija lukee sen viestin kohdalla. Rivit ovat tuotannon lajeja
(`user`, `assistant`, `marker`), toisin kuin kierroksella 1, joten
välistys vastaa `HistoryView`tä.

## Rakentaminen ja tarkistus

```
ln -s <open-habitat>/web/node_modules web/node_modules   # tai: cd web && npm ci
node design-system/prototypes/rounds/2026-11-24-times-conversations-2/build.mjs <out>
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
  node design-system/prototypes/rounds/2026-11-24-times-conversations-2/check.mjs \
  <out>/offline.html <kuvahakemisto>
```

`check.mjs` tarjoilee sivun näkymän hiekkalaatikon CSP:llä ja käy kaikki
neljä suuntaa Päivä-, Yö- ja Korkea kontrasti -teemassa 1440 ja 390 px
vähennetyllä liikkeellä suomeksi ja kahdesti englanniksi: päiväerottimet,
jokaisen ajan paikka omaan korttiinsa nähden (otsakkeen oikea reuna, nimen
perässä, kortin alla omalla puolella, marginaalissa omalla puolella), mitkä
vuorot saavat keston millä kynnyksellä, kesto vastaa työriviä (alas
pyöristettynä), käynnissä olevan vuoron kello ilman kestoa, aikavyöhykkeen
vaihto ja sivupalkin iät. Selaimen oma vyöhyke on tarkoituksella Tokio.
Konsolin pitää pysyä puhtaana.

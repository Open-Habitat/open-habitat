# Agentin viesti toiselle keskustelulle – kierros 3

Issue `agent-agent-message`. Jari 24.11.2026 kierroksesta 2: A Kirjeet.
Tuleva viesti pysyy kierroksen 2 A:na. Akseli: lähtevä viesti lähettäjän
puolella – näytetäänkö se aina omana kuplanaan vai vain, kun agentin teksti
ei kerro sitä, ja minkä muotoisena.

- Nyt = kierroksen 2 A: katkoviivakupla aina siinä, missä viesti lähti.
- A Peili: aina oma kupla, tulevan kirjeen peilikuva agentin puolella.
- B Rivi: aina, tiivis avattava rivi vuoron seuraavan vastauksen alla
  (ennen vastausta vuoron lopussa).
- C Upotettu: vastaus, joka linkittää viestin, kantaa sen lainauslohkona;
  vain jos mikään vastaus ei linkitä sitä, lohko on omana rivinään siinä,
  missä viesti lähti.

Tarina on kierroksen 2 viisi vaihetta, ja vaiheet 6–7 jatkavat vaihtoa
silmukaksi (selitteen muoto edestakaisin), kunnes karkaamisvahti pidättää
11. peräkkäisen viestin kummassakin keskustelussa näkyvällä kortilla
(Jatka, Älä lähetä / Näytä viesti). Nyt näyttää vaiheessa 6 kierroksen 2
hyppyrajan (`409 agent_message_chain`). Aikaleimoja ei suunniteltu.

Tuotannosta: `ConversationFrame`, `AgentHeader`, `ConversationTimeline`,
`UserMessage`, `AssistantMessage`, `ToolRow`, `Composer` jonoineen,
`Markdown`, `Icon`, Habitat-rivin ja -kortin luokat (`ah-mp-line`,
`ah-mp-card`) ja lainauksen pinta (`ah-reply-sent`, `quotePlain`).
Kierroksen omia ovat kirjeet, rivi, upotettu lohko ja vahtikortti tokenien
päällä. Tuotantokomponentteja ei muutettu.

## Rakentaminen ja tarkistus

```
ln -s <open-habitat>/web/node_modules web/node_modules   # tai: cd web && npm ci
node design-system/prototypes/rounds/2026-11-24-agent-agent-message-3/build.mjs <out>
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
  node design-system/prototypes/rounds/2026-11-24-agent-agent-message-3/check.mjs \
  <out>/offline.html <kuvahakemisto>
```

`check.mjs` tarjoilee sivun näkymän hiekkalaatikon CSP:llä ja käy kaikki
neljä suuntaa Päivä-, Yö- ja Korkea kontrasti -teemassa 1440 ja 390 px
vähennetyllä liikkeellä suomeksi ja kahdesti englanniksi, seitsemän
vaihetta läpi. Konsolin pitää pysyä puhtaana.

# Agentin viesti toiselle keskustelulle – kierros 4

Issue `agent-agent-message`. Jari 25.11.2026 kierroksesta 3: A Peili, ei
karkaamisvahtia eikä hyppyrajaa. Tuleva viesti on kierroksen 2 A Kirjeet ja
lähtevä kierroksen 3 A Peili. Akseli: kuinka paljon viestilohko sanoo nimen
ja viestin lisäksi.

- Nyt = kierroksen 3 A Peili sanoineen ("· agentti", "Tämä agentti ›",
  "Viittaa viestiin · kuka · klo", "Jonossa: … oli kesken").
- A Minimi: kuvake, keskustelun nimi linkkinä, aika nimen perässä, viesti.
- B Hiljainen: A ja lainaus yhtenä rivinä, kun agentti lainasi.
- C Konteksti: B ja tila yhdellä sanalla vain, kun viesti ei mennyt suoraan
  perille ("Meni jonoon").

Tarina on kierroksen 2 viisi vaihetta. Aika on nimen perässä, kuten
aikaleimojen kierros 2 päätti (A Otsake). Kaikki lohkojen sanat ovat
`text.ts`:n `copy`-taulukossa suunnittain.

Tuotannosta: `ConversationFrame`, `AgentHeader`, `ConversationTimeline`,
`UserMessage`, `AssistantMessage`, `ToolRow`, `Composer` jonoineen,
`Markdown`, `Icon` ja lainauksen pinta (`ah-reply-sent`, `quotePlain`).
Kierroksen omia ovat kirje, peili ja yhden rivin lainaus tokenien päällä.
Tuotantokomponentteja ei muutettu.

## Rakentaminen ja tarkistus

```
ln -s <open-habitat>/web/node_modules web/node_modules   # tai: cd web && npm ci
node design-system/prototypes/rounds/2026-11-25-agent-agent-message-4/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
  node design-system/prototypes/rounds/2026-11-25-agent-agent-message-4/check.mjs \
  design-system/prototypes/dist/2026-11-25-agent-agent-message-4/offline.html \
  design-system/prototypes/dist/2026-11-25-agent-agent-message-4/shots
```

`build.mjs` kirjoittaa oletuksena `design-system/prototypes/dist/2026-11-25-agent-agent-message-4/`.
`check.mjs` tarjoilee sivun näkymän hiekkalaatikon CSP:llä ja käy kaikki
neljä suuntaa Päivä-, Yö- ja Korkea kontrasti -teemassa 1440 ja 390 px
vähennetyllä liikkeellä suomeksi ja kahdesti englanniksi, viisi vaihetta
läpi. Konsolin pitää pysyä puhtaana.

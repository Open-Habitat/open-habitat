# Agentin viesti toiselle keskustelulle – kierros 1

Issue `agent-agent-message`. Jari 24.11.2026: "lähetä tuolle agentille tämä
viesti". Host osaa jo lähettää (`open-habitat agent message create`); tämä
kierros näyttää, miltä vaihto näyttää kummassakin keskustelussa.
Suunnitelma ja host-tiedot ovat issuen `design.md`:ssä.

Akseli: kuinka paljon vaihdosta näkyy kummallakin puolella. Nyt (nykytila),
A Kirje, B Rivi, C Kierto. Lähettävä ja vastaanottava keskustelu ovat
rinnakkain kuten Jarilla; puhelimella allekkain. Yläpalkin valinnat:
teema, kieli (suomi/English), vastaanottajan tila (Vapaa, Kesken,
Pysähtynyt, Arkistoitu) ja vaihe (Lähetetty, Vastattu). Sivun alla näkyy
teksti, jonka vastaanottava Pi saa. Linkki keskustelusta toiseen
vierittää toisen paneelin kohtaan ja korostaa sen hetkeksi
(vähennetyllä liikkeellä liikkumaton reunus); osoite ei vaihdu.

Tuotannosta: `ConversationFrame`, `AgentHeader`, `ConversationTimeline`,
`UserMessage`, `AssistantMessage`, `ToolRow`, `Composer` (myös sen jono),
`Markdown`, `WorkspaceIcon` ja Habitat-rivin luokat (`ah-mp-line`).
Kierroksen omia ovat saapuvan viestin kortti, rivit ja lähetetyn viestin
kortti tokenien päällä. Tuotantokomponentteja ei muutettu. Jonon rivi,
jossa lähettäjä on nimetty, on tuotannon jonokortti merkkijonolla, johon
lähettäjä on lisätty; toteutuksessa nimi tulisi jonorivin
`agent_message`-tiedosta.

## Rakentaminen ja tarkistus

```
ln -s <open-habitat>/web/node_modules web/node_modules   # tai: cd web && npm ci
node design-system/prototypes/rounds/2026-11-24-agent-agent-message/build.mjs <out>
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
  node design-system/prototypes/rounds/2026-11-24-agent-agent-message/check.mjs \
  <out>/offline.html <kuvahakemisto>
```

`check.mjs` tarjoilee sivun näkymän hiekkalaatikon CSP:llä ja epäonnistuu,
jos sivu pyytää muuta, sisältää kehyksen tai vaihtaa osoitettaan. Se käy
kaikki neljä suuntaa Päivä-, Yö- ja Korkea kontrasti -teemassa 1440 ja
390 px vähennetyllä liikkeellä suomeksi ja kahdesti englanniksi:
vastaanottajan merkintä (nykyään sinun kuplasi, A:ssa ja C:ssä kortti,
B:ssä rivi, ei koskaan kupla), lähettäjän puoli, C:n palaava vastaus,
linkki paneelien välillä, vaiheet, varatun vastaanottajan jono,
pysähtynyt, arkistoidun kieltäytyminen, Pi:n saama teksti ja ylivuoto.
Konsolin pitää pysyä puhtaana.

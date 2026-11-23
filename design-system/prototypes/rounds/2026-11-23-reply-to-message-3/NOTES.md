# Vastaa agentin viestiin – kierros 3

Issue `reply-to-agent-message`. Jari 23.11.2026: vastauspainike on agentin
viestin oikeassa yläkulmassa, lainaus on kentän sisällä (kierroksen 2 B) ja
arkkitehtuurivaihtoehto 1 on hyväksytty. Tämä kierros riffaa kolmea asiaa:

1. **Kulmapainike**: A Kopioin pari, B Rajattu ja hiljainen, C Sävytetty
   pilleri; levossa, osoittimen alla, fokuksessa, vastattaessa ja puhelimessa,
   Päivä- ja Yö-teemassa.
2. **Pitkän viestin lainaus kentässä**: A Kaksi riviä, B Avattava viesti,
   C Sama kuin agentille.
3. **Otteen pituus**: a 280 merkkiä, b ensimmäinen virke, c alku
   rakenteineen; neljällä viestillä (lyhyt, pitkä, alkaa koodilla, lista)
   rinnakkain se, mitä agentti saa, ja se, mitä kentässä näkyy.

Sivu on yksi vierivä dokumentti, joka toimii Habitat-näkymänä: ei kehyksiä,
ei siirtymiä, ei verkkoa. Valitsimen suunta (A, B, C) vaihtaa elävän
keskustelun painikkeen (1) ja lainauksen (2); sen alla osiot näyttävät kaikki
muunnelmat rinnakkain, joten painikkeen ja lainauksen voi valita eri
suunnista. Osion 3 valinta vaihtaa elävän keskustelun ja suunnan C otteen.
Puhelinsarake soveltaa kosketuksen sääntöjä puhelimen levyiseen sarakkeeseen;
oikea puhelinasettelu on sama sivu puhelimen levyisenä. Valitsimen `?v=`-kirjanpito
pidetään muistissa, koska näkymän hiekkalaatikko ei saa vaihtaa osoitettaan.

Rakennettu tuotannon komponenteista (`ConversationFrame`, `AgentHeader`,
`ConversationTimeline`, `UserMessage`, `AssistantMessage`, `ToolRow`,
`Composer`, `ControlButton`, `Icon`, `Markdown`). Kierroksen omia ovat
vastausnuoli, lainauksen säännöt ja otteen kolme sääntöä, jotka ovat
`round.tsx`:ssä (`excerptA`, `excerptB`, `excerptC`). `AssistantMessage` ei
vielä ota `actions`-proppia, joten painike viedään portaalilla kortin
`actions`-paikkaan.

## Rakentaminen ja tarkistus

```
ln -s <open-habitat>/web/node_modules web/node_modules   # tai: cd web && npm ci
node design-system/prototypes/rounds/2026-11-23-reply-to-message-3/build.mjs <out>
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
  node design-system/prototypes/rounds/2026-11-23-reply-to-message-3/check.mjs \
  <out>/offline.html <kuvahakemisto>
```

`check.mjs` tarjoilee sivun näkymän hiekkalaatikon CSP:llä (läpinäkymätön
alkuperä, ei yhteyksiä eikä kehyksiä) ja epäonnistuu, jos sivu pyytää mitään
muuta, sisältää kehyksen tai vaihtaa osoitettaan. Se käy kaikki suunnat
Päivä-, Yö- ja Korkea kontrasti -teemassa 1440 ja 390 px: rivit, painikkeen
paikka ja koko, lainaus kentän sisällä, avaus ja sen raja, hyppy, ✕, uusi
vastaus, lähetys, painikematriisi, lainausmatriisi ja otetaulukko (pituus,
rakenne, mitä agentti saa). Konsolin pitää pysyä puhtaana.

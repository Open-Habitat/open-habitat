# Koskematon paikkamerkki lähtiessä

Issue `proto-start-page-request-presentation`, kierros 3. Jari 6.11.: suunta
**Siru ja lause** on valittu, eikä kentän alle tule vihjettä. Auki jäi
kysymys (b): mitä tapahtuu, kun pyynnön lähettää koskematta hakasulkeista
paikkamerkkiä, ja toimiiko tavoitteiden `[kysymys]` samoin. Tämä kierros
näyttää sen askel askeleelta.

Jokaisessa riffissä on kaksi riviä samoilla askelilla: **Aloitussivu
työtilan sivulta** ja **Tavoite Kysy muistiinpanoista**. Askeleet ovat
**a** mistä pyyntö lähtee, **b** kenttä siru ja paikkamerkki valittuna, ja
**c** historia sen jälkeen, kun pyyntö lähetettiin koskematta. c-ruudun alla
on katkoviivakehyksessä katselun apu *Agentille lähti*: tarkka teksti, jonka Pi
sai. Pois jäänyt rivi näkyy siinä yliviivattuna. Apu ei ole tuoteehdotus.
Edelliseen kierrokseen nähden ero näkyy oletusnäkymässä: vihje on poissa,
tavoiterivi on uusi, ja c-ruutujen alla on lähtenyt teksti.

Rakennettu tuotannon komponenteista (`WorkspaceIntro` tavoitekortteineen,
`AgentHeader`, `ConversationFrame`, `ConversationTimeline`, `UserMessage`,
`AssistantMessage`, `SkillInvocation`, `Composer` ja sen `GoalChip`).
Tavoitteen kenttä tehdään tuotannon `goalDraft`-funktiolla, ja sen
paikkamerkki tulee `goalRequest`-funktiosta. Aloitussivutaidon ohje on
asennetun taidon teksti. Työtila, tavoitteet, ajat ja agentin vastaukset
ovat synteettisiä. b-kentissä voi kirjoittaa ja lähettää, jolloin c näyttää
kirjoitetun. *Palauta koskematon lähetys* palauttaa lähtötilan. Yläpalkista
vaihdetaan *Kieli* ja *Teema*.

## Riffit

Akseli: jääkö koskematon paikkamerkki lähtiessä pois, ja onko sääntö sama
aloitussivupyynnössä ja tavoitteissa.

1. **Aina pois**: koskematon paikkamerkki jää lähtiessä pois sekä aloitussivupyynnöstä että tavoitteen [kysymys]-riviltä. Agentti saa pelkän ohjeen, eikä historiassa näy hakasulkeita.
2. **Aina mukaan**: hakasulkeinen rivi lähtee aina sellaisenaan, kuten tavoitteissa nyt. Historiassa näkyvät [anna lisäohjeita] ja [kysymys].
3. **Eri sääntö**: aloitussivun lisäohje on vapaaehtoinen ja jää pois, mutta tavoitteen [kysymys] lähtee sellaisenaan, jotta agentti näkee, mitä jäi kertomatta.

Suositus: **Aina pois**.

| | 1 Aina pois | 2 Aina mukaan | 3 Eri sääntö |
|---|---|---|---|
| Aloitussivu, Pi saa | `/skill:open-habitat-start-page Luodaan tälle työtilalle aloitussivu.` | sama + `⏎[anna lisäohjeita]` | kuin 1 |
| Tavoite, Pi saa | `/skill:kysy-muistiinpanoista` | `/skill:kysy-muistiinpanoista [kysymys]` | kuin 2 |
| Historia, tavoite | pelkkä siru | siru ja `[kysymys]` | siru ja `[kysymys]` |
| Uutta koodia | pudotussääntö | ei mitään | pudotussääntö vain aloitussivulle |

## Mitä kierros tietää Pi:stä

- Pi laajentaa `/skill:<nimi>`-kutsun myös ilman perässä olevaa tekstiä
  (`AgentSession._expandSkillCommand` asennetussa pi-coding-agentissa:
  ilman argumentteja viesti on pelkkä taitolohko). Pois jätetty `[kysymys]`
  ei siis riko tavoitteen kutsua.
- Tuotannon `HistoryView` piirtää taitokutsun ilman omaa tekstiä pelkkänä
  siruna. Kierros tekee saman.
- Agentin vastaukset ovat synteettisiä. Kummassakin tapauksessa se kysyy,
  mitä etsitään. Oikealla mallilla tätä ei kokeiltu.

## Rakentaminen ja tarkistus

```
cd web && npm ci            # jos node_modules puuttuu
node design-system/prototypes/rounds/2026-11-06-aloitussivupyynto-3/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
  node design-system/prototypes/rounds/2026-11-06-aloitussivupyynto-3/check.mjs \
  design-system/prototypes/dist/aloitussivupyynto-3/offline.html <kuvahakemisto>
```

`check.mjs` käy kolme riffiä läpi vaaleana ja tummana, 1440 ja 390 px
leveänä ja kerran englanniksi. Se tarkistaa kummankin kentän sirun ja
valitun paikkamerkin sekä sen, ettei vihjettä ole. Se tarkistaa myös, mitä
koskematon lähetys jätti historiaan ja agentin tekstiin kunkin säännön
mukaan. Lisäksi se painaa aloituspainiketta ja tavoitekorttia, kirjoittaa
kysymyksen paikkamerkin päälle, lähettää ja palauttaa lähtötilan, ja ottaa
kuvat kertoimella 2. Tarkistuspisteitä on 114, ja konsoli on puhdas.

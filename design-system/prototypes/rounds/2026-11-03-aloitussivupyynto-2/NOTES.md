# Aloitussivupyyntö mallikehotteena

Issue `proto-start-page-request-presentation`, kierros 2. Jari 3.11.:
painike ei lähetä, vaan vie viestikenttään mallikehotteen. Siinä on
agentille lause, joka saa aloitussivutaidon käyttöön, rivinvaihto ja
hakasulkeinen paikanpitäjä valittuna, joten kirjoittaminen korvaa sen.
Sama kulku kolmena ruutuna: **a** mistä pyyntö lähtee, **b** kenttä
mallikehotteineen ja **c** miltä lähetetty pyyntö näyttää historiassa.
Kaksi lähtöpaikkaa ovat työtilan sivun *Luo/Päivitä aloitussivu* ja tyhjän
keskustelun rivi ja painike. Kumpikin vie kenttään saman mallikehotteen.
Yläpalkista vaihdetaan *Tila* (luonti tai päivitys), *Kieli* (suomi tai
English) ja *Teema*.

Rakennettu tuotannon komponenteista (`WorkspaceIntro`, `AgentHeader`,
`ConversationFrame`, `ConversationTimeline`, `UserMessage`,
`AssistantMessage`, `SkillInvocation`, `Composer` ja sen `GoalChip`,
`ControlButton`). Taidon ohje ja kuvaus ovat asennetun taidon teksti
(`internal/daemon/start-page-skill/SKILL.md`). Työtila, ajat ja agentin
vastaus ovat synteettisiä. b-ruudun kentässä voi kirjoittaa ja lähettää, ja
c-ruutu näyttää silloin lähteneen tekstin. Valinnan korostus kentässä on
katselun apu: selain piilottaa valinnan, kun kenttä ei ole kohdistettu, ja
sivulla on kaksi valmisteltua kenttää yhtä aikaa.

## Suunnat

Akseli: miten taito näkyy kentässä ja historiassa, ja mitä koskematon
paikanpitäjä tekee lähtiessä.

1. **Nimi lauseessa**: kentässä on pelkkä lause, joka nimeää taidon. Koskematon [anna lisäohjeita] jää lähtiessä pois huomaamatta, ja historiassa on sama lause tavallisena viestinä.
2. **Siru ja lause**: kentässä on siru *Luo aloitussivu* ja lause. Vihje kertoo, että koskematon rivi jää pois, ja historiassa on siru, jonka takana on taidon ohje.
3. **Komento näkyvissä**: kentässä on Pi:n oma `/skill:`-komento tekstinä ja lause. Hakasulkeinen rivi lähtee sellaisenaan, ja historiassa näkyy taidon natiivinimi.

Suositus: **Siru ja lause**.

| | 1 Nimi lauseessa | 2 Siru ja lause | 3 Komento näkyvissä |
|---|---|---|---|
| Lause (luonti) | Luodaan aloitussivu käyttäen open-habitat-start-page-taitoa. | Luodaan tälle työtilalle aloitussivu. | Luo tälle työtilalle aloitussivu. |
| Paikanpitäjä | [anna lisäohjeita] | [anna lisäohjeita] | [lisäohjeet, jos on] |
| Mitä Pi saa | lauseen; malli lataa taidon itse | `/skill:…` ja lauseen; Pi laajentaa taidon | sama kuin 2 |
| Koskematon rivi | jää pois | jää pois, vihje kertoo | lähtee mukana |
| Historia | tavallinen viesti | siru *Luo aloitussivu*, ohje taitettuna | natiivinimi ja englanninkielinen kuvaus |

## Mitä kierros tietää Pi:stä

- Pi laajentaa taidon vain, kun viesti alkaa `/skill:<nimi>`
  (`AgentSession._expandSkillCommand` asennetussa pi-coding-agentissa).
  Lauseen keskellä oleva nimi ei ole kutsu, joten suunta 1 luottaa siihen,
  että malli lukee järjestelmäkehotteen taitolistasta nimetyn taidon. Tätä
  ei kokeiltu oikealla mallilla.
- Suunnat 2 ja 3 lähettävät saman tekstin `/skill:open-habitat-start-page
  <lause>⏎<lisäohje>`. Ne eroavat vain siinä, miten kenttä ja historia sen
  näyttävät. Siru on tuotannon nykyinen tavoitesiru (`splitGoal`), ja
  historian natiivinimi on tuotannon nykyinen `SkillInvocation`.
- Sanoja *Luodaan/Päivitetään* ja *Luo/Päivitä* kertovat agentille
  tilan, joten tieto säilyy historiassa myös uudelleenlatauksen jälkeen.

## Rakentaminen ja tarkistus

```
cd web && npm ci            # jos node_modules puuttuu
node design-system/prototypes/rounds/2026-11-03-aloitussivupyynto-2/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
  node design-system/prototypes/rounds/2026-11-03-aloitussivupyynto-2/check.mjs \
  design-system/prototypes/dist/aloitussivupyynto-2/offline.html <kuvahakemisto>
```

`check.mjs` käy kaikki kolme suuntaa läpi vaaleana ja tummana, 1440 ja 390
px leveänä, luonti- ja päivitystilassa ja kerran englanniksi. Se tarkistaa
kentän sisällön ja valitun paikanpitäjän, historian ilman `/skill:`-tekstiä
ja koskemattoman rivin käytöksen. Lisäksi se painaa molempia painikkeita,
kirjoittaa paikanpitäjän päälle, lähettää toisen kentän koskematta, avaa
sirun ohjeen ja ottaa kuvat kertoimella 2. Tarkistuspisteitä on 146, ja
konsoli on puhdas.

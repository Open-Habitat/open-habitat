# Aloitussivupyyntö ennen ja jälkeen lähetyksen

Issue `proto-start-page-request-presentation`, jatkoa kierrokselle
`2026-11-02-aloitussivun-painike` (Jari 3.11.: tyhjän keskustelun painike,
rivi ja painike, ja agentti aloittaa heti). Yksi kulku kolmena ruutuna
rinnakkain: **a** mistä pyyntö lähtee, **b** mitä painallus tekee ja **c**
miltä lähetetty pyyntö näyttää historiassa. Kaksi lähtöpaikkaa: työtilan
sivun *Luo aloitussivu* / *Päivitä aloitussivu* ja tyhjän keskustelun
painike. Työpöydällä ruudut ovat vierekkäin, puhelimessa (390) allekkain.
Yläpalkin *Tila* vaihtaa luonti- ja päivitystilan välillä.

Rakennettu tuotannon komponenteista (`WorkspaceIntro`, `StartHere`,
`AgentHeader`, `ConversationFrame`, `ConversationTimeline`, `UserMessage`,
`AssistantMessage`, `SkillInvocation`, `Composer` ja sen `GoalChip`,
`ControlButton`). Taidon ohje on asennetun taidon teksti sellaisenaan
(`internal/daemon/start-page-skill/SKILL.md`). Työtila, ajat ja agentin
vastaus ovat synteettisiä; mitään ei lähetetä. Painike a-ruudussa korostaa
ruudun, joka näyttää painalluksen tuloksen.

## Nyt ja suunnat

Akseli: kuinka paljon pyynnöstä näkyy ja kuka sen lähettää.

0. **Nyt**: työtilan sivun painike kirjoittaa kenttään komennon, ja historiaan jää sama komento tavallisena viestinä; tyhjässä keskustelussa on vain kehotus.
1. **Siru**: työtilan sivun painike vie kenttään sirun *Luo aloitussivu* ja lähetät itse; historiassa nimi, ja ohje on taitettuna sen taakse.
2. **Heti, ohje**: kumpikin painike lähettää pyynnön heti ja agentti aloittaa; historiassa nimi, ja ohje on taitettuna sen taakse.
3. **Heti, nimi**: kumpikin painike lähettää pyynnön heti; historiassa pelkkä nimi ilman avattavaa ohjetta.

Suositus: **Heti, ohje**.

## Mitä "Nyt" oikeasti on

Labista otetut kuvat (`nyt.mjs`) näyttävät saman kuin kierroksen Nyt-näkymä:

- Työtilan sivun painike (`WorkspaceLanding.tsx`, `prepareInvocation`) avaa
  uuden keskustelun ja kirjoittaa kenttään `/open-habitat-start-page `
  raakatekstinä.
- Pi laajentaa taidoksi vain muodon `/skill:<nimi>`
  (`_expandSkillCommand`). Painikkeen teksti ei siis ole taidon kutsu:
  malli saa sen tavallisena viestinä ja joutuu itse päättelemään, että
  pitäisi lukea taidon tiedosto. Historiassa näkyy tavallinen kupla
  `/open-habitat-start-page`, ja keskustelun nimeksi tulee sama komento
  ("/open-habitat-sta…" puhelimen yläpalkissa).
- Jos taidon valitsee Komennot-listasta, historiaan tulee `SkillInvocation`:
  natiivinimi monospacella ja taidon englanninkielinen kuvaus. Tätä
  polkua painike ei käytä.
- Tyhjässä keskustelussa lukee "Pyydä agenttia luomaan työtilalle
  aloitussivu." ilman painiketta; pyynnön kirjoittaa itse.

## Sama kaikissa suunnissa

- Ruudulla ei ole komennon eikä tiedoston nimeä. Lähetetty pyyntö on
  `/skill:open-habitat-start-page` (sirussa ja lähetyksessä), joten Pi
  kirjaa sen taidon kutsuna.
- Historiassa pyynnön nimi on *Luo aloitussivu* (tai *Päivitä
  aloitussivu*) tavallisella kirjaimella, ja suunnissa 1 ja 2 sen alla
  "Esittely ja tavoitteet tälle työtilalle". Keskustelun nimi on sama.
- Taitettu ohje on se, minkä Pi tallentaa kutsun mukana: taidon koko teksti,
  englanniksi. Lukijan otsikko on yhä monospacea (`GuideArticle`), sitä
  kierros ei muuta.
- Tyhjän keskustelun painike lähettää heti kaikissa suunnissa (päätetty
  3.11.); suunnat eroavat siinä vain c-ruudussa.

## Rakentaminen ja tarkistus

```
cd web && npm ci            # jos node_modules puuttuu
node design-system/prototypes/rounds/2026-11-03-aloitussivupyynto/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
  node design-system/prototypes/rounds/2026-11-03-aloitussivupyynto/check.mjs \
  design-system/prototypes/dist/aloitussivupyynto/offline.html <kuvahakemisto>
```

`check.mjs` käy Nyt-näkymän ja kolme suuntaa läpi vaaleana ja tummana, 1440
ja 390 px leveänä, luonti- ja päivitystilassa; tarkistaa, että Nyt-näkymässä
komento on kentässä ja historiassa tavallisena viestinä ja ettei suunnissa
ole komennon tai tiedoston nimeä, painaa molempia painikkeita, avaa
taitetun ohjeen ja ottaa kuvat kertoimella 2 (118 tarkistuspistettä,
konsoli puhdas). `index.html` on sama ilman upotettuja fontteja glasspadia
varten. `nyt.mjs` ottaa Nyt-kuvat käynnissä olevasta labista.

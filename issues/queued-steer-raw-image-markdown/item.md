---
created: 2026-11-07
updated: 2026-11-07
type: bug
reporter: jari
status: open
priority: normal
preparation: ready
lane: queued-steer
lane_seq: 1
---

# Queued steer card shows an image attachment as raw Markdown

## Description

Kirjattu testikoneelta (KOKEILTAVAA.md, testiopas 7.11.2026):

Jonossa odottava ohjausviesti näyttää kuvaliitteen raakana Markdown-linkkinä (Jari 1.11., pilot.572, tumma, englanniksi): agentin työskennellessä liitetty kuvakaappaus ja teksti *Test* näkyivät *Waiting for the agent 1* -kortissa muodossa `Test ![CleanShot 2026-11-01 at 19.38.06@2x.png]` ja perässä liitteen polku `/api/v1/attachments/9e619403-2fa…` sulkeissa. Jarin tuomio: ei hyvä. Kortin pitäisi näyttää teksti ja liite kuten lähetetyssä viestissä (pikkukuva tai liitesiru), ei kentän sisäistä Markdownia. Viesti näkyi kerran, ja daemon sai yhden `steer` 200 (17:38:14Z) sekä toisen 17:38:50Z; *Hylätty*-merkintää ei tullut (`enter-sends-twice`).

## Acceptance Criteria

- [ ] havainto korjattu; testi rajapinnassa

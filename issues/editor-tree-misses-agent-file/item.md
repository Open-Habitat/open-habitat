---
created: 2026-11-07
updated: 2026-11-07
type: bug
reporter: jari
status: open
priority: normal
preparation: ready
lane: editor-tree
lane_seq: 1
---

# Open editor's file list does not show a file the agent just created

## Description

Jari 7.11.2026 (testikone): työtilan tiedostoeditori oli auki, ja agentti lisäsi
samalla työtilaan uuden tiedoston. Tiedosto ei tullut näkyviin editorin
tiedostolistaan. Uuden (ja poistetun, nimetyn) tiedoston pitää näkyä listassa
ilman käsin päivitystä.

Selvitettävää: kumpi lista (code-serverin Explorer vai Habitatin oma
tiedostopuu) ja miksi muutos ei näy. Code-server seuraa tiedostoja inotifyllä;
Birchlla `inotify_max_user_instances=128` (näkyy gaten resurssirivillä), ja
jokainen Chrome, editori ja watcher kuluttaa niitä, joten loppunut inotify-raja
on yksi epäilty.

## Acceptance Criteria

- [ ] syy löydetty; agentin luoma tiedosto näkyy auki olevan editorin listassa; testi rajapinnassa

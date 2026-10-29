---
created: 2026-10-29
updated: 2026-10-29
type: bug
reporter: jari
status: open
priority: normal
lane: worker-presentation
lane_seq: 2
preparation: ready
---

# Idle interactive worker pulses as working in the rail and panel

_Source: chat_

## Description

From KOKEILTAVAA.md (test server testing):

Pysähtynyt interaktiivinen worker sykkii sivupalkissa työskentelevänä (Jari 29.10., pilot.511): `--interactive`-spinoff teki commitin ja jäi odottamaan kehotteeseen, eli Pi on vapaa eikä tee mitään. Silti sivupalkissa pääkeskustelun (joka käynnisti workerin) pallo ja sen workerista kertova haaramerkki jatkavat sykkimistä, ja Workerit-paneelin rivillä pyörii katkoviivaympyrä (*agentti ei odota · 1 commit · Pi · builtin*). Taskfleetin mukaan ajo on `running`, koska interaktiivinen ajo ei pääty itsestään. Pi:n oma tila on kuitenkin vapaa, ja sen pitäisi näkyä, esim. *odottaa sinua* tai *valmis*, ei työskentelynä (`worker-panel-rivi`, `sidebar-group-row-time`).

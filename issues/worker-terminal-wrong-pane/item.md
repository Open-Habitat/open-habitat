---
created: 2026-10-29
updated: 2026-10-29
type: bug
reporter: jari
status: fixed
priority: normal
lane: worker-presentation
lane_seq: 4
preparation: ready
closed: 2026-10-29
---

# Worker view terminal shows the wrong tmux pane

_Source: chat_

## Description

From KOKEILTAVAA.md (test server testing):

Workerin pääte näyttää väärän tmux-ruudun (Jari 28.10., kuvakaappaus): worker-näkymän *Pääte · vain luku* näyttää tyhjän bash-kehotteen worktree-hakemistossa, ei Pi:tä. Taskfleetin headless-ikkunassa `@1` on kaksi ruutua: `%1` (taskfleet/Pi, 40 saraketta, jossa luottamuskysely odottaa) ja `%2` (bash, 39 saraketta). Habitat näyttää `%2`:n, vaikka Taskfleetin `attach.identity.pane_id` on `%1`. Kapea ruutu selittää myös, miksi kehote rivittyy noin 40 merkin kohdalta. Siksi Jari ei nähnyt luottamuskyselyä lainkaan (`worker-view-conversation`).

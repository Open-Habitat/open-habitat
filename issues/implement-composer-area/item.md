---
created: 2026-10-20
updated: 2026-10-20
type: feature
reporter: jari
status: done
priority: high
related: ['@proto-composer-area']
lane: composer
lane_seq: 1
collision: [web/src/components/composer]
preparation: ready
closed: 2026-10-20
---

# Composer area: Rivillä with commands, files, ! and Ctrl-P

Implement the composer area Jari chose on 2026-10-20: direction **Rivillä** of `proto-composer-area` (round `design-system/prototypes/rounds/2026-10-19-koko-alakerta/`, its result.md incl. "Jari's choice"), which combines the earlier accepted pieces (`proto-composer-combined` Alarivi with Komennot/Tiedosto buttons and caret completion, `!`/`!!` typed only, Ctrl/⌘+P palette from `proto-composer-commands`). Architecture as recorded there: Pi runs `!` through RPC `bash`/`abort_bash` with the daemon relaying; the `/` command list when Pi is not running comes from a short-lived list-only Pi helper; file completion from the workspace via the daemon as the person. Send, mode chip (Ohjaa/Työn jälkeen), Stop, queue card, `!` running state on the bottom row; keyboard: Enter, Alt+Enter, Esc.

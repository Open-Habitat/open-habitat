---
created: 2026-10-20
updated: 2026-10-20
type: bug
reporter: jari
status: open
priority: high
related: ['@implement-browser-shell']
lane: browser-shell
lane_seq: 2
collision: [web/src/components/terminal]
preparation: ready
---

# Browser shell: shortcut on Finnish keyboard, open directly, no warning, selection vanishes

Jari on the test server (pilot.237, Finnish keyboard on macOS), 2026-10-20, browser shell (`implement-browser-shell`):

1. **Ctrl+` cannot be the shortcut**: on a Finnish keyboard ` is a dead key (Shift+´ then space); Jari could not make it work. Choose a shortcut that works on Finnish/Nordic and US layouts (match on `event.code` where sensible, avoid dead-key characters) and update hints and tests.
2. **"Avaa pääte" opens an empty area with a second "Avaa pääte" button.** Pressing the top-bar button must open the terminal itself in the panel directly.
3. **Remove the first-open warning** about what the terminal is and its rights. Not needed.
4. **Selecting text in the terminal: the selection disappears immediately.** Text selection must stay (so it can be copied and "Vie keskusteluun" offered); find what clears it (re-render, focus, tmux redraw, the 500 ms capture refresh, xterm options).

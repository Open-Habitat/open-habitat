---
created: 2026-10-20
updated: 2026-10-20
type: bug
reporter: jari
status: open
priority: normal
lane: shell
lane_seq: 1
collision: [web/src/components/terminal]
---

# Pääte still opens an empty panel with another open button; floating pill covers the terminal; tmux error opens the panel

_Source: chat:jari-test-2026-10-20b_

## Description

Jari 2026-10-20 (pilot.247): pressing Pääte opens the panel showing another 'Avaa pääte' button instead of the terminal immediately (browser-shell-polish was meant to fix this; check whether the fix is in this path, e.g. first open vs reopen, or a different entry point). When the terminal is open, the floating 'latest/viimeisin' jump pill sits on top of the terminal window. Once 'Palvelin ei voi avata päätettä: tmux puuttuu tai ei käynnistynyt' appeared at the bottom of the panel: the panel should not open just to show an error; errors need the product's natural notice place, and find why tmux failed to start (server log around the event). Shortcut: Jari proposed Ctrl+T/⌘T, but browsers reserve them for a new tab and pages cannot take them; use Ctrl+Alt+T (Mac ⌃⌥T), consistent with Ctrl+Alt+K for the editor, keep Ctrl+Shift+Enter as an alias. Done: browser tests for direct open, pill placement, error placement.

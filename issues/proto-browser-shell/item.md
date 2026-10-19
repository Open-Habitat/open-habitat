---
created: 2026-10-19
updated: 2026-10-19
type: task
reporter: jari
status: open
priority: normal
related: ['@research-shell-editor']
lane: unlaned
collision: [issues/proto-browser-shell]
preparation: ready
---

# Prototype: shell in the browser

Jari, 2026-10-19: a shell in the browser is sensible; prototype what it looks like. The browser is the person's only route to the server by default (no SSH assumed). If the person has a tmux session, the browser shell can attach to it; otherwise it is a plain shell in the workspace.

Prototype round: where the shell lives (workspace page, a panel beside the conversation, its own view, a tab next to conversations), how it is opened per workspace, how several shells/tmux windows appear, what happens when the browser closes and comes back (session continues), how it looks on a phone (on-screen keys for Ctrl/Esc/Tab/arrows), copy/paste, the security moment before opening (if re-authentication is chosen), and how the shell relates to the conversation and the processes tray. Feasibility and security facts come from `research-shell-editor` (its report, when landed).

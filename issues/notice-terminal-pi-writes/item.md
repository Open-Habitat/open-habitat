---
created: 2026-10-02
updated: 2026-10-02
type: improvement
reporter: jari
status: untriaged
priority: normal
provenance: chat
source_ref: chat:2026-10-02/terminal-writes
---

# Notice Pi sessions written from a terminal

## Description

When Pi is used from a terminal (SSH/tmux) the daemon does not notice the session file changing and publishes no journal event, so an open browser view does not show the new messages until the conversation is loaded again. The daemon has no file watcher.

Jari decided on 2026-10-02 that the current client-history work (ADR 0008, `docs/conversation-data-flow.md`) does not handle this: no visibility listener and no background snapshot polling in the browser. This issue is for thinking about the need and the shape later: how often it matters in real use, and whether a browser-side check or a daemon file watcher (e.g. inotify on Pi's session directory, publishing into the existing journal so it stays the only push channel) is the right answer. Jari's lean: a file watcher later.

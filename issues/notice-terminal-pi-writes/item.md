---
created: 2026-10-02
updated: 2026-10-03
type: improvement
reporter: jari
status: untriaged
priority: normal
provenance: chat
source_ref: chat:2026-10-02/terminal-writes
---

# Keep terminal Pi writes in sync across open browser views

## Description

When Pi is used from a terminal (SSH/tmux), the daemon does not notice the session file changing and publishes no journal event. Open browser views of that conversation, including views in different browsers, do not show the new messages until the conversation is loaded again. The daemon has no file watcher.

This is distinct from changes made through a Pi process controlled by the daemon: its events already reach each connected browser tab through the journal. The missing piece is noticing *external* writes to the native Pi session file and getting those changes to every open browser view, without introducing another history store or a separate push channel.

Jari decided on 2026-10-02 that the current client-history work (ADR 0008, `docs/conversation-data-flow.md`) does not handle this: no visibility listener and no background snapshot polling in the browser. Investigate how often terminal/browser concurrent use matters and whether a daemon file watcher (e.g. inotify on Pi's session directory, publishing an invalidation into the existing journal) or a browser-side check is appropriate. Jari leans toward a file watcher. Verify that two simultaneously open browsers update from the same external write, and that daemon-controlled changes still reach both without duplication. Do not schedule this issue yet, per Jari's 2026-10-03 direction.

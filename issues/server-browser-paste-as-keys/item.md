---
created: 2026-11-22
updated: 2026-11-22
type: improvement
reporter: jari
status: open
priority: normal
provenance: chat
source_ref: habitat:pi-current/2026-11-22-server-browser-paste-as-keys
lane: server-browser-control
lane_seq: 6
preparation: ready
---

# Server browser: Ctrl/Cmd+V types the clipboard as keystrokes

## Description

Implement Jari's decision in server-browser-paste-flow (22.11.2026): Ctrl/Cmd+V on the
server browser types the clipboard text as keystrokes directly, no popover; the text
never reaches the remote clipboard; fallbacks and the focus/eye details per that decision.

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

## Decisions

### 2026-11-22T12:51:52Z · @jari

Jari 22.11.2026: for the edge cases (characters that cannot be typed, very long text, multi-line text where Enter could submit) do not fall back to the remote clipboard; show a warning that paste does not work in this situation and why. The Leikepöytä popover's explicit 'Liitä sivulle' stays as the deliberate clipboard route.

### 2026-11-22T13:30:47Z · @conductor

Conductor 22.11.2026 after the security blocker in run 01m81n2pff1yzagtqnrvcx78rm: the CDP Input.insertText route does not ship (focus inference can deliver the person's text to a background page). Ship Jari's own rule instead: Ctrl/Cmd+V types the text as X keystrokes (delivered to the X-focused window, like real typing) for what the preloaded keymap covers, and shows the warning for what it cannot type (emoji, CJK), long text and multi-line text. Revisit a destination-bound Unicode route after server-browser-popup-takes-over gives the viewer an authoritative current window.

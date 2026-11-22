---
created: 2026-11-22
updated: 2026-11-22
type: bug
reporter: jari
status: fixed
priority: normal
provenance: chat
source_ref: habitat:pi-current/2026-11-22-terminal-selection
lane: unlaned
preparation: ready
closed: 2026-11-22
---

# Terminal: selection buttons open on top of the selected text

## Description

Jari (22.11.2026, test server): selecting text in the terminal with Shift held
shows the selection buttons (copy / send to the conversation), but they open on
top of the selected text, hiding it.

Next action (defect, fix directly): the selection buttons never cover the
selected text.

## Acceptance Criteria

- [x] Selection actions stay outside all selected rows for plain and tmux Shift selections, including multiple rows and panel edges.
- [x] Existing copy and send actions are unchanged; focused web and terminal browser checks pass.

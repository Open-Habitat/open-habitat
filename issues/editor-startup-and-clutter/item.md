---
created: 2026-10-20
updated: 2026-10-20
type: improvement
reporter: jari
status: open
priority: normal
lane: editor
lane_seq: 3
collision: [internal/gateway/editor]
---

# Editor: slow start, Copilot chat, Restricted Mode and Welcome tab; Ctrl+Alt+K focus return

_Source: chat:jari-test-2026-10-20b_

## Description

Jari 2026-10-20 (pilot.247, screenshot): opening the editor took 15–30 s, not a few seconds. The workbench shows a lot of noise: a Chat/'Build with Agent' panel on the right (not needed: Pi is the agent), Restricted Mode banner and status-bar badge (workspace trust — the person's own workspace should be trusted), and a code-server Welcome tab (open empty instead). Ship these as code-server defaults the daemon applies per user without overwriting the person's own settings (e.g. security.workspace.trust.enabled=false, workbench.startupEditor=none, chat/copilot disabled, welcome off). Measure and reduce start time (where does it go: user service start, extension host, first load); show honest progress. Also Ctrl+Alt+K (⌘⌥K) moves focus to the composer, but going back does not return focus to the exact editor position where it was. Done: measured before/after start time, lab capture of a clean workbench, focus round-trip test.

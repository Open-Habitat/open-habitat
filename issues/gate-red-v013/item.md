---
created: 2026-11-16
updated: 2026-11-16
type: bug
reporter: conductor
status: open
priority: high
provenance: chat
source_ref: chat:2026-11-16/gate-red-v013
lane: unlaned
lane_seq: 1
preparation: ready
---

# Clean gate before v0.1.3 red: one Go test and 14 browser specs

## Description

Clean gate on main 58588c70 (staging installation, 16.11.2026, load average up to 9 with one prototype worker running) failed. Logs: /var/tmp/agent-keep/gate-v013/v013-1.{json,err} (private host path).

Go: internal/daemon TestArchiveStopsIdlePiButNotBackgroundWork (pi_activity_linux_test.go:263: background work: live true, busy [{pi:… turn}]).

Ordinary browser suite (4 failed, 673 passed):
- browser-conversation.spec.ts:3944 @conversation-details archive offer rides in the next header and expires unpaused
- context-ring.spec.ts:179 @compaction-spacing keeps the conversation rhythm after a normal reply
- settings-search.spec.ts:76 @settings-search finds a setting, arrows preview results…
- thread-fill.spec.ts:13 @thread-fill a short conversation sits on the composer…

Lab suite (10 failed, 263 passed):
- lab-composer-lists-in-field.spec.ts:204 command preview starts at the top for each selection
- lab-composer-stack-gaps.spec.ts:43 composer stack gaps and edges at 390/800/1024/1440
- lab-reply-selection.spec.ts:44 a selection in a live and in a settled reply survives updates…
- lab-yaml-preview.spec.ts:11 YAML explanation 390/1440 fi/en-US

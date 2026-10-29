---
created: 2026-10-29
updated: 2026-10-29
type: improvement
reporter: jari
status: done
priority: normal
lane: experimental
lane_seq: 10
preparation: ready
closed: 2026-10-29
---

# Remove the experimental terminal Pi watch

_Source: chat_

## Description

Jari 29.10.: remove the experimental terminal Pi watch (`terminal-watch-experimental`, commit 895e9ef7) entirely: the HistoryView footer and *Katso päätteessä*, the `GET /api/v1/workspaces/terminals/writer` route and the `&conversation=` WebSocket target, the daemon's tmux socket reach across its PrivateTmp, the contract `writer` definition, its experimental feature card, specs, KOKEILTAVAA lines and the rule it added to `internal/AGENTS.md`. A stored `terminal-watch` switch in account preferences is ignored or dropped. Pi in a terminal stays readable in the browser as before (read-only history).

## Acceptance Criteria

- [x] No code path reaches a tmux socket outside the daemon's own namespace; Taskfleet window views unchanged.
- [x] Contract, daemon, gateway and web tests green; the experimental section shows the two remaining features.

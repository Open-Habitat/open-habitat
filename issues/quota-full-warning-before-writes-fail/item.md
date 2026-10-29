---
created: 2026-10-29
updated: 2026-10-29
type: improvement
reporter: jari
status: open
priority: normal
lane: session-robustness
lane_seq: 2
preparation: ready
---

# Warn the person and agents before the disk quota fills

_Source: chat_

## Description

29.10.: Jari's Birch account filled its 64 GiB quota without anyone noticing until writes failed and a conversation was damaged (`session-partial-last-line-locks-conversation`). Agents (Go build cache 20 GiB, gate worktrees) grew it. The storage bell exists on main but Birch ran pilot.14.

## Acceptance Criteria

- [ ] The person is warned (bell / storage) early enough, e.g. at 85 % and 95 %, and agents learn it too (`agent environment show` already reports quota; agent guidance tells agents to check before large builds and how to free caches: `go clean -cache`, old worktrees).
- [ ] Verify the warning thresholds on the test server; KOKEILTAVAA line.

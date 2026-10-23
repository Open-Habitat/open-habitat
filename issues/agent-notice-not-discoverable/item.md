---
created: 2026-10-23
updated: 2026-10-23
type: bug
reporter: jari
status: open
priority: normal
preparation: ready
lane: agent-host
lane_seq: 1
collision: [internal/daemon/pi]
---

# Agent cannot find the notice command: open-habitat not on PATH, capability unknown

## Description

Jari 2026-10-23 on pilot.332, retesting `agent-unaware-of-notices`: asked "jätä minulle muistutus tähän keskusteluun". The agent did not know how; it spent six tool calls and three thinking steps: `open-habitat agent notice create --help`, searching `~/.local/bin` and `/opt/open-habitat`, setting `OH=/opt/open-habitat/current/bin/open-habitat`, reading `/proc/sys/kernel/...`, listing notices, deciding a write was not persisted, retrying. So `open-habitat` is not on the agent's PATH and the agent has no reliable knowledge of the notice command.

Make it immediate: the agent's session must find `open-habitat` on PATH (as the person's own CLI), and the agent must know the notice capability without searching — through the native mechanism Pi already uses for host capabilities (its system prompt/AGENTS context or a bundled skill), not a second instruction store. Check why the first write looked unpersisted and fix that too.

## Acceptance Criteria

- [ ] In a fresh conversation the request produces a dismissible notice with one tool call (verified with real Pi against the synthetic host); `open-habitat` resolves on the agent's PATH.

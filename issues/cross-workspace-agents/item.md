---
created: 2026-10-20
updated: 2026-10-20
type: feature
reporter: jari
status: open
priority: normal
lane: host-context
lane_seq: 3
collision: [host-context]
---

# Agents work across workspaces: read sibling repos and start worktree agents in them

_Source: chat:ville-requests-2026-10-20_

## Description

Ville (2026-10-20): needs access to repos 'ristiin' — meetings concern both Ergona and Northwind, he mixes information from several repos. Jari: same need in his own work (agents run in fleetrepo and in open-habitat in parallel); an agent should be able to start worktree runs in a parallel repository, or at least read its files. Both must work.
All workspaces are directories under the same Unix user's ~/src, so Pi can already read them natively; verify nothing (cwd assumptions, sandboxing, tool restrictions) blocks it. Make the cross-workspace case first-class: the host context tells the agent where the other workspaces are and how to start a worktree agent/spinoff in another one (taskfleet run create from that repo); the browser shows such a run under the workspace it runs in and in the parent conversation's spinoff state; the parent gets the completion wake. Done: synthetic test where a conversation in workspace A starts a worktree run in workspace B and the UI shows it in both places; host-context test.

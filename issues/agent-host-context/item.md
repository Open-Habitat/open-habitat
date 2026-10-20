---
created: 2026-10-20
updated: 2026-10-20
type: feature
reporter: jari
status: open
priority: high
lane: host-context
lane_seq: 1
collision: [host-context]
---

# The agent knows nothing about its Open Habitat environment

_Source: chat:ville-test-2026-10-20_

## Description

Ville (second test user, 2026-10-20, pilot.237) asked his agent about his own environment — what this place is, what it can do, how workspaces, conversations, worktree agents, the editor, the browser shell, integrations, trash and storage limits work — and the agent did not know. Jari: this is a serious gap; the agent must be the person's first guide to the environment's features.

The daemon starts native Pi without any host context: no skill, AGENTS.md or appended system context describes Open Habitat. Give Pi, in every conversation the daemon starts, a native description of the host it runs on, in the way Pi itself loads context (for example a root-owned read-only skill or context file shipped with the release, selected through Pi's own mechanisms, not a parallel prompt store). It should cover what the person can do in the browser and how that maps to native things (workspaces = directories under ~/src, conversations = Pi sessions, worktree agents, Taskfleet spinoffs, integrations via personal-data skill, editor, shell, trash and quota, ~/.local/bin for user-installed tools), and where the agent cannot act. Must stay true to the code: generate or test it against the product so it cannot drift silently. Must not leak other users' data or installation secrets.

Done: a fresh conversation on the test server answers 'what can I do here / how do I X' correctly; covered by a test that fails when a described capability disappears.

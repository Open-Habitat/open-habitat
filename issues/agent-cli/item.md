---
created: 2026-10-20
updated: 2026-10-20
type: feature
reporter: jari
status: open
priority: normal
lane: agent-cli
lane_seq: 1
collision: [agent-cli]
---

# open-habitat CLI for agents: everything the person can do in the UI, plus agent-to-person notices

_Source: chat:agent-cli-2026-10-20_

## Description

Jari, 2026-10-20: agents need an open-habitat CLI through which they can do everything the person can do in the browser UI, and which also carries ad hoc warnings and notices (e.g. storage quota full) between the environment, the agent and the person. Do NOT implement yet: first ideate what functionality this CLI integration point brings to the agent, together with Jari.
Context: today the agent only receives release-owned host context (agent-host-context); local-files-access adds the first agent→daemon→browser request; cross-workspace-agents needs a way to start worktree runs in other workspaces; the quota test showed the agent learns about a full disk only from a failing command. The CLI would run as the person's own Unix user against their own daemon socket (no new identity authority), and follow the AI-first CLI canon.
Step 1 (research run): a capability inventory and proposal for Jari to review. Step 2: Jari decides scope and authority rules; record as ADR. Step 3: implementation issues.

## Decisions

### 2026-10-20T12:39:45Z · @jari

Jari, 2026-10-20: the CLI is meant to be a *comprehensive* interface for the agent to all information in the system, plus the ability to perform operations independently and on the person's behalf — not a minimal slice. The research should inventory everything readable and everything actionable, and treat the first slice only as an ordering of a comprehensive surface.

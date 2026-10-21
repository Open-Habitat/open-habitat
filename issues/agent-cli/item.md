---
created: 2026-10-20
updated: 2026-10-21
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

### 2026-10-21T00:26:51Z · @jari

Jari, 2026-10-21, answers to the five questions in research.md:
1. Entry route: a general own-UID route into the daemon is required; the CLI must work from any of the person's processes, so the per-conversation local-files socket is not enough. (ADR to record it.)
2. The agent may steer the person's other conversations and change global defaults (model, thinking level). Implementation order is the implementer's call.
3. First notice type is a basic notice attached to a conversation with a visible timestamp. Acknowledgement semantics are open: a close control is fine, but what a notice should contain and when agents send one is not yet known (the quota test is the only case so far). Implement it openly, watch how agents use it, and shape it from that.
4. No general list of browser-confirmed actions: the agent does what its Unix user may do. If any operation gets a confirmation pop-up through the CLI, the set must be small and clearly bounded; possibly some admin-type actions.
5. Whether on-demand environment state suffices before a proactive wake is implementation order; no decision needed now.

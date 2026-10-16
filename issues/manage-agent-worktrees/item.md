---
created: 2026-09-21
updated: 2026-10-16
type: task
status: obsolete
priority: normal
epic: native-agent-host-architecture
lane: ui-v1
lane_seq: 1000
blocked_by: ['@connect-github-workspaces', '@decide-taskfleet-browser-integration']
collision: [docs/, AGENTS.md, design-system/]
preparation: reviewing
related: ['@implement-spinoff-agents']
closed: 2026-10-16
---

# Manage agent worktrees

## Superseded scope

Jari accepted observe-only spinoffs on 16 October 2026. Implementation is now
@implement-spinoff-agents, following direction 1, Langassa, in
@proto-spinoff-agents. [ADR 0017](../../docs/decisions/adr-0017-observe-taskfleet-spinoffs.md)
amends ADR 0010; the [architecture sketch](architecture.md) retains the
integration detail.

Taskfleet launches and owns the spinoff agent, run, worktree and settlement.
The browser observes state, results and native transcripts read-only. The
person speaks only to the parent, which learns outcomes with native
`taskfleet run wait` and controls any interactive settlement through the CLI.
The daemon neither starts a separate Pi in the spinoff checkout nor injects
messages into the parent's history.

Browser-created, browser-controlled worktree agents using caller-owned runs
are deferred. Taskfleet's `caller-owned-agent-runs` is not a dependency for
spinoff observation. The replacement issue records the smaller cross-repo
contracts and the accepted UI, including the waiting state above the composer
and its blinking right-hand dot in the sidebar.

## Resolution

### 2026-10-16T06:20:17Z · @issuectl

Superseded by @implement-spinoff-agents under ADR 0017; caller-owned browser worktree agents are deferred (Jari, 2026-10-16).

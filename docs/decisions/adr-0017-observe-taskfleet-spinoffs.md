# ADR 0017: Observe Taskfleet spinoffs read-only

**Status:** Accepted by Jari on 16 October 2026 in
[proto-spinoff-agents](../../issues/proto-spinoff-agents/item.md#decisions).

An agent delegates work to its own spinoffs; the person talks to the parent,
not to each worker. Spinoffs are therefore ordinary Taskfleet-owned runs.
Taskfleet launches their agents and owns their runs, worktrees and settlement;
the browser observes their state, results and native transcripts read-only.
The parent learns their outcomes through Taskfleet's native wait mechanism.

This amends [ADR 0010](adr-0010-taskfleet-worktree-agents.md): browser-controlled
worktree agents using caller-owned runs are deferred until direct conversation
with a worktree agent is needed. Taskfleet's ownership and Pi's ownership of
native history remain unchanged. Reusing Taskfleet's worker and evidence
avoids a second agent-control path for a person who does not need one.

The [integration sketch](../../issues/manage-agent-worktrees/architecture.md)
holds the details; [implement-spinoff-agents](../../issues/implement-spinoff-agents/item.md)
tracks implementation.

Amended by [ADR 0021](adr-0021-resume-catch-up.md) (16 October 2026): the
companion extension inside the parent's own Pi may tell a resumed parent which
of its spinoffs settled, and which waits were cut off, while its Pi was
stopped. The daemon still never writes into a conversation.

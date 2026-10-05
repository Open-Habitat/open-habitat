---
created: 2026-09-21
updated: 2026-10-05
type: task
status: open
priority: normal
epic: native-agent-host-architecture
lane: ui-v1
lane_seq: 70
blocked_by: ['@complete-conversation-ui']
collision: [docs/, AGENTS.md, design-system/]
preparation: pending
---

# Manage local workspace lifecycle

Let users create, configure, hide, restore and delete local workspaces under
`~/src`. A workspace remains an ordinary directory usable through native tools;
the browser adds no registry or second copy of Git state.

[Product behavior](../../docs/product.md#työtilojen-ja-keskustelujen-hallinta)
and [design](../../design-system/design.md) describe the intended experience.
[Workspace architecture](../../docs/architecture/workspaces.md) describes the
current implementation, which does not yet provide these local management
operations. The [implementation map](../plan-v1-implementation/implementation-briefs.md)
separates this work from GitHub integration and Taskfleet management.

## User experience and stored information

Creation supports a plain directory or `git init`, and Git can be enabled
later. The created workspace opens with the product's first-agent and focus
behavior. Directory names follow the [command contract](../../contracts/v1/command.schema.json).
Display-name edits leave directory names unchanged; Git, branch and remote
information comes from Git. Repository readiness belongs to
@connect-github-workspaces and remains unknown until verified.

Hiding is reversible presentation state: it leaves the directory and running
agents in place. Deletion previews the affected processes, worktrees and other
effects, offers “Hide instead”, and asks for the exact directory name.

The [annotation contract](../../contracts/v1/annotations.schema.json) defines
workspace settings and user presentation state. Optional
`.agent-host/workspace.json` holds the schema version, stable ID and display
name; hidden state lives in the user's XDG state keyed by stable ID. Metadata
is not required for discovery. Atomic writes protect these small files from
interruption; corrupt or unknown metadata produces a warning without being
overwritten or making native data unreadable. Prefer a local Git exclude for
host metadata so it does not become a repository-wide policy change.

## What deletion must protect

The user's daemon owns native mutations. Descriptor-relative, no-follow
operations and target revalidation prevent a replaced path from redirecting a
write or deletion. Traversal stays within mount boundaries.

Confirmation matches the directory name exactly, including case and whitespace,
and its observation token identifies the same filesystem target. A mismatch or
stale target allows no process, worktree or directory mutation: the user has
not confirmed the new target.

The preview accounts for linked worktrees outside `~/src` too. Unowned
processes, unobservable effects and unsafe targets block deletion because their
cleanup could destroy work the host does not control. Managed processes stop
through their owner, with exit and settled history verified. Taskfleet removes
its own worktrees; until @manage-agent-worktrees verifies that adapter, these
are unknown effects that block deletion. Manual or unknown worktrees stay
read-only and block destructive cleanup.

An operation reports completed stages and remaining effects, since a later
failure cannot undo an earlier success. Browser disconnection does not cancel
these local host operations. Reconnection and retries use fresh native
observations; deletion is complete only when the source listing confirms
absence, with remaining cleanup reported as partial.

## Evidence

The [contract scenarios](../../contracts/v1/scenarios.json) assigned here are
CT-016, CT-017, CT-020, CT-024 and CT-029. Their clone cases also involve
@connect-github-workspaces. Useful evidence covers ordinary creation and
settings, duplicate names and permissions, and the risks above: symlink,
replacement, mount, process and worktree races, disconnects, partial failures,
and crashes during mutation or metadata writes.

[TESTING.md](../../TESTING.md) defines validation and synthetic browser evidence;
record results and limits in `result.md` and visual evidence in
`visual-acceptance.md`. Shared production components and examples follow
[web guidance](../../web/AGENTS.md); design sources follow the
[design process](../../design-system/process.md). These shared instructions
also govern documentation and evidence upkeep. Jari's outstanding visual verdict
remains visible without blocking functional completion or independent work.

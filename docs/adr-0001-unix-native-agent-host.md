# ADR 0001: Keep agents and workspaces native to Unix

**Status:** Accepted

**Date:** 2026-09-19

## Context

People already work in project directories with Linux accounts, Git, tmux and
native agent histories. Adding a browser should leave those tools usable directly
through SSH. Unix supplies mature users, permissions and processes; composing
these tools keeps their behavior and data with the components that already own
them.

## Decision

Run one lightweight daemon per Linux user behind a shared authentication gateway.
The gateway maps each web identity to exactly one account on that server and
forwards requests to its daemon. The browser cannot choose an account; the
gateway cannot read homes or run agents. Administrators control admission;
[ADR 0004](adr-0004-first-login-user-provisioning.md) defines the root broker that
creates accounts and owns their bindings.

Agents use their Linux user's permissions and native credentials. Unix accounts
separate people; each tenant gets a separate deployment. Restrictions provided
by extensions inside the same UID are guardrails, not a security sandbox.

Discover workspaces as immediate directories under `~/src`, with or without Git.
Optional `.agent-host/workspace.json` settings hold workspace-specific information
such as a stable ID or display name. Each native component keeps its own
configuration, credentials and history. Git owns repository facts and Taskfleet
owns its worktree lifecycle.

Identify conversations by the harness's native resume ID, namespaced as
`pi:<id>`. Processes come and go; native history remains available. Under
[ADR 0003](adr-0003-host-stack.md), browser conversations have one writer:
ended browser conversations can be deliberately continued, while terminal
histories are read-only in the browser. Closing the browser leaves agents running.

Read native facts rather than maintaining another workspace registry or history
store. Save an annotation only for a concrete need that native sources cannot
reliably satisfy. Add a rebuildable cache only for a measured performance problem.
This avoids competing records of the same work.

Servers remain independent, each owning its users and files. The architecture
allows a browser to connect to several servers; the
[accepted UI scope](../issues/review-ui-v1/review.md#scope-and-limits) leaves
multi-server navigation outside the first implementation.

Use JSON/HTTP for queries and commands and one cursor-marked SSE event feed per
server. Reconnect from retained events or fetch a fresh snapshot. The
[interface contract](interfaces.md) supplies the details, including
[ADR 0005's separate clone stream](adr-0005-clone-progress-stream.md).

## Consequences

The host connects existing tools without owning a parallel copy of their state.
It needs harness-specific adapters and must show incomplete or conflicting native
observations honestly. Same-UID extensions cannot provide stronger user isolation.

[ADR 0003](adr-0003-host-stack.md) resolves authentication, daemon implementation
and packaging. [Architecture](architecture.md) explains their composition;
[implementation](implementation.md) links to delivered work and remaining evidence.

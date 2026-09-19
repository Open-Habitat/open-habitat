# ADR 0001: Use a federated Unix-native agent host

**Authority:** Accepted decision for the Native Agent Host's core server, user, workspace, agent identity, permission, discovery, and client-projection model.

**Updates when:** This decision is superseded or clarified by a later accepted ADR.

**Not the source for:** Current implementation status, research observations, application-specific domain models, or unresolved protocol details.

**Status:** Accepted

**Date:** 2026-09-19

## Context

The initial reference architecture proposed platform-owned sessions, tenant context, policy and credential services, durable product history, and a comparatively broad control plane. Current-state evidence showed that the systems we actually need to expose are already organized around conventional Unix users, source directories, native harness histories, Git, tmux, processes, extensions, and Taskfleet metadata.

The desired product must remain usable without its web client. A user must still be able to SSH to a server, attach to tmux, enter a directory under `~/src`, resume Pi or another harness, inspect Git worktrees, and use Taskfleet directly. The browser is an additional interface to those native components, not their replacement or the authority for their state.

The term `session` is already overloaded at every layer. The architecture therefore does not introduce a platform session or workstream abstraction.

## Decision

### Federated client and servers

A web client connects independently to one or more Agent Host servers known to the user. Each server remains authoritative for its own users, workspaces, agents, processes, and native state. The web client may combine their projections, but it does not own or reconstruct server state.

### Unix users and authentication

A Linux user account is the server's security principal. One lightweight Agent Host daemon runs per Linux user under that user's UID. A shared gateway terminates TLS, authenticates the web identity, maps it through administrator-owned configuration to exactly one Linux user on that server, and proxies HTTP and streaming connections to that user's daemon. The client cannot select or assert a Unix username.

The gateway does not inspect workspaces, run agents, read histories, or own agent state. A web identity may map differently on different servers, but maps to only one Unix account on each server.

### Workspaces

A workspace is normally an immediate directory below the user's `~/src` directory. It may be a Git repository, an ordinary directory, or an application content directory. The daemon discovers workspaces by listing `~/src`; Git repositories, branches, and worktrees continue to use normal Git conventions.

An optional `.agent-host/workspace.json` may provide a schema version, stable workspace ID, display name, kind, or later workspace-specific annotations. Harness-owned configuration such as Pi's default model does not belong there. Runtime state, credentials, process IDs, and duplicated native facts do not belong there.

### Agents and native identity

An agent is a persistent logical entity represented primarily by its harness's native resume/continue identity and history. Agent IDs are namespaced native IDs such as `pi:<id>`, `claude-code:<id>`, or `codex:<id>`. Processes are temporary incarnations of an agent; an agent remains resumable and inspectable after its process exits.

The daemon discovers agent facts from native harness history and configuration, live operating-system processes, tmux, Git, Taskfleet, and optional harness extensions. Taskfleet run IDs, process identities, tmux panes, branches, worktrees, and current models are bindings or discovered facts, not replacement agent identities.

Agent hierarchies and presentation categories may be expanded as concrete UI needs emerge. Likely presentations include a workspace main agent, peer or detached roots, same-workspace side agents, and worktree children. No anticipatory taxonomy is made normative. Parent or presentation annotations are stored only when a clear UI or behavior needs them and they cannot be reconstructed reliably from native sources.

### Discover rather than duplicate

Native components remain authoritative for every fact they already own:

- the filesystem owns the workspace list;
- Unix owns users, groups, processes, and permissions;
- Git owns repositories, branches, and worktrees;
- Pi, Claude Code, and Codex own their native histories, model changes, and resume identities;
- tmux owns terminal attachment and retained pane output;
- Taskfleet owns its run, node, hierarchy, worktree, and lifecycle metadata;
- harness extensions own any process inventory and output they expose.

Agent Host stores only non-discoverable annotations with a named consumer. A derived index may be added only after a measured performance need; it must be disposable and rebuildable from authoritative sources.

### Permissions, tools, and credentials

An agent has the same server permissions and credentials as its Linux user. Native filesystem permissions and Unix account separation are the security boundary. Agent Host does not add a credential broker or claim per-tool confinement.

Users or administrators may install harness extensions that add approvals or restrictions. Such extensions are guardrails inside the same Unix account unless backed by an external enforcement boundary. The UI must not present them as stronger isolation than they provide.

### No core tenant abstraction

A server has Linux users, not Native Agent Host tenants. Multiple schools or organizations are not multiplexed through a core tenant object. Strong school separation can use separate servers or deployment instances. Future shared workspaces may use Unix groups and filesystem permissions. Application-specific organizations, such as Acme Creator organizations, remain application concepts unless later evidence justifies a separate decision.

### Client–daemon protocol

The initial protocol is a small versioned JSON/HTTP API:

- HTTP GET for snapshots and queries;
- HTTP POST for commands;
- one cursor-marked SSE feed per server for agent, process, workspace, and other server events;
- reconnect from a retained cursor when available, otherwise a fresh authoritative snapshot.

A combined feed for all of a user's agents on one server is the default. Retention and partitioning are added only when measured load requires them. AHP, ACP, AG-UI, or another broad protocol is not required for this core path.

## Consequences

### Benefits

- The system follows Unix ownership and composition rather than replacing them.
- SSH, tmux, native harness resume, Git, and Taskfleet remain first-class interfaces.
- The daemon can stay lightweight because it projects and controls native components instead of copying their state.
- Browser loss does not affect server-side agents.
- Multiple servers require no central global control plane.
- The first API can remain small and product-specific.

### Costs and constraints

- The shared gateway is a trusted security boundary and its identity-to-UID mapping must fail closed.
- Cross-user collaboration must use explicit Unix permissions, groups, or a later design rather than an implicit tenant layer.
- Discovery adapters must handle incomplete, stale, and conflicting native evidence honestly.
- Some UI hierarchy information may require sparse sidecar annotations.
- Same-UID agents have ambient user authority; extension approvals are not a sandbox.
- Native history formats and resume mechanisms require harness-specific adapters.

## Rejected alternatives

- A platform-owned session or workstream record as the primary user-visible unit.
- A central multi-server control plane that owns agent state.
- A platform tenant abstraction for users sharing one server.
- A mandatory credential broker and universal typed-tool policy layer.
- Duplicating harness histories, Git state, Taskfleet state, or process output into a new authoritative database by default.
- Requiring AHP or another broad agent protocol before the simple HTTP/SSE projection has demonstrated a gap.

## Follow-up decisions

This ADR intentionally leaves open:

- gateway authentication technology and transport deployment;
- daemon implementation language and packaging;
- the initial process-extension contract and terminal/output controls;
- exact agent-tree presentation fields and annotation storage format;
- SSE cursor retention and resnapshot bounds;
- application-specific integrations, including Acme Creator and Moodle;
- optional Unix-group collaboration and stronger isolation profiles.

See the [architecture](architecture), [decision register](decisions), and [implementation proof plan](implementation).

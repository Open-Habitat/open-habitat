# Architecture

**Authority:** Normative integration of accepted architecture decisions and remaining provisional boundaries; it governs the Project View until superseded.

**Updates when:** An accepted ADR changes the integrated model, an accepted boundary is clarified, or evidence invalidates a stated assumption.

**Not the source for:** Research observations, rejected alternatives, ADR rationale, implementation progress, or executable task state.

> **Status:** ADR 0001 establishes the core Unix-native host model. Implementation details and application integrations remain provisional; architecture v1 has not been declared. The original [reference architecture v0](https://github.com/maintainer/native-agent-host/blob/2292047fc1a59efb3a22e9373eba46b8599e74ca/issues/native-agent-host-architecture/reference-architecture-v0.md) is retained as historical design input where not superseded.

## Purpose

Native Agent Host gives a browser access to native AI agents running under ordinary Unix accounts on one or more servers. It adds a web projection without making SSH, tmux, native harness resume, Git, or Taskfleet secondary interfaces.

The architecture deliberately does not introduce a platform `session` or `workstream`. Those terms would duplicate and obscure the concrete workspace, agent, harness history, process, tmux, Git, and Taskfleet objects that already exist.

## Accepted system shape

```text
Web client
  ├─ Server A authentication gateway
  │    ├─ Linux user jari → per-user daemon (UID jari)
  │    │    └─ ~/src/* → workspaces → agents → processes
  │    └─ Linux user kaisa → per-user daemon (UID kaisa)
  └─ Server B authentication gateway
       └─ mapped Linux user → per-user daemon
```

The client connects independently to every configured server and may combine their views. Each server remains authoritative for its own users and native state. Client loss does not affect running agents.

A shared lightweight gateway terminates TLS, authenticates the web identity, applies an administrator-owned mapping to exactly one Linux account on that server, and proxies HTTP and streaming connections to that user's daemon. The client never supplies a trusted Unix username. The gateway does not inspect workspaces or own agent state.

One lightweight daemon runs as each Linux user. It lists and controls only what that UID can access. It discovers native state, adapts it to the web API, and launches or resumes agents with the user's ordinary permissions.

The complete rationale and consequences are in [ADR 0001](adr-0001-unix-native-agent-host).

## Workspaces

A workspace is normally an immediate directory under `~/src`. It may be a Git repository, an ordinary directory, or an application content directory. The directory list is the primary workspace catalog; no separate registry is required to discover it.

An optional `.agent-host/workspace.json` may carry only workspace facts or annotations with a concrete consumer, such as schema version, stable ID, display name, or kind. Harness settings—including Pi model defaults—remain in the harness's own configuration. Runtime state, credentials, process IDs, Git facts, and duplicated native configuration do not belong in the workspace file.

Git repositories, branches, worktrees and cleanup continue to use Git's normal files, paths and conventions. A worktree agent may execute outside the primary workspace directory while remaining logically associated with that workspace.

## Agents and hierarchy

An agent is a persistent logical entity whose primary identity is its harness's native resume/continue identity, namespaced by harness—for example `pi:<id>`, `claude-code:<id>`, or `codex:<id>`. The native history file is authoritative for the conversation, model changes and resume state. A process is a temporary incarnation of an agent.

The daemon joins native history with live process, tmux, Git, Taskfleet and extension observations. Taskfleet run/node IDs, PIDs, panes, branches, worktrees and current model are discovered bindings rather than replacement agent identities.

The UI is expected to grow a workspace-local agent tree: a designated main agent, peer or externally started roots, same-workspace side agents, and worktree children. This taxonomy is intentionally not frozen before concrete UI behavior requires it. Parent or presentation annotations are stored only when they cannot be reconstructed reliably and have a named consumer. A Pi extension can capture parentage when a main agent launches Taskfleet as an ordinary tool even if Taskfleet records that run as top-level.

## Discover rather than duplicate

Native Agent Host is primarily a discoverer, adapter, event forwarder and thin command executor:

- `~/src/*` owns the workspace list;
- Unix owns users, groups, processes and permissions;
- Git owns repositories, branches and worktrees;
- Pi, Claude Code and Codex own native histories, model state and resume identities;
- tmux owns terminal attachment and retained pane output;
- Taskfleet owns run, node, worktree and lifecycle metadata;
- harness extensions own any subprocess inventory and output they expose.

No derived cache is required initially. A performance index may be introduced only after measuring a slow path, and must remain disposable and rebuildable. Agent Host persists only sparse, versioned annotations that cannot be discovered and are required by identified UI or behavior.

## Permissions and processes

An agent has the same permissions and credentials as its Linux user. Unix account and filesystem separation are the security boundary. Native Agent Host does not add a credential broker or claim universal per-tool confinement.

Users or administrators may install Pi or other harness extensions that add approvals or restrictions. Unless backed by a separate enforcement boundary, these are same-UID guardrails and the UI must describe them honestly.

Each agent manages the subprocesses it starts. A Pi extension may expose process identity, status, retained output, exit state and stop controls to the daemon. Existing tmux-backed process handling should be reused where it already preserves complete output rather than replaced by a parallel process store.

## No core tenant model

A server contains Unix users, not Native Agent Host tenants. Strong school separation can use separate servers or deployments. Future shared workspaces may use Unix groups and filesystem permissions. Application concepts such as a Acme organization remain application-owned and do not become a core tenant merely by name.

## Client–daemon protocol

The initial public surface is a small versioned JSON/HTTP API:

- snapshots and queries over HTTP GET;
- commands over HTTP POST;
- one cursor-marked SSE feed per server, combining workspace, agent, process and output events for that user;
- reconnect from a retained cursor when possible, otherwise a fresh authoritative snapshot.

The client can maintain one connection per configured server and merge presentation locally without becoming state authority. Feed partitioning, caches and broader protocols are added only after a measured need. AHP, ACP, AG-UI, or a semantic Taskfleet browser protocol is not required for the core path.

## Current-state fit

- **Alder:** already uses one trusted Unix security domain per user, native Pi histories, tmux, Git and Taskfleet. The accepted model exposes these rather than wrapping them in a second control plane.
- **Northwind:** keeps personal clones and normal Git/worktree practices. A future server can project each developer's Unix account without imposing a central managed-workspace abstraction.
- **Native Creator:** already behaves as a local single-user harness over a content directory and can fit a non-Git workspace.
- **Creator web:** remains an application-specific browser platform with its own organization and workspace concepts. Integration is a later application decision, not a reason to add tenants to the core host.

The revision-pinned dossiers and their access limitations remain indexed in [evidence](evidence).

## Open design work

The next architecture work concerns gateway authentication technology, daemon packaging, Pi discovery and process-extension contracts, exact HTTP/SSE schemas and cursor bounds, sparse annotation formats, harness adapters beyond Pi, and application/adoption fit. These gates are tracked in [decisions](decisions) and proved through [implementation](implementation).

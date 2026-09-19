# Decisions

**Authority:** Register of accepted architecture ADRs and index of unresolved decision gates.

**Updates when:** An architecture decision is opened, accepted, superseded, or closed as unnecessary.

**Not the source for:** Decision rationale, rejected alternatives, current architecture text, research findings, or task scheduling.

## Accepted ADRs

| ADR | Decision | Status |
|---|---|---|
| [ADR 0001 — Use a federated Unix-native agent host](adr-0001-unix-native-agent-host) | Web clients federate independent servers; one daemon runs per Linux user behind a shared identity gateway; workspaces, agents, permissions and history remain native and discoverable; the first projection is JSON/HTTP plus SSE | Accepted |

## Current accepted boundaries

ADR 0001 establishes that:

- a Linux account is the server security principal, and one web identity maps to one Unix account per server;
- the browser projects one or more independent servers and never owns their state;
- workspaces are discovered primarily from `~/src/*`;
- agents use namespaced native harness resume identities;
- native filesystem, Git, harness, tmux, process and Taskfleet facts are discovered rather than duplicated;
- an agent has its Unix user's ambient permissions and credentials; extensions may add guardrails but are not automatically a sandbox;
- the core has no platform session/workstream or tenant object;
- the initial client API is small versioned JSON/HTTP plus a cursor-marked combined SSE feed;
- Taskfleet normally remains an ordinary Pi tool rather than a dedicated browser protocol.

## Open decision gates

ADR 0001 closes the core host information-model and projection direction. The remaining gates are narrower implementation and application decisions. The ordering below is an evidence dependency, not issue scheduling.

| Order | Gate | What must be established first |
|---:|---|---|
| 1 | Gateway authentication and per-user daemon transport | Select the authentication mechanism, administrator-owned web-identity→UID mapping, Unix-socket boundary, failure behavior and deployment packaging |
| 2 | Agent discovery and process-extension contract | Prototype Pi discovery, native resume, live status, subprocess/output exposure, Taskfleet correlation and degraded operation without extensions |
| 3 | HTTP/SSE API details | Walking slice for snapshot, commands and one combined feed; cursor retention, resnapshot, cancellation, backpressure and schema-version behavior |
| 4 | Sparse annotation and workspace metadata formats | Demonstrate the first non-discoverable UI need; define `.agent-host/workspace.json` and per-agent annotation ownership without duplicating native facts |
| 5 | Harness adapters beyond Pi | Establish Claude Code and Codex history, resume, model, process and event surfaces only when required by an adoption slice |
| 6 | Unix-group collaboration or stronger isolation | Concrete shared-workspace requirement or workload whose risk exceeds the accepted same-UID model |
| 7 | Acme integration and deployment | Combined fit-gap over both Creator implementations; decide separate-server deployment, application organization mapping, Moodle path and application-specific UI |
| 8 | Northwind adoption model | Representative developer evidence and a pilot that preserves personal-clone, worktree, credential and CI/review practices |
| 9 | Availability, backup and recovery | Alder walking-slice measurements plus explicit history, restore, SLO and operational requirements |

Architecture v1 remains open until the accepted Unix-native model has a walking implementation and the remaining application/adoption gates are resolved. The original [reference architecture backlog](https://github.com/maintainer/native-agent-host/blob/2292047fc1a59efb3a22e9373eba46b8599e74ca/issues/native-agent-host-architecture/reference-architecture-v0.md#18-decision-backlog-and-gates) is historical input where ADR 0001 has superseded its session, tenant, credential-broker, platform-history and broad-control-plane assumptions.

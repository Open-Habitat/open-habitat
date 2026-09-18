# Decisions

**Authority:** Register of accepted architecture ADRs and index of unresolved decision gates.

**Updates when:** An architecture decision is opened, accepted, superseded, or closed as unnecessary.

**Not the source for:** Decision rationale, rejected alternatives, current architecture text, research findings, or task scheduling.

## Accepted ADRs

No architecture ADR has been accepted yet. Do not create placeholder ADRs. When a decision is accepted, its top-level `adr-NNNN-<slug>.md` page owns the choice, rationale, consequences, and rejected alternatives; this register receives one link and [architecture](architecture) integrates the current result.

## Current v0 boundaries

These constraints come from the [architecture epic](https://github.com/maintainer/native-agent-host/blob/2552704579715cba56a289af364e2da4dc2d220b/issues/native-agent-host-architecture/item.md) and provisional [reference architecture v0](https://github.com/maintainer/native-agent-host/blob/2292047fc1a59efb3a22e9373eba46b8599e74ca/issues/native-agent-host-architecture/reference-architecture-v0.md), not from ADRs:

- preserve the existing lifecycle authority behind an adapter initially;
- keep harness and lifecycle integration independently addressable;
- keep identity, authorization, tenant scope, policy, credentials, durable history, and audit as platform concerns;
- do not require a semantic Taskfleet browser protocol merely to display Taskfleet invoked as a Pi tool;
- treat logical tenancy independently of physical deployment.

## Open decision gates

The [architecture evidence synthesis](https://github.com/maintainer/native-agent-host/blob/3230e1326e2f2280c6d79ff6dc83fd2d60988137/issues/native-agent-host-architecture/synthesis-and-architecture-review.md#9-ordered-architecture-decision--adr-agenda) orders the gates and names the evidence that unlocks each ADR. Every row remains blocked; the ordering is an evidence dependency, not issue scheduling.

| Order | Gate | What must be established first |
|---:|---|---|
| 1 | Minimum platform information model and authority map | Four current-state dossiers; common scenarios for session/run/attempt/event/artifact identity and lifecycle authority |
| 2 | Protocol/profile by seam: harness, host connector, generic projection, and application projection | Five controlled spikes; named interoperability need; actual Pi/Claude surfaces; multi-user security, durability, compatibility, and implementation-cost evidence |
| 3 | Identity and authorization | Adoption-case role/resource matrices, actual identity providers, cross-user/cross-tenant negative tests, live revocation and threat review |
| 4 | Capability policy and credential brokerage | Ambient-power and credential inventories, typed-tool/approval tests, provider/model-egress constraints and broker feasibility |
| 5 | Durable history and event semantics | Harness fidelity, reconnect/restart/workspace-removal tests, privacy/retention requirements, datastore and restore evidence |
| 6 | Process/workspace isolation profiles | Actual data and tool risks, bypass analysis, Unix/container/VM/server experiments, performance and cost |
| 7 | Acme tenancy and deployment topology | Both Creator dossiers and fit-gap, school/Moodle requirements, operations, residency, deletion and cost evidence |
| 8 | Application-specific UI integration | Both Creator domain mappings, generic-versus-structured AG-UI spike, typed-tool contract and one prototype against each implementation |
| 9 | Northwind repository/workspace strategy | Actual personal-clone, branch, credentials, CI/review and concurrent-agent workflow evidence |
| 10 | Control-plane decomposition, availability and disaster recovery | Earlier model/protocol/storage decisions, Alder pilot measurements and explicit scale/SLO/cost targets |

The MVP protocol and architecture v1 remain open. No candidate's use of the terms session, client, permission, organization, group, or workspace settles the corresponding platform decision. The complete original inventory remains in the [reference architecture backlog](https://github.com/maintainer/native-agent-host/blob/2292047fc1a59efb3a22e9373eba46b8599e74ca/issues/native-agent-host-architecture/reference-architecture-v0.md#18-decision-backlog-and-gates).

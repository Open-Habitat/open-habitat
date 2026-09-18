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

| Gate | What must be established first | Owning source |
|---|---|---|
| Browser-facing protocol: adopt AHP, expose an AHP adapter, reuse its information model, or remain independent | Pi/AHP mapping, competitor dossiers, interoperability need, multi-user security, durability, and walking-slice cost | [AHP analysis](https://github.com/maintainer/native-agent-host/blob/19bd88389129b7fdb0b856b10f274620a1b36524/issues/native-agent-host-architecture/research/agent-host-protocol-analysis.md) and [epic](https://github.com/maintainer/native-agent-host/blob/2552704579715cba56a289af364e2da4dc2d220b/issues/native-agent-host-architecture/item.md) |
| Minimum session/run/event model and adapter contracts | Current-state dossiers and protocol-neutral scenarios across all adoption cases | [reference architecture decision backlog](https://github.com/maintainer/native-agent-host/blob/2292047fc1a59efb3a22e9373eba46b8599e74ca/issues/native-agent-host-architecture/reference-architecture-v0.md#18-decision-backlog-and-gates) |
| Identity, authorization, capability grants, credential brokerage, and audit policy | Role/resource matrices, data classes, host trust topology, and threat review | [reference architecture decision backlog](https://github.com/maintainer/native-agent-host/blob/2292047fc1a59efb3a22e9373eba46b8599e74ca/issues/native-agent-host-architecture/reference-architecture-v0.md#18-decision-backlog-and-gates) |
| Durable history, event ordering, retention, export, deletion, backup, and recovery | Harness fidelity, datastore evaluation, privacy requirements, and failure tests | [reference architecture decision backlog](https://github.com/maintainer/native-agent-host/blob/2292047fc1a59efb3a22e9373eba46b8599e74ca/issues/native-agent-host-architecture/reference-architecture-v0.md#18-decision-backlog-and-gates) |
| Runtime isolation and tool-enforcement profiles | Actual ambient powers, data risks, performance/cost experiments, and bypass analysis | [reference architecture decision backlog](https://github.com/maintainer/native-agent-host/blob/2292047fc1a59efb3a22e9373eba46b8599e74ca/issues/native-agent-host-architecture/reference-architecture-v0.md#18-decision-backlog-and-gates) |
| Acme tenancy/deployment and application projection | Both Creator dossiers, school requirements, Moodle flows, operations, residency, and cost | [architecture epic](https://github.com/maintainer/native-agent-host/blob/2552704579715cba56a289af364e2da4dc2d220b/issues/native-agent-host-architecture/item.md#tenancy-questions) |
| Northwind workspace and concurrency strategy | The actual personal-clone, branch, credentials, CI, and multi-agent workflow dossier | [architecture epic](https://github.com/maintainer/native-agent-host/blob/2552704579715cba56a289af364e2da4dc2d220b/issues/native-agent-host-architecture/item.md#discovery-method) |

The complete decision inventory remains in the reference architecture. This page intentionally keeps only reader-oriented gates and canonical links.

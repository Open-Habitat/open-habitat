# Architecture

**Authority:** Normative integration of the current provisional reference architecture; it governs the Project View until superseded, but it is not architecture v1.

**Updates when:** Architecture synthesis or an accepted ADR changes the integrated model, an accepted boundary is clarified, or evidence invalidates a stated assumption.

**Not the source for:** Research observations, rejected alternatives, ADR rationale, implementation progress, or executable task state.

> **Status:** provisional v0 target model, revised by the [architecture evidence synthesis](https://github.com/maintainer/native-agent-host/blob/3230e1326e2f2280c6d79ff6dc83fd2d60988137/issues/native-agent-host-architecture/synthesis-and-architecture-review.md). The complete original design, classifications, trust boundaries, flows, risks, and decision backlog remain in [reference architecture v0](https://github.com/maintainer/native-agent-host/blob/2292047fc1a59efb3a22e9373eba46b8599e74ca/issues/native-agent-host-architecture/reference-architecture-v0.md). No ADR or architecture v1 has been accepted.

## Purpose and boundary

Native Agent Host is a multi-user control plane for host-native AI agent sessions. Authenticated browser and application clients work through stable platform concepts while replaceable adapters isolate harnesses, host connectivity, lifecycle mechanisms, and application integrations.

The platform must preserve durable session history beyond any process, terminal, branch, or disposable workspace. It must keep principal, tenant, session, run, resource binding, workspace, and native process identities distinct.

The current model does **not** select a wire protocol, identity provider, tenancy topology, datastore, isolation technology, or final deployment decomposition. Those remain [decision gates](decisions). The synthesis found no reviewed candidate that satisfies the whole need: protocols, UI event layers, runtime hosts, control planes, and complete platforms contribute different pieces and must not be ranked as substitutes.

## Authority and components

The provisional model separates:

- a **client/API boundary** for authenticated commands, queries, subscriptions, and artifacts;
- **identity and tenant context** for stable principals, memberships, roles, and application scope;
- a **session coordinator and event service** for durable intent, observed state, timelines, and reconnect;
- a **policy service and credential broker** for bounded capabilities, approvals, and late secret resolution;
- an authenticated **host gateway/connector** boundary;
- independent **lifecycle, harness, tool, model-egress, and integration adapters**;
- separate durable **product history** and **security/administrative audit evidence**.

Actual runtime and workspace side effects remain with the existing lifecycle authority. The control plane records intent and reconciles observations; it must not infer success from dispatch or manipulate tmux/worktrees directly. The named components are logical responsibilities and trust boundaries, not a required microservice decomposition; a pilot may co-locate them while preserving authoritative writers and adapter ports.

Taskfleet is currently invoked by an agent as an ordinary tool inside Pi. Supporting that workflow does not itself require a Taskfleet-specific browser protocol or semantic run/worktree API: generic harness tool-call and terminal state can carry it. The default MVP therefore keeps orchestration semantics behind the lifecycle adapter. A dedicated public orchestration surface is added only for a later named product requirement for direct human orchestration outside the agent conversation. See the [epic clarification](https://github.com/maintainer/native-agent-host/blob/2552704579715cba56a289af364e2da4dc2d220b/issues/native-agent-host-architecture/item.md#comments) and [synthesis correction](https://github.com/maintainer/native-agent-host/blob/3230e1326e2f2280c6d79ff6dc83fd2d60988137/issues/native-agent-host-architecture/synthesis-and-architecture-review.md#43-assumptions-to-revise).

## Core invariants

- Clients never become lifecycle, identity, policy, or credential authorities.
- One mutable fact has one authoritative writer; requested and observed lifecycle state stay separate.
- Non-idempotent intent is durable before dispatch, has a distinct attempt identity, and is not blindly retried after ambiguity.
- Host observations are authenticated but treated as evidence, not direct writes to control-plane stores.
- Model and harness output is untrusted input to typed, policy-checked tool operations.
- Missing tenant or resource scope fails closed.
- Product history survives ephemeral runtime cleanup; capture gaps and unknown outcomes remain explicit.
- Logical school tenancy is independent of pooled, dedicated, or hybrid physical deployment.

## Trust and enforcement boundaries

The v0 model distinguishes browser-to-control-plane, identity-provider, tenant-to-tenant, control-plane-to-host, harness/model-to-tool, external-provider, and product-history-to-audit boundaries. It recognizes three tool-enforcement modes: mediated and confined; mediated application tools with declared ambient host access; and observe-only. The UI and audit trail must never present an observe-only path as enforced policy.

Pooled tenants and school workloads require an enforced runtime/OS isolation boundary when native shell, filesystem, or network access could bypass policy. A trusted household pilot may accept declared ambient powers, but it cannot claim stronger isolation than it enforces.

## Session and failure model

A durable session can span multiple runtime runs. Browsers reconnect to snapshots and durable logical positions; a disconnected browser does not determine process lifetime. Commands, input delivery, tool side effects, policy decisions, artifacts, and observations retain correlation and provenance.

Timeout means **unknown**, not failed. While a non-idempotent outcome is unresolved, only proven-safe reconciliation or emergency actions proceed. Uncorrelated native resources are quarantined rather than adopted under a user or tenant.

## Integration seams under evaluation

Protocol choice is now separated by seam rather than treated as one universal contract: harness adapter, host connector, generic synchronized client projection, and application-specific projection. ACP, AHP, AG-UI, LangChain Agent Protocol/Streaming, and a minimal native API will be exercised against one frozen scenario suite. Any composition must justify its permanent translation, state-ownership, security, and compatibility cost. Until that evidence lands, the platform-owned identity, policy, durability, and audit core is a requirement rather than an implementation selection.

The minimum normalized event model must retain source provenance, fidelity/degradation and capture gaps. It must not erase Pi commands/custom entries, ACP version-specific ownership, AG-UI interrupt semantics, or other harness-native distinctions merely to make adapters look equivalent.

## Adoption overlays

The same control-plane concepts must be tested, not assumed, across:

1. **Alder:** Jari and Kaisa as distinct principals with declared capability differences and durable history over the existing Pi/tw environment.
2. **Northwind:** per-developer identity and repository/workspace strategies that do not impose Alder-specific worktrees on personal-clone workflows.
3. **Acme Creator:** school tenants, Moodle integrations, richer typed tools, application-specific clients, and evidence-based pooled/dedicated/hybrid deployment choices.

The required source-grounded dossiers and fit-gap work are tracked as [implementation proofs](implementation). Until they land, the adoption mappings remain hypotheses.

# Implementation

**Authority:** Architecture-level milestone and adoption-proof map, including the evidence required to call each milestone complete.

**Updates when:** A milestone's required capability, proof, or completion evidence changes or a completed slice supplies new acceptance evidence.

**Not the source for:** Issue lanes, blockers, spawnability, assignees, task queues, current-state narrative, or architecture decisions.

Use the live [`native-agent-host-architecture` epic](https://github.com/maintainer/native-agent-host/blob/e7012c75e759af3a26dcea2ed2fb9d70ef077376/issues/native-agent-host-architecture/item.md) and `issuectl` for executable work state. This page stays at architecture-milestone granularity.

## Architecture milestones

| Milestone | Capability or output | Proof required | Landed evidence |
|---|---|---|---|
| M0 — provisional foundation | Reviewable target model, common vocabulary, evidence method, and maintained Project View | Reference architecture v0; dossier template; initial protocol/ecosystem/documentation research; validated six-page view | [Evidence index](evidence) |
| M1 — source-grounded current state | Factual models of Alder, Northwind, and both Acme implementations | Four complete dossiers with exact revisions, observations, unknowns, and trust/lifecycle/credential boundaries | Not yet landed |
| M2 — comparative synthesis and architecture v1 | Tested common information model and explicit protocol, identity, policy, durability, isolation, tenancy, and integration choices | Shortlist benchmarks, fit-gap analyses, cross-case synthesis, accepted ADRs, architecture/security review | Protocol/traction research and seven source-grounded candidate dossiers landed; common-scenario behavioral benchmarks, adoption fit-gaps, synthesis, ADRs, and final review remain |
| M3 — Alder walking skeleton | Two web principals use one durable control plane over orchestrator-owned host-native execution | Negative cross-user authorization tests; declared ambient-power limits; reconnect and ambiguity reconciliation; credential no-leak; durable history after cleanup; audit evidence | Not yet landed |
| M4 — dedicated Northwind pilot | Organization deployment supports actual developer clone/branch/agent workflows | Workflow acceptance, identity and credential boundaries, concurrency/repository proof, operational ownership, and migration findings | Not yet landed |
| M5 — Acme integration | Application-specific UI and Moodle/tool flows use shared platform concepts with school tenancy | Both fit-gap reports; selected topology ADR; tenant isolation/deletion/audit tests; one application projection/integration pilot | Not yet landed |

## Walking-skeleton boundary

The first implementation slice proves seams rather than breadth: two principals; one explicit tenant; durable sessions/events and minimal audit; one lifecycle adapter; one independently addressed harness adapter; one two-ended host-connectivity adapter; one low-risk mediated tool plus one denied or approval-required operation; disconnect/reconnect; ambiguous lifecycle and input reconciliation; capture-gap handling; and completed-session inspection after runtime/workspace cleanup.

The detailed acceptance and failure-injection list is canonical in [reference architecture v0 §14](https://github.com/maintainer/native-agent-host/blob/2292047fc1a59efb3a22e9373eba46b8599e74ca/issues/native-agent-host-architecture/reference-architecture-v0.md#14-walking-skeleton-boundary).

## Adoption proofs

- **Alder:** establish actual identity/Unix-user topology, tw trust/routing, current lifecycle authority, harness integration surfaces, repository/workspace behavior, credentials, history, and bypass paths.
- **Northwind:** establish personal-clone workflows, concurrent agent/branch behavior, Claude Code surfaces, credentials, CI/review handoffs, sensitive data, and acceptable operations/isolation.
- **Each Acme Creator implementation:** establish users/roles/schools, Moodle flows, sessions/tools, providers/credentials, storage/deletion/audit, deployment, branding/configuration, and migration constraints independently.

These proof definitions come from [reference architecture v0 §15](https://github.com/maintainer/native-agent-host/blob/2292047fc1a59efb3a22e9373eba46b8599e74ca/issues/native-agent-host-architecture/reference-architecture-v0.md#15-adoption-case-fit-and-required-evidence). Their task decomposition and order remain exclusively in issuectl.

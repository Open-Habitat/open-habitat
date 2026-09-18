# Implementation

**Authority:** Architecture-level milestone and adoption-proof map, including the evidence required to call each milestone complete.

**Updates when:** A milestone's required capability, proof, or completion evidence changes or a completed slice supplies new acceptance evidence.

**Not the source for:** Issue lanes, blockers, spawnability, assignees, task queues, current-state narrative, or architecture decisions.

Use the live [`native-agent-host-architecture` epic](https://github.com/maintainer/native-agent-host/blob/e7012c75e759af3a26dcea2ed2fb9d70ef077376/issues/native-agent-host-architecture/item.md) and `issuectl` for executable work state. This page stays at architecture-milestone granularity.

## Architecture milestones

| Milestone | Capability or output | Proof required | Landed evidence |
|---|---|---|---|
| M0 — provisional foundation | Reviewable target model, common vocabulary, evidence method, maintained Project View, and adversarial evidence synthesis | Reference architecture v0; dossier template; protocol/ecosystem/candidate research; synthesis with frozen benchmark and dossier briefs; validated six-page view | [Evidence index](evidence) and [synthesis](https://github.com/maintainer/native-agent-host/blob/3230e1326e2f2280c6d79ff6dc83fd2d60988137/issues/native-agent-host-architecture/synthesis-and-architecture-review.md) |
| M1 — source-grounded current state | Factual models of Alder, Northwind, and both Acme implementations | Four complete, non-overlapping dossiers with exact revisions, direct observations, privacy limits, unknowns, and trust/lifecycle/credential boundaries | Launch-ready scopes landed in the synthesis; dossiers not yet executed |
| M2 — comparative synthesis and architecture v1 | Tested common information model and explicit protocol, identity, policy, durability, isolation, tenancy, and integration choices | Common benchmark across AHP, ACP, AG-UI, LangChain Agent Protocol/Streaming and a minimal native baseline; three adoption fit-gaps; accepted ADRs; final architecture/security/maintainability/failure review | Source-grounded candidate synthesis landed; behavioral benchmark, current-state dossiers, fit-gaps, ADRs, and final review remain |
| M3 — Alder walking skeleton | Two web principals use one durable control plane over orchestrator-owned host-native execution | Negative cross-user authorization tests; declared ambient-power limits; reconnect and ambiguity reconciliation; credential no-leak; durable history after cleanup; audit evidence | Not yet landed |
| M4 — dedicated Northwind pilot | Organization deployment supports actual developer clone/branch/agent workflows | Workflow acceptance, identity and credential boundaries, concurrency/repository proof, operational ownership, and migration findings | Not yet landed |
| M5 — Acme integration | Application-specific UI and Moodle/tool flows use shared platform concepts with school tenancy | Both fit-gap reports; selected topology ADR; tenant isolation/deletion/audit tests; one application projection/integration pilot | Not yet landed |

## Walking-skeleton boundary

The first implementation slice proves seams rather than breadth: two principals; one explicit tenant; durable sessions/events and minimal audit; one lifecycle adapter; one independently addressed harness adapter; one two-ended host-connectivity adapter; one low-risk mediated tool plus one denied or approval-required operation; disconnect/reconnect; ambiguous lifecycle and input reconciliation; capture-gap handling; and completed-session inspection after runtime/workspace cleanup.

The detailed acceptance and failure-injection list is canonical in [reference architecture v0 §14](https://github.com/maintainer/native-agent-host/blob/2292047fc1a59efb3a22e9373eba46b8599e74ca/issues/native-agent-host-architecture/reference-architecture-v0.md#14-walking-skeleton-boundary).

## Adoption proofs

- **Alder:** establish actual identity/Unix-user topology, tw trust/routing, current lifecycle authority, Pi/extension integration surfaces, Taskfleet-as-tool behavior, repository/workspace correlation, credentials, history, ambiguous outcomes and bypass paths.
- **Northwind:** establish personal-clone workflows, concurrent agent/branch behavior, Claude Code surfaces, credentials, CI/review handoffs, sensitive data, centralization constraints and acceptable operations/isolation.
- **Each Acme Creator implementation:** independently establish users/roles/schools, Moodle flows, sessions/tools, providers/credentials, storage/deletion/audit, deployment, branding/configuration and migration constraints; then produce an explicit divergence map rather than assuming one implementation represents both.

The [synthesis §8](https://github.com/maintainer/native-agent-host/blob/3230e1326e2f2280c6d79ff6dc83fd2d60988137/issues/native-agent-host-architecture/synthesis-and-architecture-review.md#8-launch-ready-current-state-dossier-briefs) owns the launch-ready access, revision, observation, privacy, unknown and fit-gap requirements. The [frozen benchmark §7](https://github.com/maintainer/native-agent-host/blob/3230e1326e2f2280c6d79ff6dc83fd2d60988137/issues/native-agent-host-architecture/synthesis-and-architecture-review.md#7-frozen-common-hands-on-benchmark-specification) owns fixtures, operations, observables, evidence capture, scoring, category-specific N/A handling, safety limits and stop conditions. Their executable task decomposition and order remain exclusively in issuectl.

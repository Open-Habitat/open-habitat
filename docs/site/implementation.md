# Implementation

**Authority:** Architecture-level milestone and adoption-proof map, including the evidence required to call each milestone complete.

**Updates when:** A milestone's required capability, proof, or completion evidence changes or a completed slice supplies new acceptance evidence.

**Not the source for:** Issue lanes, blockers, spawnability, assignees, task queues, current-state narrative, or architecture decisions.

Use the live [`native-agent-host-architecture` epic](https://github.com/maintainer/native-agent-host/blob/e7012c75e759af3a26dcea2ed2fb9d70ef077376/issues/native-agent-host-architecture/item.md) and `issuectl` for executable work state. This page stays at architecture-milestone granularity.

## Architecture milestones

| Milestone | Capability or output | Proof required | State |
|---|---|---|---|
| M0 — evidence foundation | Reviewable v0, evidence method, candidate research, maintained Project View and adversarial synthesis | Reference architecture, dossier template, source-grounded protocol/ecosystem research, benchmark scenarios and validated view | Landed; indexed in [evidence](evidence) |
| M1 — current-state dossiers | Factual models of Alder, Northwind and both Acme implementations | Four revision-pinned dossiers with bounded observations, privacy limits, unknowns and trust/lifecycle/credential boundaries | Landed with explicit access gaps; indexed in [evidence](evidence) |
| M2 — accepted core model | Simple authority model that preserves native Unix and harness operation | Explicit decision for server federation, user mapping, workspace/agent identity, permissions, discovery and browser projection | Landed as [ADR 0001](adr-0001-unix-native-agent-host) |
| M3 — Alder walking slice | One browser reaches one user's native Pi workspace and agent through a gateway and per-user daemon | Identity→UID mapping; `~/src` discovery; native Pi session discovery/resume; snapshot; prompt/command; combined SSE feed; disconnect/reconnect; tmux/SSH continuity; no duplicated authoritative state | Not yet landed |
| M4 — second-user and failure proof | Jari and Kaisa use separate Unix-backed views on the same server | Negative cross-user tests; gateway fail-closed behavior; daemon restart and stale/native-conflict behavior; extension limitation documented honestly | Not yet landed |
| M5 — agent/process depth | Useful workspace-local agent tree and process visibility | First concrete parent/presentation need; sparse annotation proof; Taskfleet correlation; Pi-extension process/output/stop contract; worktree cleanup and native-history resume | Not yet landed |
| M6 — adoption pilots | Northwind and Acme paths preserve their real native/application constraints | Representative Northwind workflow pilot; combined Acme fit-gap and deployment decision; application-specific projection only where generic host UI is insufficient | Not yet landed |
| M7 — architecture v1 | Tested accepted model plus explicit operational boundaries | Walking-slice results, adoption findings, final architecture/security/maintainability/failure review and any required follow-up ADRs | Not yet landed |

## First walking slice

The first implementation should be narrower than the earlier candidate-neutral benchmark. It should prove the accepted architecture end to end:

1. one authentication gateway with a fixed web-identity→Unix-user mapping;
2. one daemon running as that user;
3. direct discovery of `~/src/*` with no required registry or cache;
4. discovery of one native Pi resume identity and its history;
5. launch or resume through Pi's own configuration and permissions;
6. one versioned JSON snapshot and HTTP command path;
7. one cursor-marked SSE feed combining that user's workspace, agent, process and output events;
8. browser disconnect/reconnect without affecting the agent;
9. continued direct use through SSH, tmux, Pi, Git and Taskfleet;
10. clear degraded behavior when an optional Pi extension or native source is unavailable.

Do not add a performance cache, broad agent taxonomy, credential broker, platform history store, tenant object, protocol compatibility layer or event-feed partition until a measured or observed requirement demands it.

## Adoption proofs

- **Alder:** prove the Unix-native model first. The dossier already establishes one-user trust, separate native stores, ambient tool power and one live Taskfleet correlation; attached-seat behavior, second-user separation, interruption, cleanup and complete correlation remain to be observed.
- **Northwind:** preserve personal clones and normal Git/worktree conventions. Obtain representative developer evidence and a controlled concurrency pilot before choosing a dedicated-server workflow.
- **Native Creator:** treat its content directory as a possible non-Git workspace and preserve its unrestricted local-tool reality. Do not infer school identity or Moodle behavior from the unavailable fork/package.
- **Creator web:** keep its organization, durable drafts/jobs and private application SSE as application-owned concepts. Decide later whether it embeds or complements the generic host projection; do not introduce a core tenant to imitate it.

The frozen fixture remains useful for later comparative claims, but ADR 0001 deliberately avoids requiring a broad protocol benchmark before the minimal native HTTP/SSE slice. Run candidate comparisons only when a concrete interoperability need appears.

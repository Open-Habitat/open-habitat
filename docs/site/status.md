# Current status

**Authority:** Sole reader-facing narrative of the architecture initiative's current state.

**Updates when:** A meaningful reader-visible milestone, review result, decision need, next proof, or the landed project-state baseline used by this narrative changes; ordinary task churn alone does not require a rewrite.

**Not the source for:** Executable task state, scheduling, accepted architecture, research findings, or durable decision rationale.

**Updated:** 2026-09-19

**Source revision:** `04319441e9a3ecce6882d04e0a7614f902afa734` (latest landed evidence baseline considered in the accepted design dialogue; not the self-referential documentation commit)

## Summary

The first core architecture decision is now accepted. Native Agent Host will be a federated, Unix-native web projection rather than a new universal control plane. A web client connects to one or more independent servers. Each server has a shared authentication gateway and one lightweight daemon per Linux user; an administrator maps each authenticated web identity to exactly one Unix account on that server.

Workspaces are discovered from `~/src/*`. Agents use namespaced Pi, Claude Code or Codex resume identities. Native filesystem, Git, harness history/configuration, tmux, processes and Taskfleet remain authoritative. Agent Host discovers and joins their facts instead of duplicating them. An agent receives its Linux user's permissions and credentials; optional extensions may add guardrails but are not automatically a sandbox. The core has no platform session/workstream or tenant abstraction.

The initial client surface will be a small versioned JSON/HTTP API plus one cursor-marked combined SSE feed per server. No AHP, ACP, AG-UI, Taskfleet-specific browser protocol, performance index, platform history database or broad agent taxonomy is required before a concrete need appears. The complete decision is [ADR 0001](adr-0001-unix-native-agent-host), integrated into [architecture](architecture).

## Ready to review

The accepted model now covers server federation, user mapping, workspace and agent identity, authority, discovery, permissions, sparse annotations and the initial browser protocol. The source-grounded current-state dossiers and candidate research remain indexed in [evidence](evidence). They continue to constrain adoption details without overriding the simpler accepted host model.

The candidate-neutral fixture remains valid comparative infrastructure, but its own tests prove only fixture integrity. It has not established that any protocol implements B1–B8.

## Decisions still open

Implementation choices remain for gateway authentication technology, gateway-to-daemon transport, daemon packaging, Pi discovery and process-extension contracts, exact HTTP/SSE schemas and cursor bounds, the first demonstrably necessary hierarchy annotations, adapters beyond Pi, stronger isolation if an actual workload needs it, and application-specific Northwind/Acme integration.

Architecture v1 has not been declared. Tenant, credential-broker, platform-history and broad control-plane assumptions from reference architecture v0 are superseded by ADR 0001 unless a later evidence-backed decision reintroduces a narrower capability.

## Next proof

Build the smallest Alder walking slice: authenticate one web identity, route it to one UID-scoped daemon, list `~/src`, discover and resume one Pi agent through its native identity, return one JSON snapshot, accept one command, and stream a combined cursor-marked SSE feed. Verify that browser disconnect does not affect the agent and that SSH, tmux, Pi, Git and Taskfleet remain usable directly.

Add no cache until measurement identifies a slow path, and store no annotation until a named UI or behavior cannot reconstruct the information from native sources.

## Notable limitations

Alder's attached-seat and second-principal behavior, ambiguous lifecycle outcomes and cleanup remain incompletely observed. The Northwind dossier lacks representative interviews, macOS/live-Claude observation and a controlled concurrency exercise. Native Creator's private fork, package/deployment correspondence and live provider/Moodle behavior were unavailable. Creator web lacked an authenticated synthetic account, host/data/log access, restore testing and a Moodle integration path. These are unresolved access or observation gaps, not proof that the corresponding capabilities do not exist.

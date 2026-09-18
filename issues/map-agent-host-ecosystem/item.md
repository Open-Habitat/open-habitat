---
created: 2026-09-18
updated: 2026-09-18
type: task
reporter: jari
status: in-progress
priority: high
epic: native-agent-host-architecture
lane: unlaned
---

# Map the agent host ecosystem

## Goal

Map the current ecosystem of agent-host protocols, runtimes, web control planes, and multi-user agent platforms relevant to native-agent-host, then produce a justified shortlist for deeper benchmarking.

## Scope

- Investigate OpenHands, Trellis, and the project tentatively remembered as Herdr/Herd; verify exact project identities rather than assuming the names are correct.
- Discover additional serious candidates systematically through primary-source searches and references between projects.
- Classify candidates as protocol, runtime/session host, orchestration layer, web control plane, application framework, or multi-user platform.
- Compare at a screening level: session model, browser UI, native host execution, multi-agent/harness support, durability, tool mediation, identity/authz, tenancy, auditability, extension model, deployment model, license, maturity, and activity.
- Treat Microsoft AHP only at screening level because a sibling task performs its deep analysis.

## Deliverable

Write an engineer-facing English report to `issues/native-agent-host-architecture/research/agent-host-ecosystem.md`. Prefer primary sources, cite non-trivial claims inline, record inspected revisions/dates, explain the search method, and give a justified shortlist for the later deep benchmark.

## Exclusions

Do not choose the platform architecture, write an ADR, or duplicate the sibling AHP deep analysis.

## Acceptance criteria

- Named leads are verified or explicitly marked unresolved.
- Candidate discovery extends beyond the names supplied initially.
- Categories prevent unlike products from being compared as direct substitutes.
- The shortlist states why each candidate deserves or does not deserve deeper benchmarking.

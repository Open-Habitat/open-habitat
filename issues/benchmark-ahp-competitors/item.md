---
created: 2026-09-18
updated: 2026-09-18
type: task
reporter: jari
status: open
priority: high
epic: native-agent-host-architecture
lane: unlaned
---

# Benchmark AHP competitors and traction

## Goal

Identify protocols that directly or materially compete with Microsoft Agent Host Protocol for the native-agent-host browser/client ↔ agent-host seam, and compare their real-world traction, maturity, governance, and fit.

## Scope and method

- Start from the existing `agent-host-ecosystem.md` and `agent-host-protocol-analysis.md`, but perform a fresh protocol-centered search rather than repeating the product/platform survey.
- Separate direct substitutes from adjacent/complementary protocols. Explain why ACP, AG-UI, MCP, A2A, framework-specific streams, editor protocols, or newly discovered candidates are or are not direct AHP alternatives.
- Prefer official specs, repositories, package registries, release histories, implementation lists, product documentation, and governance records.
- Record a dated snapshot and exact inspected revisions/versions.

## Traction evidence

Use multiple indicators rather than stars alone: independent implementations, production/product adoption, named integrations, dependent packages/repositories where measurable, package downloads where meaningful and reproducible, contributors/organizations, releases, commit/issue activity, conformance tooling, SDK/language coverage, governance/standardization, and credible abandonment or concentration risks. State metric collection dates and limitations; do not fabricate inaccessible metrics or treat vendor marketing as independent adoption.

## Deliverable

Write an engineer-facing English report to `issues/native-agent-host-architecture/research/ahp-competitors-and-traction.md`. Include a taxonomy, direct-competitor shortlist, comparable traction table, protocol capability comparison focused on native-agent-host, divergent interpretations of traction, risks, and a recommendation for which protocols deserve hands-on benchmark spikes before the MVP protocol decision.

Do not choose the final protocol or author an ADR.

## Acceptance criteria

- Direct competitors and adjacent protocols are clearly separated.
- Candidate discovery extends beyond the already named protocols where evidence supports it.
- Traction claims are dated, sourced, reproducible where practical, and normalized cautiously.
- Architectural fit covers state synchronization, commands/actions, tool and input lifecycle, reconnect/resume, extensibility, browser suitability, multiple clients, durability assumptions, identity/auth boundary, and implementation burden.
- The report explains whether AHP has a genuine peer competitor or mainly overlaps several narrower protocols.
- The result is suitable input to the architecture synthesis and protocol decision.

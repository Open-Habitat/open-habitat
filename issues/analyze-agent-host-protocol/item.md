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

# Analyze Microsoft Agent Host Protocol

## Goal

Produce a source-grounded deep analysis of Microsoft Agent Host Protocol (AHP) and determine where it overlaps with the proposed Pi → server → web control path for native-agent-host.

## Scope

- Identify the authoritative specification, repositories, implementations, license, maturity, and exact inspected revisions or dates.
- Analyze session state and lifecycle, status and activity, working directories, tool-call states, input requests, events, transport, reconnect/resume behavior, durability, extensibility, identity, authorization, and multi-user assumptions.
- Map AHP concepts to the platform described by @native-agent-host-architecture.
- Distinguish verified behavior from inference and unresolved questions.
- Evaluate four paths without selecting one prematurely: adopt AHP, provide an AHP-compatible adapter, reuse its information model, or design an independent protocol.

## Deliverable

Write an engineer-facing English report to `issues/native-agent-host-architecture/research/agent-host-protocol-analysis.md`. Prefer primary sources and cite every non-trivial external claim inline with stable URLs. Include an explicit fit-gap table, risks, unknowns, and questions that must be resolved before locking the MVP specification.

## Exclusions

Do not make the final architecture decision, author an ADR, or implement code.

## Acceptance criteria

- Authoritative sources and inspected revisions/dates are recorded.
- Protocol semantics are described precisely enough to support a later architecture decision.
- Similarities and differences with the proposed native-agent-host boundary are explicit.
- The report ends with decision inputs rather than an unsupported recommendation.

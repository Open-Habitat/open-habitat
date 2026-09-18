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

# Produce ecosystem shortlist candidate dossiers

## Goal

Produce first-version, source-grounded candidate dossiers for every ecosystem shortlist member not already covered by the dedicated AHP analysis, and evaluate how each fits the native-agent-host vision.

## Units and outputs

- OpenHands → `issues/native-agent-host-architecture/research/candidates/openhands.md`
- Herdr → `issues/native-agent-host-architecture/research/candidates/herdr.md`
- Coder → `issues/native-agent-host-architecture/research/candidates/coder.md`
- both identified Pi Web implementations as one comparative dossier → `issues/native-agent-host-architecture/research/candidates/pi-web.md`
- Agent Client Protocol (ACP) → `issues/native-agent-host-architecture/research/candidates/acp.md`
- AG-UI with CopilotKit → `issues/native-agent-host-architecture/research/candidates/ag-ui-copilotkit.md`
- Open WebUI → `issues/native-agent-host-architecture/research/candidates/open-webui.md`

Microsoft AHP is already covered by `research/agent-host-protocol-analysis.md`; do not duplicate it.

## Method

Use `dossier-and-benchmark-template.md` as the common evidence and comparison contract, adapting non-applicable sections explicitly rather than forcing unlike candidates into one category. Prefer authoritative repositories, specifications, product documentation, release histories, licensing, implementation source, and reproducible observations. Record exact revisions/versions and collection dates.

Each dossier must explain what the candidate actually is, its architecture and authority boundaries, relevant workflows and state model, deployment/operations, identity/authorization/tenancy, persistence, tooling/integrations, extension points, maturity/traction, constraints, and fit-gap against the three native-agent-host adoption cases and reference architecture v0.

## Acceptance criteria

- Seven disjoint candidate dossier files exist and use consistent evidence labels and frozen comparison dimensions.
- Every non-trivial claim is cited to a primary source where available.
- Product editions and open-source versus commercial capabilities are distinguished.
- Facts, tested observations, inference, and unknowns are separate.
- Each dossier ends with adopt/borrow/benchmark/reject implications and concrete questions for synthesis.
- Cross-candidate ranking is deferred to the later synthesis; units do not silently choose the architecture.

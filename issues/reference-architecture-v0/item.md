---
created: 2026-09-18
updated: 2026-09-18
type: task
reporter: jari
status: done
priority: high
epic: native-agent-host-architecture
lane: unlaned
commits:
- hash: 8d4b1ec8d771ff042daf5c985162bc7f366ae024
  summary: 'docs: prepare initial architecture task'
closed: 2026-09-18
closed_by: agent
---

# Draft reference architecture v0

## Goal

Draft reference architecture v0 for the native-agent-host platform as a provisional, reviewable architecture that does not lock the MVP protocol prematurely.

## Scope

- Define vision, scope, non-goals, vocabulary, actors, trust boundaries, components, responsibilities, and major data/control flows.
- Cover the browser clients, shared control plane, harness adapters, existing orchestration authority, host-native runtimes, durable session history, policy-controlled tools, identity/authz, tenant boundaries, auditability, and application-specific interfaces.
- Address all three adoption cases in @native-agent-host-architecture without making Alder-specific assumptions universal.
- Separate invariant platform requirements from hypotheses, candidate designs, and unresolved decisions.
- Make protocol boundaries and adapter contracts visible while deliberately leaving their wire formats undecided pending ecosystem research.

## Deliverable

Write an engineer-facing English document to `issues/native-agent-host-architecture/reference-architecture-v0.md`. Include at least one clear component/context diagram using Mermaid or an equally maintainable text format, key end-to-end flows, trust boundaries, assumptions, risks, and an explicit decision backlog.

## Exclusions

Do not implement code, select AHP or another external protocol, finalize ADRs, or call the document architecture v1.

## Acceptance Criteria

- [x] A walking-skeleton boundary can be understood without prematurely specifying its wire protocol.
- [x] Existing orchestration remains the initial lifecycle authority behind an adapter.
- [x] Durable history is distinct from ephemeral process/worktree state.
- [x] Identity, authorization, capability policy, tenancy, credentials, and auditability are first-class in the model.
- [x] Open questions suitable for the later synthesis/review gate are explicit.

---
created: 2026-09-18
updated: 2026-09-18
type: task
reporter: jari
status: open
priority: high
epic: native-agent-host-architecture
lane: architecture
commits:
- hash: 8d4b1ec8d771ff042daf5c985162bc7f366ae024
  summary: 'docs: prepare initial architecture task'
---

# Draft reference architecture v0 and project dossier template

## Goal

Produce the first reviewable architecture package for native-agent-host. It must turn the parent epic's vision into a clear but explicitly provisional platform model and a reusable method for comparing the four source systems.

This is an architecture and discovery task, not an implementation task. Record unknowns rather than filling them with assumptions.

## Required outputs

Keep the working documents in this issue directory until the architecture is reviewed:

- `vision-and-boundaries.md`
- `reference-architecture-v0.md`
- `project-dossier-template.md`
- `comparison-criteria.md`

The project dossier template must begin with an unrestricted free-form architecture description before any structured checklist.

## Inputs and evidence

- Read the complete parent epic `@native-agent-host-architecture`.
- Inspect the current Alder, tw, Pi, Taskfleet, and orchestration documentation and source where needed to distinguish observed behavior from architectural hypotheses.
- Read Pi's SDK, RPC, session, extension, and TUI documentation and follow relevant cross-references before characterizing integration options.
- Treat the Northwind and two Acme Creator implementations as later source-grounded dossiers. This task may define questions and comparison criteria for them, but must not pretend to have inspected them.
- Cite inspected files, documentation, commands, repositories, and revisions. Label hypotheses and unresolved questions explicitly.

## Required coverage

The reference architecture v0 must address at least:

- control plane, agent runtime/data plane, browser clients, application-specific clients, adapters, integrations, and durable event/history storage
- identity, roles, authorization, capability policy, credentials, auditability, and user separation
- sessions, agent processes, parent-child relationships, repositories, workspaces, checkouts, worktrees, branches, and lifecycle events
- the boundary between native-agent-host and the existing orchestrator
- harness portability across Pi, Claude Code, and future runtimes
- generic agent UI versus Acme Creator and other domain-specific interfaces
- school tenancy independently from physical deployment
- pooled, per-tenant-server, and hybrid deployment models
- Moodle and other domain tools as governed integrations rather than UI assumptions
- completed-session retention after processes, worktrees, or branches disappear
- where host-native execution is essential and where Unix users, containers, VMs, or host separation may provide isolation

## Acceptance criteria

- The four required documents exist and agree on terminology and boundaries.
- The architecture separates stable platform concepts from current Alder/tw implementation details.
- The dossier template is open-ended and can capture facts not anticipated by its checklist.
- The comparison criteria can be applied consistently to Alder, Northwind, and both Acme Creator implementations.
- Tenant identity and deployment topology are modeled as separate decisions.
- Decisions not justified by evidence remain hypotheses or open questions.
- The package identifies the next source-grounded dossier tasks without implementing the platform.

## Comments

---
created: 2026-09-18
updated: 2026-09-18
type: task
reporter: jari
status: open
priority: normal
epic: native-agent-host-architecture
lane: unlaned
---

# Design dossier and benchmark template

## Goal

Design the common evidence dossier template and benchmark criteria used to inspect current systems and compare external agent-host solutions consistently.

## Scope

- Begin the dossier with a free-form architecture description so unexpected findings are not forced into a checklist.
- Cover users, workflows, interfaces, processes, sessions, repositories, workspaces, orchestration, tools, integrations, credentials, isolation, persistence, operations, constraints, evidence, revisions, and unknowns.
- Add tenancy coverage for users/roles, sessions, data, credentials, Moodle connections, tools, audit logs, retention/deletion, configuration, branding, and physical deployment.
- Define evidence quality and citation rules, including repository/revision, source files, configuration, commands, and observed behavior.
- Define benchmark dimensions that can be applied to protocols, runtime hosts, control planes, and complete platforms without hiding category differences.

## Deliverable

Write an engineer-facing English template to `issues/native-agent-host-architecture/dossier-and-benchmark-template.md`. It must be directly reusable for Alder, Northwind, both Acme Creator implementations, and the later external-product benchmark. Include instructions, structured sections, comparison fields, and guidance for unknown or non-applicable entries.

## Exclusions

Do not fill the template for any current system, perform the ecosystem research, or make architecture decisions.

## Acceptance criteria

- The template supports source-grounded current-state dossiers and comparative benchmarking.
- Free-form findings remain possible before the structured checklist.
- Evidence, fact, inference, and unknown are distinguishable.
- Deployment topology and logical school tenancy are modeled independently.
- The output is usable without additional interpretation by subsequent worktrees.

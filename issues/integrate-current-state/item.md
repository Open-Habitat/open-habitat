---
created: 2026-09-18
updated: 2026-09-18
type: task
reporter: jari
status: done
priority: high
epic: native-agent-host-architecture
lane: architecture-docs
lane_seq: 20
closed: 2026-09-18
closed_by: pi
---

# Integrate current state evidence

## Goal

Integrate the completed four current-state dossiers and candidate-neutral benchmark fixture into the maintained Project View and architecture epic without performing fit-gap analysis or accepting architecture decisions.

## Inputs

- `issues/native-agent-host-architecture/research/current-state/alder.md`
- `issues/native-agent-host-architecture/research/current-state/northwind-workflow.md`
- `issues/native-agent-host-architecture/research/current-state/acme-creator-native.md`
- `issues/native-agent-host-architecture/research/current-state/acme-creator-web.md`
- `benchmarks/agent-host/`
- their introducing commits and closed child issues
- `docs/AGENTS.md` authority and update contract

## Deliverables

1. Mark all five completed child rows in the architecture epic checked and add this integration task to its checklist.
2. Add revision-pinned evidence rows for each dossier and the benchmark fixture to `docs/site/evidence.md`, preserving scope, direct-observation limits, privacy/access gaps, and the rule that fixture validation is not a benchmark result.
3. Update `docs/site/architecture.md`, `decisions.md`, `implementation.md`, and `status.md` only where the new evidence changes their owned integrated view. Preserve provisional status; do not write or accept ADRs, declare architecture v1, select an MVP protocol, choose a tenancy topology, or turn dossier inferences into normative architecture.
4. Surface the most decision-relevant current-state facts and blockers category-correctly: Alder's single-Unix-user trust and split native stores; Northwind's personal-clone/worktree practices and missing representative interviews; native Creator's local unrestricted-tool model and org-key cloud seam; web Creator's existing org-scoped browser platform, private SSE/application runtime, deployed-source drift and absent Moodle path.
5. State the next bounded evidence step: run the minimal custom API baseline against the frozen fixture and produce three adoption fit-gap analyses, with unresolved dossier observations carried forward.

## Validation

Run the complete benchmark fixture validation commands from `benchmarks/agent-host/README.md`, `python3 docs/validate-project-view.py`, `glasspad build --dry-run --json docs/site /tmp/native-agent-host-project-view`, and `git diff --check`. Close this issue as done with a stamped commit and merge through the owning Taskfleet run. Do not publish Glasspad from the worktree; publication happens after landing.

---
created: 2026-09-18
updated: 2026-09-18
type: task
reporter: jari
status: open
priority: high
epic: native-agent-host-architecture
lane: architecture-review
lane_seq: 10
---

# Synthesize architecture evidence

## Goal

Synthesize and adversarially review all landed architecture, protocol, Pi-extension, documentation-workflow, and seven-candidate evidence before current-state adoption dossiers or an MVP protocol choice begin.

## Scope

Read the architecture epic and every canonical artifact indexed by `docs/site/evidence.md`, especially:

- `issues/native-agent-host-architecture/reference-architecture-v0.md`
- `issues/native-agent-host-architecture/dossier-and-benchmark-template.md`
- all reports under `issues/native-agent-host-architecture/research/`
- all seven dossiers under `issues/native-agent-host-architecture/research/candidates/`
- the six-page Project View under `docs/site/`

Use existing source-grounded evidence as the baseline. Recheck primary sources only where a material claim is conflicting, ambiguous, or decision-critical; do not turn this into an unbounded ecosystem survey.

## Deliverables

1. Write `issues/native-agent-host-architecture/synthesis-and-architecture-review.md` as the canonical synthesis report.
2. Give a direct, category-aware verdict on whether any reviewed candidate already satisfies the whole native-agent-host need. Distinguish full adoption, compositional use, pattern borrowing, benchmark-only use, and rejection; do not compare protocols, UI event layers, runtime hosts, and control planes as though they were interchangeable products.
3. Adversarially review reference architecture v0 against the project goal and three adoption cases. List assumptions to preserve, revise, remove, or defer, with evidence and confidence. Explicitly re-evaluate the public orchestration-control API in light of the epic's Taskfleet clarification.
4. Freeze a reproducible common hands-on benchmark plan for AHP, ACP, AG-UI, LangChain Agent Protocol, and a minimal custom API baseline. Define scenarios, fixtures, expected observations, evidence capture, pass/fail or scored criteria, category-specific N/A handling, safety limits, and stop conditions. Do not claim the benchmark was executed.
5. Define the exact scope and evidence plan for four source-grounded current-state dossiers: Alder/tw/Pi/current orchestration, current Northwind workflow, Acme Creator implementation A, and implementation B. State required repositories/deployments, revision pinning, direct observations, privacy constraints, unknowns, and how each dossier feeds fit-gap work.
6. Produce an ordered architecture-decision/ADR agenda covering at least protocol/profile, identity and authorization, durable history, process/workspace isolation, tenancy/deployment topology, and application-specific UI integration. Mark which decisions remain blocked and by what evidence.
7. Recommend the next bounded work sequence. Keep the MVP protocol and architecture v1 unlocked unless the evidence genuinely closes their gates.
8. Update the Project View according to `docs/AGENTS.md`: add the synthesis to `docs/site/evidence.md` with its exact introducing revision handled in the repository's established way, update `architecture.md`, `decisions.md`, `implementation.md`, and `status.md` where the synthesis changes their owned view, and avoid promoting research recommendations into accepted ADRs.

## Quality and completion criteria

- Every material conclusion points to canonical repository evidence and clearly separates observation, inference, recommendation, and unknown.
- Candidate verdicts identify edition/licensing and untested-behavior limits where relevant.
- The benchmark plan is executable by later workers without inventing scenarios or success criteria.
- The four dossier briefs are sufficiently concrete to launch as parallel, non-overlapping investigations.
- No ADR is accepted and no architecture v1 is declared by this review.
- Run `python3 docs/validate-project-view.py` and `glasspad build --dry-run --json docs/site /tmp/native-agent-host-project-view`.
- Commit all work, close this issue as `done` with a stamped implementation commit, and merge/report through the owning Taskfleet run.

---
created: 2026-09-18
updated: 2026-09-18
type: feature
reporter: jari
status: done
priority: high
epic: native-agent-host-architecture
lane: unlaned
closed: 2026-09-18
closed_by: agent
---

# Create architecture Project View

## Goal

Put the approved minimal architecture Project View into use for native-agent-host, based on `research/aggountant-project-view-analysis.md`.

## Deliverables

Create the maintained documentation surface:

- `docs/AGENTS.md` and `docs/CLAUDE.md` symlink
- `docs/site/.glasspad.yaml` with stable `space_key: native-agent-host` only
- `docs/site/glasspad.yaml` with a small grouped navigation manifest
- `docs/site/index.md`
- `docs/site/architecture.md`
- `docs/site/decisions.md`
- `docs/site/evidence.md`
- `docs/site/implementation.md`
- `docs/site/status.md`
- a lightweight repository-local validator for the documented structural and authority rules

Amend root `AGENTS.md` so `docs/site/` is an explicit exception to the per-directory AGENTS/CLAUDE pattern, because the publishable Glasspad space must contain no symlinks or instruction files.

## Content and authority

- Populate the pages from the landed architecture v0, research reports, epic, and issue state by linking to canonical artifacts rather than copying long findings.
- Clearly declare each page's authority, update trigger, and what it does not own.
- Keep `status.md` as the sole reader-facing current-state narrative.
- Keep issuectl as executable task truth; do not copy lanes or task queues into documentation.
- Keep research reports under the architecture epic as canonical evidence; `evidence.md` is an index with exact revisions/limitations.
- Do not create audience companions, per-stint archives, placeholder ADRs, or a documentation generator.

## Validation and publication boundary

Validate Glasspad scanning/building, manifest/page parity, slugs, symlinks, links, required authority headers, and duplicate/missing navigation entries. Do not publish from the worktree: after the change lands, the supervising main session will publish the complete `docs/site/` from `main` and report the URL.

## Acceptance criteria

- The six-page site is coherent and useful as the current architecture front door.
- A reader can find accepted/provisional architecture, evidence, decisions, implementation milestones, and current status without duplicated sources of truth.
- Maintenance triggers are concrete enough for later handoff/wrap-up workflows.
- Validation is deterministic, non-interactive, and documented.
- The repository remains clean and no user/global configuration is modified.

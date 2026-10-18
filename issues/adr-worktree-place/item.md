---
created: 2026-10-18
updated: 2026-10-18
type: task
reporter: jari
status: open
priority: high
preparation: ready
lane: worktree
lane_seq: 1
collision: [docs/decisions/]
---

# ADR: worktree as a place, agent-driven settlement, daemon cleanup

Record as an ADR the host decisions Jari made on 2026-10-18 for interactive worktree agents and worktree cleanup (`issues/proto-interactive-worktrees/result.md`, "Jari's decision" and the host decisions; background `issues/research-worktree-agents-host/report.md`). The decision is made; this issue writes it down precisely, not re-decides it.

It amends ADR 0010 (Taskfleet caller-owned runs for browser worktree agents → a worktree is a plain Git place, agent-driven settlement, no host settlement engine), leaves ADR 0017 (spinoffs) as is, and extends ADR 0019 with daemon-owned worktree cleanup and forced removal. Update `docs/decisions/index.md`, the amended ADRs' status lines and `docs/architecture/` pages that describe worktrees.

## Acceptance Criteria
- [ ] ADR accepted-by-Jari (2026-10-18) with context, decision, consequences and the cleanup safety rules; related ADRs and architecture docs updated.

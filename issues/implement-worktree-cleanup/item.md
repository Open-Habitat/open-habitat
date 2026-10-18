---
created: 2026-10-18
updated: 2026-10-18
type: feature
reporter: jari
status: open
priority: high
preparation: ready
lane: worktree
lane_seq: 2
collision: [internal/daemon/workspace, contracts/v1/]
blocked_by: ['@adr-worktree-place']
---

# Worktree cleanup and forced removal

Worktree cleanup as Jari decided on 2026-10-18 (`issues/proto-interactive-worktrees/result.md`, "Cleanup belongs to the daemon"; the ADR from `adr-worktree-place`). Jari: "Näiden kanssa on nykyäänkin ongelmia … pitäisi olla joku tapa ehkä siivota näitä pois tai forsettaa ne pois."

- A list of all worktrees of the user's workspaces (workspace page and Asetukset › Tallennustila) with Git state: merged, unmerged, uncommitted changes, missing directory.
- Merged: remove checkout and branch; "Siivoa kaikki yhdistetyt". Unmerged: remove the checkout, keep the branch. Uncommitted changes: "Tallenna muutokset haaraan ja poista" (commit to the branch) or "Poista pakolla" confirmed by typing the name. Missing directory: `git worktree prune`.
- The daemon does it as the user with the Trash's safety rules (ADR 0019): open-process check, paths resolved by the daemon, never taken from the browser. Applies to existing worktrees, including Taskfleet leftovers; never removes a worktree a live Taskfleet run owns (check `taskfleet run list`).

## Acceptance Criteria
- [ ] Host tests for each state and the live-run guard; browser flow with lab screenshots; KOKEILTAVAA lines.

# Result: ADR 0025, worktree as a place

[ADR 0025](../../docs/decisions/adr-0025-worktree-as-a-place.md) records Jari's
18 October 2026 decision: a worktree is a plain Git place holding ordinary
browser conversations, agents settle it in conversation while the top bar shows
Git's state, Taskfleet does not own these worktrees (spinoffs unchanged), and
the daemon lists and removes worktrees, including forced removal, with the
Trash's safety rules. The context explains why the research's option-B
objection (no lifecycle owner, or a second merge engine) falls away once there
are no settlement buttons.

Updated alongside: ADR 0010 status (amended by 0025), a pointer at the end of
ADR 0017 (decision unchanged), ADR 0019 status and check 4 (extended by 0025),
`docs/decisions/index.md`, `docs/glasspad.yaml`, `architecture/workspaces.md`,
`architecture/conversations.md` and the worktree paragraph of `product.md`.
No product code; no user-visible change, so no KOKEILTAVAA line.

Checks: `python3 scripts/validate-project-view.py` (37 pages valid) and
`git diff --check`. Self-review only, as the brief allows.

## Decisions for later review

These fill gaps the 18 October decision did not state; the ADR records them as
part of the decision and implementation may revisit them.

- **Placement** of browser-made worktrees: `~/src/<workspace>__worktrees/<name>`,
  the existing sibling convention. A `~/src` child holding only linked
  worktrees of discovered workspaces is a container, not a workspace, judged
  from Git's registry.
- **Base** for ahead/behind and "merged": recorded natively as the new branch's
  local upstream; without one, the main checkout's current branch.
- **Forced removal** deletes (descriptor walk as in Trash permanent deletion)
  rather than moving the checkout to the Trash; the ADR lists the Trash move as
  a considered alternative.
- **Locked** worktrees are shown with their reason and not removed; a
  Taskfleet-owned worktree blocks cleanup until its run is merged or cancelled.
- **Merged branch deletion** is compare-and-delete on the observed tip.
- Not decided: whether a removed worktree's conversations stay listed under the
  workspace (no binding store is allowed, so only a path rule could do it), and
  whether *Tallenna muutokset haaraan* runs commit hooks. Left to
  `implement-worktree-agents` and `implement-worktree-cleanup`.

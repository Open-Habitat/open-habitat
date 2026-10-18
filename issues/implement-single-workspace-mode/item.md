---
created: 2026-10-18
updated: 2026-10-18
type: feature
reporter: jari
status: open
priority: high
preparation: ready
lane: topbar
lane_seq: 2
collision: [web/src/app/]
related: ['@proto-single-workspace-mode']
blocked_by: ['@implement-git-status-topbar']
---

# Single-workspace mode (Yläpalkissa)

Implement single-workspace mode as Jari chose on 2026-10-18 in `proto-single-workspace-mode`: direction **Yläpalkissa** ("sivupalkki ei ole mikään itseisarvo"). Prototype `design-system/prototypes/rounds/2026-10-17-yksi-tyotila/`; `issues/proto-single-workspace-mode/result.md` has the direction, host facts and "Jari's decision".

- The mode is derived from the number of visible native workspaces (1 vs more); nothing is stored. Adding a second workspace moves to multi-workspace mode, and back when it drops to one.
- **The last workspace cannot be moved to the Trash** (Jari: for many it is the only place they work). Do not offer it, or show it blocked with the reason.
- Unanswered questions take the recommendations (hidden workspaces do not count; a notice on each mode change); list them under Decisions for later review.
- The top bar also carries the Git status (`implement-git-status-topbar`), which lands first; build on it.

## Acceptance Criteria
- [ ] Single-workspace UI on desktop and phone, transitions both ways, last-workspace trash blocked; lab screenshots against the prototype; browser tests for the mode switch.

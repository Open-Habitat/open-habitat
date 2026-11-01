---
created: 2026-11-01
updated: 2026-11-01
type: improvement
reporter: jari
status: open
priority: normal
lane: rail-quiet-all-flat
lane_seq: 2
related: ['@proto-rail-recent-r2', '@rail-recent-five']
preparation: pending
blocked_by: ['@proto-rail-quiet-flat']
---

# Rail: Sinun vuorosi, Käynnissä, Hiljaiset with every conversation as a flat list

Jari 1.11., after going through the state graphs of `proto-rail-recent-r2`:
*Viimeisimmät* is confusing. Remove it as a section. The rail's
conversation sections are:

- **Sinun vuorosi** — as now.
- **Käynnissä** — as now (including the interrupted turn).
- **Hiljaiset** — every other conversation: all of them, not a recent
  few, newest first (`changed_at`).

Hiljaiset has no workspace header rows (no repository name as a group
heading): it is one flat list of conversations. "Let's look at it with all
of them there first."

Defaults where Jari did not say (record under "Decisions for later
review"):
- "All" means every non-archived conversation the snapshot lists that is
  not in the two sections above, including the person's own finished
  worktree conversations (round 2 found the worktree exclusion only hid
  them); Taskfleet workers stay out as they never reach the list.
- The count setting added by `rail-recent-five` goes away with the
  section (contract field, daemon merge, settings row and search entry).
- Rows show the workspace icon when icons are on; without icons each row
  carries its workspace's name quietly in the row, not as a heading.
- The narrow dot rail beside the editor is unchanged.
- Not gated: it replaces the unprototyped Viimeisimmät on main.

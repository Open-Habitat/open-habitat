---
created: 2026-11-01
updated: 2026-11-01
type: improvement
reporter: jari
status: open
priority: normal
lane: rail-quiet-all-flat
lane_seq: 6
related: ['@proto-rail-recent-r2', '@rail-recent-five']
preparation: ready
blocked_by: ['@proto-rail-quiet-flat', '@proto-rail-quiet-flat-r2', '@proto-rail-quiet-flat-r3', '@proto-rail-quiet-flat-r4', '@proto-rail-quiet-flat-r5']
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

## Accepted design (Jari 1.11., prototype rounds 1–5)

This supersedes the defaults above where they differ. The specification is
`issues/proto-rail-quiet-flat-r4/` riff **1 · Ruudut** and
`issues/proto-rail-quiet-flat-r5/` riff **2 · Rengas**:

- Sections Sinun vuorosi · Käynnissä · Hiljaiset; Viimeisimmät and its count
  setting go away. Hiljaiset lists every other non-archived conversation,
  workspace icons on as the target default.
- Hiljaiset has the icon-grid menu (round 4 riff 1): sort order and the
  workspace narrowing in one popover. With one workspace chosen, *by
  workspace* is not offered as an order. The chosen order is kept when the
  person returns to all workspaces. No explanatory foot text in the menu.
- Sort and workspace choice are per-person settings that follow the person
  to every device (account preferences, replacing `recent_count`); the fold
  is per device.
- Folded Hiljaiset still shows the open conversation's row and the
  workspace icon pills.
- The open conversation's row is emphasised with a **ring** (round 5 riff
  2). No coloured edge stripe anywhere (`design-system/design.md`).
- Conductor's default for round 5's open question: the folded pill of the
  open conversation's workspace is not marked separately; the ringed row
  above it is enough (record under Decisions for later review).

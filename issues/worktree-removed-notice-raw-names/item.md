---
created: 2026-11-09
updated: 2026-11-09
type: bug
reporter: jari
status: open
priority: normal
lane: unlaned
preparation: ready
---

# Worktree removal notice speaks in raw directory and branch names

## Description

Jari 9.11.2026, test server pilot.23, the new worktree list (`worktree-list-attention`,
direction Huomio): pressing *Poista* on a leftover row showed
*wt-wn4g5vgp8d-testi-headless-p-ttyy-merge-m-tt poistettu. Haara
wt/wn4g5vgp8d-testi-headless-p-ttyy-merge-m-tt säilyy.* — the raw directory
and branch names the Huomio direction set out to replace (`web/src/text/worktrees.tsx`
`branchStays` and the removed message). The notice should name the row the
way the list does (its task title, or *Jäänne* with a short readable name)
and say in plain words that its saved work is kept and how to get it back
if needed, without the internal branch name in the sentence (the full name
may stay available, e.g. in a detail or copy action). Check the
confirmation dialog and every other worktree message for the same.
Fixing agreed behaviour; no prototype.

## Acceptance Criteria

- [ ] Removal notice and confirmation name the row as the list does, fi and en; no raw `wt-…` names in the sentence.
- [ ] Touched specs green.

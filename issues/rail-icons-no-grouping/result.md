# Result

With workspace icons on, the rail's quiet conversations (done and untouched
for over an hour, not the open one, not failed) leave their workspace groups
and stand under *Hiljaiset · yli tunnin* as ordinary rows, each led by its
workspace icon. Neither the per-workspace dormant fold
(`rail-fold-dormant-*`) nor the "N hiljaista" fold inside a live group
(`rail-fold-quiet-*`) appears. Without icons the rail is unchanged (the
icons-off screenshots before and after are byte-identical).

Evidence (`evidence/`, device scale factor 2, light and dark, synthetic
browser host): `before-icons-on-*` shows Jari's case (`› GP git-project 1`
and `› 1 hiljainen`), `after-icons-on-*` the rows under the rule,
`before-icons-off-*` the folds, which the after run rendered byte-identically (so no separate after copy is kept). Captured with
`OH_RAIL_ICONS_CAPTURE=before|after` on `web/tests/rail-icons-quiet.spec.ts`.

Tests: `Navigation.test.tsx` (icons-on quiet rows, order, no folds),
browser spec `rail-icons-quiet.spec.ts` (both modes; 5/5 consecutive passes),
`rail-groups.spec.ts` and `lab-workspace-icons.spec.ts` still pass. Review:
focused self-review (web only, no daemon, contract or authority change).

## Decisions for later review

- **The quiet section does not fold as one.** Alternatives: one
  "N hiljaista" toggle under the rule, or a fold on the rule itself. Jari
  asked for no grouping because a fold hides the conversation behind a
  click; a single fold would bring that back. If the quiet list grows long
  in practice, a single fold is the easy follow-up.
- **Quiet rows are ordered most recently changed first**, across
  workspaces. Alternatives: by workspace name (keeps a workspace's rows
  adjacent, i.e. grouping by another name) or the host's order. Recency
  matches the row's own age label, so the list reads top-down from 1 t
  to days.
- **Live groups keep their spacing** and only lose their quiet rows; the
  open and failed rows stay in their group as before.

---
created: 2026-10-31
updated: 2026-10-31
type: bug
reporter: conductor
status: open
priority: high
lane: main-suite-red-r43
lane_seq: 1
preparation: ready
---

# Main browser suite red after the 31.10. evening landings

The conductor's clean gate on integrated main `d2646e25` (31.10. evening,
after `single-workspace-normal-rail`, `next-waiting-on-send`,
`clone-empty-repo` and `rail-recent-five` landed) failed seven browser
specs; Go, contracts, web unit tests and packaging passed. Load average was
about 7.5 (three workers running), so some may be load flakes, but most touch
this round's changes.

Ordinary suite:
- `browser-conversation.spec.ts:1338` a stale working view cannot strand an unsent queued draft (`send-receipt` not visible, line 1387)
- `clone-page.spec.ts:492` @lab a Gitea repository is cloned from the common list (`toBeDisabled` got enabled, line 517)
- `spinoffs.spec.ts:387` sidebar marks a working spinoff without a live wait after a daemon restart, and clears when it settles (row count 1, expected 0, line 427)
- `thread-fill.spec.ts:13` a short conversation sits on the composer and a tall thread scrolls to its first line (`older-history` not in viewport, line 144)

Lab suite:
- `lab-worker-row-sentence.spec.ts:16` a worktree conversation in the rail says its work only while the feature is on
- `lab-workspace-icons.spec.ts:51` the rail shows each workspace's icon from its repository only while the feature is on
- `lab-worktree-agent.spec.ts:23` create, converse, ask to merge and see it merged

Gate log: `~/.local/state/oh-conductor/gate-r43/stdout.json` on Birch.

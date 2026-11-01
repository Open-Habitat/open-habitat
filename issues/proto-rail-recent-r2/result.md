# Result: Viimeisimmät as implemented, and which conversations it lists

Prototype: `prototypes/raide.html`, one hand-written offline page built from
`prototypes/page.src.html` by `python3 prototypes/build.py` (tokens and fonts
inlined). The page machinery, graph drawing and event set are round 1's
(`issues/proto-rail-recent/prototypes/`). The picker offers Nykyinen ·
1 · Kaikki keskustelut · 2 · Kesken oleva työ. Every view has light and dark
themes, desktop and phone, the wide or narrow (editor) rail, and workspace
icons on or off. Jari's guide in Finnish is `prototypes/NOTES.md`.
Screenshots (device scale factor 2, AVIF) are in `prototypes/kuvat/`.

## Baseline: main now

Read from `web/src/app/railNow.ts`, `web/src/components/Navigation.tsx`
(`NowSections`, `RunningGroups`, `NowDot`), `web/src/components/RecentSettings.tsx`,
`web/src/text/recentSettings.ts` and `internal/daemon/snapshot_linux.go`.

- Viimeisimmät lists finished conversations (not your turn, not running,
  not failed or cut), not archived, **with no `worktree_id`**, newest
  `changed_at` first, cut to `recent_count` (default 5, 1–20).
- Terminal-run conversations are listed.
- The open conversation is appended in italic when it fell outside the cut,
  **but only if it was eligible**. The header count includes it.
- Without icons, rows group by workspace in newest-first order. With icons,
  the list is flat.
- The count is set only in Settings › Ulkoasu › *Viimeisimmät keskustelut*
  (stepper), stored in account preferences, so it follows the person. The
  rail shows only the header number.
- The narrow rail beside the editor (`NowDot` strip) shows Sinun vuorosi and
  Käynnissä only.
- No experimental gate.

## The axis, and why

Four choices were made without a prototype: the membership rule, the count
setting, the italic open row, and the narrow rail. The membership rule
matters most, because its premise is wrong on main. The worktree exclusion was meant to
keep **Taskfleet workers** from taking places (round 1: "workers are
excluded"). However, the snapshot already drops every Taskfleet-owned
worktree place (`snapshot_linux.go`: `taskfleetOwned` → `continue`). Since a
session is attributed to an agent only through a known place, a worker's
conversation never reaches `agents[]`. The worker shows on its parent's row
(`spinoffs_working`/`spinoffs_idle`). The `worktree_id` exclusion therefore
removes exactly one kind of conversation: the worktree agents **the person
started from the browser** (ADR 0025, *Uusi worktree-agentti*), plus any
hand-made `git worktree` places. The axis is **which finished conversations
Viimeisimmät lists**. The other three choices are shown as main has them in
every view, and their open questions are below.

## Directions

| | Direction | Rule | Decides | Cost |
|---|---|---|---|---|
| — | **Nykyinen** | finished, no worktree place | worktree work lives on the workspace page | (1) your own worktree agent leaves the rail the moment it finishes; (2) opened from the workspace page it has **no row at all**, not even italic |
| 1 | **Kaikki keskustelut** | every finished conversation the host lists | the rail treats a worktree agent as one of your conversations; the row's existing worktree/merge glyph tells them apart | (A) an evening of worktree agents fills the section; (B) merged work stays until newer pass it or you archive it |
| 2 | **Kesken oleva työ** | finished, and a worktree agent only while its work is not merged (`worktreeMerged`) | an unmerged branch is still your business; merged work frees its place | (A) a stale unmerged branch holds a place; (B) the row leaves when Git says merged, which happens outside the browser, often in the agent's last turn, so it may never appear as done |

In both directions the open conversation always shows (italic when outside
the cut) unless it is archived, so Nykyinen's gap 2 closes. This also fixes
a general case: any conversation opened from the workspace page now has a
selected row.

## Host facts each needs

| Fact | Where | Exists? | Used by |
|---|---|---|---|
| Native conversations in visible places, terminal-run included; Taskfleet places omitted | snapshot `agents[]` (`snapshot_linux.go`) | **yes** | all |
| Last change | `changed_at` (session file mtime) | **yes** | all |
| Archive | `archive` | **yes** | all |
| Conversation is in a worktree place | `agents[].worktree_id` | **yes** | Nykyinen (exclude), 1 (glyph), 2 |
| Place's work merged | `workspaces[].worktrees[].git_summary.base.merged` + `branch_moved` + `dirty_count` (`worktreeMerged`) | **yes**, refreshed by the snapshot's Git watch | 1 (glyph), 2 (rule) |
| Worker on the parent | `spinoffs_working`, `spinoffs_idle` | **yes** | Käynnissä, all |
| Count | account preferences `recent_count` | **yes** | all |

No direction needs a new host fact or store. Direction 1 is the smallest
code change: delete the `if (recent && a.worktree_id) continue;` line and
let the selected exception take any finished, non-archived conversation.
Direction 2 replaces that line with `worktreeMerged(place)`.

## Recommendation

**1 · Kaikki keskustelut.** The exclusion guards against something main
no longer produces (Taskfleet workers in the list), and what it removes
instead is the person's own recent work. That is the work round 1 set out to
keep within reach. Direction 1 makes the rule one sentence ("your
last N finished conversations"). It needs no Git state in the decision and
reuses the worktree/merge glyph the row already draws. It also closes the
missing-selected-row gap. Its cost (worktree agents fill the section on a
busy evening) is what the count setting is for. Direction 2 is appealing,
but its row leaves on a Git event the person did not take in the browser.
When the agent merges in its last turn, the row never appears as done in
the rail. That is the "it vanished while I was looking" complaint that
started round 1.

Implementing it on main means: remove the worktree exclusion in `railNow`,
append the selected conversation whenever it is finished and not archived
(not only when eligible), and replace the comment that cites round 1's
worker premise.

## Questions for Jari

- Worktree agents you started in the browser: in Viimeisimmät like any
  other conversation (1), until merged (2), or never (now)?
- The count is only in Settings › Ulkoasu, with the header number as its
  only trace in the rail. Is that enough, or should the section offer
  *Näytä lisää* / its own count control? The prototype keeps main's choice.
- The italic open row raises the header count from 5 to 6. Keep it, or count
  only the cut rows?
- The narrow rail beside the editor: keep it without Viimeisimmät (main), or
  add dots under a rule?

## Main as of this round

The baseline is main at `c9c88327` (the rail code is unchanged since
`d2646e25`). No production code was changed.

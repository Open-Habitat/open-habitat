# Result: prototype round 1

Prototype: `prototypes/ended-worker/index.html` (one offline file, three
directions behind the picker). [NOTES.md](prototypes/ended-worker/NOTES.md)
is Jari's guide in Finnish, and `prototypes/ended-worker/evidence/` holds the
screenshots (device scale factor 2). The page is hand-written (`round.js`,
`surface.css`, inlined with tokens and fonts by `build.mjs`). It contains no
production components.

## Why the row cannot be removed today

- `serveSpinoffs` (`internal/daemon/spinoffs_linux.go`) lists every Taskfleet
  run that the conversation's Pi session created, up to 20, on every poll.
  Taskfleet keeps run records on disk for good and has no archive or forget
  command. `run list` filters only by status, kind and repository. The
  browser keeps no hidden-row state. *Poista päättyneet* in the strip
  removes only processes, and its tooltip says so.
- `BackgroundStrip.tsx` sets the red dot to
  `(unmerged || failed) && preserved`, where `preserved` is
  `branch_present || worktree_present` from `run show`. Jari decided on
  16.10.2026 that the dot stays until the branch is gone, so looking at the
  row does not clear it.
- Jari's case is Taskfleet `done` with `landed: false` and work preserved.
  Dry-runs on Birch confirm that no Taskfleet command settles such a run:
  `run discard` answers `run_not_discardable … discard requires a failed
  or cancelled run`, and `run salvage` refuses `done` and `cancelled` runs.
  Only Git can take the work forward or delete it (merge the branch, or
  `git worktree remove` and `git branch -D`). After that, `preserved`
  becomes false, the dot goes away and the row reads *ei mergetty* forever.

## Axis and directions

The axis is **what takes an ended row off the list**. Content is the same in
all three: conversation *Iltakierros* (repository `kasvimaa`) with one live
worker and five ended ones, one per state the issue names: landed; not merged
with work preserved (Jari's case); failed without work; cancelled with work;
interrupted but resumable. A second scene is Jari's case alone: pill 0 with
the red dot.

The actions are the same in all three. Each one says which of three kinds it
is:

- **Katso · ei muuta mitään** (view): Raportti, Muutokset (diff stat
  against the source branch), Worktree editorissa.
- **Pyydä pääagentilta** (request): the browser writes a draft into the
  parent conversation's composer, and the person sends it. Each request
  names what the agent will run. Merge: `git rebase + merge` for
  done/cancelled runs, `taskfleet run salvage` for an interrupted one.
  New worker from the same branch: `taskfleet run create`. Resume:
  `taskfleet run reattach`. Discard: `taskfleet run discard --force` for
  cancelled, `run cancel` then `discard` for interrupted, and
  `git worktree remove + git branch -D` for done.
- **Vain tämä näkymä** (view-local): Kuittaa, in direction 1 only.

The directions:

1. **Kuittaus**: the person removes the row. Every ended row has ✓ Kuittaa.
   Acknowledged rows fold into *Kuitatut* and can be restored from there.
   Acknowledging a row with preserved work first asks for confirmation
   ("työ jää haaraan…"). A resolved row stays, in its new state, until it
   is acknowledged. Acknowledging clears the dot.
2. **Ratkaisu**: the work removes the row. There is no hide action. A row
   with a branch stays, with the dot, until its work is merged or discarded.
   A row without work leaves 24 h after it ended. A line under the list
   states this rule.
3. **Siivous**: a rule removes the row at once. The panel holds only live
   workers and an unfolded *Odottaa päätöstäsi* group. Every ended row
   without work sits behind *Workerihistoria · n ›*, and a resolved row
   moves there as soon as the agent has done the request.

In every direction, an ended worker's own view opens on **Raportti**
(outcome, branch, worktree, Taskfleet state), with **Muutokset** and
**Keskustelu** tabs. In place of today's "Workerille ei kirjoiteta
suoraan" notice, its foot asks "Mitä tälle työlle tehdään?" and offers the
same actions as the row.

## Host facts per direction

| Fact | Exists? | Needed by |
| --- | --- | --- |
| Run list for the conversation, `preserved`, branch, worktree, summary, `ended_at` | Yes, in the spinoffs contract | all |
| `cancelled` as its own state | No. The daemon folds `done` and `cancelled` into `unmerged`. Taskfleet has the status, and it decides whether `run discard` applies | all |
| `interrupted` (resumable) | Partly. Taskfleet `stalled`, or `running` with the supervisor `dead`/`unknown`, reaches the contract as `unknown` and is listed among the live runs as *tila ei tiedossa*. "Resumable" means the worktree is present (`preserved_work`), which `run show` has | all |
| Diff stat of the branch against its source | No. The daemon would read `git diff --stat <source>...<branch>` as the user in the worktree (read-only) | all (Muutokset) |
| Open a worktree in the editor | No. Worktrees under `<repo>__worktrees/` are hidden from workspaces (`filterTaskfleetWorkspaces`), and the editor opens only workspaces | all (can be left out) |
| Hand merge detected | No. Taskfleet's `landed` comes from `run merge`/`salvage` (`landed_method: report-marker`). A Git merge leaves the run `done`/`landed: false`. Without an ancestry check (`git merge-base --is-ancestor`) the resolved row reads *ei mergetty* rather than *mergetty käsin* | all (only the word) |
| Prefill the parent composer with a request | Browser only, no host fact. The composer exists | all |
| Acknowledged-row set | No. A new per-user record, either in the browser (`localStorage`, per device) or a daemon file in the user's state directory | 1 only |
| Worker history beyond 20 runs | No. The daemon stops at 20 rows per conversation and marks the reply partial | 3 (and 1's *Kuitatut* over time) |
| Taskfleet eligibility | Yes, checked with dry-runs. `discard`: failed/cancelled only. `salvage`: attention-required or failed with preserved work; refuses done/cancelled. `reattach`: dead supervisor | all (which request each row offers) |

No direction moves authority. The browser only drafts. The person sends the
request, and the main agent, running as the person, runs Taskfleet or Git
as it already does. The daemon gains only read-only facts (state split,
diff stat, optionally ancestry), all read as the user.

## Recommendation

**Ratkaisu (2).** Jari's complaint was that the row never goes away. In
Ratkaisu the row goes away for the same reason the work does, so the list
and the red dot tell the truth: a dot means there is still a branch to
decide on, which is Jari's 16.10. rule. It needs no new store (the 24 h rule
uses the `ended_at` that already exists). It also teaches the one thing the
pilot.456 case lacked: what the person can do with the branch, and who runs
it.

Kuittaus is the quickest way to "get rid of it". But it lets the dot lie
about work still on disk, and the acknowledgement set is a second record of
the runs that Taskfleet knows nothing about. Siivous gives the shortest
panel and keeps decisions unfolded, but it hides a just-landed worker at
once and needs a history view and paging past 20. Its *Odottaa
päätöstäsi* group could be added to Ratkaisu later if a fold proves too
easy to ignore.

The implementation needs `cancelled` and `interrupted` in the contract,
the diff stat, the composer prefill, and the 24 h filter in the panel. The
editor action and the hand-merge word can follow separately.

## Decisions for later review

- **A request is a draft in the parent composer, not a button that acts.**
  The alternative was a direct "Hylkää" that has the daemon run `taskfleet
  run discard` as the user. That is within the user's own authority, but the
  issue excludes the browser discarding a run itself, and the draft keeps
  the person as the one who sends. The agent can also resolve Git conflicts
  that a button could not.
- **Jari's case (done, not landed) is resolved with Git.** Taskfleet
  refuses both `discard` and `salvage` for it (checked by dry-run). The
  request text says so ("Taskfleet ei mergeä päättyneen ajon haaraa, joten
  tee se Gitillä"). The alternative, a Taskfleet change that lets `discard`
  accept a done run with preserved work, is outside this repository.
- **Interrupted runs are shown with the ended ones that need a decision**,
  not among the live runs as *tila ei tiedossa*. The run has no worker
  doing anything, and its worktree waits on the person, as the other
  preserved runs do.
- **24 h after `ended_at`** is Ratkaisu's grace for rows without work.
  Alternatives were "until the next turn" (needs turn tracking) and "until
  seen" (needs a seen-store). 24 h uses only an existing fact.
- **Kuittaus asks before hiding preserved work**, and restoring is
  possible. The alternative, no confirmation, would make one click enough
  to forget a branch.
- **A resolved row's word assumes ancestry detection** (*mergetty käsin*).
  Without it the word would be *ei mergetty*, which is true but misleading.
- **Worktree editorissa is shown, though it does not exist.** It is the
  issue's own example of inspecting work. It can be left out of the first
  implementation.

## Questions for Jari

The questions are in NOTES.md: acknowledgement (1) or resolution (2/3);
whether 2/3 still need a *Päätän myöhemmin*; and whether a draft request
is enough or discarding should be a direct button.

## Verification

```sh
node issues/proto-ended-worker-lifecycle/prototypes/ended-worker/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright node issues/proto-ended-worker-lifecycle/prototypes/ended-worker/check.mjs
```

`check.mjs` passed 12 cases: 3 directions at 1440 and 390 px, each in light
and dark, at device scale factor 2. For each case it checked:

- Jari's case: pill 0 with the red dot, and the action kinds, with Git as
  the merge route for a done run;
- the five ended states, and that Siivous keeps landed runs out of the
  panel and puts them in its history;
- reattach and salvage offered for the interrupted run, and discard for
  the cancelled one;
- in Kuittaus, acknowledgement with confirmation, *Kuitatut* and restore,
  and that the dot stays while other work remains;
- that a request becomes a draft with focus and does nothing until sent;
- where the resolved row goes in each direction;
- that the day-later rule affects only Ratkaisu;
- the worker view's report, changes and decision foot;
- that Escape returns focus to the pill;
- no horizontal overflow, the shared picker check, no console errors and
  no network requests.

Self-review of the screenshots fixed a phone overflow in the lab header,
hidden state marks in Siivous's group, and run ids in the commands. No
production code changed.

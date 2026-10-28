# Result: prototype round 2

Prototype: `prototypes/ended-worker-r2/index.html` (one offline file, three
variants behind the picker). [NOTES.md](prototypes/ended-worker-r2/NOTES.md)
is Jari's guide in Finnish, and `prototypes/ended-worker-r2/evidence/` holds
the screenshots (device scale factor 2). The page is hand-written
(`round.js`, `surface.css`, inlined with tokens and fonts by `build.mjs`). It
contains no production components. Round 1 stays in
`prototypes/ended-worker/` for comparison.

## Jari's decision and what it leaves open

Jari decided on 28.10.2026 that there is no acknowledgement. The list
reflects real state: when the agent cleans up a worker's worktree and branch,
the row disappears. An unfinished row carries a red ball. The typical
reaction to one is to tell the agent something, and the browser shows that as
a request to the agent, not as its own action. A row may also carry a button
for removing the worktree.

The decision leaves one thing open: **what the browser removes itself.**
Round 2 compares three answers on that axis. Everything else is the same in
all three:

- **The list rule.** An ended row is listed while its branch or worktree
  exists (Taskfleet `run show` → `preserved_work[].branch_present ||
  worktree_present`). A landed run and a run that failed without work leave
  nothing on disk, so their rows disappear as soon as they end. The lab's
  *Kastelu laskeutuu* and *Rajapinta epäonnistuu* buttons show this. The
  agent's message in the conversation reports the outcome. A line under the
  list states the rule.
- **The red ball** marks an *unfinished* row: work on disk that has not
  reached the source branch. That covers not merged, cancelled with work and
  interrupted. A row that is merged but still has its worktree is listed
  with a merge mark and no ball.
- **The pill** shows one mark per live worker and one red ball per
  unfinished row, so it no longer reads "0" with a corner dot. Jari's case
  shows the branch icon and one red ball. Its sentence reads "Workerit: ei
  työskentele, 1 keskeneräinen, työ tallessa". With nothing to list, the
  pill is gone.
- **Kerro agentille** on every ended row opens the requests. Each request
  drafts a message into the parent composer, and nothing happens until the
  person sends it. Each request names what the agent will run. *Kirjoita oma
  viesti* drafts only a reference to the worker. *Raportti*, *Muutokset* and
  *Worktree editorissa* are views. When the agent has removed the branch and
  the worktree, the row disappears and a status line says why.
- **The worker view** opens on *Raportti* and shows the same actions at its
  foot.

## The three variants

| # | Variant | What the browser removes itself | When it is the right choice | Its cost |
| --- | --- | --- | --- | --- |
| 1 | Pyyntö | Nothing. Every change to the work, including cleaning up a merged worktree, is a request to the agent (`git worktree remove + git branch -d`). | One route and one authority for every change. The row has a single button. | Even a cleanup that cannot lose anything costs an agent turn. |
| 2 | Yhdistetty | Only a worktree whose branch is already merged into its base. The existing `worktree_remove` removes the checkout and the branch, nothing is lost, and the row disappears. Other rows have no remove button, and their menu says why. | The one button the browser offers always does what it promises: the row goes away, and no work can be lost. | The button is rare. It appears only when the agent merged by hand and left the worktree. It needs the row joined to the worktree listing. |
| 3 | Worktree | Any worktree the existing flow accepts. Merged: checkout and branch. Unmerged: checkout only, so the branch stays, and the row and its ball stay ("haara tallessa, worktree poistettu"). Dirty: commit to the branch and remove, or force with the typed name. Interrupted: blocked, because Taskfleet still calls the run `running`. | Disk or editor clutter can be cleared at once, without the agent. | A button that looks like "get rid of this" leaves the row and the ball in place for every unfinished worker. A forced removal deletes uncommitted work of a cancelled run, which comes close to the browser discarding retained work. |

The scene is the conversation *Iltakierros* (repository `kasvimaa`). It has
two live workers: one the agent waits on and one in another repository that
nobody waits on. It also has four ended rows:

| Row | Word | Taskfleet | Worktree as `worktree_list` reads it |
| --- | --- | --- | --- |
| test-guide: worker-näkymän koe | ei mergetty · työ tallessa | `done`, `landed: false` (Jari's pilot.456 case) | `unmerged`, 3 commits ahead |
| Lomakkeen saavutettavuus | peruttu · työ tallessa | `cancelled` | `dirty`, 2 changed files |
| Sääaseman CSV-vienti | keskeytyi · jatkettavissa | `running`, supervisor dead | `unmerged`, blocked by `taskfleet_run` |
| Kuvien pakkaus | mergetty · worktree jäljellä | `done`, `landed: false` (the agent merged with Git) | `merged` |

A second scene is Jari's case alone.

## What each row action reads or invokes, and who holds that authority

| Action | Reads | Invokes | Authority |
| --- | --- | --- | --- |
| Row present or gone | `taskfleet run show`: `status`, `landed`, `preserved_work[].branch_present / worktree_present`, supervisor | nothing | Daemon, read-only, as the user. Taskfleet owns the run's state, and the browser stores nothing. |
| Red ball, pill balls | the same, and the worktree's `merged` state | nothing | Daemon, read-only |
| Raportti | `run show` (summary, branch, worktree, status) | nothing | Daemon, read-only |
| Muutokset | `git diff --stat <source>...<branch>` in the repository | nothing | Daemon, read-only, as the user |
| Worktree editorissa | the worktree path | open the editor | Browser and editor (not available today) |
| Pyydä mergeämään (done, cancelled) | — | the agent runs `git rebase` + `merge`, then removes the branch and the worktree. Taskfleet's `salvage` refuses done/cancelled runs. | Main agent as the user. The browser only drafts. |
| Pyydä viemään nykyinen tila perille (interrupted) | — | `taskfleet run salvage <id>` | Main agent, via Taskfleet |
| Pyydä jatkamaan samaa ajoa (interrupted) | — | `taskfleet run reattach <id>` | Main agent, via Taskfleet |
| Uusi worker samasta haarasta | — | `taskfleet run create` from the branch, then the old worktree is removed | Main agent, via Taskfleet |
| Pyydä hylkäämään | — | cancelled: `taskfleet run discard <id>`; interrupted: `run cancel`, then `discard`; done: `git branch -D` + `git worktree remove` (Taskfleet discards only failed or cancelled runs) | Main agent |
| Pyydä siivoamaan (merged, worktree left) | — | `git worktree remove` + `git branch -d` | Main agent |
| Kirjoita oma viesti | — | nothing until sent | Person, then the agent |
| Poista worktree (variants 2 and 3) | `worktree_list` for the run's workspace: state, ahead, changed, blockers, `observation_token` | `worktree_remove` with `disposal` remove, commit or force | Daemon as the user, under ADR 0025's rules. It is refused while a live Taskfleet run owns the worktree (`worktreeRunBlockers`). The run's status does not change. |

No variant moves authority between the gateway, the daemon and provision.
The browser never merges, discards or cancels a run. Variants 2 and 3 reuse a
daemon action that already exists and already defers to Taskfleet for live
runs.

## Host facts each variant needs

| Fact | Exists? | Where | Needed by |
| --- | --- | --- | --- |
| Run list for the conversation, with `preserved`, branch, worktree, summary and `ended_at` | Yes | `internal/daemon/spinoffs_linux.go`, `contracts/v1/spinoffs.schema.json` | all |
| An ended row filtered out when nothing is on disk | No, but the data exists. `preserved` is computed only for done/failed/cancelled (`spinoffs_linux.go`, the `detail.Status` check), and the panel lists every ended row (`web/src/components/BackgroundStrip.tsx`, `backgroundFacts`) | daemon or panel | all |
| `cancelled` and `interrupted` as their own states | No. `spinoffState` folds done and cancelled into `unmerged`, and a stalled run or a dead supervisor into `unknown`, which is listed as live | `spinoffs_linux.go` | all |
| `preserved` for an interrupted run | No. It is computed only for terminal runs. | `spinoffs_linux.go` | all |
| Branch and worktree presence separately | No. The contract has one `preserved` boolean. | `spinoffs.schema.json` | 3 (the word "haara tallessa, worktree poistettu"), and 2's merged-row case |
| A hand merge detected (merged but not `landed`) | In the worktree listing only. `readWorktreeGit` sets `merged` against the recorded source branch. The spinoffs row does not have it. | `internal/daemon/workspace_worktrees_linux.go` | all (the merged row's word and no ball). 2 also needs it for the button. |
| Diff stat of the branch | No | — | all (Muutokset) |
| Open a worktree in the editor | No. Taskfleet worktrees are hidden from workspaces (`filterTaskfleetWorkspaces`). | — | all (can be left out) |
| Prefill the parent composer | Browser only. The composer exists. | `web/src/app/BrowserConversation.tsx` | all |
| Pill marks per unfinished row | No. The pill shows live marks or a number, plus a corner dot. | `BackgroundStrip.tsx` | all |
| Worktree removal with blockers, a commit or force option, and branch deletion only when merged | Yes | `workspace_worktrees_linux.go` (`worktree_remove`, `worktreeRunBlockers`, `deleteMergedBranch`), `web/src/app/WorktreeCleanup.tsx`, `web/src/components/WorktreeList.tsx` (`WorktreeRemoveDialog`) | 2, 3 |
| A run row joined to its worktree listing entry | No. The browser can join a spinoff's `worktree` to `worktree_list`'s `path` for the run's workspace. The daemon already matches run paths to registry entries in `worktreeRunBlockers`. | browser or daemon | 2, 3 |

## Recommendation

**Yhdistetty (2).** It is the only variant in which every browser button
keeps Jari's rule: pressing it makes the row disappear because the worktree
and the branch are really gone, and it cannot lose work. Every unfinished row
goes to the agent, as Jari expects the typical reaction to be. It reuses the
existing removal flow unchanged, with its Taskfleet blocker, and adds no
authority.

Pyyntö (1) is the cheaper first step if joining a row to its worktree
listing proves costly. The workspace page's existing worktree cleanup
(*Siivoa kaikki yhdistetyt*) already offers the same removal elsewhere.

Worktree (3) puts a remove button on rows it cannot remove. For Jari's own
case, the click leaves the row and the ball where they were. Its forced
removal of a cancelled run's uncommitted changes is closer to discarding
than the issue allows the browser.

The implementation would split `unmerged` and `unknown` into done, cancelled
and interrupted, compute `preserved` for interrupted runs, filter ended rows
without work, put balls on the pill, prefill the composer, and (for 2) join
the row to the worktree listing for the merged case. The diff stat and the
editor action can follow separately.

## Decisions for later review

- **A row without work disappears as soon as it ends**, landed or failed.
  Alternatives: round 1's 24 h grace, or until the agent's next turn. Jari's
  words ("the row disappears when the agent cleans up") leave no grace, and
  the agent reports the outcome in the conversation. A grace would need a
  second rule for the person to learn.
- **The pill is hidden when nothing is listed.** The alternative was an idle
  pill with a check mark. An empty, always-present pill says nothing.
  Production already hides a pill whose kind has no rows (`present` in
  `backgroundFacts`).
- **One red ball per unfinished row on the pill instead of "0" with a corner
  dot**, capped at three plus "+n". Alternatives: keep the number and the
  dot, or show a count in red. Balls match the row's own ball and the
  Pisteet marks, and the pill no longer shows a "0" next to a warning.
- **A merged row with its worktree left has no red ball.** Its work is in
  main, and only cleanup remains. The alternative, a ball until cleaned,
  would put a warning on something that cannot lose work.
- **Interrupted counts as unfinished, not live.** No worker is doing
  anything, and Taskfleet's `running` with a dead supervisor is what blocks
  the browser's removal. The row says so in variant 3.
- **"Kerro agentille" is one button that opens the requests**, instead of a
  separate button per request on the row. The row stays two lines, and the
  menu can name the command behind each request.
- **Kirjoita oma viesti** drafts only a reference (title and run id). This
  is Jari's "or similar": the typical message may not be one of the
  prepared requests.
- **Discarding a done run is a request that names Git, not Taskfleet.**
  Taskfleet refuses `discard` and `salvage` for a done run (round 1's
  dry-runs). The alternative, a Taskfleet change, is outside this
  repository.
- **The prototype's dialog copies `WorktreeRemoveDialog`'s words and adds
  one line about the row**: whether it will disappear or stay. In variant 3,
  that line is what tells the person the click does not settle the worker.

## Questions for Jari

They are in NOTES.md:

1. Should the browser remove anything itself, and if so, only what is
   loss-free (2) or anything the existing flow accepts (3)?
2. Is it right that a landed or failed worker disappears from the panel at
   once, with only the conversation reporting it?
3. Do the red balls on the pill read better than "0" with a dot?

## Verification

```sh
node issues/proto-ended-worker-lifecycle/prototypes/ended-worker-r2/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright node issues/proto-ended-worker-lifecycle/prototypes/ended-worker-r2/check.mjs
```

`check.mjs` passed 12 cases: 3 variants at 1440 and 390 px, each in light and
dark, at device scale factor 2. For each case it checked:

- Jari's case: no "0" on the pill and one ball, and the requests name Git
  for a done run;
- each variant's remove button and its effect: none in 1; only the merged
  row in 2, which disappears; in 3, every accepted worktree, where an
  unmerged branch keeps the row and the ball, and the interrupted run is
  blocked;
- the request drafted, then sent, removes the row, and with nothing left
  the pill;
- landed and failed-without-work runs leave the list;
- the dirty worktree's commit and typed force;
- the worker view's report, changes and foot;
- Escape returns focus from the dialog and the panel;
- no horizontal overflow, the shared picker check, no console errors and no
  network requests.

Self-review of the screenshots shortened the lab controls on the phone and
fixed a row menu that stayed open after the panel closed. No production code
changed.

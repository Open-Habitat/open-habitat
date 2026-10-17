# Result: interactive worktree agents prototype

**Prototype:** https://glasspad.example.test/p/hpr267jzxxb2453tqbbssgadcm/

Round `design-system/prototypes/rounds/2026-10-17-worktree-agentti`. Build it from
`design-system/prototypes/` with `node build.mjs rounds/2026-10-17-worktree-agentti`
(output `dist/2026-10-17-worktree-agentti.html`). The host sketch is
[research-worktree-agents-host/report.md](../research-worktree-agents-host/report.md);
the views are drawn on its option A. The earlier round is
[proto-worktree-agents](../proto-worktree-agents/result.md).

## What changed from the earlier round

The earlier round asked what a worktree run *is* in the view: a conversation, a task or
a place. Under option A the answer is fixed. The worktree agent is an ordinary browser
conversation whose working directory is the worktree, so this round draws it as a
conversation with a branch mark. In the prototype, *Status-skripti* is the library's
full live conversation running in a worktree, with streaming, Stop, steering, the
model chip and the spinoff and process marks all unchanged. The earlier round's
*Yhdistää itse / Kysyy ensin* policy is gone. The person settles the work themselves
with Taskfleet's controls instead of asking the agent to merge.

Spinoffs are unchanged (ADR 0017). The worktree agent's own spinoff and test watcher
appear as the usual background marks above the field, read-only.

## Axis and directions

**Axis: where the worktree's marks and controls sit around the conversation.** All
three directions have the same content: workspace `aurinkokello` with six worktree
agents (ready to merge, working with uncommitted changes, merge failed on a conflict,
Pi stopped after a server restart, cancelled with work kept, merged) and its ordinary
conversations. The scripted controls work in every direction: merge, ask to resolve,
ask to commit, resume by sending, cancel, discard, and creating a new agent.

1. **Yläpalkissa (in the top bar).** A branch pill sits next to the workspace name:
   `status-skripti ↑3`, plus the number of uncommitted changes and a dot when the
   branch is ready to merge. The pill opens a layer (a bottom sheet on the phone)
   with the branch, base, changes, commits, worktree path and the controls. This is
   the quietest option and the same pattern as the workspace page's Git pill. The
   cost is that every control is one click away, and readiness shows only as a dot.
2. **Kentän yllä (above the field).** A bar sits directly above the composer and
   the background marks: `wt/status-skripti → main ↑3`, then *Yhdistä
   main-haaraan* as a visible primary button, with *Lopeta, säilytä työ* and
   *Hylkää…* as icons. The branch part opens a panel upward with changes and commits.
   A settled state turns the bar into its outcome ("Yhdistetty main-haaraan c81d2fa ·
   3 committia") and the field goes away. The main action is next to where the
   person already works, and the bar fits a phone with only icons. The cost is one
   permanent line of height in every worktree conversation.
3. **Sivupaneelissa (in a side panel).** A 300 px panel on the right shows the state,
   branch, agent (Pi), changes, commits and worktree. It ends with a *Lopetus*
   (ending) section where every control has one line explaining what it does. On the
   phone the panel is a sheet opened from a top-bar button. It explains the lifecycle
   best and has room for more facts later. The cost is that it narrows the
   conversation on desktop (to about 470 px in the 1080 px frame) and is hidden on
   the phone.

## Shared across directions

- **Creation.** The workspace page's icon row gets *Uusi worktree-agentti* (a branch
  with a plus) next to *+*. It opens an empty conversation that explains: "The first
  message creates its own worktree and branch from `main` @ `a41c9e2` and starts
  Pi there; the workspace's 2 uncommitted changes are not included." There is no
  dialog. Sending shows the message as the dashed *Odottaa Pi:tä* bubble (as chosen in
  `2026-10-16-jonolahetys`). The creation steps (worktree and branch, Pi starting)
  show in the direction's place for controls. The title comes from the conversation.
  The rail's *+* still makes an ordinary conversation.
- **Rail.** A worktree agent is a conversation row with a small branch glyph before the
  title. It is in attention order with the other conversations. A merged or
  discarded agent folds into *Valmiit*. A failed merge sorts to the top with a red
  warning mark, and a cancelled agent with kept work stays open with its own mark. The
  production spinoff mark (on the right) is unaffected.
- **Workspace page.** This is the implemented Ikonirivi page. A worktree agent is a
  recap card in *Avoimet*, with a branch line (`wt/… → main ↑2 ↓1 · 2 muutosta`) and a
  highlighted line for "ready to merge", "working" or "conflict". The summary counts
  worktree agents. *Poista työtila* explains that it is blocked by open worktree agents
  (ADR 0019).
- **States.** The states are: creating, working, waiting for you, stopped (the next
  message resumes Pi in the same worktree), merging, merged, not merged (work kept),
  cancelled (work kept) and discarded. Settled states show a read-only notice instead
  of the field, and the conversation stays readable.
- **Controls** (report, "Settlement"):
  - *Yhdistä main-haaraan* (`run merge`) confirms first. It is disabled with a reason
    while the worktree has uncommitted changes, and then *Pyydä commitoimaan* sends the
    agent a request. If the agent is working, the confirmation says it is stopped
    first.
  - *Lopeta, säilytä työ* (`run cancel`) takes an optional note.
  - *Hylkää…* (`run discard --force --reason`) is enabled only after a cancel or a
    failed merge. It requires a reason and says what is lost.
  - *Pyydä agenttia ratkaisemaan* appears after a conflict. Stop in the field only
    stops Pi and does not settle the run.
  - Archiving is disabled while the worktree is open.
- **Timeline.** Lifecycle events are quiet rows in the conversation (started, stopped,
  resumed, merge failed, merged, cancelled, discarded), in time order.
- **Details** (`ⓘ`) adds the Taskfleet run ID and worktree path.

Check: `check.mjs` passes for all three directions in light, dark and phone, with the
controls opened and *Lopeta* clicked, and the console is clean. A scripted flow
(Playwright) ran desktop light, desktop dark and phone through every control in every
direction: merge, conflict resolution and merge, resume of a stopped agent, cancel,
discard with a reason, the workspace page, and creation through to a ready branch. The
console stayed clean throughout.

## Host facts the views assume (option A)

Everything is read again as the user. No new store.

- **Taskfleet `run show` / `run list`, filtered to caller-owned runs by exact
  `source_repo`:** run ID, title, branch, checkout path, source branch and base OID,
  `status` (open, done, failed, cancelled), the settlement intent (merging), the
  `merge.rebased` OID, the discard receipt, `preserved_work` and the failure summary
  (for example the conflicting file).
- **Git, read by the daemon:** commits ahead and behind against the source branch (and
  their subjects for the commit list), and uncommitted files in the worktree (the
  existing Git pill reader opened at the verified checkout). The diffstat after a
  merge comes from Git.
- **Daemon:** Pi activity, as for any conversation, and `caller_agent.state`
  (`exited` → *Pysähtynyt*, resumable).
- **The run → Pi session binding**, so that a merged or discarded conversation stays
  readable after cleanup.
- **Readable branch names** (`wt/status-skripti`) assume the report's Taskfleet ask 2.
  Today they are `wt/<run id>`.
- **Stopped after a server restart → resumable** assumes ask 1. Without it the state
  would be *control uncertain* and would need manual repair. The prototype does not
  draw that state.
- **Not verified:** whether a run whose merge failed on a conflict can relaunch Pi
  (*Pyydä agenttia ratkaisemaan*) under its sticky settlement intent, or whether the
  intent must be retired first. This needs to be confirmed in Taskfleet before
  implementation.

## Where option B or C would change the UI

- **B (the daemon runs `git worktree add`, no Taskfleet).** The conversation and the
  marks would stay. The worktree would appear as its own linked-worktree workspace in
  `~/src`, the rail item would become a place under the workspace (close to the
  earlier round's *Paikkana*), and the workspace page would list it as a workspace, not
  a card. Merge, cancel and discard would either disappear (the person asks the agent,
  and the browser shows only Git facts) or become daemon operations. There would be no
  *cancelled* state, *failed* would mean only what the agent reports, and discarding
  would conflict with ADR 0019's refusal to delete a linked worktree.
- **C (Taskfleet's own interactive worker in tmux).** The conversation would no longer
  be a browser conversation. Stop, steer/follow-up, the model chip, streaming and the
  working/idle state would go away. The field would become a single "send to the
  worker" box (`run message`) with an acceptance receipt, and the view would be the
  read-only spinoff transcript. All three directions' controls could stay, plus an
  *Avaa terminaalissa* command (`tmux attach`). The *Pysähtynyt → send resumes* state
  would not exist in the same form.

## Questions for Jari

1. **Which direction?** I recommend **Kentän yllä**. You asked for the marks and
   controls "immediately", and the bar keeps them visible right where you type, merge
   is one click, the outcome replaces the bar, and it works the same on the phone.
   Yläpalkissa hides the controls one step away. Sivupaneelissa explains the most but
   costs a third of the conversation's width on desktop and is hidden on the phone.
2. **Settlement controls in the browser:** merge, cancel with work kept, and discard
   after a cancel or failure, as prototyped? (This is the report's question 2.) I
   recommend all three, since without discard a kept branch has no end in the browser.
3. **Creation from a new empty conversation rather than a dialog,** with the source
   branch fixed to the workspace's current branch? I recommend yes. Choosing another
   source branch can come later if needed.
4. **The term:** "worktree-agentti", as in your request, instead of the earlier round's
   "haaratyö"? I recommend "worktree-agentti", since it matches the word you used and
   the terminal's `git worktree`.
5. **Is it acceptable that a browser-created worktree agent cannot be attached from
   tmux** (option A, the report's question 3)? The worktree itself is visible from SSH
   (`taskfleet run list`, `git worktree list`, `pi --resume` lists the session).

## Library proposals

None required. When a direction is chosen, its pieces (the branch mark, the controls,
the state and event rows, and the chosen bar, pill or panel) should move into `lib/`
as their own `worktree.*` pair next to `strip.*`, not into `app.js`. The round adds
`STATES.stopped/merging/merged/failed/cancelled/discarded` locally. If chosen, these
belong with the library's `STATES`.

## Notes

- The `prototype` skill is user-invocation only and could not be loaded from this
  autonomous run. The round follows `design-system/prototypes/AGENTS.md`
  ("Prototyyppiworker") and uses the library's picker contract unchanged.
- Production views were read in the synthetic lab (`OH_PORT_BASE=5600`): the workspace
  page with its icon row and Git pill, a conversation with a working spinoff, and the
  background strip.

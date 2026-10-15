# Result: worktree agents prototype

Round `design-system/prototypes/rounds/2026-10-16-haaratyo`. Build it from
`design-system/prototypes/` with `node build.mjs rounds/2026-10-16-haaratyo`
(output `dist/2026-10-16-haaratyo.html`). The architecture sketch is
[manage-agent-worktrees/architecture.md](../manage-agent-worktrees/architecture.md).

## Axis and directions

**Axis: what a worktree run is in the view.** All three directions show the same
content: workspace `aurinkokello` with six worktree runs ("haaratyö"), one in
each state, plus the workspace's ordinary conversations.

1. **Keskusteluna** (as a conversation). A worktree run is one row among the
   conversations, in attention order. Its branch and policy are small marks on
   the row, and merged runs fold into "Valmiit" with finished conversations.
   This adds the fewest new concepts: the run's state becomes the conversation's
   state.
2. **Tehtävänä** (as a task). The workspace page gets its own "Haaratyöt"
   section of cards. Each card shows three separate facts: the Taskfleet run
   (Ajo), Pi activity (Pi) and browser control (Ohjaus), as the integration
   design asks. The sidebar has a "Haaratyöt" fold under the workspace. The
   conversation opens with the same card at the top. This makes the separation
   of the three facts visible everywhere, at the cost of more surface.
3. **Paikkana** (as a place). A worktree is a branch of the workspace. The page
   draws the runs as lanes leaving the `main` trunk, and a merged lane rejoins
   it. The sidebar lists each worktree as a child place named by its branch, and
   the conversation's breadcrumb is `aurinkokello / <branch>`. This follows Git's
   own model and would let one worktree hold several conversations later. It
   also shows the cost: a merged worktree no longer exists as a place.

All three share these parts:

- **Starting work.** On the workspace page, *Uusi* (+) opens a menu: *Keskustelu*
  or *Haaratyö…*. The dialog takes the task, an optional title and the policy:
  *Yhdistää itse* (merges itself, the default) or *Kysyy ensin* (asks first). It
  warns that the workspace's uncommitted changes are not included and will block
  the merge. After you start, the run appears on the page and goes through three
  steps: Taskfleet run, worktree, Pi. Then it works. A self-merging run merges on
  its own; an asks-first run waits.
- **States:** creating, working, waiting for you, merging, merged, not merged
  (work preserved), agent stopped, and in the terminal (read-only).
- **The conversation** ends with an outcome card. Ready to merge has
  *Yhdistä main-haaraan*, which sends the agent a message. Merged shows the
  commit, the diff stat and the cleanup. Not merged shows the reason, the
  preserved branch and checkout, *Pyydä agenttia ratkaisemaan* (ask the agent to
  resolve it), and the CLI commands for cancelling. In place of the composer, a
  bar says why you cannot write: merged, merging, in the terminal, or stopped
  (with *Jatka*, continue).

Check: `check.mjs` passes in light, dark and phone for all three directions,
with the + menu and the dialog clicked and a clean console. A scripted flow
covered creation through submit, merge, conflict resolution, resume and the
terminal run, again with a clean console.

## How this fits the workspace page (proto-workspace-page)

The page reuses the chosen home page's language (`h-head`, `hrows`, cards,
`kc-go`). Worktree runs are an addition placed under the page header. In v1 they
join the conversation list. In v2 they are a section after "Keskustelut". In v3
the "Haarat" section comes first and the main checkout's conversations follow
it. The + menu here is a minimal version of that round's "+" layer; the only
thing this round needs from it is a *Haaratyö…* item. The top bar and composer
are the library's.

## Host facts the view assumes

The sketch's tables list them. In short:

- From Taskfleet, per run: full run ID, title, branch, checkout path, source
  branch and OID, policy (`settlement_policy`), run state including
  merge-intent-recorded and failed attempt with reason, and the merge report
  (commit, commit count, diff stat, cleanup state).
- From Git in the checkout, read by the daemon: commits ahead and uncommitted
  files.
- From the daemon: Pi activity and browser control. Terminal-started runs
  appear read-only.
- The durable run → Pi session binding, so a conversation stays readable after
  cleanup.

None of these is new storage in the host.

## Questions for Jari

1. Which direction: conversation, task or place?
2. In asks-first mode, is the go-ahead a message to the agent, as prototyped,
   with no browser button that calls `taskfleet run merge` directly?
3. Should the default policy be *Yhdistää itse* (merges itself)?
4. Placement: sibling worktrees directly under `~/src`
   (`~/src/<repo>__wt-…`, which existing discovery already reads), or nested
   with a new resolver?
5. Is the word "haaratyö" right in the UI, or should it say "worktree-agentti"?

## Decisions for later review

- The UI term is **haaratyö**, with the branch in monospace. The modes are
  *Yhdistää itse* and *Kysyy ensin*.
- After creation the view stays on the workspace page (you can start several
  runs) instead of opening the conversation.
- Cancel, salvage and discard stay in Taskfleet's CLI. The failed state shows
  copyable commands. Merging always goes through the agent.
- A merged run's conversation is read-only, because its checkout is gone.
  Continuing means starting a new conversation or run.
- A cancelled state is left out of the prototype. It would look like "not
  merged" with a cancelled label.
- In the prototype, a working run's composer shows the resting state; the Stop
  and steer row is the library's and is bound to the library conversation.
- The architecture sketch recommends sibling placement, and the prototype paths
  follow it.
- Review level: the sketch touches the Unix-user boundary and component
  authority, so it got one targeted `/llm-review`. Finder was gpt-6-astra (a
  different provider from this Claude worker, for independence) and verifier
  was claude-fable-5-1. Two findings were confirmed and fixed: a failed merge
  may retire the intent only before any ref moved, and `run wait` must not
  settle on the Pi exit while a merge intent is active. The model-performance
  entry was not logged because the write to alder over SSH was refused (the
  known `assess-models-alder-self-ssh` issue). The prototype HTML/JS got a
  focused self-review and the scripted checks.
- The `prototype` skill could not be loaded from this autonomous run (it is
  user-invocation only). The round follows `design-system/prototypes/AGENTS.md`
  ("Prototyyppiworker") and the library's picker contract instead.

## Library proposals

None required. If a direction is chosen, the run row, outcome card and dock
should move into `lib/` as their own `worktree.*` pair rather than into
`app.js`.

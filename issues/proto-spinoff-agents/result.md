# Result: spinoff agents under their parent conversation

Round `design-system/prototypes/rounds/2026-10-16-spinoffit/`. Build it from
`design-system/prototypes/`:

```
node build.mjs rounds/2026-10-16-spinoffit      # → dist/2026-10-16-spinoffit.html
```

Keys 1–3 switch direction. The page opens on the parent conversation
*Julkaisu 0.4: valmistelu* in `aurinkokello`. The page bar's **Välimuisti
valmistuu** button lets the working spinoff finish. Writing anything to the
parent (for example "Mergeä se.") makes the parent merge the spinoff that is
waiting for it. Clicking `aurinkokello` in the sidebar opens the workspace page.

The architecture is revised in
[manage-agent-worktrees/architecture.md](../manage-agent-worktrees/architecture.md).

## Starting point

This round riffs on `2026-10-16-tyotilasivu` (workspace page, direction 1
accepted) and `2026-10-16-haaratyo` (worktree agents, rejected because the user
started and steered them). Production has no spinoff surface. Spinoffs follow
Jari's model: the agent starts them for itself, and the user does not message
them.

**The workspace page** is the accepted direction 1, *Keskustelut edellä*, with
the Git pill-button in the page head kept exactly as prototyped there
(`main · 2 muutosta ↑1`, opens the Git layer, a bottom sheet on the phone). Per
Jari's clarification it is not hidden when up to date and not redesigned. The
top bar's `+` is a plain *Uusi keskustelu*, and the sidebar `+` creates a
conversation directly (the library behaviour). The worktree group and the `+`
layer are gone.

## Axis: where a conversation's spinoffs appear

All three directions have the same content. The parent conversation started four
spinoffs, one in each state:

| Spinoff | State |
|---|---|
| README-esimerkit ajan tasalle | **Mergetty**: commit, commit count, diffstat, files, worktree removed |
| CI:n pip-välimuisti | **Työskentelee**: current activity and a clock |
| Maanantain CI-aikakatkaisu | **Ei mergetty · työ tallessa**: conflict reason, preserved branch and worktree, copyable `taskfleet run show/salvage` |
| Aikavyöhyke tulosteeseen | **Odottaa pääagenttia**: an `--interactive` spinoff that is finished and waits for its parent's `run merge` |

| # | Direction | What it decides | Cost |
|---|---|---|---|
| 1 | **Langassa** | The spinoffs are one group in the parent's thread, at the point where the agent started them, and each row updates live. Nothing is added to the sidebar or the workspace page beyond the parent's own state and recap. | The quietest option. To find a spinoff you open its parent, and in a long conversation the group scrolls away. |
| 2 | **Yläpalkissa** | The parent's top bar has a spinoff mark (count plus the states worth a look) that opens a list. On the workspace page, the parent's card gets one line of spinoff pills. | Always one click away, and it does not grow the thread. The mark's small state icons need learning, and on the phone only the count shows. |
| 3 | **Alirivit** | Quiet child rows under the parent conversation in the sidebar and in its card on the workspace page. Merged spinoffs fold into one "N mergetty" row. | Visible from anywhere without opening the parent. Adds rows to the sidebar while spinoffs exist. |

**Shared by all directions:**

- **Opening a spinoff is read-only.** It shows its transcript (the parent's task
  as a *Pääagentti* bubble, the spinoff's own Pi thread) and its result card. A
  dashed bar replaces the composer: "Spinoffille ei kirjoiteta: sitä ohjaa
  agentti, joka käynnisti sen", with *Kirjoita pääagentille →*. The top bar
  says *Spinoff*, links to the parent, shows the state and a dashed *Vain luku*
  tag, and Tiedot lists the run ID, branch, worktree, starting point, merge mode,
  the parent and the agent.
- **How the parent sees the outcome.** The parent waits for its spinoffs
  natively with `taskfleet run wait`, as a background `process`. While the wait
  runs and the turn has ended, the parent is **Odottaa spinoffia** (see below).
  When the wait ends, a muted row says "Prosessi `spinoffit` päättyi ja herätti
  agentin", and the parent takes a turn that reads the wait output and reports.
  The browser never writes into the parent.
- **The person acts only through the parent.** "Mergeä se." in the parent makes
  the agent run `taskfleet run merge` for the waiting spinoff, and the spinoff
  becomes *Mergetty*.

`check.mjs` passes in light, dark and phone for all three directions, with
these clicks: the spinoff row → Tiedot (v1), the top-bar mark → a panel row →
Tiedot (v2, dark and phone), the sidebar child row → the workspace page → the
Git pill (v3), and the phone drawer → child row (v3). The console is clean. A
scripted flow (spinoff finishes → parent wakes; answering the parent → merge;
v2 panel; v3 page fold → merged spinoff) also ran with a clean console.

## The parent's waiting state (shared with proto-processes-blocks)

Jari's note of 16 October 2026: a parent waiting for a spinoff is in a state of
its own. This round assumes the following, and `proto-processes-blocks` should
agree or say where it differs:

| State | Derivation | Mark and wording | Where it shows |
|---|---|---|---|
| **Odottaa spinoffia** | Pi's turn has ended and the conversation's `process` inventory has a live, recognised `taskfleet run wait <run-id>…` | The spinoff glyph in accent ink, "Odottaa spinoffia". Not the hollow *Odottaa sinua* ring | Sidebar and home/workspace mark. The top-bar chip names the awaited spinoff with *its* state mark and opens it. A row at the end of the thread names the spinoff, its state and line, and says "Herää, kun spinoff valmistuu. Voit kirjoittaa silti." |
| Wake-up | The wait process exits, and Pi's processes extension delivers the exit, which starts a turn | A muted row "Prosessi `spinoffit` päättyi ja herätti agentin" before the new turn | Thread. *proto-processes-blocks* owns this block's final design |
| `process start` of a wait | A tool call with a recognised wait command | A special tool row "Odottaa spinoffeja" with the awaited spinoffs and their marks, instead of a generic process row | Inside the thread's (folded) work |

Rules carried in the architecture:

- Only simple literal `taskfleet run wait` commands are recognised, parsed in the
  companion extension into a structured field. Variables, pipes and compound
  commands are ordinary processes.
- If the turn ends with a question while a wait still runs, the state is
  *Odottaa spinoffia*, not *Odottaa sinua*, because the host cannot tell that
  the reply is a question. The person can still write.
- A foreground `run wait` inside a running turn is *Työskentelee*.

Sort order in lists: *Odottaa spinoffia* sits between *Työskentelee* and
*Odottaa sinua*.

## Host facts the view assumes

From the [architecture sketch](../manage-agent-worktrees/architecture.md):

- **Run → conversation:** a new Taskfleet field `created_by_session`, taken from
  `TASKFLEET_CREATOR_SESSION=pi:<uuid>`, which the daemon sets when it starts Pi.
  It is attribution only, beside Taskfleet 0.14's `created_by_run_id`.
- **Spinoff transcript:** Taskfleet exposes the node's session ID, its live
  session path (a private `--session` file under Taskfleet's state root) and its
  evidence archive path. The daemon reads them read-only with header checks.
- **State and result:** `status`, `lifecycle`, `attention_required`, `landed`,
  the report's merge commit, `preserved_work` and the failure summary, retained
  after teardown. Diffstat and files come from Git in the workspace.
- **Waiting:** the conversation's native process inventory plus the structured
  wait field.
- **Placement:** Taskfleet's own `~/src/<repo>__worktrees/wt-…`, outside
  workspace discovery, so spinoff worktrees never appear as workspaces.
- **Lifetime:** Taskfleet starts the supervisor and worker in their own user
  unit and derives `XDG_RUNTIME_DIR` itself. Each browser user has a running
  systemd manager (lingering).

## Questions for Jari

1. Which direction? I would pick **3, Alirivit**: Jari wants status to stay
   quiet, and child rows show which conversation owns which spinoff from
   anywhere without opening the parent, while merged ones fold away. Choose
   **1** if spinoffs should exist only inside their conversation.
2. Accept the ADR 0010 amendment: spinoffs are Taskfleet-owned runs that the
   browser observes read-only, and browser-controlled worktree agents
   (caller-owned runs) are deferred.
3. Accept the Taskfleet asks (`created_by_session`, session paths in
   `run show`, retained terminal runs, its own user unit and runtime directory).
4. Is the word "spinoff" right in the UI (your own word), or should it be
   "sivutyö" or something similar?

## Decisions for later review

- **UI term "spinoff"**, with states *Työskentelee*, *Mergetty*, *Ei mergetty ·
  työ tallessa* and *Odottaa pääagenttia*, and *Odottaa spinoffia* for the
  parent. "Merge" is used as a verb as in Jari's own speech.
- **Odottaa pääagenttia** is modelled as Taskfleet's `--interactive` lifecycle:
  the spinoff is finished and waits for the parent's `run merge`/`cancel`. That
  is a real Taskfleet state and needs no invented command.
- **The Git pill is direction 1's as it was,** following Jari's clarification
  during the round. An earlier draft of this round hid Git when up to date. It
  was replaced before any commit.
- **The "Taskfleet observed" row was dropped.** An early draft showed a dashed
  host-observed row when a spinoff finished while its parent was idle. Jari's
  note that the parent waits with `run wait` makes the native wake-up the path,
  so the browser never adds rows to the parent's history.
- **No settlement or write control on a spinoff.** The failed state offers only
  copyable CLI commands, and all action goes through the parent.
- **Grandchildren** (spinoffs of spinoffs) are not prototyped. The architecture
  shows direct children only.
- **Claude Code spinoffs:** the transcript waits for ADR 0016 adapters. The view
  would show the result alone.
- **The lab was not run for this round.** Production has no spinoff surface, and
  the two source rounds captured the lab state the same day. The workspace page
  is reused from `2026-10-16-tyotilasivu`.
- **Review level:** the sketch touches the Unix-user boundary, the daemon's
  launch environment and component authority, so it got one targeted
  `/llm-review`. The finder was gpt-6-astra (another provider than this Opus
  worker) and the verifier claude-fable-5-1. Three findings were confirmed
  locally and by the verifier, and all were fixed:
  - Taskfleet keeps live worker sessions in a private `--session` file outside
    `~/.pi`.
  - `systemd-run --user` fails under the daemon's minimal Pi environment even
    with lingering, so Taskfleet must derive `XDG_RUNTIME_DIR`.
  - The process inventory records a shell string, not argv, so wait recognition
    is narrowed to literal simple commands.

  The prototype HTML/JS got a focused self-review plus scripted checks. The
  model-performance entry was not logged, because SSH to alder was refused (the
  known `assess-models-alder-self-ssh` issue).
- **Lab ports:** none were needed. `check.mjs` ran against the built file, using
  the main checkout's Playwright through a scratch symlink, because this
  worktree has no `web/node_modules`.

## Library proposals

If a direction is chosen:

- Add the parent state `spinwait` to `STATES`/`STATE_ORDER` in `lib/app.js`
  (shared with `proto-processes-blocks`).
- Move the spinoff marks, the read-only dock and the spinoff view into a
  `lib/spinoff.*` pair.
- Move the chosen placement's renderer (thread group, top-bar mark, or child rows
  through the `APP.row` hook) there as well.

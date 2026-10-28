# Result: prototype round 3

Prototype: `prototypes/ended-worker-r3/index.html` (one offline file, three
variants behind the picker). [NOTES.md](prototypes/ended-worker-r3/NOTES.md)
is Jari's guide in Finnish, and `prototypes/ended-worker-r3/evidence/` holds
the screenshots (device scale factor 2, AVIF encoded by `check.mjs` with ffmpeg to keep the tree small). The page is hand-written
(`round.js`, `surface.css`) and inlined with tokens and fonts by `build.mjs`.
It contains no production components. Rounds 1 and 2 stay in
`prototypes/ended-worker/` and `prototypes/ended-worker-r2/` for comparison.

## Jari's decision and what it leaves open

Jari decided on 28.10.2026, after round 2, that *Kerro agentille* is the
function itself, not a draft. Pressing it sends an agent a request to handle
exactly that worktree. The agent inspects it and recommends merge, continue
or discard, and the person answers in the conversation. *Käsittele kaikki*
sends one request covering every unfinished row. Round 2's rules are
unchanged: a row is listed while its branch or worktree exists, an
unfinished row has a red ball, and the row disappears once the agent has
removed the branch and the worktree.

The decision leaves open **which conversation receives the request.** The
brief offered three candidates: the parent, the current conversation, and a
new one. In production, the current conversation and the parent are always
the same. The Workers panel is served per parent
(`/api/v1/agents/pi:<id>/spinoffs`, `serveSpinoffs` in
`internal/daemon/spinoffs_linux.go`), and a run belongs to the panel only
when its `Creator.SessionID` is that conversation (`belongsSpinoff`). Every
press therefore happens inside the parent. Round 3 replaces "current" with
Jari's own alternative, "a chosen agent":

- **1 Vanhempi (parent).** Always the conversation that started the worker.
  If it is in a turn, the request waits in its follow-up queue. If it is
  closed, sending continues it. If the browser cannot write to it (a Pi
  started in a terminal), the request falls back to a new conversation, and
  a notice says why.
- **2 Valittava (chosen).** The same by default. A caret beside every button
  chooses another conversation in the worker's workspace, or a new one. A
  read-only parent is greyed out in the choice.
- **3 Uusi keskustelu (new conversation).** Every press starts a new
  conversation in the workspace. The parent is never interrupted.

## What is the same in all three

- **Where the buttons sit:**
  - *Kerro agentille* on every ended row.
  - *Käsittele kaikki (n)* in the panel's Päättyneet header, shown when two or
    more unfinished rows wait for a request.
  - *Käsittele kaikki (n)* (or *Käsittele* for one row) beside the worker pill
    while any unfinished row waits.
  - The same button at the foot of the worker view.

  In production the pill sits above the composer, not in the top bar
  (`BrowserConversation.tsx`, `HistoryView.tsx` render `BackgroundStrip`), so
  the prototype keeps it there.
- **The request is the person's own message**, identical in every variant:

  > Käsittele worker ”test-guide: worker-näkymän koe” (Taskfleet-ajo
  > 01m5yq1t6wkd3r8n2c4h7pqa0e, haara wt/5yq1-test-guide-worker-nakyma,
  > worktree ~/src/kasvimaa__worktrees/wt-5yq1-test-guide-worker-nakyma):
  > päättyi klo 07.36, ei mergetty, työ tallessa. Tarkista sen tila ja
  > suosittele, mitä sille tehdään: mergeä, jatka tai hylkää. Älä muuta
  > mitään ennen kuin vastaan.

  When the target is not the parent, a sentence names the parent
  conversation. *Käsittele kaikki* lists the rows one per line under
  "Käsittele nämä 3 keskeneräistä workeria:".
- **The synthetic agent reply** lists what it found (commits ahead, a
  conflict, the test result) and recommends one action with the command
  behind it. For the scene's rows that is:
  - not merged: merge with Git, because Taskfleet does not merge a done run;
  - cancelled and superseded: `taskfleet run discard`;
  - interrupted: `taskfleet run reattach`;
  - merged with its worktree left: cleanup.

  It names the alternatives and ends with a question. The batch reply has one
  numbered item per worker and ends with "Teenkö nämä kaikki?".
- **The person answers** as a normal message: "kyllä", "hylkää", "mergeä 1,
  jätä muut", "jätä toistaiseksi".
- **The row while the request is handled.** The red ball becomes a turning
  accent ring, and the second line shows the phase and where it is:
  - *pyyntö jonossa · lähtee, kun Iltakierros vapautuu*
  - *pyyntö lähetetty · Iltakierros jatkuu* or *uusi keskustelu käynnistyy*
  - *agentti tarkistaa · tässä keskustelussa*
  - *odottaa vastaustasi* (a still ring, like the rail's *Odottaa sinua*)
  - after the answer: *agentti mergeää / hylkää / jatkaa ajoa*

  The row's button becomes *Näytä keskustelu*, or *Avaa keskustelu* when the
  request went to another conversation. "Jätä toistaiseksi" returns the row
  to its red ball. The pill shows rings for handled rows and balls only for
  rows still waiting.
- **How the row disappears.** When the branch and worktree are gone, the row
  shows a green check, a struck-through name and its last word (*mergetty ·
  haara ja worktree poistettu*) for about 1.5 s. It then folds away (240 ms;
  with reduced motion it is simply removed), and a notice says "… poistui
  Workerit-listasta". A resumed run moves to the live rows. With nothing
  left, the pill is gone.
- Pressing never navigates. The panel stays open so the person sees the row
  take the request.

## The three variants

| # | Variant | Who receives the request | When it is the right choice | Its cost |
| --- | --- | --- | --- | --- |
| 1 | Vanhempi | The parent. It queues when the parent is busy, continues it when closed, and falls back to a new conversation when the parent is a terminal Pi. | The agent that launched the worker knows why. One press, and the person answers where the row is. | The request lands in the middle of an ongoing conversation and waits for its turn to end. |
| 2 | Valittava | The parent by default; the caret chooses another conversation in the workspace or a new one. | A busy parent can be bypassed without giving up the default. | Every button is a split button. The choice lists conversations that know nothing of the worker. |
| 3 | Uusi keskustelu | A new conversation every time, named for the worker or *Workereiden käsittely*. | The parent is never interrupted or queued behind. Closed and terminal parents do not matter. | The new agent starts without the parent's context. The person must go to another conversation to answer. Each press starts a Pi, and conversations pile up in the rail. |

## Which host path sends a message, and may the browser send it

The composer's own route sends the request. Nothing new is needed:

- `web/src/app/conversations.ts`:
  - `send()` → `POST /api/v1/conversations/<id>/send` with `{message, command_id}`
    (`contracts/v1/pi-message.schema.json`);
  - `queueMessage(…, "follow_up")` → `/follow_up` while Pi is in a turn
    (`ConversationActions.tsx` `submitQueue`);
  - `continueConversation()` → `/continue` for a resting browser conversation;
  - `create()` → `POST /api/v1/conversations` with `workspace_id` for a new one;
  - `sendReceipt()` reads the delivery receipt by `command_id`.
- `internal/daemon/conversation_linux.go`: `ServeHTTP` routes `send`, `steer`,
  `follow_up`, `continue` and the create. `sendKind` resumes a
  browser-started conversation on send, and answers `409 read_only_history`
  for terminal history.
- `internal/daemon/continuation_linux.go`: `continueEnded` requires the
  daemon's native ownership lock and browser-origin marker. "A terminal
  history alone cannot grant control." This is the reason for variant 1's
  fallback.
- `historyEligibility()` (`GET …/eligibility`) tells the browser in advance
  whether a conversation is `eligible`, `writer_present` or
  `read_only_history`. Variants 1 and 2 use it to know when the parent cannot
  take the request.

**May the browser send it on the person's behalf? Yes.** Pressing the button
is the person's own action, the same as typing the text and pressing Send:
- It goes through the same route, the same authenticated session and the same
  `X-Agent-Host-CSRF` header.
- Pi's history records it as the person's user message, and it is run by the
  person's own Pi as their Unix user.
- The daemon still trusts no identity claim from the browser, and no
  authority moves between gateway, daemon and provision.

Variants 2 and 3 send to another of the same person's conversations, which
the person could also open and type into.

The line to keep:
- the browser sends only on an explicit press, never automatically (for
  example, not when a worker ends);
- the conversation shows the message exactly as sent.

## Host facts each variant needs

| Fact | Exists? | Where | Needed by |
| --- | --- | --- | --- |
| Send, queue as follow-up, continue a resting conversation | Yes | `web/src/app/conversations.ts`, `internal/daemon/conversation_linux.go`, `continuation_linux.go` | all |
| Whether the parent can be written to (read-only terminal history) | Yes | `historyEligibility` (`…/eligibility`), status `continuation` | 1, 2 (fallback and the greyed-out choice) |
| Start a conversation in a workspace and send its first message | Yes | `create()` / `pi-conversation-create.schema.json`, then `send()` with `first_choice` (`ConversationActions.tsx`) | 3, and 1–2's fallback and "Uusi keskustelu" |
| Workspace id for a worker in **another** repository | No. The spinoffs row has `other_repository` (a directory name). `terminal_workspace` is only for the selected live run (`workerTerminalWorkspace`, `spinoff_history_linux.go`). | `spinoffs.schema.json` | 3 (otherwise it starts in the parent's workspace) |
| The workspace's conversations, for the chooser | Yes, the rail's list | snapshot (`agent-workspaces.schema.json`) | 2 |
| Run id, branch, worktree, source branch for the request text | Yes | `spinoffs.schema.json` (`run_id`, `branch`, `worktree`, `source_branch`) | all |
| A row's handling phase (queued, checking, waiting for answer, acting) | No. Nothing links a message to a run. It can be derived without a new store: the request text carries `Taskfleet-ajo <run_id>`, so a user message naming the run after its `ended_at` marks it handled. The phase then follows that conversation's queue (`queue.follow_up`) and activity (working, or turn ended), all read through existing routes. For the parent the browser already holds the history; for 2 and 3 it must read another conversation's history and status. | browser, or a daemon read over Pi history | all (cheapest for 1) |
| An ended row disappears when nothing is on disk | No (round 2). `preserved` is one boolean, computed only for done/failed/cancelled. | `spinoffs_linux.go`, `BackgroundStrip.tsx` `backgroundFacts` | all |
| `cancelled` and `interrupted` as their own states, `preserved` for interrupted | No (round 2). `spinoffState` folds them into `unmerged` / `unknown`. | `spinoffs_linux.go` | all (the agent can read Taskfleet itself; the row word needs it) |
| Pill: balls per unfinished row, rings per handled row, *Käsittele kaikki* beside it | No. The pill shows live marks or a number and a corner dot. | `BackgroundStrip.tsx` | all |

## Recommendation

**Vanhempi (1).** The agent that launched the worker knows what it was for,
so it gives the best recommendation. The person answers in the same view
where the row and its phase are shown, and one press is the whole action.
The handling phase is cheapest to derive here, because the browser already
holds the parent's history and queue. Variant 1's two awkward cases have
existing host answers:
- a busy parent: the follow-up queue, with the row saying "pyyntö jonossa";
- a parent the browser cannot write to: the eligibility read, then a new
  conversation with a notice.

Valittava (2) is the right addition if Jari often wants to keep the parent
free. The caret can be added to 1 later without changing anything else.
Uusi keskustelu (3) gives up the parent's context and costs a navigation to
answer, which goes against "the person answers in the conversation" where
the row is.

## Decisions for later review

- **The request is sent at once, without confirmation, also for Käsittele
  kaikki.** The protection is the request's last sentence, "Älä muuta mitään
  ennen kuin vastaan": a wrong press costs one agent turn and changes
  nothing. Alternatives: a confirmation on *Käsittele kaikki* only, or an
  undo window (`cancel_held` only covers held messages, so this would be a
  delay before sending).
- **The request is natural-language Finnish naming the run id, branch and
  worktree.** Alternatives: a slash command or skill (`/worker <id>`), which
  hides what is asked, or a structured block. Plain text is "the same as
  typing", reads well in history, and lets any agent, including a new one,
  find the work.
- **No marker that the message came from the panel.** It is the person's
  message. A marker would need metadata Pi history does not carry.
- **The handling phase is derived from the conversation, not stored.** See
  the host-fact table. The alternative, browser memory keyed by
  `command_id`, is lost on reload and on another device.
- **A busy parent gets a follow-up, not a steer.** A steer would redirect the
  turn the person started.
- **A closed browser parent is continued by the press**, as when the person
  starts typing into a resting conversation (ADR 0020 as amended
  2026-10-27). A terminal parent cannot be, so variant 1 falls back to a new
  conversation and says so. The alternative was to disable the button and
  explain.
- **Käsittele kaikki covers unfinished rows not already being handled.** The
  merged row with only cleanup left keeps its own button. It is in the panel
  header when two or more rows wait (one row has its own button), and beside
  the pill from one row up.
- **The chooser lists only the worker's workspace conversations and "Uusi
  keskustelu".** Conversations in other workspaces run elsewhere.
- **A new conversation's title in the prototype (*Worker: …*, *Workereiden
  käsittely*) is illustrative.** Production titles come from Pi's own
  titling.
- **Round 2's open question, whether the browser removes a merged worktree
  itself, is left out of this round.** No variant has a remove button, so
  the one axis stays visible. Round 2's recommendation (Yhdistetty) still
  stands beside any choice here.
- **The brief's "header worker pill" is placed where production has it**,
  above the composer.

## Questions for Jari

They are in NOTES.md:

1. Which conversation receives the request: the parent (1), the parent or a
   chosen one (2), or always a new one (3)?
2. Is the request's last sentence enough protection, or should *Käsittele
   kaikki* ask first?
3. Should the merged row with only cleanup left be part of *Käsittele
   kaikki*?

## Verification

```sh
node issues/proto-ended-worker-lifecycle/prototypes/ended-worker-r3/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright node issues/proto-ended-worker-lifecycle/prototypes/ended-worker-r3/check.mjs
```

`check.mjs` passed 12 cases: 3 variants at 1440 and 390 px, each in light and
dark, at device scale factor 2. For each case it checked:

- Jari's case: the press sends at once (no draft), the exact request text
  with run id, branch and worktree, the row phases through checking and
  waiting for the answer, the agent's recommendation, then "kyllä", the row
  folding away, the pill gone, and the notice;
- Käsittele kaikki from the panel header (in Valittava through the chooser,
  with Escape closing it): one numbered request, three rows handled, then
  "kyllä": two rows gone, one resumed into the live rows, and the merged
  row's own button kept;
- a busy parent: the queue box and "pyyntö jonossa" in 1 and 2, none in 3,
  and delivery after the turn; "jätä toistaiseksi" brings back the ball;
- a closed parent: continued in 1 and 2;
- a terminal parent: the fallback to a new conversation with its notice, and
  the greyed-out choice in 2;
- the worker view's button;
- Escape returns focus to the pill;
- no horizontal overflow, the shared picker check, no console errors and no
  network requests.

Self-review of the screenshots fixed the rail growing
with a long new title, moved the notice off the queue box, removed a double
gap in *Näytä keskustelu*, and shortened the picker label to *Uusi* so that
it does not wrap on the phone. No production code changed.

# Design: a worker's question to its parent, and the agent's own word in the rail

Design for review, 14.11.2026. **Nothing here is implemented or approved.** It
covers two issues: `worker-asks-parent` and `agent-sets-rail-state`.

## Yhteenveto Jarille

- **Kaksi osaa, jotka toimivat erikseen.** (1) Agentti kertoo itse, kenen vuoro
  on: `open-habitat agent handoff` (*odottaa workereita* / *tarvitsee
  vastauksesi: kysymys* / *valmis*). (2) Worker kysyy vanhemmaltaan:
  `taskfleet node ask` odottaa vastausta, `taskfleet run answer` vastaa.
- **Ensimmäinen viipale on pelkkää Habitatia** eikä tarvitse Taskfleetiin
  mitään: agentin ilmoitus ja railin sääntö. Hyöty heti: vastaus "käynnistin
  kolme workeria, palaan asiaan" ei enää nouse *Sinun vuorosi* -ryhmään.
- **Agentin sana ei ohita havaintoa.** Käynnissä oleva vuoro, virheet, Pi:n oma
  kysymys ja sinun Nosta / Ei nyt -merkkisi voittavat aina. *Odottaa
  workereita* pätee vain niin kauan kuin Habitat näkee workerin työssä.
- **Ilmoitus tallennetaan keskustelun omaan Pi-historiaan** (kuten agentin
  ilmoitukset nyt), ei uuteen tiedostoon: se kestää daemonin uudelleenkäynnistyksen
  ja raukeaa itsestään, kun seuraava vuoro alkaa (sinä kirjoitat tai worker
  herättää agentin).
- **Workerin kysymys menee agentille, ei sinulle.** Taskfleet palauttaa
  vanhemman `run wait` -odotuksen heti; Habitat herättää pysähtyneen
  keskustelun kuten valmistuneesta workerista. Agentti vastaa itse tai siirtää
  kysymyksen sinulle (`taskfleet run escalate` + *tarvitsee vastauksesi*).
- **Aikakatkaisu:** worker jatkaa ilmoittamallaan oletuksella ja kirjaa sen.
  Jos agentti ei reagoi viidessä minuutissa, kysymys nousee sinun vuoroosi.
- **Taskfleet-ehdotus** on omana lukunaan (§4), valmiina vietäväksi
  Taskfleetin trackeriin. Sitä ei ole viety eikä Taskfleetiä muutettu.
- **Sinulta tarvitaan** viisi päätöstä (§6): komennon nimi, *valmis*-tilan
  käytös, saako Habitat herättää keskustelun joka ei odottanut, vastaatko
  Workers-paneelista suoraan vai agentin kautta, ja oletusaikakatkaisu.

## 0. What the code does today

Read at Open Habitat `97ad46ac`, installed Taskfleet 0.20.0 (commit `6ad8d7ca`,
the `v0.20.0` tag) and its source three issue-only commits later.

**The rail** (`web/src/app/railNow.ts`) sorts each conversation from observed
facts. A conversation is the person's turn when it has a new reply
(`attention === "new"`), a read reply while nothing is live, the person's
raise, a new conversation without a first message, or a native Pi question
(`pending_question`). Otherwise it is in Käynnissä when its turn runs, it waits
on a background process or a `taskfleet run wait`, or one of its workers works
or idles (`spinoffs_working`, `spinoffs_idle`); the rest is Hiljaiset. Two
consequences matter here:

- A new reply claims the person's turn **even while the conversation's workers
  work and the agent waits for them**: `turn` is computed before `live` is
  consulted. "I started the workers, nothing for you yet" lands in Sinun
  vuorosi.
- The person's own word already exists as `turn_mark` (Nosta, Ei nyt), kept in
  `~/.config/open-habitat/turn-marks.json` by the daemon
  (`internal/daemon/turn_marks_linux.go`). The agent has no word at all.

**The agent CLI** reaches the person's daemon over the per-user socket
`/run/open-habitat/users/<user>/agent.sock` (`internal/cli/agent_linux.go`).
`--current` sends the conversation, workspace and launch generation that the
daemon's Pi launch exported; the daemon refuses a stale generation
(`current_context_stale`). `agent notice create` is the existing precedent for
an agent write scoped to its own conversation: the daemon asks the Pi companion
(`internal/daemon/process-extension.mjs`, op `notice`) to append a custom entry
to the native branch through Pi's own writer, after the companion re-checks
session and generation. The companion also records `oh-person-stop` this way.

**Taskfleet** has a durable question state already: a worker appends
`node.awaiting_input` with `discussion_items` (topic, options,
`recommended_default`) through the generic `taskfleet event create`. `run show`
and `run list` then say `awaiting_input: true`; a default `run wait` settles on
it after a 180-second grace (`crates/taskfleet/src/run/awaiting_input.rs`), and
`--terminal` ignores it. `node.input_resolved` clears it by event sequence and
delivers nothing. `run message` reaches only a live Taskfleet-launched Pi
worker or a resident worker between rounds. There is no command that blocks
until an answer arrives, no answer record, and no timeout that applies a
default.

**Habitat's Taskfleet observation** is read-only: the daemon runs only
`taskfleet run list` and `run show` (`internal/daemon/spinoffs_linux.go`,
`process_taskfleet_linux.go`). A run belongs to a conversation when a Pi
session created it directly (`belongsSpinoff`: `created_by_session`, no
`created_by_run_id`). For `awaiting_input` today:

- The Workers panel says *Odottaa vastausta päätteessä* and points at
  `taskfleet run attach` (`web/src/components/Spinoffs.tsx`,
  `BackgroundStrip.tsx`): it means a prompt in the worker's terminal.
- The rail ignores it: `workingSpinoffs` counts the run as working, so the row
  says *Worker työskentelee* while the worker is blocked.
- A stopped parent whose `run wait` was cut off is woken when its runs "settle
  as the wait would have returned" (`internal/daemon/wake_linux.go`,
  `waitOutcome`); `catchUpLive` already treats `awaiting_input` as settled, and
  the catch-up tells the agent the run "is waiting for you (needs attention)".
  The check runs once a minute, and one automatic wake per conversation is
  allowed in 30 minutes (`wakeCooldown`).
- A live parent is woken by Pi's own process notification when its backgrounded
  `run wait` exits. A parent that did not arm a wait is never woken; the
  companion only reminds it once at turn end (`uncoveredRuns`).

A worker launched from a Habitat conversation **inherits the parent's
`OPEN_HABITAT_CONVERSATION_ID`, workspace and launch generation**, as the agent
skill says and as this design's own worker run showed. `--current` in a worker
therefore names the parent conversation. §2.5 deals with that.

## 1. The flow, end to end

```
worker                    Taskfleet                 parent agent            Habitat / person
  │ node ask (blocks) ──▶ node.asked
  │                       run wait settles ──────▶ turn starts
  │                       (or: Habitat sees the ask and wakes a stopped parent)
  │                                                 answers itself:
  │ ◀── exit 0, answer ── node.answered ◀────────── run answer
  │                                                 or must ask the person:
  │                       node.ask_escalated ◀───── run escalate
  │                                                 handoff needs_answer ──▶ Sinun vuorosi:
  │                                                                          "Kysyy sinulta: …"
  │                                                 ◀── the person replies in the conversation
  │ ◀── exit 0, answer ── node.answered ◀────────── run answer --decided-by person
  │
  │ deadline passes: exit 2, worker continues with its stated default (node.ask_timed_out)
```

1. **The worker asks.** Any harness runs one shell command with a question, a
   stated default and a timeout (§4). The command blocks. Because agent
   harnesses cap a single command's run time, the command returns "still
   pending" after a bounded slice and the worker re-invokes it with the same
   key; the deadline does not move.
2. **The parent is woken.** Three cases, by what the parent was doing:
   - *Live, with a `run wait` armed:* Taskfleet settles the wait at once and
     Pi's process notification starts the parent's turn. Habitat does nothing.
   - *Stopped, its wait cut off:* Habitat's existing wake applies, because the
     wait would have returned. It needs the open ask to count as settled
     (§3, slice 3) and a wake budget per question instead of per conversation.
   - *Not waiting at all* (live and idle, or stopped without a cut wait):
     nothing wakes it today. Proposed: Habitat wakes it for a question
     addressed to it (§6, question 3), except a conversation the person
     stopped or archived, whose question goes to the person (below).
3. **The parent answers or escalates.** It answers within its own brief with
   `taskfleet run answer`. When only the person can decide, it runs
   `taskfleet run escalate` (which keeps the worker waiting and extends the
   deadline), declares `needs_answer` with the question (§2), and asks in its
   reply. The person answers in the conversation as they answer anything else;
   the agent then runs `run answer --decided-by person`.
4. **The answer reaches the worker** as the blocked command's output and exit
   status. No terminal input is injected and no harness adapter is needed.
5. **Timeout.** At the deadline the command exits with the timed-out outcome
   and repeats the default; the worker continues with it and Taskfleet records
   that it did. A late `run answer` is refused with the ask's final state, so
   the parent learns the worker went on without it.

**Who owns what.** Taskfleet owns the question, the answer, the deadline and
every state between them, in the run's event log. Habitat stores none of it:
it reads the open ask from `run list`/`run show` as it reads everything else
about a run, shows it, wakes the parent, and gives the person's turn to a
question nobody is handling. The person-facing answer path is the parent
conversation, not a second inbox.

**When no agent handles the question.** If an ask has been open and
unescalated for five minutes and the parent's turn is not running (the person
stopped the conversation, the wake was declined, Pi could not start), the
conversation moves to Sinun vuorosi as *Worker odottaa vastausta: <question>*.
Otherwise the worker would fall to its default with nobody having seen the
question.

## 2. The agent's own word: `open-habitat agent handoff`

A **handoff** is what the agent says, during a turn, about who has the next
move once that turn ends. It is the agent's counterpart of the person's
`turn_mark`.

```
open-habitat agent handoff create --current --state waiting_workers --json
open-habitat agent handoff create --current --state needs_answer --text "Kumpi kirjasto: A vai B?" --json
open-habitat agent handoff create --current --state done --json
open-habitat agent handoff show --current --json
open-habitat agent handoff delete --current --json
```

`--text` (or `--text-file -`) is one line of plain text, at most 200 UTF-8
bytes, required for `needs_answer` and refused for the other states. There is
no `--conversation` form: the command exists only for the caller's own
conversation.

### 2.1 What the agent may declare

| State | Meaning | Rail |
| --- | --- | --- |
| `waiting_workers` | "This reply asks nothing of you; I continue when my workers report." | Käynnissä, *Odottaa workereita*. The reply does not claim Sinun vuorosi; it stays unread. |
| `needs_answer` + text | "Nothing continues until you answer this." | Sinun vuorosi, *Kysyy sinulta: <text>*, sorted and counted like a native question. |
| `done` | "Finished; nothing is pending for you." | Hiljaiset, with the unread mark kept on the row until the reply is opened. |

### 2.2 What stays Habitat's observation

The agent cannot set, and a handoff never overrides:

- **a running turn** (always Käynnissä, *Työskentelee*);
- **failures**: a crashed Pi, a cut turn, an error turn, a failed worker;
- **a native Pi question** (`pending_question`), which needs its own answer;
- **the person's marks**: Nosta puts the row in Sinun vuorosi and Ei nyt in
  Hiljaiset whatever the agent said, and Ei nyt is offered on a `needs_answer`
  row;
- **archive**, the new-conversation rule, and lost-connection marking.

Order, first match wins: running turn → failure → the person's mark → native
question → handoff → today's observation.

### 2.3 Expiry and override

The handoff is stored as a custom entry (`oh-agent-handoff`) on the
conversation's native Pi branch, written by Pi's own writer through the
companion, as notices are. It is not part of the model's context. The daemon's
branch scan (`scanBranch`) reads it and the snapshot carries it as an optional
`handoff` object on the agent (`state`, `text`, `at`), a new field in
`contracts/v1/snapshot.schema.json`.

- **Scope.** A handoff is valid from the end of the turn it was declared in
  until the next turn begins. The scan drops it at any later person message or
  turn-starting companion message (a wake's catch-up). The last declaration in
  a turn wins; `handoff delete` withdraws it.
- **The person writes.** Their message starts a turn: the handoff is gone, and
  the agent declares again if it still applies. A steer into a running turn
  drops it too; the agent has just been redirected.
- **A worker finishes.** `waiting_workers` holds only while Habitat itself
  observes one of the conversation's own runs working (`spinoffs_working > 0`
  or a `taskfleet_wait` in `waiting_on`). When none remains it lapses and the
  row is placed by observation: the unread reply takes Sinun vuorosi. Normally
  the finished worker wakes the agent first and the new turn replaces it.
- **The turn ends.** That is when the handoff takes effect, not when it
  expires. `needs_answer` has no time limit, like an unanswered reply.
  `done` is tied to the reply it was declared with.
- **Daemon restart, Pi stop, another device.** Nothing is kept in daemon
  memory, so all three read the same branch. A rewind or fork behind the entry
  removes it with the turn it belonged to.

A new file beside `turn-marks.json` was considered and rejected: it would be a
second place for a fact that belongs to one point in the conversation's
history, and every expiry rule above would need code instead of following from
where the entry sits.

### 2.4 A worker's open question and `needs_answer` together

| Situation | Workers panel row | Rail |
| --- | --- | --- |
| Ask open, parent being woken or in its turn | *Kysyy agentilta: <question>* · default and deadline | Käynnissä, *Worker kysyy agentilta* |
| Ask open and unescalated ≥ 5 min, parent's turn not running | same, marked unanswered | Sinun vuorosi, *Worker odottaa vastausta: <question>* |
| Parent escalated and declared `needs_answer` | *Odottaa sinun vastaustasi* · deadline | Sinun vuorosi, *Kysyy sinulta: <text>* |
| Answered | back to *Työskentelee* | by observation |
| Timed out | *Jatkoi oletuksella: <default>* until the run ends | by observation |

The parent may name the ask in its handoff (`--worker-ask <run_id>/<ask_id>`,
slice 4). Habitat then drops the `needs_answer` when that ask is no longer open
(the worker timed out and went on), so the row does not keep asking the person
something that no longer waits for them.

The native-question label *Kysyy sinulta* is shared on purpose: to the person
both are "the agent asks you". The Workers panel's present
*Odottaa vastausta päätteessä* stays for `awaiting_input` and startup prompts,
which really are answered in the worker's terminal.

### 2.5 Trust

- **No new authority.** The command talks to the person's own daemon over
  their per-user socket; the daemon, running as that user, writes to that
  user's own Pi history. Gateway and provisioning are untouched and no identity
  claim is trusted that is not trusted today.
- **Not a security boundary inside one user, and not presented as one.** Any
  process of the person's Unix user can already send messages to, interrupt or
  stop any of their conversations through the same socket
  (`agent message create --conversation`). A handoff is weaker than all of
  those: it changes a label and a rail section.
- **Own conversation only.** No explicit-target form exists. The daemon checks
  the launch generation and the companion re-checks session and generation, as
  for notices.
- **Only during that conversation's running turn.** The daemon refuses
  (`turn_not_active`) unless the conversation's own turn is running. An agent
  only ever acts inside a turn, so this costs it nothing, and it is what keeps
  a worker with the inherited parent context, or a leftover background script,
  from re-marking a parent that has moved on. A worker that calls it during the
  parent's own turn is not stopped by this; the agent skill tells workers that
  `handoff` is the parent's command, and the worst outcome is a wrong label
  until the next turn.
- **It cannot hide anything that needs the person** (§2.2), cannot keep a row
  in Käynnissä without real workers, and cannot touch the person's marks.
- **The text is data.** Plain, one line, bounded, rendered as text and named as
  the agent's question. It grants nothing and is never read as an instruction.

## 3. Phasing

| Slice | Where | Delivers | Depends on |
| --- | --- | --- | --- |
| 1. Agent handoff | Habitat | `agent handoff` (CLI, daemon route, companion op, branch scan, snapshot field, rail rule, skill text). The rail follows the agent's word; a "waiting for workers" reply no longer claims the turn; explicit question rows. | nothing |
| 2. Ask/answer | Taskfleet | `node ask`, `run answer`, `run escalate`, wait settling, projections, worker preamble (§4). Already useful without Habitat changes for a live parent with an armed wait. | nothing |
| 3. Show and wake | Habitat | `ask` on worker rows (contract), panel row and rail label, catch-up state "asks" with the answer and escalate commands, wake keyed per ask, open ask treated as settled in `catchUpLive` and the companion's `liveRun`. | 2 |
| 4. Close the loop | Habitat | `handoff --worker-ask`, the five-minute unanswered rule, the person's answer action in the Workers panel, waking a parent that was not waiting. | 1, 3 |

Slice 2 before slice 3 degrades safely: Habitat ignores the unknown `open_ask`
field, a stopped parent is not woken, and the worker continues with its default
at the deadline. Slices 1 and 2 are independent and can be built in parallel.

Slice 1 changes the snapshot contract, the daemon and the session branch, so
its implementation run needs the independent review (`/llm-review` and
`/assess-findings`).

**Out of this design:** non-blocking notes from worker to parent, and startup
silence. A worker stuck before its agent loop cannot run any command; Taskfleet
already has that as its own item (`startup-blocked-attention`), and Habitat
observes it today as a blocked worker (`workerBlocked`,
`internal/daemon/spinoff_activity_linux.go`).

## 4. Taskfleet proposal (self-contained; to be filed in Taskfleet's tracker)

### A worker's blocking question to its parent: `node ask`, `run answer`

**Problem.** A worker that meets a decision outside its brief can only end the
run with `success: false`, or append a low-level `node.awaiting_input` event
that is described as a human decision, reaches the parent's `run wait` after a
180-second grace, and has no answer: `node.input_resolved` clears attention and
delivers nothing. `run message` reaches a live worker only on Pi. So a Claude
or Codex worker cannot get a mid-run answer at all, and no worker can wait for
one with a bounded, recorded fallback.

**Proposal.** A correlated, durable ask/answer exchange carried by ordinary
shell commands, so it works in every harness that can run one.

#### Worker side

```
taskfleet node ask (--current | <RUN_ID> <NODE_ID>)
    (--question TEXT | --question-file FILE)
    --default TEXT [--option TEXT]...
    [--timeout 30m] [--wait 8m]
    --idempotency-key KEY [--json]
```

- `--current` resolves the run as `run show --current` does (worktree
  ownership, not the branch name). `TASKFLEET_RUN_ID` is not exported for every
  harness, so it cannot be the only way.
- `--default` is required: what the worker does if nobody answers. It must be
  something the brief already allows, which may be "stop and report the
  decision". Taskfleet records it; it does not judge it. With `--option`, the
  default must be one of the options, as `discussion_items` requires today.
- `--timeout` (default 30m) sets an absolute `expires_at` on first append.
  `--wait` (default 8m) bounds one invocation, because harnesses cap command
  run time. Re-invoking with the same key attaches to the same ask and never
  moves the deadline.
- One open ask per node. A second, different ask while one is open is refused
  (`ask_already_open`), naming the open one.
- Limits: question 4 KiB, default and each option 512 bytes, eight options.

Outcome in `data.outcome`, with exit codes that follow `run wait`:

| Exit | `outcome` | Meaning |
| --- | --- | --- |
| 0 | `answered` | `data.answer`, `data.choice` (when options), `data.decided_by` |
| 4 | `pending` | `--wait` elapsed, the ask is still open: re-invoke with the same key |
| 2 | `timed_out` | deadline passed; `data.default` repeats what to do now |
| 3 | `cancelled` | the run was cancelled or the node ended |
| 1 | — | usage or unknown run (error envelope) |

#### Parent side

```
taskfleet run answer <RUN_ID> --ask <ASK_ID>
    (--text TEXT | --body-file FILE | --choice OPTION)
    [--decided-by agent|person] [--node n-0001] [--json]

taskfleet run escalate <RUN_ID> --ask <ASK_ID>
    [--extend 4h] [--note TEXT] [--node n-0001] [--json]
```

- `run answer` appends the answer and releases the worker. On an ask that is
  not open it fails with `ask_not_open` and reports the final state
  (`answered`, `timed_out`, `cancelled`) and the default the worker took.
  Answer limit 16 KiB.
- `--decided-by` (default `agent`) is the answering session's own statement of
  whether a person made the decision. It is a told value, not verified; it lets
  a worker's report distinguish "my parent judged" from "the person decided".
  It grants the worker no permission its brief did not.
- `run escalate` says the parent has passed the question to a person. The ask
  stays open, the worker keeps waiting, `expires_at` moves to now + `--extend`
  (default 4h, never earlier than the current deadline), and the ask stops
  settling `run wait` so the parent can wait again without spinning.

#### Events and projection

| Event (node-scoped) | Data |
| --- | --- |
| `node.asked` | `ask_id`, `question`, `options[]`, `default`, `expires_at` |
| `node.ask_escalated` | `ask_id`, `expires_at`, `note` |
| `node.answered` | `ask_id`, `answer`, `choice`, `decided_by` |
| `node.ask_timed_out` | `ask_id`, `default` |

`ask_id` is derived from the `node.asked` event's sequence, so a stale answer
can never close a newer question (the property `node.input_resolved` has
today). All four append under the run lock; the first closing event wins and
the reducer ignores a later one. `node ask` appends the timeout itself at the
deadline; if the worker's command is gone, an ask past `expires_at` reads as
`timed_out` at read time, as `stalled` is derived today, and the next append
records it.

`run show`, `run list` and each `run wait` run outcome gain:

```json
"open_ask": {
  "ask_id": "a-0042", "node_id": "n-0001",
  "question": "…", "options": ["…"], "default": "…",
  "asked_at": "…", "expires_at": "…",
  "escalated": false, "pending_age_secs": 12
},
"last_ask": { "ask_id": "a-0041", "outcome": "timed_out", "default": "…", "closed_at": "…" }
```

`awaiting_input` is **not** set for an ask. It keeps meaning a prompt that is
answered at the worker itself, and observers that show it as such stay right.

#### `run wait`

- An open, unescalated ask settles a default `run wait` **immediately**, with
  no grace. The grace exists so a short-lived prompt does not page a person;
  here the worker is blocked and the reader is its parent agent. The run's
  outcome carries `asking: true`, `open_ask`, and the reason
  `worker asks its parent`.
- An escalated ask does not settle the wait. `--terminal` ignores asks, as it
  ignores other attention.
- A timed-out or answered ask does not settle the wait: the worker is working
  again. `last_ask` tells an observer what happened.

#### Worker instructions

The generated run-context preamble's "Decisions and live replies" section
changes from "write a `success: false` report" to: ask with `node ask`, state a
default the brief already allows, continue on the answer or on the default,
and name in the terminal report any decision that was taken by default. Ending
with `success: false` remains for a decision with no acceptable default.

#### Not proposed

- Terminal-input injection or per-harness delivery adapters: the answer is the
  blocked command's output.
- A non-blocking message or note channel.
- A push hook to the parent. Parents observe through `run wait` and `run list`
  as they do for every other state.
- Startup silence (`startup-blocked-attention`): a worker that never reached
  its agent loop cannot ask.
- Any change to who may write to a run. Ask and answer use the same local
  state root and file permissions as every other event.

#### Acceptance

- A Claude worker and a Pi worker each ask, block, and continue on a parent's
  `run answer`, with the answer in the command's output.
- A killed or timed-out `node ask` invocation re-attaches to the same ask with
  the same key and the same deadline.
- With no answer, the worker gets `timed_out` at the deadline and a later
  `run answer` is refused with `ask_not_open` and the default taken.
- A parent's default `run wait` returns at once for a new ask, and blocks again
  after `run escalate`.
- A race of answer and timeout leaves exactly one closing event, and both
  commands report it.

## 5. Decisions for later review

1. **Storage in the Pi branch, not a new file.** Alternative: a sibling of
   `turn-marks.json`. Chosen because the fact belongs to one turn and then
   expires by position, survives restarts without daemon memory, and adds no
   store.
2. **The noun `handoff`.** Alternatives: `rail-state`, `conversation state`,
   `turn-claim`. Chosen because it names what the agent does (hands the turn
   over, or says it has not) and does not tie the CLI to one view's name.
3. **`waiting_workers` is bounded by observed workers.** Alternative: trust the
   agent until the next turn. Chosen so a wrong or stale claim cannot keep a
   reply out of Sinun vuorosi after the workers are gone.
4. **Handoff accepted only during the conversation's running turn.**
   Alternative: any time with a valid launch generation. Chosen because
   workers inherit the parent's context.
5. **Asks get a new `open_ask` field, not `awaiting_input: true`.**
   Alternative: reuse the flag for compatibility with today's wake. Chosen
   because Habitat's panel tells the person to answer `awaiting_input` in the
   worker's terminal, which would be wrong for an ask.
6. **No grace before an ask settles `run wait`.** Alternative: keep 180 s.
   Chosen because the reader is an agent and the worker is blocked.
7. **`run escalate` is separate from Habitat's `needs_answer`.** Alternative:
   one Habitat command doing both. Chosen because Taskfleet must not depend on
   Habitat, and a parent in a plain terminal escalates too.
8. **The five-minute unanswered rule gives the question to the person.**
   Alternative: leave it to the timeout. Chosen so a question is not lost
   silently when the parent cannot be woken.
9. **One open ask per node.** Alternative: several. Chosen because a blocked
   worker has one thing it waits for; several questions fit in one ask's text.
10. **The catch-up carries the question text** (bounded) into the woken
    parent's turn. Alternative: only tell it to read `run show`. Chosen because
    the question is the news; it is the same user's own data.

## 6. Open questions for Jari

1. **Is `handoff` the right name?** Recommendation: yes
   (`open-habitat agent handoff create|show|delete`). If you want the rail in
   the name, `agent rail-state` works with the same shape.
2. **Should `done` move an unread reply straight to Hiljaiset?**
   Recommendation: yes, keeping the unread mark on the row. If that feels like
   replies going missing, drop `done` from slice 1; the other two states carry
   most of the value.
3. **May Habitat wake a conversation that was not waiting, for a worker's
   question?** Today the rule is that a conversation that only created runs is
   not woken. Recommendation: yes for questions, once per ask, never for a
   conversation you stopped or archived: a question is addressed to the parent,
   a completion is only news.
4. **When you answer a worker's question yourself from the Workers panel, does
   it go through the parent conversation?** Recommendation: yes. The panel's
   action writes your message to the parent conversation naming the run (as
   *Kerro agentille* does), and the agent runs `run answer`. The daemon then
   keeps reading Taskfleet only, and the conversation stays the record. The
   alternative, the daemon running `taskfleet run answer` itself, is faster but
   would be the daemon's first write into Taskfleet.
5. **Default timeout.** Recommendation: 30 minutes for an ask, extended to
   4 hours when escalated to you. A night's work would need the worker's
   default anyway; a longer wait holds a worktree idle.

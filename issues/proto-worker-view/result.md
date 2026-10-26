# Worker view — round 1

Prototype: `issues/proto-worker-view/prototypes/worker-view/index.html`
(one offline file). [NOTES.md](prototypes/worker-view/NOTES.md) is Jari's guide,
in Finnish: what each variant is, how to try it, and the host-fact table.

## For Jari

**Recommendation: Kehys (2).** It opens in place of the parent conversation,
reached from the background strip as today. The worker band at the top stays
visible while scrolling. It names the parent conversation as a link back,
shows the issue and Pi · profile, and switches between **Keskustelu** and
**Pääte**. The worker's replies are labelled "Worker", and a result card says
whether the work landed or was preserved. You asked for the main conversation
UI without the composer and with a visual cue that this is a worker. Kehys is
that cue without changing where workers open. Hiljainen's dashed "Worker"
mark is too easy to miss once the read-only footer scrolls away, and then the
view looks like your own conversation.

The rail nesting shown in Kehys is a separate choice. Putting workers under
their parent in the sidebar needs spinoff facts for every listed
conversation, which the host does not have today, and a rule for when
finished workers leave the list. The band works without it. Sivupaneeli is
the best for watching a worker while writing to the parent on a desktop, but
on a phone it collapses into the same full-screen view. Keskustelussa's
inline card is a good later complement, because it shows progress where you
already are, but placing it in the parent's timeline needs a run → tool-call
link that does not exist.

**Questions:** is Kehys the direction? Should workers also nest in the
sidebar? And for Claude Code workers, which can only show the terminal
today, is that acceptable for now, or should Claude worker history become its
own work?

## Comparison axis and variants

The variants differ in how strong the worker cue is and where the view opens.
Content, the four states (running, waiting at a terminal prompt, landed,
failed with work preserved) and the Pi/Claude switch are identical across
them. The worker's conversation uses the production conversation markup and
CSS, captured from the synthetic lab (`baseline.mjs` → `extract.py` →
`captured/`). New presentation is only the worker identity, the result card,
the prompt notice, the side panel and the inline card, all in `round.css`.
The task brief appears as a "Pääagentti · tehtävä" bubble with a dashed
border, not as "Sinä". No variant has a composer. The raw pane is always one
action away, and for a Claude worker it is the default view, with the reason
stated.

1. **Hiljainen**: in place. The header gets a "Worker" status mark and a
   profile chip, and today's read-only footer names the parent.
2. **Kehys**: in place, with the persistent band, labelled replies, a result
   card and Keskustelu/Pääte tabs. The worker is nested under its parent in
   the rail.
3. **Sivupaneeli**: the parent stays with its composer, and the worker opens
   in a right panel. On a phone it is a full-screen sheet with a back button.
4. **Keskustelussa**: a worker card in the parent's timeline with its state
   and latest steps. It opens fully in place with a breadcrumb.

## Host facts

The table in NOTES.md is the full account. In short:

- **Pi workers:** the run → native session mapping exists. Taskfleet
  `node_transcripts` gives `session_id` and the file path, and the daemon
  already reads the file (`readSpinoffTranscript`). But the daemon flattens it
  to user/assistant/tool text. Rendering the conversation components needs
  the worker's session served through the same history contract and decoder
  as a conversation.
- **Claude Code workers:** no mapping. Taskfleet reports
  `support: unsupported`, `session_id: null` for a Claude node (observed on
  this round's own Claude run, 2026-10-25), and Habitat has no Claude Code
  history decoder.
- **Facts Taskfleet has that the spinoffs contract does not carry:**
  `awaiting_input` (for "waiting at a terminal prompt"), and profile, harness
  and model from `manifest.selection`.
- **Facts that exist nowhere:** the prompt text itself (only in the tmux pane,
  so it would need a capture-pane excerpt), an issue field, the landed commit
  SHA, per-conversation worker lists for the rail, and the parent tool call
  that started a run.
- **Already available:** state, parent attribution, title, branch and
  worktree, preserved work, report summary, and a read-only attach to the
  worker's window. Joining the attach to the worker view is new wiring, not a
  new host fact.

## Verification

From the repository root, with the lab started for the baseline:

```sh
node issues/proto-worker-view/prototypes/worker-view/baseline.mjs <scratch>   # lab running: OH_PORT_BASE=… scripts/lab.sh start
python3 issues/proto-worker-view/prototypes/worker-view/extract.py <scratch>
node issues/proto-worker-view/prototypes/worker-view/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright node issues/proto-worker-view/prototypes/worker-view/check.mjs
```

- `check.mjs` passed 40 renders: 4 variants × 4 states with Pi, plus the
  Claude fallback, each at 1440 px light and 390 px dark. It found no
  console errors, no network requests and no horizontal overflow. It also
  clicked through stage and tool disclosure, the details popover, the
  terminal from the prompt notice, Kehys's terminal tab, closing and
  reopening the side panel, the inline card's open and back, and the
  keyboard variant switch. Results are in
  `prototypes/worker-view/evidence/checks.json`.
- 41 AVIF screenshots are in `prototypes/worker-view/evidence/`, plus the
  current spinoff view as a baseline (`nykytila-*`). Ran on Birch with the
  worktree's own `npm ci` and the user's cached Chromium. Scratch was in
  `/var/tmp/oh-proto-worker.eGwBEk`.
- Self-review looked at the screenshots of every variant in both widths and
  fixed four problems: the band and the details popover were held to the
  column width by production's frame rule; the profile chip crowded the
  phone header; tool targets overlapped tool names on a phone; and the parent
  composer showed Stop and Steer from the captured busy turn.
- No production code changed, so the gate was not run.

# Worker view — round 2

Prototype: `issues/proto-worker-view/prototypes/worker-view-2/index.html`
(one offline file). [NOTES.md](prototypes/worker-view-2/NOTES.md) is Jari's
guide, in Finnish: what each variant is, how to try it, and the host facts.

Built on Kehys, per Jari's verdict of 2026-10-26. Workers are not nested in
the rail; the parent's row keeps production's working-worker mark.

## For Jari

**Recommendation: Välilehti (1).** It is the Kehys you accepted with two
additions. First, a Claude Code worker opens on the Pääte tab. A line above
the terminal says why: Habitat cannot read Claude Code history yet, or the
session has not been found. When the history becomes readable, the
Keskustelu tab gets a dot and the line offers **Näytä keskustelu**. Nothing
moves under the reader, and a worker whose history is already readable opens
straight in the conversation. Second, the composer's place holds a fixed
notice: **Workerille ei kirjoiteta suoraan**, then what the main agent can
do, and **Kysy pääkeskustelussa ›**.

Vaihtuu itse (2) switches to the conversation by itself, which saves a
click. Its question box, which drafts into the parent's composer, is the
most direct way to ask. But the box looks like the composer you asked to
remove, and for a Claude worker it suggests more than the parent can do.
Pääte keskustelussa (3) has no mode switch at all and fits the most
conversation on screen. Its band-only "Kysy" is too easy to miss to answer
"why can't I type here". Its brief-first idea could be added to 1 later.

**What preparing the round found:**

- **The main agent can message only a live Pi worker.** `taskfleet run
  message` reaches only a Taskfleet-launched Pi worker with the message
  adapter. Acceptance does not prove the worker read the message. A Claude
  Code worker, or one that has finished, cannot be messaged.
- **The notice depends on the worker.** It has three versions: a live Pi
  worker (the main agent can message it), a live Claude worker (the main
  agent sees its state), and a finished worker (the main agent has its
  report).
- **A steering message cannot answer a terminal prompt.** Round 1's prompt
  card said the main agent could answer the prompt. That was wrong, and
  the card is corrected here.

**Questions:**

- Should the view switch by itself (2), or only when the person chooses (1)?
- Is the band's "Kysy" (3) enough, or does the notice need to be visible?

## Host facts

- **Claude Code session file:** it exists from the worker's start at
  `~/.claude/projects/<worktree path with / and . as ->/<uuid>.jsonl`.
  This round's own Claude worker is an example: its file appeared in the
  same minute as its worktree. Taskfleet does not record it: the handshake
  holds only `pi_session_*`, and `node_transcripts` says
  `support: unsupported`. The worktree path is per run, so the directory
  identifies the run. A restarted worker can leave several files.
- **Claude Code history reader:** Habitat has none. `readSpinoffTranscript`
  returns `unsupported` for anything but Pi. So "Habitat ei lue" is today's
  state, and "Ei vielä löytynyt" is a short start-up gap once a reader
  exists.
- **The brief:** it is in `~/.taskfleet/runs/<run>/prompt.md`. Neither
  `run show` nor the daemon exposes it. Variant 3 needs it before history
  exists.
- **Whether the parent can message the worker:** this follows from facts
  the spinoffs contract already carries, harness and state.
- **A finished worker's terminal:** `run merge` tears the window down. For a
  failed run this was not verified; the prototype assumes the window is
  closed too.

## Verification

From the repository root:

```sh
node issues/proto-worker-view/prototypes/worker-view-2/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright node issues/proto-worker-view/prototypes/worker-view-2/check.mjs
```

- **Renders:** `check.mjs` passed 38 renders at 1440 px light and 390 px
  dark, with device scale factor 2. Each of the 3 variants was rendered
  with Claude history pending, unreadable and just arrived, with a Pi
  worker, and as a landed worker. Variants 1 and 3 were also rendered with a
  Pi worker waiting at a terminal prompt and with a failed Claude worker
  whose history is unreadable.
- **Interactions it clicked:** history arriving live through the lab button
  in each variant. Variant 1 must not switch by itself. Variant 2's
  **Takaisin päätteeseen**, and its question carried into the parent's
  composer and back. Variant 3's terminal row. The details popover and the
  keyboard variant switch.
- **What it checked for:** no console errors, no network requests, no
  horizontal overflow, no composer in a worker view, and an
  ask-the-parent notice in every render. Results are in
  `prototypes/worker-view-2/evidence/checks.json`. The 40 AVIF screenshots
  are beside it.
- **What was reused:** round 1's captured production DOM and CSS
  (`prototypes/worker-view/captured/`); the lab was not rerun.
- **Self-review:** looked at every variant's screenshots at both widths and
  fixed four problems. Production's frame rule collapsed the terminal body.
  The back-to-worker crumb had lost its styles. Variant 2 hid its
  explanation on a phone. Finished workers offered a terminal that no longer
  exists.
- **Gate:** no production code changed, so the gate was not run.

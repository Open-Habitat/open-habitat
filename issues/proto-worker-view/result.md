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

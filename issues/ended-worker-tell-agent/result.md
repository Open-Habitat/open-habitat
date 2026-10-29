# Result

Implemented round 3 with Jari's choice **Vanhempi**:

- `internal/daemon/spinoffs_linux.go`: the Workers list shows an ended run
  only while its preserved branch/worktree exists or its worktree directory
  is still on disk (`preserved`); the worker's own view (`?run=`) still
  opens any run.
- `web/src/app/workerRequests.ts`: the request text and each row's phase,
  derived from the parent's queue, held messages and history (the request
  names `Taskfleet-ajo <run_id>`); nothing is stored.
- `BackgroundStrip.tsx`: red ball per unfinished row, ring while handled,
  *Kerro agentille* on rows, *Käsittele kaikki* in the Päättyneet heading
  (two or more) and beside the pill (one or more), leaving rows shown
  briefly then folded away.
- `BrowserConversation.tsx` sends through the composer's own path (send,
  follow-up during a turn, held send starting a resting Pi). `HistoryView`
  (read-only parent) starts a new conversation (`newConversationAsk.ts`).
- The worker view's result card carries the same button; it returns to the
  parent, which sends.

Verification: `go test ./internal/daemon` (spinoff tests incl. listing
filter), contracts, web unit/component checks, browser specs
`ended-worker-ask.spec.ts` (new), `spinoffs`, `worker-panel`, `worker-view`.
Review: `/llm-review` (gpt-6-astra) found three phase-derivation bugs, all
fixed with tests.

## Decisions for later review

- **No new host surface.** Phases are derived in the browser from the
  parent's history/queue/held list; the request is the person's message
  through the existing routes. Alternative: a daemon read joining messages
  to runs. Chosen because the browser already holds the parent's state.
- **Merged run with its worktree left counts as listed (`preserved: true`)**
  and gets its own *Kerro agentille* ("siivotaanko se"), but is not part of
  *Käsittele kaikki* and has no red ball. Detected by `Lstat` of Taskfleet's
  `worktree_path` (a symlink does not count). Alternative: a `git branch`
  check per run; rejected as an extra native call per row.
- **Failed runs without work on disk no longer appear at all** (before: a
  grey ✕ row). Follows "the list is the real state".
- **"acting" lasts only while the answer is the newest message and the
  agent works**; after that turn a row still on disk is unhandled again,
  even if the agent asked a follow-up question. Alternative: track the
  dialogue further, which needs more inference from free text.
- **The worker view's button navigates back to the parent** and the parent
  sends (waiting up to 10 s for it to be able to send, else it opens the
  panel so the row's disabled button says why). The prototype kept the
  worker view open; the parent's send path only exists in the parent view.
- **Read-only parent fallback** remembers run→new conversation in this
  tab's sessionStorage (identity- and parent-scoped); the row then says
  only "pyyntö lähetetty · uudessa keskustelussa" with *Avaa keskustelu*.
  It does not read the new conversation's phases.
- **No `cancelled`/`interrupted` row states.** Cancelled still reads as
  "ei mergetty"; an interrupted run stays a live "tila ei tiedossa" row.
  The agent reads Taskfleet itself; a contract enum change was left out.
- **The pill's red corner dot is replaced by the balls**; data attributes
  `data-unfinished`/`data-handled` carry the counts for tests.
- **Fake Pi's "hylkää" rejection now matches only a message starting with
  it**, since the request offers "mergeä, jatka tai hylkää".

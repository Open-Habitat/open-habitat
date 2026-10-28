# Result

Both parts of Jari's 2026-10-28 direction are implemented.

- **Idle stop waits for the person.** The daemon's existing `POST …/presence`
  now also records when the person was last there. The idle reaper stops Pi
  only after ten minutes since Pi's last observed work *and* since the latest
  presence report. A room stop still happens when a place is needed, but it
  now stops the conversation seen longest ago (latest use or presence). The
  browser now reports presence for more than the composer and stream: a key,
  press, wheel or touch anywhere on the conversation page while the tab is
  visible (this covers the terminal dock, the in-page editor and the top bar),
  and every 30 s while the VS Code frame has focus in a focused, visible
  window. Reports go at most once per 20 s. The browser's own recap hold is
  unchanged.
- **No card when nothing happened.** A rest is news only when a background
  process was cut off, a turn was cut (the branch's last turn message is a
  prompt, tool call or tool result that nobody answered), a run settled, or
  Taskfleet could not be read. Otherwise the browser shows no card, no
  *Lepää* and no wake placeholder, and the companion writes no catch-up, so
  there is no history marker and no explanation for the agent. This applies
  to every cause, including a Habitat restart. Typing still wakes Pi quietly
  ahead of the message. The rest report (`rest.schema.json` via history
  `restart`) carries `interrupted_turn`. The card names a cut turn ("Agentin
  kesken ollut työ katkesi.") and the agent's catch-up says it too.
- **A missing Taskfleet binary counts as an empty inventory**, on both the
  daemon side and the companion side. Before this change it counted as
  unread, so every rest on a host without Taskfleet would still have shown a
  card.

The rule is in `internal/AGENTS.md`.

## Evidence

- Go: the whole `./internal/daemon` package passes. New tests:
  `TestIdleStopWaitsForThePersonsAbsence` covers a present person kept, then
  stopped ten minutes after their last report. `TestPresenceReportHoldsTheIdleStop`
  goes through the handler. `TestBranchScanSeesACutTurn` covers answered,
  unanswered prompt, open tool call, unanswered result, aborted, a `!command`
  or custom message after a cut, and the sibling branch. The rest report
  asserts `interrupted_turn` and checks that no Taskfleet means available.
  `TestRestartCatchUpIsPresentedFromItsDetails` asserts the projection. The
  real-Pi `TestProcessResumeCatchUpAcrossDaemonRestart` now expects no
  catch-up after a restart with nothing to tell.
- Node: `catch-up.test.mjs` covers a quiet rest giving no message, a cut turn
  being told, the cut-turn rule, and missing Taskfleet treated as empty.
- Web: `test-focused.sh --area web` passes. New tests: `rest.test.tsx` (a
  quiet rest is hidden, and a failed refresh shows the card),
  `recapHold.test.tsx` (page input and a focused editor frame report
  presence without holding the recap) and `RestartNotice.test.tsx`
  (`restHasNews`, the cut-turn sentence).
- Contracts regenerated; `--area contracts` passes.
- Browser (Birch, `OH_BROWSER_WORKERS=2`): `rest-card.spec.ts` passes all 3,
  including the new "a rest with nothing to tell shows no card, and typing
  still wakes Pi". The phone case now has a settled run so that its card has
  news. Also passing: queued-send (13), process-tray (6), spinoffs (5),
  long-pause-composer (2), browser-conversation "idle stop" (1), and lab
  lab-conversation and lab-composer-focus `--tag recap` (4+2) and
  lab-idle-pi-slots (2).
- Review: `/llm-review` with gpt-6-astra as finder and claude-fable-5-1 as
  verifier. Both findings were confirmed and fixed: a failed refresh could
  leave a quiet rest hidden, and a `!command` or custom message erased a cut
  turn. `/assess-findings` marked both FIX, applied.

## Decisions for later review

1. **A visible tab alone is not presence.** The direction listed "näkyvä
   välilehti". Only input in a visible tab counts, plus focus in the VS Code
   frame, whose input the page cannot see. *Alternative:* treat a visible tab
   as presence. *Why not:* a tab left open on an unattended screen would keep
   Pi running for good, and the daemon's automatic recap, which listens to
   the same signal, would never come while the tab was open.
2. **Page-wide input also postpones the daemon's automatic recap.** This
   reuses the one presence signal, as the brief asked, instead of adding a
   second kind. Someone working in the terminal beside the conversation gets
   the recap three minutes after they stop. The browser's own recap hold is
   unchanged.
3. **An unsent draft keeps Pi alive indefinitely.** The draft's 30 s report
   continues, as it did for the recap, including in a background tab. *Alternative:*
   count drafts only in a visible tab. Left as is: an idle Pi costs memory
   only, and a room stop still frees its place when needed.
4. **Room stops ignore presence.** When all four places are taken, an idle
   Pi is still stopped for the new conversation. It is the one seen longest
   ago, so the person present is stopped last.
5. **A run still working is not news on its own.** If its wait was cut off,
   the cut process already makes it news.
6. **The card waits for the report.** The rest card used to appear at once
   and fill in later. Now it appears only once the report has been read and
   has news, or once the read has failed.
7. **A cut turn is read from the native branch, not the daemon's memory.**
   This works the same after a restart. An assistant reply saved as `aborted`
   counts as ended. So a turn the person aborted, or that Pi saved as
   aborted on shutdown, is not called cut. A custom message that starts a
   turn and is killed before the first token reads as whatever preceded it.
8. **Missing Taskfleet is an empty inventory.** This keeps the "unread is
   not empty" rule for a Taskfleet that fails to answer. It drops that rule
   for one that is absent from the agent's PATH, where no run can exist.

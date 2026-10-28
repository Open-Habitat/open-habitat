# Result

Reproduced in the lab (`pi-deltas`, "pitkä virta"). The existing spec's
"live" selection was in fact not in the reply: the chosen line lay under the
agent header, so the drag selected header and sidebar text. With the drag
fixed to hit the reply, the selection was lost at settle, for three reasons:

- **The reply vanished for one commit.** At the end of the run the daemon
  delivers every saved entry of the run at once (person, first assistant
  message, tool result, answer). The first assistant entry was already known,
  but its arrival retired *all* streamed assistant fragments, including the
  answer's, 3 ms before the answer's own entry arrived. The stage lost its
  reply element and mounted a new one. Now a saved message whose tool calls
  already ran retires only what was streamed before their execution
  (`applyTurnEvent` in `web/src/app/conversationEvents.ts`).
- **Live and saved text rendered differently.** Live text was `<Markdown>`;
  saved text `OrderedBlocks > ReadableBlock` keyed by entry. Both now render
  through `TurnText` (`HistoryView.tsx`), an unkeyed `ReadableBlock` that
  resets its loaded block content itself when its source entry changes. This
  also covers a long reply that settles into the daemon's 16 KiB preview
  (`readable` block).
- **The turn's key changed** when the live row (`live-turn-<command>`) was
  replaced by the history item (`turn:<entry>`). `useTurnIdentity`
  (`web/src/app/turnIdentity.ts`) gives the history turn that takes over a
  live row the row's key for as long as the conversation is open. In this
  lab flow the turn was already history-named before it settled, so this
  part is covered by `turnIdentity.test.ts`, not by the browser spec.

## Evidence

- `web/tests/lab-reply-selection.spec.ts` now marks the turn and the reply
  holding the live selection, waits for the turn to settle, and requires the
  same elements and the same selection. With only the event fix reverted it
  fails on the replaced reply element; with only the rendering/identity
  change reverted it fails on the lost selection; with both it passes.
- Unit: `conversationEvents.test.tsx` (re-delivered entries keep the later
  answer; fails on the old rule), `turnIdentity.test.ts`,
  `HistoryView.test.tsx` (paragraph element kept from streamed text to a
  saved preview).

## Checks

- `./scripts/test-focused.sh --area web`: 129 files, 823 tests passed.
- `lab-reply-selection`, `lab-conversation-scroll` (5), `lab-live-turn`,
  `lab-long-stream`, `lab-open-at-end` (3): passed.
- Whole browser suite (`--area browser`): 422 passed, 3 skipped, 1 failed:
  `browser-shell.spec.ts:650` (typed input lost in the second shell). It
  passes 12/12 alone and touches no code changed here; filed through intake
  as `dreadfully-perpetual-songs`.
- Review: independent `/llm-review` (finder gpt-6-astra, verifier
  claude-fable-5-1) because live session-state handling changed. Two
  findings, both confirmed and fixed: the 16 KiB preview still remounted
  (first revision keyed preview blocks), and adoption failed when a catch-up
  history read showed the saved turn beside the live row. Verifier follow-ups
  also applied (scope reset clears the pending row; a block read for a
  previous source is dropped).

## Decisions for later review

- **A long reply still shrinks to its preview when it settles.** The browser
  holds the whole streamed text but shows the daemon's 16 KiB preview with
  *Lataa lohkon sisältö* afterwards, as before. The element and the selection
  in the kept part survive; text beyond the preview disappears until loaded.
  Alternative: keep showing the streamed text when the saved block is a
  prefix of it. Not done: it would show text the native history did not
  confirm, and it is a product choice beyond this bug.
- **Tool and thinking rows in an opened stage still remount** when they move
  from live to saved (different components: `liveNode` vs `OrderedBlocks`).
  This happens mid-turn as each call is saved, not only at settle, and a
  tool's expansion survives through the store. Unifying them is a larger
  rewrite of the live work rows; left until it is observed to matter.
- **Retirement rule.** A saved assistant message whose tool calls have
  `tool.*` fragments retires only the fragments before the first of them;
  one without calls, or whose calls have not run, retires all streamed
  assistant content as before. Alternative: skip retirement for an entry the
  window already has. Rejected: a history read can bring an entry before its
  event, and the streamed copy would then stay duplicated.

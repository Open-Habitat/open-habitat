# Result: interim replies as stages (Vaiheet, no turn head)

Production now draws a Pi turn as stages. The turn head row
(`PI · <model> · N ajatusta · N työkalua · 0:44`) is gone. Each stage that did
work starts with a quiet summary row, for example
`› 1 ajatus · 2 työkalua · git rev-list --count origin/main..HEAD`. The row is
a button with `aria-expanded`, and it opens only that stage's work. The message
that closes the stage follows it. Every text before the last one is a
**Välivastaus** card (speech icon, accent label, copy button). The last text
of a settled turn keeps **✓ Vastaus valmis** and the model. While a turn runs,
its current stage is the existing information row
(`Näytä työ · ● Agentti työskentelee · Ajaa … · 0:31`), shown in that stage's
place. Pi's text streams after it as **Vastaa**.

## Where the code is

- `web/src/components/AgentTurn.tsx`: `AgentTurn` now takes ordered `steps`
  (thinking / tool / other / text) and splits them into stages itself
  (`turnStages`, `stageSummary`, `StageRow`).
- `web/src/components/Conversation.tsx`: `InterimMessage`.
- `web/src/app/HistoryView.tsx`: `timelineItems` turns saved entries into
  steps. When it is given a running turn's live tail (`LiveTurnInput`), it
  continues the open saved turn instead of drawing a second turn.
- `web/src/app/BrowserConversation.tsx`: builds the live steps.
- Storybook: `Production/Turn stages` (several interim replies, long and
  back-to-back, none, one with a failure, live after an interim reply, live
  streaming). Playwright: `web/tests/lab-turn-stages.spec.ts` covers history,
  keyboard, Axe WCAG A/AA, phone light/dark and a live turn. The lab session
  "Miksi CI epäonnistuu macOS:llä?" carries the round's invented fleetrepo turns.

## Two production faults fixed on the way

- **The running turn was split in two.** Mid-turn, the saved part of the turn
  reached the browser by history re-read and was drawn as a settled turn: a
  "Vastaus valmis" card containing a tool row. The live part was drawn as a
  second turn. They are now one turn, named after the person's message
  (`turn:<user entry>`), so the turn keeps its identity and the reader's open
  stages when it settles.
- **Interim replies showed twice while a turn ran.** The daemon publishes
  `history.entry` only when the turn settles, so the streamed fragments of an
  already-saved message stayed. The browser now drops streamed text and
  reasoning that precede a saved tool call, the same way it already dropped
  the saved call itself. No host change was made.

## Comparison with the round

`screenshots/` pairs each lab capture (PNG with an inert HTML twin) with the
round's direction 3 image (`round-3-vaiheet-*.jpg`): `vaiheet-kiinni`
(desktop, closed), `vaiheet-auki-tumma` (all stages open, dark),
`vaiheet-puhelin` (390 px), `vaiheet-elava` and `vaiheet-elava-auki` (a live
turn after its interim reply, work closed and open). The only intended
difference is the missing turn head. Production's existing reply and tool
cards replace the prototype's; there are no clock times on cards, because
production history has never shown them.

## Decisions for later review

- **Label "Välivastaus".** This is the round's working name, kept because Jari
  did not answer the question. Alternatives were no label (icon only) or
  "Pi kirjoitti".
- **No clamping.** A long interim reply is shown in full, as in the round. A
  clamped interim reply is partly hidden, which is what the original complaint
  was about. Alternative: clamp to a few lines with "Näytä koko viesti".
- **The model appears only on the final answer.** The turn head was the other
  place that showed it, and it is gone. An interim card has no model.
- **The duration of a settled turn is no longer shown.** It was only on the
  turn head, and Jari asked for "only the stage rows" in its place. The running
  clock remains in the information row. Alternatives were the final answer's
  header or the last stage row; both add weight to the parts Jari wanted quiet.
- **Failed tools are counted in their own stage row**
  (`1 työkalu · 1 epäonnistui · npm test`, in the error colour), because the
  turn head that used to count them is gone.
- **The stage row names the last tool call.** That is a bash command's first
  line, a file tool's `read <path>`, or otherwise the tool's name. A history
  page never carries tool arguments: `history_block_read_linux.go` keeps them
  out because they may contain credentials. So a closed stage reads its last
  call's block through the existing per-block endpoint, as an opened tool row
  already does. That is at most one small request per stage row shown. It also
  means a command line can now be visible with the work closed. I did not
  change the daemon to inline short arguments: that would change a stated
  security rule, which is Jari's decision.
- **Streaming text is "Vastaa" until the next step arrives.** Whether a
  streaming text is an interim reply or the answer is only known when a tool
  call or thinking follows it, or when the turn settles. The round used
  "Kirjoittaa" for a live interim reply; production cannot tell the two apart
  in time.
- **The current stage has no summary row while it runs.** As in the round, its
  information row stands in its place, and Näytä työ opens only that stage. A
  stage that was open while it ran stays open when it closes or when the turn
  settles, so the view does not jump.
- **Turn ending without a final text.** A turn that ends with work and no text
  after it (aborted or stopped) shows that work as a stage row and no
  "Vastaus valmis". Its earlier texts stay interim replies.
- **The design library is unchanged.** `design-system/prototypes/lib`
  (`lanka`, `playLive`) still draws the old turn head. The round's renderer
  remains the reference for direction 3. Moving the stage pieces into `lib/`
  is left for the next prototype round that needs them.

## Evidence

Synthetic lab only, not the live server: fast web checks
(`scripts/test-focused.sh --area web`), Storybook build, lab specs
`lab-turn-stages`, `lab-conversation`, `lab-live-turn`, `lab-idle-pi-slots`,
`lab-open-at-end`, `lab-long-stream` and `lab-foundation`, and the
default-suite specs `browser-conversation`, `file-tool-cards`,
`thinking-title`, `quiet-work`, `thread-fill`, `design-system`,
`tool-header-layout`, `native-history`, `resilience-states` and `queued-send`.
All passed. Captures come from `web/lab/capture-interim-stages.mjs`.

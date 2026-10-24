# Result

A closed stage row of an agent turn reads `1 ajatus · 2 työkalua · 4 min 00 s`: counts, failures when there are any, and how long the stage took. The last command is no longer shown or fetched; opening the row still shows every thinking and tool step as before. The final reply header reads `Vastaus valmis` without the model id, and an assistant message outside a turn no longer shows the model as its state. The live working line (`Näytä työ · … · 0:31`) is unchanged.

## Decisions for later review

- **Source of the time.** Every native history entry carries the timestamp Pi wrote when it saved that entry, which is when that piece was complete. A stage runs from the entry before it (the person's message for the first stage, the entry carrying the previous stage's reply for later ones) to the entry carrying the reply that closed it, or to its last work entry when no reply closed it. If either end has no timestamp, or the turn did not start from a saved message of the person, the time is omitted rather than estimated. Because Pi saves an assistant entry only once its tool calls are written, a stage whose closing reply shares an entry with the next stage's first tool call starts the next stage after that call was generated; the difference is the model's writing time for that call.
- **Format.** Under a minute `14 s`, under an hour `1 min 05 s`, longer `2 h 03 min`.
- **No model anywhere in reply headers.** The issue named the final reply; the model also appeared as the state of a lone assistant message, and that was removed for consistency. The conversation header's model chip remains the one place that names it.

## Validation

- `npx tsc --noEmit`, `biome check` on touched files, `vitest run` (whole web unit suite) — passed. New unit cases: stage time from the previous entry to the closing one, unknown ends leave the time out, Finnish duration format boundaries; `HistoryView.test.tsx` derives the times from native entry timestamps through `timelineItems` and checks that a closed stage reads no block until it is opened.
- `./scripts/test-focused.sh --area browser --lab --spec lab-turn-stages.spec.ts` — 3 passed against the host-backed synthetic lab: each closed row carries an elapsed time and no command, no reply names the model, rows precede their replies, phone width fits.
- Captures from the synthetic lab (`web/lab/capture-turn-summary-plain.mjs`): [desktop light](review/stages-1440-light.png) · [HTML](review/stages-1440-light.html), [desktop dark](review/stages-1440-dark.png) · [HTML](review/stages-1440-dark.html), [390 px](review/stages-390-light.png) · [HTML](review/stages-390-light.html).

No Go or contract change.

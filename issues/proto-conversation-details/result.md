# Result

Three small prototype rounds, one per item. The three decisions are independent of each other. One picker with three axes would have tied them together: direction 2 would mean a given notice *and* a given button *and* a given card, so Jari could not pick, say, the first notice with the third card. Each round has one axis, three directions and the same content in all three.

Build from `design-system/prototypes/`:

```
node build.mjs rounds/2026-10-16-epaonnistunut-komento
node build.mjs rounds/2026-10-16-arkistoitu
node build.mjs rounds/2026-10-16-viimeisimpaan
```

All three passed `check.mjs` (light, dark and phone, clean console). Each round also has a focused Playwright pass that exercises its interactions; details are under each round.

## 1. Failed bash card: `2026-10-16-epaonnistunut-komento`

**Axis:** how loud the failed card is and how much it says about the cause.

Content: two failures in history plus one in the live turn. The history failures are an argparse error with exit code 2 and a `pip download` that hits Pi's 30-second timeout. The live turn's pytest run has one failing test, so Pi reports exit code 1.

| Direction | What it decides |
|---|---|
| **Kulma** | The card looks like a successful one. Only the corner (`× epäonnistui`) and the red node on the thread show the failure. Pi's own status line ("Command exited with code 2") stays in the output, as Pi stored it. No new host fact is needed. |
| **Syy kulmassa** | The corner names the cause: `× paluuarvo 2`, `× aikakatkaisu 30 s`. Pi's status line leaves the output because the corner already says it (no duplicate, per Jari's pilot.65 feedback), and its original text is in the corner's tooltip. The card has a red left edge. |
| **Viimeinen rivi** | Same as Syy kulmassa, plus the closed card shows the last output line under its header. For pytest that is "1 failed, 34 passed"; for argparse it is the error message. The failure can be read without opening the card. The line hides when the card opens. |

Shared by all three directions: the thread summary adds a red "· 1 epäonnistui" ("2 ajatusta · 4 työkalua · 1 epäonnistui"). Work is hidden by default, so this is the only place a failure shows before the thread is opened. None of the directions keeps production's red tint over the whole card.

**Host facts the view assumes:**
- Pi marks a failed tool result only with `isError`. The daemon already passes it on as `is_error`, so Kulma and the summary count use only existing facts.
- For bash, Pi gives no structured exit code; it throws, and `details` are lost. A failed result's text ends with Pi's own fixed-format status line (`Command exited with code N`, `Command timed out after N seconds`, `Command aborted`; source: Pi's `core/tools/bash.js`). Syy kulmassa and Viimeinen rivi need the daemon to read that last line into a structured field. Where it does not match (another Pi version, an extension tool), they fall back to Kulma's `epäonnistui`.
- Viimeinen rivi shows the last non-empty line before that status line literally. It does not infer from that line that an error happened.

Checked: every card closed and opened in every direction, light, dark and phone; the live failure appears in place; the summary count is right.

## 2. Notice after archiving: `2026-10-16-arkistoitu`

**Axis:** how long Palauta stays offered as a floating notice, and where the way back continues afterwards.

Archiving works as in production since 14.10: no confirmation, and the window moves to the workspace view. The workspace view here is only a stand-in (name, path, Keskustelut, Arkisto); its real design is proto-workspace-page's round.

| Direction | What it decides |
|---|---|
| **Hetki alhaalla** | A dark bar at the bottom centre: "Arkistoitu **Status-skripti**", Palauta and ×. It stays 8 s, and the time pauses while the pointer or focus is on it. After that, the way back is the Arkisto section's "Palauta näkyviin". |
| **Kortti ylhäällä** | A light card in the top corner, where the archive icon was: "Keskustelu arkistoitu · Status-skripti on nyt työtilan Arkisto-osiossa. Pi:n historia säilyy." with Palauta. No timer: it stays until closed or until the user navigates elsewhere. |
| **Arkistoon** | Like Hetki alhaalla, but when the notice leaves (timeout, ×, Esc) it moves onto the archived conversation's row in the Arkisto section. The row stays highlighted while the page is open, which shows where the conversation went. |

Shared by all three: Palauta restores the conversation and returns to it (undo means back where you were). Esc closes the notice. Focus moves to the workspace heading after archiving, because the focused archive button disappears. The notice is `role="status"` and does not take focus. Reduced motion removes the movement.

**Host facts:** none new. Archive and restore exist (`changeArchive(agent, false)`, a visibility annotation; restore does not start Pi). A refused restore (409, state changed) is not drawn. It would keep the notice and show the existing error text in it. The notice is transient browser state and is not stored anywhere.

Checked in every direction: archive → workspace view and notice; 9 s timeout (Kortti ylhäällä stays, Arkistoon hands over to the highlighted row); Palauta → back in the conversation and in the sidebar; Esc; the row's "Palauta näkyviin". One bug found while testing was fixed: a notice removed while focused still received `focusout` and restarted the timer, which closed the next notice.

## 3. Viimeisimpään: `2026-10-16-viimeisimpaan`

**Axis:** what the button tells about what is below, and where it sits.

| Direction | What it decides |
|---|---|
| **Nuoli** | A 36 px round arrow at the conversation column's bottom-right edge. A small accent dot means something new has arrived since the reader left the end. |
| **Kertova** | A pill at the centre says what is below: "● Pi työskentelee 0:42 ↓", "● Uusi vastaus ↓", or just "Viimeisimpään ↓". Production's "Uutta sisältöä (n)" count is replaced by these words. |
| **Kentän reunassa** | A band across the column attached to the top edge of the recap card or composer. The state is on the left ("Pi työskentelee 0:42", "Uusi vastaus alempana", "Luet aiempaa keskustelua") and "Viimeisimpään ↓" is on the right. It does not float over the text. |

Shared by all three: the button shows when the end of the conversation is more than 120 px below the view. Visibility is recalculated on scroll and on every height change (expanding or collapsing blocks, streaming), as in the latest-button-visibility fix. A click or Enter scrolls smoothly to the end (instantly with reduced motion), following of the newest content resumes, and the button hides. While it fades out it keeps its text, so it does not change size. Only its text is updated, never the element, so clicks and hover survive the clock. The accessible name carries the state ("Viimeisimpään, Pi työskentelee"). The button sits just above whatever follows the conversation, so it never covers the recap card or the composer. On first load a toast says to scroll up.

**Host facts:** none new. The view uses layout plus the live turn's working/settled state and the confirmed reply, which the browser already has from the event stream.

Checked in every direction, light, dark and phone: scrolling up during the work shows "working", the reply arrives as "reply", and the click returns to the end. On desktop light: 60 px up is still hidden; opening the turn's work makes the button appear without scrolling, and closing it hides the button again; keyboard Enter works.

## Questions for Jari

1. Failed card: may the daemon read Pi's own status line ("Command exited with code 2") into a field so the corner can say "paluuarvo 2"? design.md says an error or exit code is not inferred from raw text. This line is Pi's fixed-format status rather than the command's output, but it is still text. If not, Kulma is the only one of the three that can be built.
2. Archive: should Palauta return to the conversation (as here), or restore it while staying on the workspace view?
3. Viimeisimpään: is the count ("Uutta sisältöä (3)") worth keeping somewhere? With work hidden, a count of blocks says little, so Kertova replaced it with words.

## Proposals for the library (`lib/`, not changed here)

- A `failed` state for tool rows (`fail: { exit | timeout }`) in `pieces.js`/`live.js`, after a direction is chosen. Also mark the live pytest call in `fixture.js` as failed: a pytest run with a failing test exits 1, so the library currently shows something Pi would not report.
- `app.js` still archives through a confirmation dialog, while production has archived directly since 14.10. The chosen notice should replace `askArchive` in the library, along with a workspace view once proto-workspace-page is chosen.
- The chosen Viimeisimpään becomes a library piece placed after `#stage` (the `jl-host` pattern), so later rounds see it.

## Decisions for later review

- Three rounds instead of one round with three axes, for the reason given at the top.
- The `prototype` skill could not be invoked by an agent (`disable-model-invocation`). The round followed `design-system/prototypes/AGENTS.md` ("Prototyyppiworker") and the conventions of earlier rounds instead.
- The current production view was read from today's lab screenshots in `issues/tool-failure-notice/` and `issues/latest-button-visibility/` plus the component code, not from a fresh lab run. They are the same code from the same day, and alder had just run out of memory.
- Shared choices that are not one of the axes: the "1 epäonnistui" summary count, the 120 px threshold, the 8 s notice life with pause, Palauta returning to the conversation, focus to the workspace heading after archiving.
- Kulma keeps Pi's English status line visible in the output, as Pi stored it.
- When the focused Viimeisimpään button hides after a jump, focus falls to the document. The library's stage is not focusable; production should move focus to the conversation region.
- Review level: no architecture sketch was needed (the issue says so), so no independent review. The prototype code with synthetic content was reviewed by me through the interaction scripts above, which found and fixed two defects: the focusout timer and the `.out` class name colliding with the library's output box.
- To run the checks, the worktree used a temporary untracked symlink `web/node_modules` → the main checkout's; it was removed before merge.

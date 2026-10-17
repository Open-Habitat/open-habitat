# Result: the background strip is Merkit, with a process window

## Change

- **`web/src/components/BackgroundStrip.tsx`** replaces the process tray and
  the spinoff status line above the composer (browser conversation and
  read-only native history). Two pills, *Spinoffit* and *Prosessit*, with an
  icon and the count of running items; a pill is hidden when its kind has
  nothing to show. The bell sits on a pill's corner only when the agent's
  turn has ended and it waits on something of that kind; the red dot sits on
  the spinoff pill while a spinoff ended unmerged and its branch or worktree
  still exists (Taskfleet's `preserved`), however often it has been looked
  at. A pill opens a floating panel above the strip with the two kinds as
  tabs; Escape or the close button returns focus to the pill. Rows are one
  line: running items first (waited ones on top), finished ones folded under
  "N päättynyttä", which opens by itself when it holds the red dot.
  - Spinoff rows open the read-only spinoff view; a waited spinoff has the
    bell and *Lopeta odotus*, which stops only the wait process. A wait whose
    run Taskfleet does not list still shows as its spinoff, "Tila ei
    tiedossa". The footnote says spinoffs are Taskfleet runs the browser only
    shows.
  - Process rows show the name and a truncated piece of the command, a
    duration or result, the bell for a process whose end wakes the agent, and
    a stop button. A row opens **the process window** (`ProcessWindow` in
    `ProcessTray.tsx`, a React Aria modal): name and state, the command, the
    bounded output with *Pysäytä seuraaminen / Seuraa loppua*, *Pysäytä*,
    *Pakota lopetus* and, for a finished process, *Poista päättyneet*.
  - *Poista päättyneet* (the panel's finished fold or the window) clears
    processes only; spinoffs stay. No text promises anything about closing
    the browser.
- The process provider now owns the panel and window state and the stop and
  clear actions, so the thread's "Näytä prosessi ja tuloste", "Avaa nykyiset
  prosessit" and the top-bar *Odottaa prosessia* chip open the window or the
  panel. The derivation of everything the strip says is one pure function,
  `backgroundFacts`.
- The thread's spinoff group uses the branch icon instead of the "⑂" glyph,
  which rendered as an empty box in the lab font.
- **Library**: `design-system/prototypes/lib/strip.js` and `strip.css` are the
  strip with the decided changes (opt-in with `export const strip = true`,
  `STRIP.B`/`STRIP.reset()`), recorded in `prototypes/AGENTS.md`;
  `design-system/design.md` (Keskustelu) describes it.
- `sidebar-spinoff-mark-without-wait` was folded in as its own commit: the
  sidebar mark follows the conversation's working spinoffs from Taskfleet.

## Evidence

- Unit: `BackgroundStrip.test.tsx` (a wait is its spinoff's bell, the bell
  only after the turn, an unlisted waited run stays as unknown, the red dot
  while the branch remains and not after, silence while Pi is stopped unless
  a restart cut a process off); `ProcessTray.test.tsx` rewritten for the
  window (output fetched only while the window is open, pause and resume, a
  stale stop never retried, no output carried to a replacement lifetime).
- Browser, host-backed synthetic: `process-tray.spec.ts` (window journey with
  stop and force stop and clearing, unavailable inventory shows "?" and says
  so, Merkit pill/panel/window layout and axe in both themes and widths,
  waits out of the process list and clearing that leaves spinoffs, a process
  cut off by a daemon restart); `spinoffs.spec.ts` "spinoff tab" (bell, a red
  dot that stays after looking and goes when the branch is gone, the fold
  opening itself, Escape returning focus, *Lopeta odotus* posting the wait's
  token, a row opening the read-only view, axe).
- Paired screenshots, round `2026-10-16-taustatyo-riff` direction Merkit
  (`round-*.png`) against the synthetic lab (`lab-*.png` with `.html`), at
  rest, spinoff tab, process tab and (lab only) the process window, desktop
  and phone, light and dark; captured by `web/lab/capture-background-strip.mjs`
  with the round's story as synthetic wire fixtures (the lab's fake Pi has no
  process extension).

## Deviations from the round

- **Rows do not expand.** Jari's decision replaced the process shelf with a
  window; spinoff rows likewise open the existing read-only view, which
  already shows branch, run id and result, instead of a second details
  surface. The round's chevrons are therefore gone.
- **Clearing in the window is "Poista päättyneet", not "Poista".**
  pi-processes 0.10.9 clears finished processes together and has no
  single-process removal; adding one would mean a new native command. The
  button's tooltip says so.
- **Stop is production's filled square icon** rather than the round's
  outline, to match the rest of the controls.

## Decisions for later review

- **Phone shows the command piece too**, truncated to what fits after the
  name; on narrow screens it is often only a few characters.
- **The bell also rings for a running process whose end wakes the agent when
  the agent is merely idle** ("Odottaa sinua"), not only in *Odottaa
  prosessia*: the inventory says the end will wake it, which is the same
  fact the round's bell showed. A spinoff's bell likewise needs its wait to
  have `wakes_agent: true` (the daemon's `waiting_on` rule); a silent wait or
  one started by an earlier Pi (`null`) keeps only its stop button.
- **The spinoff pill counts working runs only.** Runs whose state is
  unknown or waiting for the parent stay at the top of the list with their
  own labels, and the pill's description says "N muussa tilassa".

Jari accepted these decisions on 2026-10-17.

## Review

Independent `/llm-review` (finder GPT-6 Astra, verifier Claude Fable 5.1)
confirmed two strip findings, both fixed with unit cases: the pill counted
unknown and parent-waiting runs as "työskentelee", and the spinoff bell
ignored `wakes_agent`.
- **An unknown inventory shows "?"** on the process pill (terminal control,
  missing extension, bridge down, read failed); a stopped Pi shows nothing
  unless a restart cut processes off, which shows their count.

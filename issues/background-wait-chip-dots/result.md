# Result

Jari's accepted combination from `proto-background-waits`: direction 3's
marks on the worker pill, direction 2's neutral exit codes. Production
components and tokens only; the daemon, contracts and session state are
unchanged.

## What changed

- **Worker pill** (`BackgroundStrip`): the count is replaced by one mark per
  working worker. The agent's wait on it is the shared *Odottaa taustatyötä*
  mark (`.ah-background-dot`), and a worker nobody waits on gets a dashed ring
  of the same size, never red. The pill has no bell any more; the mark says
  it. A waited run in another state (unknown, waiting on its parent) also
  gets a mark. With no working or waited workers the pill shows its count as
  before (idle `0`). The accessible name lists who is waited on and how many
  are not.
- **Worker panel**: a legend above the rows, the same mark on each live row,
  and "odotetaan · 18 min" / "ei odotusta · 6 min" in the meta. Lopeta
  odotus stays on every row with a wait.
- **Exit codes** (`exitReading` in `app/processes.ts`, used by the
  conversation's completion note, the process panel rows and marks, the
  process window and the process tool row): any exit code reads neutral
  ("päättyi · koodi 3"). A recognised Taskfleet wait names its codes:
  2 "odotus aikakatkaistiin", 3 "ajo epäonnistui", 4 "välitarkistus". Red is
  kept for a signal, a failed start (`spawn_error`, `missing_pid`) and a lost
  process. "kaatui" now means only a signal. The ended rows show the time
  after the label ("Päättyi · koodi 1 · 13.16").
- Waits already left the terminal pill once the daemon's wait grammar was
  fixed (`taskfleet-wait-grammar-misses-real-waits`); nothing more was needed
  there.

## Evidence

`evidence/` holds synthetic-lab screenshots at device scale factor 2, desktop
(1440 px) and phone (390 px), light and dark: the closed pills with three
completion notes (`<size>-<theme>.png` plus inert `.html`), the worker panel
(`-workerit`) and the process panel with its ended rows (`-prosessit`).
`web/lab/capture-background-waits.mjs` reproduces them (routed spinoff,
process and history replies on a lab conversation; see its header). The lab
conversation is read-only, so the top status is the lab's, not
*Odottaa taustatyötä*.

## Checks

- `./scripts/test-focused.sh --area web`: passed (typecheck, lint, unit and
  component tests).
- `npm run test:browser --prefix web` (whole suite): 392 passed, 3 skipped. `spinoffs.spec.ts` and `process-tray.spec.ts` rerun after the last edit: passed.
- New tests: `exitReading` tones and Taskfleet code recognition
  (`processes.test.ts`); which spinoffs get a mark and whether it is waited
  (`BackgroundStrip.test.tsx`); completion-note tone for a wait's check-in,
  an ordinary exit code and a failed start (`ProcessTray.test.tsx`);
  `spinoffs.spec.ts` checks the closed pill's waited/unwaited marks and the
  waited row in the panel.

## Decisions for later review

- **A wait that does not wake the agent is "ei odotusta".** The mark follows
  the daemon's `waiting_on` rule (`wakes_agent === true`), as the bell did.
  Such a wait still has its Lopeta odotus button on the row, so the row can
  read "ei odotusta" next to a stop-wait control.
- **More than five marks** collapse to "◉ N ○ M" so the dashed ring of a
  forgotten wait is never cut off on a phone.
- **No bell on the worker pill.** Direction 3 drops it; the waited mark is
  shown whether or not the agent's turn has ended, as in the prototype's
  "agentti työskentelee" scene.
- **Taskfleet wait exit 3** (`--fail-on-error`, a settled run failed) reads
  neutral "ajo epäonnistui": the wait did its job, and the failed run is red
  on the worker row.
- **A process tool row** whose process exited with a code shows the neutral
  (cancelled-looking) state with the label, not red "failed".
- Declared expected outcomes (direction 3's exit half) remain future work and
  need an upstream pi-processes parameter.

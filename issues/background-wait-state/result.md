# Result

## Cause

`agentPresentation` derived two activities from the host's `waiting_on`
facts, `waiting_process` and `waiting_spinoff`, with labels that named the
kind of background work. Every view repeated the pair, the sidebar drew both
with the same open ring as *Odottaa sinua*, and the conversation's top status
appended the awaited process or run names to the label.

## Fix

- One activity, `waiting_background`, labelled *Odottaa taustatyötä*, for any
  `waiting_on` entry (process or `taskfleet run wait`).
  `waitsOnWorker(waitingOn)` keeps the one place that still needs the kind:
  the rail's branch mark for a working worker.
- One status dot from tokens: a still `--ah-accent` ring around an accent
  core (`components.css`, `.ah-background-dot` / `.ah-status-background` /
  `.ah-nav-background`; the start-page card dot in `HomeWorkspaces.css`).
  Used in the sidebar (rail) row, start-page card, Jatka-näkymä's status mark
  and the conversation's top-status chip.
- The top-status chip (`ProcessWaitingChip`) shows the dot and the label
  only; the awaited names are its tooltip, and pressing it still opens the
  awaited process or worker. The start-page card's live line still names
  what is awaited (*Odotan taustatyötä: testit · …*).
- UI copy that names Taskfleet runs says *worker* instead of *spinoff*
  (process tray, background strip, read-only run view, wait hint).
- `design-system/design.md` describes the state and its mark.

## Evidence

- `./scripts/test-focused.sh --area web`: passed (748 tests, lint, types).
- `--area browser --spec process-tray.spec.ts`: 6 passed;
  `--spec spinoffs.spec.ts`: 4 passed. One process-tray assertion compared
  the strip's accessible name word for word; it now checks the count
  attribute and the native run title instead (TESTING.md: wording is not
  tested).
- Presentation tests: a process wait and a worker wait give the same
  activity and label (`processes.test.ts`); the sidebar row gets the
  background dot, not the working dot or the ring glyph
  (`Navigation.test.tsx`).
- Screenshots in `evidence/`, light and dark: `sidebar-*.png` (working,
  waiting for you, unknown, process wait, worker wait side by side),
  `start-*.png`, `conversation-*.png` and `conversation-top-*.png` (chip with
  its tooltip hovered). `evidence/capture.spec.ts` produced them; copy it to
  `web/tests/` and run it with `--area browser --spec` to retake them.

## Not tested

- No live Pi or Taskfleet: the states come from wire fixtures of the
  synthetic host, as in `process-tray.spec.ts`.
- Phone width was not captured.
- The start page's working dot is still an open blinking ring
  (pre-existing), unlike the sidebar's filled pulsing dot; this change did
  not touch it.

## Decisions for later review

- **The dot.** A still accent ring with an accent core (◉). Alternatives:
  a half-filled dot (reads as progress), a dashed ring (already means read
  only / uncertain), a slow pulse (would compete with *Työskentelee* and
  invite looking). Chosen because the accent colour says "the agent is
  occupied", the absence of motion says "nothing is happening that needs
  you", and the shape differs from the filled working dot, the open waiting
  ring and the unknown dash even without colour.
- **Term.** *Odottaa taustatyötä* (the conductor's choice in the issue);
  *worker* replaces *spinoff* only in copy that names Taskfleet runs.
  Code identifiers and test ids (`spinoff-waiting`, `Spinoffs.tsx`) were
  left as they are.
- **Names in the top status.** Moved to the chip's tooltip; the start-page
  card keeps them in its live line, since the card is the expanded view.

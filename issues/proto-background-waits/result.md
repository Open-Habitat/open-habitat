# Result: prototype round 1

Prototype: `prototypes/background-waits/index.html` (one offline file, four
directions behind the picker). `prototypes/background-waits/NOTES.md` is Jari's
guide in Finnish, and `evidence/` holds the screenshots.

## What caused the observation

The native Pi session history of the 2026-10-25 Birch conductor shows that
every wait was started as
`cd ~/src/open-habitat && taskfleet run wait <id> --check-in 45m --output json`
(some with `--terminal`). The daemon's `taskfleetWait` grammar rejects `&`
and does not know `--check-in` or `--terminal`, so none of these waits was
joined to its run. That is why the terminal chip counted them and the worker
chip had no bell. Their check-in exit 4 (by design) and the release watcher's
exit 3 (`skipped_no_product_change`) reached the thread as pi-processes kind
`crash`, shown as "kaatui · koodi N". The terminal panel's ended rows show the
same exits in red as "Virhe · koodi N". The ProcessCompletion note itself is
grey. Filed separately as intake bug
`taskfleet-wait-grammar-misses-real-waits`. That fix is needed by every
direction below except the baseline.

## Directions

1. **Nyt**: today's production with the defect, as the baseline.
2. **Sanoin**: the worker chip says "2 · 1 ei odotusta" / "2 · odotetaan", and
   each panel row says "odotetaan · 18 min" (bell, stop-wait) or
   "ei odotusta". Waits are removed from the terminal chip. Exits: any non-zero
   code is neutral ("päättyi · koodi 3"). Recognised Taskfleet waits read 4 as
   "välitarkistus" and 2 as "odotus aikakatkaistiin". Red is kept for signals
   and failed starts.
3. **Pisteet**: the chip shows one mark per working worker: ◉ (the
   *Odottaa taustatyötä* mark) if it is waited on, a dashed ○ if not. The
   panel has a legend and the same words per row. Exits: the agent declares
   expected codes and their meaning when it starts a process. A declared code
   is neutral with its word ("ohitettu: ei tuotemuutosta · koodi 3"), and an
   undeclared non-zero code is red "epäonnistui".
4. **Sisäkkäin**: the chip is unchanged, except that a dashed ring replaces the
   bell when a working worker has no wait. The panel nests the wait under its
   worker ("Odotus käynnissä · agentti jatkaa…" / "Ei odotusta · agentti ei
   herää…"). A wait's end is told in the run's terms ("Kastelun ajastus ·
   välitarkistus · työskentelee yhä"). Other processes behave as in 2.

All four keep the top-status and sidebar state from `background-wait-state`.
Other background processes, including the external release-watcher wait,
stay terminals with their own bell.

## Host facts each direction needs

| Fact | Exists? | Needed by |
| --- | --- | --- |
| Wait process → run ids (`run_ids`) | Yes, but the grammar misses the real command shapes (intake bug above) | 2, 3, 4 |
| The conversation's runs and their states | Yes (spinoff list, `belongsSpinoff`) | all |
| Whether a wait wakes the agent (`wakes_agent`) | Yes | all |
| Meaning of a recognised Taskfleet wait's exit 2/3/4 | 2 and 3 are mapped in `ProcessCompletion`; 4 (check-in) is not | 2, 3, 4 |
| The agent's declared expected exit codes and their words | No. pi-processes is the pinned third-party `@aliou/pi-processes` 0.10.9, so this needs an upstream parameter or a Habitat-side wrapper, and agent instructions to use it | 3 only |
| Whether the agent *should* wait on a run | No, and not needed: "ei odotusta" is stated as a fact, never as an error | — |
| A link from an external wait (`ssh … release-watch wait`) to anything | No, and not needed: it stays a terminal with a bell | — |

## Conductor's recommendation

**Placement from 3 (Pisteet), exits from 2 (Sanoin).**

- The dots solve Jari's question without hiding anything. A worker nobody
  waits on is visible on the closed chip, and the chip stays as narrow as
  today at 390 px. Direction 2's words carry the same information, but the chip
  roughly doubles in width on a phone and turns into a sentence that competes
  with the composer. Direction 4 hides the missing wait in a small corner ring,
  which is exactly the case Jari wanted to see.
- The ◉ mark already means "waiting on background work" in the sidebar and
  the top status, so the chip reuses a mark Jari has approved instead of adding
  one. The panel spells it out in words.
- For exits, direction 2 needs no fact that does not exist today. Direction
  3's declared outcomes are better (a real test failure stays red) but depend
  on an upstream pi-processes change. Without that change, every undeclared
  non-zero exit turns red again, which brings back the release-watcher problem.
  Declared outcomes can be added later on top of the neutral default, without
  changing the layout.
- Direction 4's run-shaped completion note ("Kastelun ajastus ·
  välitarkistus") is worth keeping as an option for Jari, but it is a separate
  choice from the chip.

Implementation order if Jari agrees: fix the wait grammar (intake bug), map
the check-in exit, change the worker chip and rows, make non-zero exits
neutral, and drop "kaatui" for exit codes.

## Verification

`check.mjs` passed: 16 direction × width × theme cases at 1440 and 390 px in
light and dark. It opened both panels and the ended rows, expanded a note,
stopped a wait, checked that Escape returns focus, and found no horizontal
overflow, no console errors and no network requests. The shared picker check
(`design-system/prototypes/picker-check.mjs`) also passed. No production code
changed.

## Questions for Jari

- Placement: is 3 the right one, or do the words of 2 read better despite the
  width?
- Exits: is it acceptable that a real non-zero failure is grey (the agent's
  next message explains it) until declared outcomes exist?

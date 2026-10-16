---
created: 2026-10-16
updated: 2026-10-16
type: task
reporter: jari
status: done
priority: high
lane: unlaned
collision: [design-system/prototypes/rounds/proto-background-strip-riff]
preparation: ready
closed: 2026-10-16
---

# Prototype riff: one quiet strip with spinoffs and processes clearly apart

Riff on round `design-system/prototypes/rounds/2026-10-16-taustatyo/` direction **Yksi palkki** (`issues/proto-composer-strip/result.md`, Decisions). Jari 2026-10-16: one bar is good, but spinoffs and processes must read clearly as separate, and there is far too much information: "tätä katsoessa tulee infoähky". Three directions on the axis **how little the strip says at rest while keeping spinoffs and processes visibly distinct** (e.g. two labelled groups in one bar with counts only; one line per kind with only the most important state; icons and counts with details on open). At rest the strip answers only: is something running, of which kind, does anything need me. Detail lives behind a click. Keep the decided behaviours (a `run wait` is shown as its spinoff, never as a process; finished spinoffs are not cleared by Poista päättyneet; the waiting mark blinks only in the sidebar).

## Acceptance Criteria
- [ ] Round verified with check.mjs; result.md per the prototype worker rules with questions for Jari.

## Decisions

Jari, 2026-10-16 ~20:30, round `2026-10-16-taustatyo-riff`:
1. **Merkit**: two small pills (spinoffs, processes) with icon and count; a pill opens the floating panel with kind tabs.
2. When the agent waits, the bell in the strip is enough; the top bar already says Odottaa spinoffia.
3. The "needs me" mark on a failed spinoff stays until its branch is gone: the branch has to be removed one way or another (merged or discarded), so the mark is a standing reminder, not cleared by looking.
4. Do not say "Prosessit jatkavat, vaikka suljet selaimen" anywhere; it need not be said aloud.
5. A process row is not an expanding shelf (collapse/accordion). The row shows the name followed by a short piece of the command it runs; clicking the row opens the process in its own modal window where its output and controls are viewed. "Se on silleen selkeämpi."

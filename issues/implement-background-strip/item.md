---
created: 2026-10-16
updated: 2026-10-17
type: feature
reporter: jari
status: done
priority: high
lane: web
collision: [web/src/app/, web/src/components/]
preparation: ready
closed: 2026-10-17
---

# Implement the background-work strip: Merkit pills, kind-tabbed panel, process modal

Implement Jari's choice from `issues/proto-background-strip-riff/item.md` (Decisions, 2026-10-16): direction **Merkit** of round `design-system/prototypes/rounds/2026-10-16-taustatyo-riff/` replaces the current process tray and spinoff bar above the composer. Build the round with `node design-system/prototypes/build.mjs rounds/2026-10-16-taustatyo-riff` and match it, with these decided changes:
- The failed-spinoff "needs me" mark stays until the branch is gone (merged or discarded), not until looked at.
- The bell is the only waiting cue in the strip.
- No "Prosessit jatkavat, vaikka suljet selaimen" text anywhere.
- A process row shows its name followed by a short, truncated piece of its command; clicking it opens the process in a modal window (output, follow/pause, stop, force stop, remove), not an expanding shelf.
Keep the earlier decisions: a `run wait` is shown as its spinoff, never as a process; Poista päättyneet clears processes only; the waiting mark blinks only in the sidebar. Also fold in `sidebar-spinoff-mark-without-wait` if it fits the same derivation (running children from Taskfleet, not the wait process). Record the strip's library version in `design-system/prototypes/lib/` and `design.md`.

## Acceptance Criteria
- [ ] Production matches Merkit with the listed changes in light, dark and phone (paired screenshots against the round, deviations justified).
- [ ] Process modal and spinoff tab behaviours covered by browser tests.

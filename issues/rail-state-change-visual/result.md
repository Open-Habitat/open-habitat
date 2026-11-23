# Rail state motion: A Siirtyy

Implemented the chosen round-2 direction as `rail-state-motion`, off by
default, under Settings → Experimental features. The chosen prototype remains
at `design-system/prototypes/rounds/2026-11-23-rail-state-change-2/`.

## Verification

Synthetic evidence, not an installed-server or real-provider acceptance:

- `./scripts/test-focused.sh --area web`: 261 files, 2201 tests passed;
  lint, catalog checks and TypeScript passed.
- `./scripts/test-focused.sh --area browser --spec lab-rail-state-motion.spec.ts --spec lab-adaptive-rail.spec.ts --spec lab-rail-scroll-region.spec.ts --spec rail-now.spec.ts`:
  20 lab cases and 4 ordinary cases passed, with two browser workers.
  Existing rail specs include accessibility, keyboard/layout and edge scrolling.
- The new spec alone with Playwright `--repeat-each 3`: 18/18 passed,
  two workers, 0–60 ms reply jitter. It checks actual browser travel geometry,
  reduced-motion outlines, off, refresh without replay, simultaneous arrivals
  beyond the edge, cleanup, and the closed phone drawer in both motion modes.
- `./scripts/test-focused.sh --area go --go-package ./internal/experimental`:
  catalog package compiled; it has no Go test files. The browser cases also
  save the new feature through the real account-preferences endpoint.
- No whole browser suite or clean gate was run. No deployment or live-server
  verification was performed in this worker.

The checked implementation is the commit carrying this result. Paired synthetic
screenshots and static HTML, including mid-travel, reduced motion, off and phone
cues, are kept outside git at `/var/tmp/agent-keep/rail-state-motion/`.
Mid-travel, the desktop still and the phone still were visually inspected.

The first browser attempts found a model-shape bug (the rail also carries a
`hints` map) and a missing edge cue when allocation changed but its count did
not. Both were fixed before the successful runs above. Missing fixture
packages were installed locally before running the host-backed checks.

## Focused self-review

Presentation-only review: traced the experimental default, pre-commit capture,
section/reply/failure detection, reduced motion, count and edge updates,
interrupted-animation cleanup, unmount, identity/server changes and reconnect
baselines. Reviewed the final diff and synthetic captures. No sessions, wire
contracts, daemon state handling or authorization boundary changed; no
independent-model review was required or run.

The motion leaves native state and routing immediate. Animating row contents
rather than the measured list items keeps the adaptive allocator and edge
observer reading final layout throughout the slide. Timers, observers, transient
attributes and animations are disposed when disabled or unmounted. Names enter
the phone cue as text, never HTML. The settings card has its Finnish and English
description beside the switch; it needs no duplicate Explain card.

## Decisions for later review

- **Follow the actual rail placement for failures.** The prototype described
  failures in Käynnissä; the current rail may put them elsewhere. Motion shows
  the existing classification rather than changing conversation semantics.
- **An unseen arrival gets an edge outline even when the count is unchanged.**
  The alternative was rolling numbers only, which misses a change when the
  adaptive region grows and hides the same number of different rows.
- **No replay on enable, initial listing, identity/server change, reconnect or
  hidden-tab updates.** The alternative was animating the whole catch-up; that
  would misrepresent old work as news. Ordinary live section changes still move.
- **A new event replaces unfinished effects.** The alternative was queued
  animations; those would lag behind the current rail. Three or more changes
  in one render share travel without per-row glows, as in the round.
- **Reduced phone cue holds for four seconds**, the same as other reduced-motion
  stills. The prototype phone name held for three seconds; consistent still
  timing gives this narrow, truncated cue as long to be noticed as the counts.

## Live check

After deployment:

1. Enable **Keskustelurivin siirtyminen / Conversation row movement** in
   Settings → Experimental features. With it off, rows should change exactly
   as before, without travel or arrival cues.
2. Watch an agent finish, or raise a quiet conversation. Its row should slide
   into Sinun vuorosi / Your turn while neighbours move aside; no mark stays.
3. Let several conversations change together. They should move together, with
   no individual glow for a batch of three or more.
4. Scroll the destination past the rail edge. The existing edge chip should
   indicate the arrival without scrolling the rail for you.
5. On a phone with the drawer closed, let a reply arrive elsewhere: one short
   name cue travels to the menu button, then its count rolls. The drawer stays
   closed. With reduced motion, there is only a still cue and outline.
6. Enable the device's reduced-motion preference and repeat on desktop: no
   sliding or rolling; a four-second still tint/outline marks the change.
7. Reload or reconnect: previously waiting conversations must not replay.

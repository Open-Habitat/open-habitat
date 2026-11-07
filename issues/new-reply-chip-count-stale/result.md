# Result

The counter previously only added arriving native assistant replies and reset at
near-bottom/jump/navigation. There was no per-reply visibility observation at
all, rather than a faulty IntersectionObserver threshold.

The reading visit now retains unseen reply identities. Each rendered text block
carries its entry identity; scrolling and layout observation remove replies as
their text intersects the viewport. A tall tool thread entering view cannot mark
its still-offscreen answer seen. End/jump/navigation clear the identities too.
Nothing persists, and no host, session-state or contract behavior changes.

## Evidence

Tested the working tree based on `381afd799927269e9351e1480d63256ca0349b06`
(see this file's commit for the exact tested implementation):

- `./scripts/test-focused.sh --area web`: passed, 176 files / 1331 tests,
  TypeScript and Biome checks passed.
- `OH_PORT_BASE=14400 OH_BROWSER_WORKERS=2 ./scripts/test-focused.sh --area browser --spec browser-conversation.spec.ts --tag 'latest pill clears'`:
  passed both cases. The existing keyboard-jump case remains; the added case
  scrolls by 40 px and requires 2 → 1 → 0 before reaching the bottom, with
  reply text taller than the viewport, then requires the chip absent at the end.
- Focused self-review: checked native reply identity versus turn grouping,
  pagination (existing unit coverage), reset paths, zero-height hidden text,
  observer/listener disposal, and unchanged keyboard jump/follow behavior.

Browser evidence is production-client / same-UID synthetic-host Chromium, not a
live pilot or Safari observation. No full gate or whole browser suite was run.
No visual styling or copy changed. The issue names no prototype or extra decisions.

## Decisions for later review

- A reply is seen when any positive-height portion of its text enters the
  viewport, rather than waiting for its bottom or a percentage of its height.
  This matches the requested arrival-in-view rule and works for long answers.
- Keep the existing neutral latest-navigation button while still far from the
  end, even after all new replies have entered view. Its new-reply count clears
  immediately; the button itself disappears at the end. Hiding all navigation
  as soon as the final tall answer starts would remove the existing way to jump
  to its end.

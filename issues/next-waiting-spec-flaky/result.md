# Result: next-waiting-row spec sees an empty round under load

Test-only fix in `web/tests/next-waiting-row.spec.ts`; the product is
unchanged.

## Cause

The `[]` was not an empty round. The spec had just passed
`expect(steps).toHaveCount(5)` and then read the steps' `data-agent` once
with `evaluateAll`. A round with fewer steps would have failed the count, and
`WaitingRound.start` freezes the steps from the rail's Sinun vuorosi in one
go, so the product cannot start a round from a half-arrived rail and walk
it as empty. What the read caught was a moment with no bar at all. The
conversation renders its composer area, and the dock with it, only while
`controlled` (`useConversation`'s `opened` is false while the opened
step's history window loads). Right after Alt+↓ navigates, the count can
still match against the earlier render, and the single read then falls into
the loading gap. Under suite load that gap is longer.

The spec now polls both reads: the round's step order (until it equals the
origin followed by the rail's order) and the rail's order itself (until it
holds the four replies).

## Evidence

On Birch, `OH_BROWSER_WORKERS=2`, `OH_PORT_BASE=9300`: 5 of 5
`next-waiting-row.spec.ts` runs passed (26–27 s each). A `timeout`-bounded,
looping `browser-conversation.spec.ts` run (`OH_PORT_BASE=9400`, its own
`--output`) was running alongside the whole time and got from case 4 to
case 28 of 74. In an earlier batch, where the load used the shared
`web/test-results`, 4 of 5 runs passed. The fifth failed only on
Playwright trace/zip `ENOENT`, because both runs cleaned the same artifact
directory; no assertion failed. `./scripts/test-focused.sh --area web`
and `biome check` on the spec passed.

## Decisions for later review

- **Not a product change.** The bar is missing while a step loads because
  the whole composer area is missing then. That is the conversation's
  existing loading behaviour, not a separate fault of the round. Keeping
  the bar on screen during the load (rendering the dock outside
  `controlled`) would be a separate design change if the brief gap ever
  bothers anyone in use.

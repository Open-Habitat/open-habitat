# Result

Earlier-day view and file rows now show their local date and time, matching
ContextPage's `formatDate` options. Today remains time-only; other years
include the year. Every timestamp has a semantic `time` element, its original
`datetime`, and a localized full-date/time tooltip.

On touch devices the timestamp gets its own metadata line so it cannot be
clipped behind file facts or actions. Expanded older view versions now also
have a touch-visible timestamp.

## Decisions for later review

- Include the year only outside the current local year, rather than always or
  never: recent rows stay compact while older offers remain unambiguous.
- Put touch timestamps on a separate line instead of retaining the inline
  separator: full dates fit at phone width without hiding the time.

## Verification

Tested the final component/CSS/browser changes on the worker branch based on
`main`; the landing commit carries this result. All commands used `umask 077`,
the shared scratch lease, and timeouts.

- `./scripts/test-focused.sh --area web`: passed, 246 files / 2008 tests,
  including fixed-clock component cases for Finnish, US and UK English,
  today, yesterday, previous year, files and unfolded view versions.
- `OH_BROWSER_WORKERS=2 OH_LAB_WORKERS=2 OH_PORT_BASE=15300 ./scripts/test-focused.sh --area browser --spec lab-asset-row-alignment.spec.ts`:
  2 passed. Touch and pointer at 390px and 1366px, three themes; timestamps
  asserted visible and contained within rows, with the clock set to a later
  year to exercise the longest dates.
- Same named lab spec through Playwright `--repeat-each 3`: 6 passed.
- `OH_BROWSER_WORKERS=2 OH_PORT_BASE=15300 ./scripts/test-focused.sh --area browser --spec agent-views.spec.ts --spec agent-file-offers.spec.ts`:
  13 passed. Neither existing interaction spec asserts time wording.
- `git diff --check`: passed.

The first browser attempt stopped at the missing Pi SDK fixture prerequisite;
after installing the lockfile dependencies, all browser checks above passed.
Synthetic screenshots and paired HTML are retained outside git at
`/var/tmp/agent-keep/conversation-assets-date-and-time/` (`asset-rows-*`).
The 390px touch and pointer light screenshots were inspected: the complete
previous-year timestamp fits, and actions stay reachable.

Focused self-review was sufficient: this is local formatting and responsive
layout only, with no sessions, contracts, daemon state or authority changes.
No independent model review, full suite, release gate or live deployment was
performed or required for this scoped change.

## Live check

After deployment, open a conversation's views-and-files panel with offers
from today, yesterday and another year. Today's rows show just time; older
rows show date and time, adding the year when needed. Check Finnish and
English, phone width and expanded older view versions. Hover a timestamp on
desktop to see its full date and time.

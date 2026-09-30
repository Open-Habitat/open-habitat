---
created: 2026-09-29
updated: 2026-09-30
type: improvement
reporter: jari
status: open
priority: normal
lane: build-tooling
collision: [scripts/ci-local.sh]
---

# Get test feedback faster

Make testing take less time during development. A small change should get useful
feedback quickly. The run that prompted this issue took 203 seconds, and workers
sometimes repeated the full test run for unchanged code.

Two directions are worth investigating:

- Make the tests themselves faster. Find where time goes: individual tests,
  setup, repeated builds or tests waiting on one another. The browser tests
  currently share scenario state, so running more workers safely may require
  making the tests independent first.
- Run less when less is enough. Can a change tell us which tests are relevant?
  Look at how tests relate to the code and behavior they cover, whether that
  relationship supports useful selection, and when an earlier result still
  applies. A small local change and a shared dependency change need not require
  the same test run.

These are possible approaches, not a requirement to build a test-selection
system. Prefer improvements that noticeably shorten the wait without making
relevant failures easier to miss. The useful result is faster feedback and a
clear basis for choosing what to run, including when a full run is worthwhile.
The current policy in [TESTING.md](../../TESTING.md) is a starting point to
reassess as part of this work; update it to reflect the resulting approach.

Some work is already done: browser checks share startup and build work, and
Go/npm caches are reused within a checkout. [result.md](result.md) records a
warm-cache comparison of 215 to 184 seconds, with the browser suite still the
largest cost. These were single observations under variable load. Build on
those results and explain what further changes save time and why the selected
tests are sufficient for the changes they cover.

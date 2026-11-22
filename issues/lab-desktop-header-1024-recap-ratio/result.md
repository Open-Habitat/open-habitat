# 1024px recap viewport failure

Fixed the test; no product header layout change was needed.

## Cause

`expectOneRow` sampled the shortening steps twice and treated equal reads as
settled content. At 1024px both reads could see the loading title, before the
first reply's context usage and generated title arrived. Its stored step was
`1`, so the subsequent assertions required recap to remain in the row. The real
header had meanwhile correctly advanced to `1 2 3`, hiding recap with
`display: none` and offering it in the overflow menu.

Instrumented reproduction with seed `1e2524bc1e09040c`, 60ms reply jitter:

- Before: row width 680, title width/text width 16, steps `1`.
- After: row width 680, title width/text width 142, steps `1 2 3`.
- Both observations: one row, zero overlaps, zero outside children.
- Recap after: `display: none`, zero bounding rectangle, not pushed off-screen.

The unchanged test first failed 1/5 repeats, then failed 3/5 with diagnostic
capture. A single focused run passed. The failure is a reproducible ordering race,
not a permanently overflowing 1024px layout or a reason to widen its breakpoint.

## Correction

Wait for the context indicator and completion of naming, then give the
conversation a known long authored title through its existing rename control.
Assert that exact synthetic title before measuring. This establishes the long
content the spec already promised and prevents automatic naming from changing
its premise between geometry and menu assertions. No sleeps, increased budgets,
removed visibility assertions or weakened layout assertions were added.
Captures can now be requested at every tested desktop width, not only 1440px.

## Evidence

Code revision: `e1daf441f36be0e37bc80a9c7beee56a468faeb7`.
All evidence is synthetic and kept outside git at
`/var/tmp/agent-keep/rail-header-harvest/`.

- `header-before-repeat.log`: original test, 1 failure / 5.
- `header-diagnosis.log`, `failure.png`, `failure.html`: 3 failures / 5,
  before/after measurements above. Temporary instrumentation was removed.
- `header-final.log`: entire spec **25/25 passed** (`--repeat-each 5`, two workers,
  seed `1e2524bc1e09040c`, 60ms jitter): 1024, 1280, 1440, 1600 and 1920px,
  each with sidebar and editor, action/menu reachability and light/dark Axe.
- `layout.log`: focused **1024/1280/390px** sweep **3/3 passed**, including phone
  facts/menu interactions; screenshots paired with offline HTML in `layout/`.
  Inspected 1024 sidebar/light, 1280 editor/dark and 390 running/light images.
- `layout-extra.log`: foundation, shell header, page-scroll header and rail
  keyboard-help specs **13/13 passed**.
- `web-final.log`: **2176 web tests in 257 files**, static/type checks passed.
- The rail graduation's result lists the final touched-spec repeats as well.

Commands used `timeout`, umask 077, leased private scratch, and one or two
browser workers. No full suite or clean release gate was run, and no deployment
or live-server evidence is claimed.

## Review

Focused source-and-evidence self-review: checked the shortening hook, its CSS
step-3 rules, observed DOM geometry and final action/menu assertions. The fix is
confined to the spec and opt-in capture; it changes no authority, session,
contract or daemon state. No new independent model review was required.

## Decisions for later review

- **Repair the test's setup rather than header CSS.** Moving the breakpoint,
  reserving space or keeping recap always visible would change valid product
  behavior to satisfy an observation taken before content arrived.
- **Use a known authored long title rather than the generated wording.** This
  tests the stated long-title layout without depending on asynchronous naming
  or asserting interface copy. Native synthetic user content remains asserted.

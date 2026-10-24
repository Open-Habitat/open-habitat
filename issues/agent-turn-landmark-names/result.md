# Result

An agent turn is now an unnamed `<section>`, which has no implicit `region`
role and so is not a landmark. Each turn already sits in its own item of the
conversation list (`li[data-kind="assistant"]`), and that list is how a screen
reader moves from turn to turn. Appearance is unchanged: styling and tests
address the turn by class and `data-testid`, never by its name.

`lab-turn-stages.spec.ts` now runs axe over the whole page with all rules on a
history conversation with two agent turns, instead of only inside one turn and
only the WCAG tags (`landmark-unique` is a `best-practice` rule, which the old
tag filter excluded). With the old component it fails on exactly that rule; with
the fix it passes. Two `HistoryView` unit tests that counted turns by the
`region` role now count them by `data-testid="agent-turn"`.

## Decisions for later review

- **Turns are not landmarks rather than numbered landmarks.** Landmarks are for
  a page's few major areas (navigation, main, the composer). A long
  conversation would otherwise add dozens of entries to the landmark list, and
  a distinguishing name such as an ordinal or a time would still say nothing
  about the content. Moving between turns belongs to the list structure and
  heading/item navigation. If per-turn jumping turns out to be wanted, the
  better tool is a heading or a named list item, not a region.

## Verification

From the worktree, under `umask 077` with a fresh `/var/tmp` `TMPDIR`
(2026-10-24): `./scripts/test-focused.sh --area web` passed (713 tests, lint,
format); `--area browser --lab --spec lab-turn-stages.spec.ts` failed on
`landmark-unique` with the old component and passed with the fix;
`--area browser` passed 366 (3 skipped) and `--area browser --lab` passed 131.
Synthetic host-backed browser evidence, routed to Fleetrepo's remote runner.

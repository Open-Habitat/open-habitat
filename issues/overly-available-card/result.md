# Result

## Cause

The spec was out of date; the product had not regressed. The rail
scroll-region change (28c46d2b, "only Työtilat scrolls, the conversation
sections stay in sight", accepted 21.11.) made Hiljaiset fold itself while
the wide rail is crowded, until the person folds or opens it on that device
(`web/src/app/quietFold.ts`, `crowdedNow` in
`web/src/components/railRegions.tsx`). The spec's quiet fixture adds nine
quiet conversations to a 1280 × 900 rail, which counts as crowded. A fresh
browser context has made no choice on the device, so Hiljaiset started
folded. That one state explains all three failures:

- `:120` showed no rows in a folded section, so `quietId(8)` was missing;
- `:191` found no `rail-quiet-menu`, because the folded section hides its menu;
- `:322` found `aria-expanded="false"` at the start.

`:413` does not use the quiet fixture, so the rail is not crowded there
and the case passed.

The agent-section, workspace-filter and graduation landings were checked
in `railNow`. None of them changes which conversations are quiet.

## Change

`quietWorld` now seeds the device choice "open"
(`nah:rail-quiet-folded = "0"`) through a context init script. The script
writes the value only while none is stored, so the fold, reload and
per-device assertions in `:322` still test the person's own choice. These
cases cover the open list, sorting, narrowing and the person's own fold.
The automatic fold is already covered in `web/tests/lab-rail-scroll-region.spec.ts`
("Hiljaiset folds itself" when crowded, stays open when not crowded).

## Verification

`OH_BROWSER_WORKERS=2 ./scripts/test-focused.sh --area browser --spec
rail-icons-quiet.spec.ts` passed 4/4 three times in a row. No other spec
uses this fixture. Only the spec changed, with no web or Go code
changes, so the web and Go areas were not run.

## Decisions for later review

- I treated the auto-fold as the agreed behaviour and changed the spec, not
  the product, because the commit records it as accepted on 21.11.
- I seeded the device choice rather than enlarging the viewport or cutting
  the fixture. A taller window would pass only as long as the crowding
  threshold allows, while the seed states the precondition the cases need.

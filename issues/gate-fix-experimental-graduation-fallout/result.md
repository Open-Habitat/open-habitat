# Result: experimental-graduation fallout in the v0.1.4 gate

Five of the six ordinary failures came from specs that no longer matched an
agreed change. The lab explain-coverage failures were missing explain cards.
Once those cards were in, the same lab case found a product crash: the rail
folded and opened Hiljaiset in a loop until React gave up.

## Specs outdated against agreed changes

- `settings-experimental.spec.ts:47`: the attention sound landed as a fifth
  experiment after the graduation, so it is added to the spec's list of
  remaining experiments.
- `settings-width-sweep.spec.ts:35` `aanet`: the Äänet section exists only
  while the attention-sound experiment is on, and with it off the route
  shows an empty heading. The brief suspected a layout defect, but there was
  none: the sweep never reached the rows. The spec now turns on the
  experiment named by the section's `experimental` entry in `settingsIndex`
  before measuring. With it on, the Äänet rows pass the sweep.
- `en-shell-editor.spec.ts:94` and `context-ring.spec.ts:34`: the context
  view graduated and replaced the context page's technical figures for
  everyone ("What it is made of", `context-total`, the turn, part and
  compaction tables). The specs now read the view instead: its total
  (`context-view-total`, still Pi's measured 205 300), the instructions and
  tools row, and, after compaction, the summary-only group with no
  measurement.
- `context-ring.spec.ts:179` ×2, "Missing notice neighbours": the
  permission-question change put the composer in a `display: contents`
  hold, whose own box has no height. The spec now looks through
  `display: contents` wrappers to the first laid-out row. The gap it
  measures and its tolerance are unchanged.
- `named-workers.spec.ts:73`: Avustajat graduated, so there is no off state.
  The "off" half became a check that the one-shot worker stays in the
  Workers pill and the named workers are only in the chip. The retired
  `named-workers` and `explain-mode` preference writes are gone.

## Product: missing explain cards

`lab-explain-coverage.spec.ts` (all views at 1440 and home at 390) found two
controls without a card: the graduated Agentin käytössä rail link
(`rail-resources`) and the workspace tiles of a folded Hiljaiset
(`rail-quiet-pill-*`, seen at 390). They got S39 and S40 in both languages.
The UI reference was regenerated; it had also fallen behind other changes
that landed tonight.

## Product: Hiljaiset fold loop crashed the page

With the coverage passing, the workspace-front-page case at 1440 got further
and failed: turning on explain mode on a workspace page brought the whole
app to the router's error screen with React #185 ("Maximum update depth
exceeded"). This happened every time.

Cause, in `railRegions.tsx`: the crowding check counts a folded Hiljaiset's
rows at a row height. With Hiljaiset folded there was no row to measure, so
it fell back to the stylesheet variable (24 px) while the rows are drawn
32 px tall. With four quiet rows the folded answer came out 32 px smaller
than the open one, more than the 24 px slack. A rail just past crowded
therefore folded, found itself uncrowded, opened, and folded again without
end. The explain bar took just enough height to land there. The check now
remembers the last drawn row height (a Hiljaiset row first) and uses the
stylesheet value only before any row has been drawn. The rail-scroll and
Hiljaiset specs (`lab-rail-scroll-region`, `lab-rail-background-door`,
`rail-icons-quiet`, `archive-quick-succession`) pass.

Also, `components.css` on main failed Biome's format check after the
short-rail commit, which broke `test-focused.sh --area web`. It is
reformatted, with no rule changes.

## Checks

- Ordinary specs (`settings-experimental`, `en-shell-editor`, `context-ring`,
  `named-workers`, `settings-width-sweep`): 32 passed, three runs in a row,
  with `OH_BROWSER_WORKERS=2`.
- Lab `lab-explain-coverage`: 12 passed, three runs in a row.
- `./scripts/test-focused.sh --area web`: passed.
- `scripts/generate-ui-reference.py --check`: clean.

## Decisions for later review

- With attention sound off, `/settings/sounds` opens to an empty heading and
  no content. Other hidden sections either open anyway (Keskustelut) or are
  not linked. A redirect to the settings list, or a line saying the feature
  is off, would be kinder. I left the product unchanged because this is not
  a regression and the choice is a product one.
- No spec surveys the graduated Agentin käytössä page (`/resources`) itself
  for explain coverage, only its rail link. Adding that survey may reveal
  more uncovered controls on the page.
- The Hiljaiset fold loop has no dedicated regression spec. The explain
  coverage case at 1440 × 900 reproduces it every time and now guards it,
  but only by accident of its geometry. A rail-region spec that turns on
  explain mode, or shortens the window to just past crowded, would make
  the guard deliberate.
- The edge chips' `-26px` margin cancels their height but not the
  conversations region's `2px` gap, so the top chip moves the rows 2 px when
  it appears. I saw no loop from this and left it alone, but the CSS comment
  promises that the chips never move the rows.

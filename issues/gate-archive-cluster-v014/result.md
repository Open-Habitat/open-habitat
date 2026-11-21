# Result

## Causes

Three agreed changes made specs outdated, and one change caused a real
product defect.

**The helper read before an archive (spec outdated).** Named helpers
graduated in d4f2b2b6. Since then every archive first reads the
conversation's helpers from Taskfleet (`useHelperArchiveConfirmation` in
`web/src/app/HelperArchiveFlow.tsx`), and when that read is incomplete it asks
the person before archiving. The synthetic host's default Taskfleet is
installed but unreadable, so each archive stopped at the helper question:
nothing was sent, the view did not navigate and no notice appeared. This one
cause explains archive-damaged-history:12 (all four sizes), native-history:81,
archive-uncertain-refusal:12, rail-archive:133 and :330,
next-waiting-row:342, lab-workspace-page:457 and lab-worktree-agent:23.
browser-conversation.spec.ts had already moved to the host's
empty-and-answering fixture (d5ff6e08).

**Hiljaiset folding itself (spec outdated).** In archive-quick-succession:18
the four quiet rows and the two empty sections' notes crowd a 1280 × 720
rail. A crowded rail folds Hiljaiset until the person chooses on that device
(28c46d2b, accepted 21.11.), so the rows were not shown. The case also needed
the answering Taskfleet.

**The storage breakdown (spec outdated).** The storage breakdown graduated in
d4f2b2b6 and replaced the `storage-usage` bar in Tallennustila, but
lab-workspace-trash:49 still looked for that bar.

**The short rail (product defect).** Since the rail scroll regions
(28c46d2b), the open rail clips its content and gives Työtilat an 11rem floor,
and the phone drawer counts as an open rail. Under about 600 px of height the
rail's head and foot leave less room than that floor. The conversations'
region then shrank to 0 px and the bottom of Työtilat was clipped, so a phone
held sideways could reach no conversation. lab-foundation:8 checks that the
390 × 390 drawer still scrolls to its end, and it failed for this reason.

## Changes

- `web/tests/answering-taskfleet.ts`: a shared hook that sets the host's
  `/fixture/taskfleet?status=empty` before each case and restores the
  default after it. Every archive spec above uses it.
- archive-quick-succession: the device opens Hiljaiset with an init script.
  It writes the value only while none is stored, as rail-icons-quiet does.
- lab-workspace-trash: the case checks the breakdown's usage bar and the
  Trash's own row in it.
- `components.css`: below 600 px of height the open rail scrolls as a whole
  again, as the narrow rail does. At 700 px and up the regions are unchanged.

## Verification

- Ordinary: all six listed specs, 25 cases, passed three runs in a row with
  `OH_BROWSER_WORKERS=2 ./scripts/test-focused.sh --area browser --spec …`.
- Lab: all four listed specs, 12 cases, passed three runs in a row with
  `--lab`.
- Also passed once after the CSS change: lab-rail-scroll-region (all six
  cases, including 700 px and the phone drawer), lab-conversation,
  lab-shell-header, clone-page and settings-close. These are the other
  specs that run the rail at heights of 600 px or less.
- `./scripts/test-focused.sh --area web` passed. Go was not touched.

## Decisions for later review

- The helper question when Taskfleet cannot be read is the agreed product
  behaviour, so I changed the specs, not the product. Each archive spec now
  sets up its own answering Taskfleet. Making `empty` the synthetic host's
  default would be a cleaner match for real installations, but it changes
  what every other spec starts from while other gate fixes run in
  parallel. The helper keeps that later switch to a one-line change.
- At 1280 × 720, four quiet conversations already count as a crowded rail,
  mostly because of the two empty sections' notes. The spec now records the
  device's choice to open Hiljaiset. Whether so few rows should count as
  crowded is a design question for the auto-fold.
- For the short rail, the fallback is a 600 px height media query. It is not
  measured from the actual head height, so a rail with a much taller head
  could still be squeezed between 600 and roughly 650 px. Measuring would mean
  extending `railRegions.tsx` (`crowdedNow`) with a "regions do not fit"
  state.

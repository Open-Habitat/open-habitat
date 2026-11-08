# Result

The footer now owns its inter-part spacing with a column gap; strip bottom
padding and composer top padding no longer accumulate. The composer uses the
same token between queue, attachment tray and field. Notices lose their extra
outer margins, including the queue-restored notice. The transcript's bottom
inset uses that token too. The existing next-waiting → work chips → queue →
draft order is unchanged. Frame geometry observes the whole footer, so resizing
it still reserves the appropriate reading space.

## Decisions for later review

- Use existing `--ah-s3` (9 px), rather than the former 6 px field gap or 12 px
  composer padding: it makes the attachment/field separation clearer without
  the large compounded strip gap. Both widths use the same token.
- Keep the transcript scroll region separate from the footer; its bottom inset
  uses the same token rather than moving the live status out of its turn.
  Internal card padding and the bottom viewport inset are not stack gaps.

## Evidence and checks

Synthetic same-UID host evidence, not a live installation or native-provider
claim. `evidence/before-*` and `after-*` are 2× AVIF captures with adjacent inert
HTML at 1440 and 390, covering idle, waiting, queued, attachment and restored
queue states. Images were inspected and converted with
`scripts/screenshots-to-avif.py`. Baseline is `86a69b7fe` plus the capture spec.

Commands run with private disk-backed TMPDIR, umask 077, OH_PORT_BASE=13900 and
OH_BROWSER_WORKERS=2. All listed checks were repeated after rebasing onto
`ef9621e7c` (implementation `7853a7674` plus the final CSS specificity cleanup):

- `scripts/test-focused.sh --area web`: 194 files / 1463 tests passed,
  typecheck, formatting and catalog checks passed.
- Browser specs run by name: `composer-geometry.spec.ts` (4),
  `composer-english.spec.ts` (1), `queued-send.spec.ts` (14),
  `next-waiting-row.spec.ts` (4): passed.
- Lab specs by name: `lab-composer-area.spec.ts` (10),
  `lab-composer-focus.spec.ts` (2), `lab-composer-stack-gaps.spec.ts` (2): passed.
- New gap checks measure consecutive visible parts, including the final live
  status and restored-queue notice. Real interactions vary next-waiting,
  queue and attachments; delayed creation also tests attachments without work
  chips. Layout polling waits for transcript anchoring after footer resize.

Focused self-review: inspected both reported screenshots, the whitespace-free
production diff, direct-child selectors affected by the new wrapper, frame
measurement and focus-ring behavior. No text, controls, session state, contract
or authority changes. No external review needed for this layout-only change.

## Iteration notes

Initial capture used a visibility assertion on the hidden mobile rail; replaced
with a count. Initial test typechecking needed a direct Playwright Page import
and explicit geometry typing. Adding status/notice measurements caught a real
extra 6 px notice margin; removed it. Measurements now happen in one browser
frame and poll for follow-scroll settlement rather than racing layout. A command
with repeated --spec flags ran only its last spec; the others were subsequently
run individually. Final lint caught a descending-specificity selector; matched
its scope to the notice selectors and reran the checks. Snapshot HTML trailing
whitespace was normalized for `git diff --check`.

The initial ordinary rebase tried to replay already-landed, rewritten parent
commits. It was aborted and only this run's commit was replayed with
`--onto main 86a69b7fe`. The KOKEILTAVAA conflict retained both workers' lines;
range-diff confirmed no implementation changes from conflict resolution.
All these failures were resolved before delivery. `git diff --check` and
`validate-project-view.py` pass. `issuectl doctor --json` reports no schema,
reference or conflict errors (existing non-AVIF evidence elsewhere is unchanged).

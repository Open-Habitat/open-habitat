# Result

Empty Sinun vuorosi, Käynnissä and Hiljaiset sections now put their empty state on the heading row. No experimental flag. The Quiet fold button stays separate from the accessible status; populated and workspace-filtered-empty sections retain their controls and reset explanation.

## Decisions for later review

- Use the heading on the left and quiet, normal-case `ei mitään` / `none` on the right, rather than a dot-separated heading or the old full sentence. This follows the muted secondary-text hierarchy and fits both languages without competing with the heading or chevron.
- Apply the same treatment to Sinun vuorosi for consistency. Only genuinely empty sections change; a filter hiding conversations still needs its explanation and reset action.
- Keep the empty state as a visible `role="status"` within the heading, outside the fold button, so it remains available to assistive technology even when Hiljaiset is folded.

## Verification

Tested the implementation in the accompanying commit, based on the worker's starting revision. All final checks passed:

- `./scripts/test-focused.sh --area web`: lint, typecheck, static checks and 248 test files / 2025 tests.
- With `OH_BROWSER_WORKERS=2 OH_LAB_WORKERS=2 OH_PORT_BASE=15600`, `./scripts/test-focused.sh --area browser --spec rail-section-filter.spec.ts --spec rail-icons-quiet.spec.ts --spec rail-now.spec.ts --spec lab-rail-scroll-region.spec.ts`: 12 ordinary and 6 lab cases passed.
- `npx playwright test tests/rail-section-filter.spec.ts --repeat-each 3` from `web/`, with two workers and reply jitter: 12 passed. Includes Finnish/English header geometry, fold interaction, axe, filtering, and keyboard navigation.
- Browser runs are host-backed synthetic evidence, not live installation or real screen-reader speech verification. No deployment was performed.
- Initial setup needed the pinned Pi fixture dependencies; an initial typecheck found a test fixture scope mistake, and a pre-existing wording assertion needed updating to a role query. Both were fixed before the passing final runs.

Synthetic screenshots and paired HTML: `/var/tmp/agent-keep/rail-empty-section-one-row/fi-FI.{png,html}` and `en-US.{png,html}`. Both screenshots were visually inspected; the short text stays aligned within the rail.

## Focused self-review

Low-risk presentation-only change: no session, wire-contract, daemon, or authorization change, so a focused self-review rather than an independent model review. Reviewed the full diff, genuine-empty versus narrowed-empty conditions, folded state, accessible heading/status structure and typography. `railRegions.tsx` calculates crowding from rendered region, section and heading heights; it returns uncrowded for zero quiet rows. No hard-coded empty-row allowance needed changing. The existing crowded/ordinary/phone region browser cases pass with the smaller sections.

## Live check

After deployment, open a rail with empty sections in Finnish and English. Each empty state should share its heading's row. Toggle Hiljaiset, then populate and filter a section: its normal controls and filtered-empty reset should still work. Resize the window to check conversation/workspace scrolling remains usable.

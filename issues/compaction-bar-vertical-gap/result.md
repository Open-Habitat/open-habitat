# Result

The compaction notice now uses the composer stack's existing spacing token above it. The stream already supplies that spacing below its last row; a following stream-level banner gets the same separation without doubling the composer inset.

The cause was not margin collapse: the notice is a flex child outside the timeline's gap-managed grid, with an explicit zero block margin. Neither a normal reply nor a held message supplied the missing gap.

## Verification

- Focused web checks: 216 files, 1,674 tests passed; formatting and TypeScript passed.
- `context-ring.spec.ts` and `conversation-context-view.spec.ts`: 12 passes across three repetitions, including running, failed and completed compaction journeys.
- New bounding-box assertions cover normal replies and held-message cards, with/without draft attachments, widths 1440/390, and light/dark/contrast. Before: 0 above, 9 below. After: 9 on both sides, measured against the stack's rhythm rather than a duplicated pixel constant.
- Synthetic lab captures: both layout cases passed; scale-2 before/after screenshot and HTML pairs remain outside the repository in the requested worker-results directory.
- Palaa tähän was exercised as a floating overlay, not a stacked banner; closing it preserves the lower gap. Other following stream banners were checked in source; they share the adjacent-sibling spacing rule.
- Focused self-review: no authority, state, contract or feature-switch changes. No unresolved findings.

This is synthetic browser/layout evidence, not a live Pi or production-host check. The held case seeds the tab's acknowledged-message delivery grace and holds incoming events while measuring; it does not claim to test native delivery timing.

## Decisions for later review

- Use `--ah-s3`, the existing composer-stack rhythm, rather than the feed's inter-message gap or a new token. The notice bridges the transcript and composer; matching their existing lower gap avoids changing unrelated message spacing.
- Leave Palaa tähän's floating behavior unchanged. Moving it into document flow would be a separate design change, not this spacing repair.

Live check: during compaction, compare the notice's gaps after a reply or a waiting message, then add/remove a draft attachment and try a phone-width view. Both sides should have the same spacing.

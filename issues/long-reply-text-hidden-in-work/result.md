# Result

## Cause and fix

`internal/daemon/history_blocks_linux.go` shares a 16 KiB text-preview budget
across an entry's thinking and text blocks. Thinking can exhaust it before a
person-facing text block: that block then has `text: ""` and `readable: true`.
The content still exists in native history.

`HistoryView.timelineItems` already classifies native `text` as a reply and
`thinking` as folded work; neither text length nor a tool call makes text into
thinking. But it discarded the `readable` distinction when building turn steps.
`AgentTurn.turnStages` then skipped the apparently empty reply. Consequently,
its preceding thinking and following tools appeared in one work stage, and
only the later short text remained visible. The final card uses the last
stage's text; earlier nonempty text stages become interim cards.

The browser now preserves readable replies even without preview text and loads
their first bounded page through the existing validated block-read path. It
keeps the normal load-more/retry control. Thinking stays folded, and genuinely
empty streaming placeholders still create no card. No daemon, contract,
shared session state, or authority boundary changed.

This is a source-grounded synthetic reproduction, not verification of the
reporter's original native history, which was not accessed.

## Verification and review

- Regression tests first failed because the interim card was absent. They now
  cover successful loading and failed loading with a visible retry, two tools,
  a short final answer, and folded thinking/work. Component coverage also
  checks a final reply with an empty readable preview and retains the existing
  genuinely-empty-placeholder regression.
- `./scripts/test-focused.sh --area web`: passed, 217 files / 1,695 tests,
  including lint and type checking.
- `./scripts/test-focused.sh --area browser --spec lab-long-reply-preview.spec.ts`:
  passed. The same named spec passed three repetitions with two workers and
  0–60 ms response jitter, using port base 17500.
- Browser evidence uses a synthetic host turn, two native fake-Pi calls, and
  intercepted history/block responses reproducing the exhausted preview.
  It verifies browser visibility, not a real provider or separate-UID isolation.
- Focused self-review: checked preview classification, bounded fetching,
  failure/retry behavior, unchanged folding, and the final/interim rule.
  Inspected the synthetic screenshot: the full opening text and short final
  card are visible, with thinking and both tools folded between their replies.
  Paired PNG/HTML captures are outside git under
  `worker-results/01m7dxc2skaxjj99s0jgxevsnh/long-opening-reply.*`.
- Initial browser setup failures were repaired: installed the missing pinned
  Pi SDK fixture; corrected an oversized synthetic preview; moved capture to
  the lab host with its actual origin and lab workspace. Final checks above
  passed. No full browser suite or clean gate was run.

## Decisions for later review

- Keep the opening text as an interim reply, rather than append it to the
  final answer: this preserves native order and the already agreed stages.
- Automatically fetch only the first page when a readable reply has no visible
  preview. Alternatives were an empty load button or expanding the host's
  preview budget; this makes text visible without changing host bounds or
  automatically fetching arbitrarily large replies.

Live check: after deployment, reopen a completed turn with long thinking,
substantial text before two tool calls, and a short final answer. The opening
text should appear as an interim reply without opening work; thinking should
remain folded.

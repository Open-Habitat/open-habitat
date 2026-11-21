# Result

Removed the no-op history-mode property, callback and toggle, their production/story/fixture/test arguments, both unused translations and the unused react-virtual dependency and lock entries. The real history pager and scroll implementation are unchanged. No behavioral test was removed; existing tests only stopped supplying the meaningless property.

## Verification

- `./scripts/test-web-fast.sh`: all 234 test files / 1921 tests passed on the combined hygiene changes.
- `npm run storybook:test --prefix web`: catalog built successfully. Reviewed the affected story source states; no production history behavior was replaced by a story-only approximation.
- Focused `history-first-page.spec.ts`: three passing runs with two workers.
- `lab-conversation-scroll.spec.ts`: two full passing runs; the third passed five cases and failed the existing live-row spacing assertion at line 301 (`8399ms +142px`). The same case failed on unchanged main `b4813239b9b32196e6a7e1ed8f64d6492f1f89d7` (`9203ms +328px`). This is already tracked by `practically-ancient-swing`; the new reproduction was added there rather than filing a duplicate or changing unrelated scrolling code.
- An intermediate build caught imports during the separate JSON-reader migration; those imports were corrected before the final runs.

The required scroll verification is not wholly green. This issue remains in testing and the worker must report failure without merging, preserving the implementation for the conductor.

Evidence: `/var/tmp/agent-keep/five-hygiene/{web-final,storybook,browser-final,history-main}.log`. The tested sources are those in this commit with the sibling hygiene changes. These are synthetic checks, not a live installation or full-suite receipt.

## Review

Low-risk source-level self-review: this removes an unreachable production control and an unused dependency. Real paging, history-store ownership and scrolling remain unchanged. No sessions, contract or authorization boundary changed.

## Decisions for later review

None. The stories now show only the history behavior that exists.

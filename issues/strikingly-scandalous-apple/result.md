# Result

Replaced the paging/recovery journey's editor-enabled checks with explicit composer readiness: `data-mode="send"` (the native run is no longer active), then no pending send (`aria-busy`), and an enabled send button after filling each new message. Each loop send has a numbered Playwright step. The overall 90-second timeout is unchanged; readiness assertions have a 30-second bound.

## Investigation

`BrowserConversation.tsx` deliberately keeps the editor enabled during work and status refreshes. Its composer activity follows `current.run_active`, and `Composer.tsx` changes the send mode to steer/follow-up during that activity. The fake Pi appends the answer before emitting `message_end` and `agent_end`. Thus neither answer text nor an enabled textarea establishes readiness for a new idle turn. The old test left that synchronization implicit in a filtered click, potentially consuming the remaining test deadline there; it now waits explicitly before filling and after each answer/reload.

No product slowness was reproduced. The unchanged test also passed ten repetitions at two workers and ten at eight workers. This establishes an incorrect readiness assertion, **not** a proven causal reproduction of the original gate-only timeout. The next round's main clean gate remains the check for recurrence under the original full-suite workload.

## Validation

Tested base: `2d977884d4839a1c200ad0953f6e6ea9bec1de2c`, with only the spec changed; tested spec Git blob: `710b3dec346b5dbf3abb0d648cfa49094cde5fa7`.

Commands from the repository root (browser commands from `web/`):

- `TMPDIR=/var/tmp npx playwright test --config playwright.lab.config.ts tests/lab-conversation.spec.ts --grep 'fresh replies and exhausted older history' --repeat-each 10 --workers 8 --trace on`: **10 passed**, 34.5 seconds.
- `TMPDIR=/var/tmp npx playwright test --config playwright.lab.config.ts tests/lab-conversation.spec.ts --workers 4 --trace retain-on-failure`: **12 passed**, 28.1 seconds.
- `TMPDIR=/var/tmp ./scripts/test-focused.sh --area web`: format, lint, typecheck and **683 tests passed**.
- `git diff --check`: passed.

Browser checks used Alder's ordinary `npx` routing to the Cedar warm runner, with fresh synthetic hosts and fake Pi. No live user data, real provider, distinct-UID isolation or clean-gate claim. Product code, fixtures, dependencies and the remaining paging/recovery assertions are unchanged.

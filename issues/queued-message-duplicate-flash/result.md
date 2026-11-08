# Investigation — incomplete

No production fix; issue remains open. The required browser reproduction did
not fail against base `13a31034056cc89e25d268a7f5d66ceeda053d7d`.

## Evidence

Added a probe in `web/tests/queued-send.spec.ts`: start a slow fake-Pi turn,
queue a follow-up with Alt+Enter, observe transcript mutations through both
answers, and reject any observation containing the first answer twice.
This checks intermediate DOM states, not only the settled transcript.

- `./scripts/test-focused.sh --area browser --spec queued-send.spec.ts`:
  14 passed (1.3 minutes), with `OH_BROWSER_WORKERS=2`,
  `OH_PORT_BASE=15700`, private disk-backed TMPDIR and umask 077.
- `./scripts/test-focused.sh --area web`: static checks and 188 test files /
  1408 tests passed.
- `python3 scripts/validate-project-view.py` and `git diff --check`: passed.
- Earlier exploratory runs also passed for steering and for a follow-up with
  EventSource callbacks delayed by 750 ms. A later 2500 ms experiment tried
  to trigger a history read through `/fixture/notice`, but supplied the wrong
  ID shape and did not check the HTTP response. Inspection established that
  this endpoint only publishes a non-persisted notice anyway: that experiment
  is **not evidence** of history/stream overtaking. Removed those test seams.

These are host-backed synthetic tests, not real Pi/provider or live-host
reproduction. No clean gate, full browser suite, or live screenshots taken.
Focused self-review only: the retained changes are test and investigation
material, not session-state or production changes.

## Source observations and next investigation

`conversationEvents.ts` retires assistant fragments when `history.entry`
arrives. `conversationStore.ts:applyPage` instead clears fragments only when
a current status supplies a settled native key contained in the incoming page.
`BrowserConversation.tsx` filters saved tool-call fragments, but a plain-text
reply has no comparable call identity. It then places the outstanding own
message between saved timeline rows and the remaining live row. A history
read overtaking journal delivery is therefore a concrete ordering candidate,
**not a confirmed cause** from this run.

The next worker should control that exact ordering (a history page containing
the first completed answer arrives while its unkeyed live fragments remain,
with the follow-up already accepted), first in the store's controlled-transport
tests and then in a browser spec. Do not deduplicate by answer text: separate
turns can legitimately contain identical answers. The current browser probe
passes before any fix, so it alone cannot validate a correction.

## Decisions for later review

Preserve the passing probe and leave the bug open, rather than change the
history/live merge based on an unconfirmed hypothesis. Alternatives were a
text-matching suppression or clearing fragments at a guessed boundary; both
risk hiding legitimate content. No product, security or authority decision
was made.

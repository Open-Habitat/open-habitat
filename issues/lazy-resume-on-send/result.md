# Not implemented in this run

Run `01m52qdasz0zmd2rx0bmfbd310` retained only the shared colour/geometry fixes and their evidence. It made no daemon, continuation or contract changes. This issue remains open; the existing explicit-continuation/read-only behavior is unchanged.

The mandatory host-backed browser test spanning a real daemon restart with no read-only state and exactly-once first-send delivery was **not implemented or run**. Opening-without-starting and reconnect/no-replay acceptance for the new behavior are likewise unproven. There is no lazy-resume prototype-compliance claim, paired lazy-resume-state evidence or live verification.

## Continuation notes

The current authority remains in `internal/daemon`:

- `conversation_linux.go:create` launches Pi and blocks its HTTP response on initial `get_state` (up to fifteen seconds).
- `continuation_linux.go:continuationProof` owns the browser-origin, native-history, workspace, process census and advisory-lock admission proof. Reuse that proof on send; do not turn a browser eligibility read into a writer reservation.
- `continueEnded` currently launches the child only on explicit POST. GET eligibility/history does not start Pi.
- `sendKind` currently admits one command against an existing live handle, spends its command ID before the asynchronous RPC, and never retries ambiguous writes.
- `useConversation` and `ConversationActions` currently retain a single outstanding send in session storage; receipt disappearance on restart remains uncertainty, not rejection.

A daemon-owned pre-start queue must provide receipts, joining into one prompt, cancellation with acknowledged text restoration and failed-start retention. Merely changing the read-only label or automatically posting the existing continue action on opening would violate the task. No such shortcut was made.

## Decisions for later review

No product or authority decisions. Preserve Jari's existing decisions. The combined worker result is unsuccessful and must not merge or close the three issues.

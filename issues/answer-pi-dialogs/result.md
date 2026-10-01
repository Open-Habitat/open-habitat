# Slice 1: daemon and browser contract

## Browser request

The authenticated conversation lease supports `POST /api/v1/conversations/{uuid}/question`, with the same session cookie, Origin and CSRF checks as other writes. Body: `{"request_id":"<pending native id>","action":"answer","value":"text or selected option"}` for input/select; `value` is a boolean for confirm. For cancellation use `{"request_id":"<pending native id>","action":"cancel"}` (no value); cancellation works for unknown dialog kinds too, but answering those does not. Fetch the current `pending_question` from status/snapshot or `question.requested` from SSE; it contains request_id, question_kind, prompt and choices as plain text. The response is `{"schema_version":1,"request_id":"...","state":"uncertain"}` even after a complete write: Pi gives no correlated receipt. A stale, duplicate or conflicting request returns 409 `control_uncertain`. A lost reply, transport failure or daemon restart is uncertain; **never retry the answer or cancel**. Refresh status to observe whether Pi has moved on; no lack of pending question proves the specific answer was delivered. The gateway does not forward browser-supplied identity headers and accepts writes only for a conversation leased to that browser session. This is a private HTTP controller route, not the generic command endpoint; `agent.question.respond` contract arguments now distinguish answer from cancel.

## Scope and limits

The daemon spends each native request ID before writing, serializes the write on Pi's RPC stdin, validates the response against the observed kind/options, and does not interpret transport completion as Pi acknowledgement. Unknown response-bearing kinds remain inert text with cancel only. Non-dialog extension UI updates do not replace the pending request. Pi dialog timeouts have no native cancellation event; a late answer remains uncertain. Browser controls are scope 2 and remain unchecked in the issue.

## Evidence

Focused synthetic fake-Pi and gateway validation tests: `TMPDIR=/var/tmp go test ./internal/daemon ./internal/gateway -run 'TestQuestion|TestConversationReceiptAndUnknownQuestion' -count=1` (pass). Full clean gate and review results to follow.

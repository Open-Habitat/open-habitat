# Gateway boundary fixture repair

## Cause and repair

The restart is a gateway restart, not a daemon restart. The Unix listener and fake daemon remain alive throughout; readiness is not the missing condition.

A diagnostic 1,000-repetition Go/race run reproduced five failures, also at create and dialog answer (not just after restart). Temporary transport instrumentation reported `write unix ...: broken pipe` for each failure. The fake daemon sent its reply without consuming the POST body. With `DisableKeepAlives`, the server can close the Unix connection while Transport is still writing. The fixture now consumes the request before replying, matching the real write handlers. No gateway policy, timeout, identity fence or write retry changed. Diagnostic product edits were removed.

Baseline: `/var/tmp/oh-harvest-gateway-baseline.log` (failed, five EPIPE occurrences). This is synthetic same-UID HTTP evidence, not live-server readiness or isolation evidence.

## Decisions for later review

None: fix the fake server rather than retrying uncertain writes or changing production transport.

## Focused self-review

The body-less framing assertions, authentication/CSRF checks, mapped socket/peer check and post-restart write assertion remain. Body read errors fail the test instead of returning a fabricated success. No production code changed; an external product-code review is not applicable.

## Validation

`go test -race ./internal/gateway -run '^TestConversationGatewaySessionBoundary$' -count=1000` passed under eight-worker browser load (52 s package time; `/var/tmp/oh-harvest-gateway-fixed.log`). Go ran under `umask 077` and a private short disk-backed TMPDIR. Full package and final committed gate results will be recorded before landing.

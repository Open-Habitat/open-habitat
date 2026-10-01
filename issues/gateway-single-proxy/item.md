---
created: 2026-10-01
updated: 2026-10-01
type: task
reporter: jari
status: open
priority: high
related: ['@architecture-built-on-caution']
lane: caution-removal
lane_seq: 20
blocked_by: ['@gateway-authorize-once']
---

# Replace gateway byte-exact proxies with one stdlib proxy

## Goal

Step 2 of the [architecture review](../../docs/reviews/architecture-review-2026-10.md) removal plan. Replace the five byte-exact proxy implementations in `internal/gateway` (snapshot, history, Pi status, Pi attempt, conversation and events forwarders) with one stdlib proxy over a Unix transport.

## Scope

- One function: check session, check the mapped socket once with `udssecure.Mapped` (G7), dial through `http.Transport` with a Unix `DialContext`, copy method, path, query, body and `Last-Event-ID` in; copy status, `Content-Type` and body out with one size cap; streams flushed per write with a write deadline; follow the browser's context plus one generous deadline (G11).
- Delete: protocol-version, single-header, exact-Content-Length and trailing-byte checks (G8); snapshot identity rebinding and Pi status re-marshalling (G9); `validatedConversationReply`, `validConversationError`, `validCombinedPayload`, `strictObject` and the status-code allowlists including the 502/503 distinction (G10, G12, G13); `validConversationInput` (G15); `streamHeaderReader` (G17); HTTP/1.1 pinning and body-absence guards (G5).
- Keep Origin + CSRF on writes (G6), `uiReturn`, `safe()`.
- Browser: remove the 502 branch in `web/src/app/pi.ts` and `App.tsx`; parsers in `conversations.ts`, `snapshot.ts` stay as the single validation layer.
- Do not remove the conversation lease table here; that is @drop-conversation-lease.

## Acceptance Criteria

- [ ] Gateway tests reduced to: status and body forwarded, streams flush, oversize body cut, two users cannot reach each other's daemon (`snapshot_integration_linux_test.go`, `TestAuthenticatedGatewayToTwoDaemonSnapshotHandlers`).
- [ ] Adding a status field in the daemon reaches the browser without a gateway change (test: daemon fixture adds an extra field, browser parser receives it).
- [ ] `scripts/ci-local.sh --clean` passes; Playwright specs unchanged.

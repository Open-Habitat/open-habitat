---
created: 2026-10-01
updated: 2026-10-01
type: task
reporter: jari
status: done
priority: high
related: ['@architecture-built-on-caution']
lane: caution-removal
lane_seq: 20
blocked_by: ['@gateway-authorize-once']
closed: 2026-10-01
closed_by: claude
---

# Replace gateway byte-exact proxies with one stdlib proxy

## Goal

Step 2 of the [architecture review](../../docs/reviews/architecture-review-2026-10.md) removal plan. Replace the route-specific proxy implementations in `internal/gateway` (snapshot, history, Pi status, Pi attempt, conversation and events forwarders) with one stdlib proxy over a Unix transport.

## Scope

- One function: check session, check the mapped socket once with `udssecure.Mapped` (G7), dial through `http.Transport` with a Unix `DialContext`, copy method, path, query, body and `Last-Event-ID` in; copy status, `Content-Type` and body out with bounded finite bodies; streams flushed promptly with a stalled-write deadline. Follow browser cancellation and use deadlines compatible with long-lived events (G11).
- Delete: protocol-version, single-header, exact-Content-Length and trailing-byte checks (G8); snapshot identity rebinding and Pi status re-marshalling (G9); `validatedConversationReply`, `validConversationError`, `validCombinedPayload`, `strictObject` and the status-code allowlists including the 502/503 distinction (G10, G12, G13); `validConversationInput` (G15); `streamHeaderReader` (G17); HTTP/1.1 pinning and body-absence guards (G5).
- Keep Origin + CSRF on writes (G6), `uiReturn`, `safe()`.
- Browser: remove the 502 branch in `web/src/app/pi.ts` and `App.tsx`; parsers in `conversations.ts`, `snapshot.ts` stay as the single validation layer.
- Do not remove the conversation lease table here; that is @drop-conversation-lease.

## Result to establish

Daemon status codes and bodies reach the browser unchanged, including added
fields. Streams flush promptly, cancellation releases the connection, stalled
writes are bounded, and finite-body limits do not truncate a healthy long-lived
stream. Routing still confines each user to the mapped daemon.

The gateway integration, conversation and events tests provide the starting
coverage. Replace assertions about removed parsing with these forwarding and
boundary outcomes; browser journeys continue to work.

Test selection and the final gate follow [TESTING.md](../../TESTING.md).

## Resolution

The shared Unix HTTP proxy replaces the route-specific response validators; browser parsing and daemon peer checks remain, while the conversation lease stays for step 5. The final clean gate passed on `6b35448`; see [result.md](result.md) for tests, review and remaining distinct-UID verification limits.

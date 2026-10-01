---
created: 2026-10-01
updated: 2026-10-01
type: task
reporter: jari
status: open
priority: high
related: ['@architecture-built-on-caution']
lane: caution-removal
lane_seq: 10
---

# Gateway authorizes a session once at login

## Goal

Step 1 of the [architecture review](../../docs/reviews/architecture-review-2026-10.md) removal plan. The gateway authorizes a browser session with the broker once, at login. For a live session it never asks the broker again; the session ends on idle or absolute expiry, logout, or `RevokeSubject` (ADR 0006).

Decision (Jari, 2026-10-01, recorded in @architecture-built-on-caution): broker authorization is checked once per session; `RevokeSubject` is the only runtime revocation path; editing the allowlist no longer logs anyone out mid-session.

## Scope

- `internal/gateway/auth.go: authenticated`: remove the broker `authorize` round trip and the epoch/generation comparison; keep the session map lookup, expiry and idle extension (rows G1, G2).
- `internal/gateway/conversation_linux.go`: remove the second `authenticated` after the body read (G16) and the per-frame recheck in `forwardConversationStream`; `events_linux.go`: remove the per-frame and per-heartbeat recheck (G13 auth part).
- Keep callback-time `ensure` + `authorize` and the revoked-serial checks (G3).
- Update `docs/adr-0006-subject-revocation.md` and `docs/interfaces.md` so that revocation is the only runtime path.

## Result to establish

A counting broker shows no authorization exchange after login for live-session
requests or forwarded stream frames. Session expiry, logout and
`RevokeSubject` still deny subsequent requests, including when revocation races
login. The two-daemon routing scenario still isolates users.

The session and revoke tests and
`TestAuthenticatedGatewayToTwoDaemonSnapshotHandlers` are the existing starting
points. ADR 0006 and interfaces describe explicit revocation as the runtime
revocation mechanism; changing the allowlist alone does not end live sessions.

Test selection and the final gate follow [TESTING.md](../../TESTING.md).

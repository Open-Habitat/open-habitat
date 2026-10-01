---
created: 2026-10-01
updated: 2026-10-01
type: task
reporter: jari
status: in-progress
priority: high
related: ['@architecture-built-on-caution']
lane: caution-removal
lane_seq: 50
blocked_by: ['@gateway-single-proxy', '@daemon-drop-status-stream']
---

# Remove the gateway conversation lease table

## Goal

Step 5 of the [architecture review](../../docs/reviews/architecture-review-2026-10.md) removal plan. Remove the gateway's cookie-keyed conversation lease table; the daemon owns every conversation of its Unix user.

Decision (Jari, 2026-10-01, recorded in @architecture-built-on-caution): a conversation is owned by the Unix user, not by a browser session. Any valid session of the same person controls their conversations; the daemon's ownership flock keeps the one-writer rule.

## Scope

- Gateway: delete `a.conversations`, `ownsConversation`, the create-time binding under lock, the `list` filtering, the `X-Agent-Host-Session` header on conversation routes (G14). `RevokeSubject` no longer needs to clear leases.
- Daemon: unchanged ownership (`piOwnership`, `continuationProof`); 404 for unknown IDs is already the daemon's answer.
- Browser: remove `list`/`sessions`/`recheckList` and the "Tarkista keskustelulista" button; `controlled` derives from status alone (B7). Keep the Pi attempt session binding (`pi_attempt_linux.go`) as is; it is onboarding state, not a conversation.
- `docs/interfaces.md` and `docs/architecture.md`: one writer per conversation is the daemon's rule; the gateway holds no conversation state.

## Result to establish

A second login of the same person can control the existing conversation,
including after a gateway restart followed by login. This assumes the daemon
and its Pi child survived; restarting a dead child remains continuation.
Different Unix users cannot reach each other's conversations, and the daemon
still prevents competing writers to one native session.

Exercise both same-user access and cross-user routing through the gateway,
with daemon ownership tests retaining the writer-lock coverage. Update the
architecture and interfaces to describe Unix-user conversation ownership.

Test selection and the final gate follow [TESTING.md](../../TESTING.md).

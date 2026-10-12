---
created: 2026-10-12
updated: 2026-10-12
type: bug
status: fixed
priority: high
lane: signin-fix
lane_seq: 4
collision: [internal/provision/, internal/gateway/]
closed: 2026-10-12
closed_by: claude
---

# Signed-in users lose their daemon after a host reboot

_Source: chat_

Observed on the pilot.20 test guest, 2026-10-12 07:29–07:31 UTC: after a host reboot (done by the storage-quota deployment), Jari's browser session survived but every daemon request failed with gateway `daemon_route failed socket_binding_unavailable user=maintainer`. Onboarding then showed "Kirjautuminen keskeytyi / Tilaa ei voitu vahvistaa" on the OpenAI step, and "Tarkista tila" cannot help.

Cause: the per-user `open-habitat-daemon@<user>.socket` is not enabled at boot on the guest (JIT sockets are started by the broker's `ensure` during sign-in, `LinuxHostExecutor.Ready`), while `authorize`, used for an existing session, is read-only by design and never starts the socket. So any host reboot or socket stop leaves every signed-in person stuck until they sign out and in again, and the UI does not tell them that.

Decide and implement how a bound user's socket comes back for a valid session after reboot: for example the gateway asking the broker for an `ensure`-like activation (no token handoff) when the route is unavailable, or the installation re-activating committed bindings at boot through the gated path. Whichever is chosen must keep the broker as the only authority that starts sockets and keep the JIT gate in front of activation. Until then, the UI should at least say that signing in again restores access.

## Acceptance Criteria

- [x] Broker startup verifies committed bindings and restores admissible daemon sockets through the JIT-gated `Ready` path without a new sign-in.
- [x] A definite activation failure for one user does not prevent the broker from serving or attempting later bindings; an uncertain submitted start fails closed.
- [x] The full clean gate passes on the implementation tree. Concrete boot ordering and live reboot verification are handed to the release worker in `result.md`.

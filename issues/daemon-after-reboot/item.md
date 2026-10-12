---
created: 2026-10-12
updated: 2026-10-12
type: bug
status: open
priority: high
lane: signin-fix
lane_seq: 4
collision: [internal/provision/, internal/gateway/]
---

# Signed-in users lose their daemon after a host reboot

_Source: chat_

Observed on the pilot.20 test guest, 2026-10-12 07:29–07:31 UTC: after a host reboot (done by the storage-quota deployment), Jari's browser session survived but every daemon request failed with gateway `daemon_route failed socket_binding_unavailable user=maintainer`. Onboarding then showed "Kirjautuminen keskeytyi / Tilaa ei voitu vahvistaa" on the OpenAI step, and "Tarkista tila" cannot help.

Cause: the per-user `open-habitat-daemon@<user>.socket` is not enabled at boot on the guest (JIT sockets are started by the broker's `ensure` during sign-in, `LinuxHostExecutor.Ready`), while `authorize`, used for an existing session, is read-only by design and never starts the socket. So any host reboot or socket stop leaves every signed-in person stuck until they sign out and in again, and the UI does not tell them that.

Decide and implement how a bound user's socket comes back for a valid session after reboot: for example the gateway asking the broker for an `ensure`-like activation (no token handoff) when the route is unavailable, or the installation re-activating committed bindings at boot through the gated path. Whichever is chosen must keep the broker as the only authority that starts sockets and keep the JIT gate in front of activation. Until then, the UI should at least say that signing in again restores access.

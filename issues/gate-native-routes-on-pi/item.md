---
created: 2026-09-28
updated: 2026-09-30
type: task
status: open
priority: normal
related: ['@design-first-use-onboarding', '@add-pi-device-adapter']
lane: gateway-pi-gate
collision: [internal/gateway/, internal/daemon/, contracts/v1/, docs/]
blocked_by: ['@add-pi-device-adapter']
---

# Gate native browser routes on Pi sign-in

After browser login, a user can choose and check out GitHub repositories, then
sign in to Pi before opening normal workspaces, native history or agent controls.
The product needs usable agent authentication for normal work. Missing or unknown
Pi status therefore leads to setup or recovery, including when the user arrives
through a direct URL or a stale tab.

The first-use repository chooser and checkout are the narrow exception agreed
in @github-repos-first-onboarding. They do not open the normal workspace,
history or control routes before Pi sign-in.

Pi exchanges, stores and refreshes credentials under the mapped Unix user.
The daemon starts Pi's native device-code operation and relays its instructions
and progress; the gateway authenticates the browser and routes to that user's
daemon. This keeps Pi credentials out of the gateway and preserves ordinary
SSH/tmux use. A pending attempt belongs to both its Unix user and its browser
session: neither another user nor another login session can take it over.

An interrupted attempt or lost daemon state leaves sign-in uncertain. Recovery
comes from checking Pi's native state, so an old browser view cannot turn missing
state into a successful login. The approved device-code interaction is recorded
in @design-first-use-onboarding, with the repository-first ordering above.

The read gate, session-owned start/status/cancel routes and generated contract
already exist. [result.md](result.md) holds their browser and distinct-UID test
evidence; [repository-first evidence](../github-repos-first-onboarding/result.md)
covers the exception. Finish the remaining integration from the current code and
record what now demonstrates the access boundaries and recovery behavior.
[TESTING.md](../../TESTING.md) explains what each test layer establishes.
The onboarding work owns the wizard; @build-agent-control owns conversation
control and terminal-history behavior.

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

## Goal

After browser login, a user chooses and checks out GitHub repositories, then
signs in to Pi before opening normal workspaces, native history or agent controls.
When Pi status is missing or unknown, the browser shows the setup or recovery
needed to continue.

The narrow first-use repository chooser and checkout run before Pi sign-in,
as Jari decided in @github-repos-first-onboarding. Normal workspace and history
access still depend on usable Pi authentication.

## Authority and ownership

Pi exchanges, stores and refreshes its own credentials under the mapped Unix
user. The daemon starts the native device-code operation and relays Pi's
instructions and progress. The gateway authenticates the browser and routes to
that user's daemon; it does not need access to native credentials.

Both Unix-user identity and browser-session ownership matter: another user or
another login session must not take over a pending sign-in. Missing daemon state
or an interrupted attempt is uncertainty to show and reconcile against Pi,
not evidence of a successful login. Existing SSH/tmux use remains native.
The accepted interaction and its reasons are in @design-first-use-onboarding.

## Existing work and completion

The Pi read gate, session-owned start/status/cancel routes and generated contract
are implemented. [result.md](result.md) records synthetic browser tests and
separate-UID container evidence, with their limits. The repository-first flow
has its own [evidence](../github-repos-first-onboarding/result.md). These reports
describe particular revisions; compare their remaining gaps with current code
and deployment receipts rather than treating every old gap as unfinished work.

Complete any remaining integration so direct URLs, stale tabs and unavailable
Pi state preserve the gate, the repository-first exception stays narrow, and
users can understand and recover from interrupted sign-in. Keep the browser
contract consistent with that behavior. The wizard belongs to the onboarding
work; conversation control and terminal-history behavior belong to
@build-agent-control.

Demonstrate the access and ownership boundaries at the layers that exercise them.
[TESTING.md](../../TESTING.md) defines the project checks. Update the result with
what is verified and any concrete remaining gap; synthetic tests and real host
receipts establish different things.

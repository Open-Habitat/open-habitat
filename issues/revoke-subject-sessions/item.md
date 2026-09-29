---
created: 2026-09-29
updated: 2026-09-29
type: task
reporter: jari
status: in-progress
priority: high
lane: gateway-revocation
collision: [internal/gateway/, docs/]
---

# Revoke one subject browser sessions safely

## Decision and purpose
2026-09-29: Jari approved implementing per-subject invalidation without asking for repeated permission during this pre-release test cycle. This unblocks an independently reviewed, Jari-only test-state reset. Avoid restarting the shared gateway or broker, deleting the binding, recycling a UID, or clearing other users' sessions. Fleetrepo `infra/native-agent-host-test/JARI-TEST-STATE-RESET.md` records the exact blocker in pilot.10; it is currently a NON-executable synthetic preflight.

## Delivery
- Implement an explicitly authorized, non-browser control path to atomically invalidate all active browser sessions, pending OAuth states and per-subject conversation authorizations for one broker-verified immutable subject/binding, without touching any other subject or copying home/credential state into the gateway. No user-supplied UID, cookie, or GitHub email as authority. Privilege mechanism must remain fail-closed and testable; record any changed authority/interface in an ADR before landing it.
- Specify ordering with in-flight callbacks, concurrent login, daemon handles and broker reauthorization: once revoked, old sessions cannot regain access through a race; distinguish revocation of gateway memory from provider-side tokens and UID-owned state. No externally reachable unauthenticated admin endpoint or broad global restart disguised as per-user reset.
- Synthetic two-subject tests for old and new cookies, pending-flow and callback races, wrong-subject denial, reboot/restart behavior, reconnect and replay. Keep tests away from real credentials, homes and browser profiles.
- Pass `./scripts/ci-local.sh --clean --json` on committed tree. Review the final security-sensitive diff independently and document tested evidence and remaining reset prerequisites; do not execute live reset in this issue.

## Scope boundary
Gateway retains browser authentication authority; daemon retains per-UID native credentials and work. Fleetrepo owns the concrete host-only reset procedure and private subject IDs. If safe authorization for the maintenance entry point requires a new root broker responsibility or cannot be bounded, record the exact architecture blocker before implementing a weaker shortcut.

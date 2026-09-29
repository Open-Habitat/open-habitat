---
created: 2026-09-29
updated: 2026-09-29
type: task
reporter: jari
status: done
priority: high
lane: gateway-revocation
collision: [internal/gateway/, docs/]
closed: 2026-09-29
closed_by: agent
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

## Comments

### 2026-09-29T11:45:42Z · @agent

Implemented at 3999b0a338793cef0e72c9cc2653fa76c627db8e (ADR 0006). Root-only systemd-created local control socket and CLI; gateway validates kernel peer UID and broker subject binding, removes only matching browser sessions/conversation grants and cuts off earlier anonymous OAuth flows after provider identity resolution. Old flows cannot issue sessions even when revocation races the native handoff. No HTTP admin route, daemon access, binding rewrite or global gateway restart.

Evidence: `go test -race ./internal/gateway ./internal/cli` passed at 3999b0a. Synthetic two-subject tests cover old/new cookie, wrong subject, pending callback, callback replay, restart, broker denial and handoff race; private socket framing and non-root peer rejection tested locally (root-success branch runs only on root runners). `./scripts/ci-local.sh --clean --json` passed from clean committed 3999b0a (`status: passed`, `clean: true`); includes release inventory, generated contracts and browser gate. Independent security review by claude-fable-5-1 on 855b5c9's security diff found no concrete exploitable authority/race defect; later 3999b0a only adds socket tests. First gate attempt failed due to missing docs manifest; corrected. A later gate passed checks but failed the final clean-tree assertion because the socket test file was added while it was running; committed and reran the gate cleanly. Initial review command invocation failed usage (prompt passed as positional argument), retried with stdin and completed. No remaining required tool failure.

Limits: synthetic tests do not prove live systemd activation, root peer success on this non-root runner, cross-UID isolation on guest, or operational reset. Broker `authorize` requires the subject daemon socket ready; revoke *before* stopping that socket or removing allowlist authorization, and a failed revoke changes nothing. New OAuth starts after revocation are allowed, so reset needs separately isolated ingress. In-flight requests already authenticated may finish; native credentials, provider grants, Pi state and daemon handles remain untouched. Fleetrepo must coordinate installation/enabling of the new socket with gateway restart before any release; no Fleetrepo mutation, deployment, real identity/home/provider flow or guest reset was performed.

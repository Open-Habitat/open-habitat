---
created: 2026-10-01
updated: 2026-10-01
type: task
reporter: jari
status: done
priority: high
related: ['@architecture-built-on-caution']
lane: caution-removal
lane_seq: 30
closed: 2026-10-01
closed_by: claude
---

# Daemon validates runtime and binding once at startup

## Goal

Step 3 of the [architecture review](../../docs/reviews/architecture-review-2026-10.md) removal plan. The daemon validates its environment once at startup and refuses to start if it fails; per request it authenticates the configured gateway UID using kernel peer credentials. Request-body validation and conversation admission remain daemon responsibilities.

## Scope

- Move to startup: `transport.validate` (binding file, NSS lookup) (D8), `checkSharedSelector` (D1), `validateRuntime` including the release-tree walk and `node --version` (D2), keep credential path checks at onboarding `Start`, where they can inform the user (D3). Missing first-use credentials are not a startup failure.
- `PiDevice.validate` becomes a constructor check; `TrustedPeer` and `historyAuthorized` reduce to the peer UID from `ConnContext`.
- Remove the `X-Agent-Host-Identity` / display-name headers on gateway and daemon (D9).
- Remove the UUID collision scan in `create` (D16).

## Result to establish

An unsafe binding, selector or runtime prevents daemon startup. A new user
without Pi credentials can still start the daemon and reach onboarding.
Counting fakes show no selector reads, runtime tree walks or Node version
probes during ordinary create, status, snapshot or events requests. Onboarding
may still invoke the Pi helper for its own purpose (D4).

Runtime, device and transport tests cover startup failures and peer rejection.
`docs/pi-runtime.md` and `internal/AGENTS.md` explain which facts are fixed at
startup and why changing the binding or runtime requires a daemon restart.

Test selection and the final gate follow [TESTING.md](../../TESTING.md).

## Resolution

### 2026-10-01T20:08:48Z · @claude

Startup checks, peer-only request authentication and credential-safe onboarding implemented; clean gate passed on a5a548d.

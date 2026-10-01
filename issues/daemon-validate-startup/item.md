---
created: 2026-10-01
updated: 2026-10-01
type: task
reporter: jari
status: open
priority: high
related: ['@architecture-built-on-caution']
lane: caution-removal
lane_seq: 30
---

# Daemon validates runtime and binding once at startup

## Goal

Step 3 of the [architecture review](../../docs/reviews/architecture-review-2026-10.md) removal plan. The daemon validates its environment once at startup and refuses to start if it fails; per request it checks only the kernel peer UID.

## Scope

- Move to startup: `transport.validate` (binding file, NSS lookup) (D8), `checkSharedSelector` (D1), `validateRuntime` including the release-tree walk and `node --version` (D2), credential path checks (D3, also at onboarding `Start` where they inform the user).
- `PiDevice.validate` becomes a constructor check; `TrustedPeer` and `historyAuthorized` reduce to the peer UID from `ConnContext`.
- Remove the `X-Agent-Host-Identity` / display-name headers on gateway and daemon (D9).
- Remove the UUID collision scan in `create` (D16).

## Acceptance Criteria

- [ ] `pi_runtime_linux_test.go` and `pi_device_linux_test.go` prove startup refuses an unsafe tree, selector or binding.
- [ ] `TestFixtureSnapshotAndEventsDoNotProbePi` extended: no Node spawn and no selector read during create, status, snapshot or events (counting fakes).
- [ ] `docs/pi-runtime.md` and `internal/AGENTS.md` say validation happens at startup and a runtime change requires a daemon restart.

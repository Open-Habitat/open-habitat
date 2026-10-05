---
created: 2026-10-05
updated: 2026-10-05
type: feature
reporter: jari
status: open
priority: normal
related: ['@decide-logging-policy', '@implement-diagnostic-emitter']
preparation: ready
lane: logging
lane_seq: 2
collision: [internal/gateway/, internal/provision/, internal/daemon/, internal/transport/, internal/nativegh/, docs/]
blocked_by: ['@implement-diagnostic-emitter']
---

# Correlate diagnostics across gateway, broker and daemon

# Correlate diagnostics across gateway, broker and daemon

## Goal

Implement steps 3 to 7 of the
[logging implementation plan](../decide-logging-policy/implementation-plan.md)
under [ADR 0013](../../docs/decisions/adr-0013-diagnostic-logging.md): the
login attempt ID crosses the broker request and daemon handoff channels, the
broker and the daemon record their own operations, privileged actions name the
verified actor, and the architecture pages describe what shipped.

## Scope

Attempt ID on the broker protocol and the daemon handoff frame, validated as a
short opaque token at both receivers. Broker records for admission, authorization,
reservation, publication, readiness and result; daemon records for the
credential handoff, Pi device start, snapshots and native discovery, with the
user taken from the daemon's binding. Browser-managed privileged changes record
actor, target and setting separately; root-only control actions record a root
peer. Update the deployment and identity-and-trust pages. A changed decision
gets a new ADR.

Deployed journal permissions, retention and ingress capture are Fleetrepo's and
tracked there.

## Acceptance Criteria

- [ ] Two simultaneous logins produce distinguishable three-service traces in a
      synthetic test; invalid or spoofed references are rejected without
      changing any authorization or routing result.
- [ ] Broker state and reply, and daemon outcomes under the mapped UID, are
      unchanged when logging fails; cross-user denial on the authenticated
      socket is covered.
- [ ] Tokens, device codes, Pi content, tool output and native stderr stay out
      of every record.
- [ ] Architecture pages match the implementation; focused tests, the clean
      gate and the applicable VM trust-boundary scenarios are recorded with
      skips named.

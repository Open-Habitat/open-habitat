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

An operator should be able to distinguish concurrent login attempts and locate the service where an operation stopped. Build on @implement-diagnostic-emitter under [ADR 0013](../../docs/decisions/adr-0013-diagnostic-logging.md). The [implementation plan](../decide-logging-policy/implementation-plan.md) identifies existing boundaries and representative failures; the result should describe the behavior that actually shipped.

Carry the gateway's opaque login attempt ID over the authenticated broker request and daemon credential handoff channels. Receivers validate it, but peer credentials, the mapped socket, the allowlist and the verified session still decide authorization and routing. Browser-chosen references are never evidence of identity or authority. Preserve the distinction between broker admission, account publication, daemon readiness, credential acknowledgement and browser session issuance; record classified outcomes at the component that knows them. The daemon takes user identity from its trusted binding, not from request data. Include useful failures in Pi device startup, snapshots and native discovery. Credentials, device codes, Pi history, tool output and native stderr do not belong in records.

For privileged browser changes, distinguish the verified session actor from the target and changed setting. A root-only control action identifies a root peer, not an unverified human operator. Diagnostics still cannot change outcomes or block work. Update the architecture account of deployed behavior; a change to the agreed authority or reader model calls for a new decision with Jari rather than an incidental code change. Fleetrepo's `nah-diagnostic-log-access` owns guest journal readers, retention and ingress evidence, not this product issue.

## Acceptance Criteria

- [ ] Concurrent synthetic logins produce distinguishable traces across the services they reach; malformed or spoofed references cannot change routing or authorization.
- [ ] Broker state and reply and daemon outcomes under the mapped UID are unchanged when logging fails; authenticated-socket cross-user denial remains effective.
- [ ] Synthetic tokens, device codes and work content are absent from records; actor and target are not conflated.
- [ ] Architecture documentation matches the landed implementation. The result records the tested revision, focused and clean CI checks, applicable VM trust-boundary evidence and any skips.

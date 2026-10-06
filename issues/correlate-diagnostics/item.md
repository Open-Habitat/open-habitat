---
created: 2026-10-05
updated: 2026-10-06
type: feature
reporter: jari
status: in-progress
priority: normal
related: ['@decide-logging-policy', '@implement-diagnostic-emitter']
preparation: ready
lane: logging
lane_seq: 2
collision: [internal/gateway/, internal/provision/, internal/daemon/, internal/transport/, internal/nativegh/, docs/]
blocked_by: ['@implement-diagnostic-emitter']
---

# Cover gateway, broker and daemon operations in logs

Apply the format from @implement-diagnostic-emitter to useful events that currently leave an operator guessing. [ADR 0013](../../docs/decisions/adr-0013-service-logging.md) asks for clear, consistent service logs with existing IDs where available, **not** for a new correlation protocol. The [source inventory](../decide-logging-policy/preparation.md) describes missing gateway routing/Access, broker provisioning and daemon operational records; the older [plan](../decide-logging-policy/implementation-plan.md) is superseded where it demands new protocols, support references or an async emitter.

Record meaningful failures and consequential transitions at the component that knows the result: gateway login and routing; broker admission, publication and readiness; daemon credential handoff, Pi startup, snapshot and native discovery. Use the shared shape, and include verified user, actor/target, operation and any existing attempt or request ID when that component already has them. If the broker or daemon has no matching gateway ID, leave it absent rather than invent a shared identifier or changing wire protocols. A root-only control action can honestly name a root peer but not an unauthenticated human operator. A missing record never proves that an operation did not happen.

Keep diagnostics separate from broker state, native history and authorization decisions. Do not log credentials, callback URLs, device codes, Pi content, tool output or raw native stderr. A log write failure must not change the operation's result. Update the product's log examples and architecture description to match what is actually emitted; Fleetrepo's `nah-diagnostic-log-access` verifies journal readers, retention and ingress on the test guest.

## Acceptance Criteria

- [ ] Representative gateway, broker and daemon successes and failures produce understandable messages in the common format, with the IDs and verified identities those paths already know; records can be related where a real shared field exists.
- [ ] Synthetic secrets and work content stay out of messages, actor and target are distinct, and logging failure does not alter tested operations or bypass cross-user access checks.
- [ ] The product's operator examples and architecture match the landed code; the result names the revision, focused and clean gate results, and any unverified guest scenarios.

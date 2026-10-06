---
created: 2026-10-05
updated: 2026-10-06
type: feature
reporter: jari
status: in-progress
priority: normal
related: ['@decide-logging-policy']
preparation: ready
lane: logging
lane_seq: 1
collision: [internal/gateway/, internal/provision/, internal/cli/, docs/]
---

# Standardize diagnostic log messages

Implement the common host-owned diagnostic message format agreed in [ADR 0013](../../docs/decisions/adr-0013-service-logging.md). Services already write to stderr and systemd collects that stream on Linux; this work is about making those messages readable together, not introducing a new logging pipeline or file store. The [source inventory](../decide-logging-policy/preparation.md) shows the current gateway JSON and the unlike broker and startup messages. The withdrawn [implementation plan](../decide-logging-policy/implementation-plan.md) is not a build specification.

Define a small, documented JSONL convention for messages the host itself emits: time, level, component, event, outcome and a clear classified reason where useful, plus identifiers already available at the event's trusted source (for example gateway `attempt_id`, operation and verified user). Use Go's existing logging facilities and share code only where that makes the format easier to maintain. Normalize existing gateway OAuth and broker-failure messages, broker guard messages and service startup/error messages. Ordinary systemd metadata already identifies the service and time; records should still be understandable when inspected as JSONL. Avoid dumping raw errors, URLs, headers, credentials, conversation content or tool output. Logging must not change an operation's outcome; no bespoke async queue, drop accounting, new protocol field or browser support-reference feature is called for.

This issue establishes format and guidance, including a concise operator-facing reference for where the gateway, broker and per-user daemon records live and how to find them. @correlate-diagnostics applies the convention to missing operational paths. Installation-specific access and retention are Fleetrepo's concern.

## Acceptance Criteria

- [ ] Gateway, broker and service startup/error messages produced by the host have a consistent, readable JSONL shape with documented field meanings and real examples; existing IDs and verified identity appear when relevant and available.
- [ ] Documentation identifies each service's stderr/journal location and shows how an operator finds its records without mistaking broker state or the Pi history for diagnostic logs.
- [ ] Representative records exclude synthetic secrets and work content, and logging failures do not change the tested operation's result.
- [ ] The result records focused tests and the committed clean gate outcome, with skips and remaining gaps identified.

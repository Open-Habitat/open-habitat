---
created: 2026-10-05
updated: 2026-10-05
type: feature
reporter: jari
status: open
priority: normal
related: ['@decide-logging-policy']
preparation: ready
lane: logging
lane_seq: 1
collision: [internal/gateway/, internal/provision/, internal/daemon/, internal/cli/, web/, docs/]
---

# Bounded diagnostic emitter and gateway support reference

# Bounded diagnostic emitter and gateway support reference

## Goal

Implement steps 1 and 2 of the
[logging implementation plan](../decide-logging-policy/implementation-plan.md)
under [ADR 0013](../../docs/decisions/adr-0013-diagnostic-logging.md): one
bounded, nonblocking JSONL emitter shared by gateway, broker and daemon, and
gateway failure records that carry a per-failure support reference instead of
the constant `req_00000000`.

## Scope

The shared envelope and its queue, caps, budgets, drop accounting and shutdown
behaviour, adopted by the gateway's existing OAuth and broker-failure records,
the CLI's startup lines and the broker's guard records. Gateway records for
pre-flow login failures, proxy and routing failures and Access denials. A
server-generated support reference in the safe error response and in the
matching record, with a way for the OAuth login page to show it that keeps it
out of URLs. Browser-sent correlation headers are ignored.

Cross-service correlation, broker and daemon coverage and attribution are
@correlate-diagnostics, which builds on this emitter.

## Acceptance Criteria

- [ ] Login and broker outcomes are unchanged with a writer that blocks, fails
      immediately or recovers, and under a sustained flood and oversized fields;
      latency and memory stay bounded and the drop count is reported on recovery.
- [ ] A browser-visible failure reference matches a gateway record for OAuth,
      Access, proxy and malformed-callback failures.
- [ ] Synthetic secrets and conversation content stay out of every record.
- [ ] Focused package tests and `./scripts/ci-local.sh --clean --json` pass on
      the committed candidate; the result records revision and skips.

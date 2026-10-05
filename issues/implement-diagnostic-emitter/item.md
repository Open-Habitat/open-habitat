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

Build the foundation for [ADR 0013](../../docs/decisions/adr-0013-diagnostic-logging.md): bounded JSONL diagnostics shared by gateway, broker and daemon, and a useful support reference on gateway failures instead of `req_00000000`. The [implementation plan](../decide-logging-policy/implementation-plan.md) maps the existing code and failure paths; its first two slices are the starting point, not a second set of instructions to execute mechanically.

Logging cannot hold up a login or change a broker decision. Bound record size, queued bytes and repetitive volume, including when stderr blocks indefinitely; account for losses when delivery resumes without promising a report from a sink that never recovers. Adapt the gateway's OAuth and broker-failure records, CLI startup output and broker guard diagnostics to the emitter. Cover meaningful gateway failures before login starts and at Access, routing and proxy boundaries. A browser should see a gateway-generated reference for a reportable failure that an operator can match to a record, including failures shown by the OAuth login page; keep that reference and OAuth secrets out of URLs and ingress logs. Do not trust browser-supplied correlation values. A record may be dropped, so a visible reference is not a guarantee that a matching log survived.

This issue establishes the emitter and gateway coverage. Broker and daemon operation coverage, cross-service references and actor attribution belong to @correlate-diagnostics. Native state and authorization stay authoritative; diagnostic records exclude credentials, raw URLs, conversation content and tool output.

## Acceptance Criteria

- [ ] Under blocked, failing and recovering writers, flood and oversized fields, login and broker outcomes are unchanged, latency and memory remain bounded, and recovery reports lost records.
- [ ] Synthetic OAuth, Access, proxy and malformed-callback failures show usable browser references matched by gateway records when delivery succeeds, without putting secrets or references in URLs.
- [ ] Synthetic secrets and work content do not appear in diagnostic records.
- [ ] The committed result names the tested revision, focused checks and clean CI outcome, with unverified paths identified.

---
created: 2026-10-21
updated: 2026-10-21
type: bug
status: fixed
priority: high
lane: unlaned
preparation: ready
closed: 2026-10-21
---

# History block read returns not found for a block the history list exposes

## Description

Live smoke on the test server (pilot.295, c770b0e2), Fleetrepo evidence issues/native-agent-hetzner-runtime-apply/agent-cli-full-smoke.md/.json (Fleetrepo 8f173de4): history list exposes conversation pi:961a716f… entry 557f0d3e block 0 at revision xj3aaVMo2AU4450MEsvb4MaC, but 'open-habitat agent history-block show … --revision …' (inline and export) and both direct HTTP routes (agent socket and gateway) return resource_not_found, reproducibly; a synthetic bash block fails the same way. The history was seeded natively via Pi's SessionManager after stopping the synthetic Pi (Pi flushes history only after a user message). Because the gateway route fails too, the browser's block reads (large output / details) are likely affected. Reproduce with a host-backed test that writes native history the same way, find why the block lookup disagrees with the list (revision computation, entry id form, block indexing, session file resolution), fix, and add the regression.

## Acceptance Criteria

- [x] Native SessionManager-seeded history reproduces the agent block-read failure.
- [x] Requests above 64 KiB return bounded text chunks with continuation instead of false not-found errors.
- [x] Cover agent and browser daemon routes, native user/assistant/bash content, stale revisions and over-budget refusal.

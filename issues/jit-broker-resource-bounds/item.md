---
created: 2026-09-24
updated: 2026-09-24
type: bug
status: open
priority: high
lane: auth-jit
lane_seq: 45
collision: [internal/provision/]
blocked_by: ['@implement-jit-broker-writer']
---

# Bound broker lock wait and accepted socket exchanges

## Bug
Read-only review of landed ADR0004 app broker slices found two pre-service resource starvation paths in `internal/provision/`: `Writer.Handle` calls blocking `unix.Flock(...LOCK_EX)` without observing request `context.Context`/deadline. A pending caller can outlive the transport's two-second exchange deadline indefinitely when another authorized account provisioning holds the lock. `Server.Serve` starts one goroutine per accepted Unix connection without a concurrency bound; an abusive/compromised permitted gateway UID can fan out unbounded goroutines (even though each exchange has a 2-second deadline). Neither surface is live yet; fix before any root service activation. Do not claim SO_PEERCRED alone prevents denial of service by a compromised gateway.

## Acceptance Criteria
- [ ] Make writer lock acquisition bounded and cancellation-aware (nonblocking flock with bounded retry on EWOULDBLOCK/EAGAIN, no busy-spin and no leaked fd); distinguish ordinary contention from state corruption, reject before any account mutation if context already canceled. Deterministic tests hold a lock and prove deadline/cancellation ends promptly without invoking executor; same-ID serialization still works.
- [ ] Bound accepted exchange concurrency per server and reject/close excess connections without handler work; ensure stop/cancel unblocks admission and drains bounded active exchanges without leaked goroutines. Tests exercise max-concurrent, stalled permitted peer, wrong peer, canceled context and reconnect. Never create a public listener, root user or host mutation in this fix.
- [ ] Go fmt/vet/race/gen drift and git diff --check pass. No guest/Fleetrepo/cloud changes. Keep security notes and report scope; fail closed rather than silently increasing timeout.

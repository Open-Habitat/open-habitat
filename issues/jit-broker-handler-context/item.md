---
created: 2026-09-24
updated: 2026-09-24
type: bug
status: open
priority: high
lane: auth-jit
lane_seq: 46
collision: [internal/provision/]
blocked_by: ['@jit-broker-resource-bounds']
---

# Carry broker exchange deadline into root handler

## Bug
The newly bounded UDS broker transport still declares `Handler func(Request) Reply`, so it cannot pass a per-exchange `context.Context` into `Writer.Handle(ctx, request)`. The 2-second socket deadline only interrupts I/O, not an account writer blocked in lock/HostExecutor; a disconnected client can leave root work running and the server's shutdown `WaitGroup` stuck. No service/guest has activated this code. Fix before any root broker wiring.

## Acceptance Criteria
- [ ] Pass per-exchange context into handler (`func(context.Context, Request) Reply`), bound by the existing exchange timeout AND parent Serve context, with cancel on connection close/timeout and no handler invocation after malformed/wrong-peer requests. Bind writer cancellation to that context in the future handler; never ignore ctx. Preserve default nil handler denying routes.
- [ ] Test a handler waiting on ctx.Done, parent cancellation, deadline while blocked, successful response before deadline, parallel clients and no runaway handler goroutine; document that an injected HostExecutor must honor ctx between irreversible steps, and a single syscall cannot be retroactively undone.
- [ ] Full Go fmt/vet/race/generated drift and diff checks; no guest/real account/cloud writes.

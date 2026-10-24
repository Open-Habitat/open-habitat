# Result

Broker startup verification and the boot restore that follows it now give
each host command (`systemctl show`, `getent`, `getfacl`, ACL commands) a
30 s budget instead of the request-time 3 s. Budgets that were already longer
(45 s socket start) stay as they were. A person's request (ensure, lookup,
runtime restore) keeps the 3 s budget.

Only time changed. Every answer goes through the same checks as before, so a
probe that answers with an unexpected or unsafe state still refuses startup,
and a probe that never answers still fails closed after 30 s.

The neutral systemd unit template is **unchanged** (`Restart=no` stays), so
Fleetrepo's installation needs no follow-up.

## How

`internal/provision/executor_linux.go`: the budget choice moved into
`commandBudget`. A context marked with `withStartupProbes` raises any shorter
budget to `startupProbeBudget` (30 s). `startupBindings` and `restoreSockets`
mark their contexts; nothing on the request path does.

Tests:

- `TestStartupProbesTolerateOnlySlowness`: an injected `run` whose answers
  take 4 s. Request-time, the probe times out; at startup a safe answer passes
  and an unsafe answer (`SocketMode=0666`) still refuses. The budget table
  shows that startup only raises short budgets.
- `TestStartupBudgetsOnlyAtBoot`: an ensure request reaches the host without
  the startup mark; boot verification and restore reach it with the mark.

`./scripts/test-focused.sh --area go --go-package ./internal/provision` and
`go test ./internal/cli` pass.

## Decisions for later review

- **Longer startup budget, not a retry or a systemd restart.** The observed
  failure was one `systemctl show` taking just over 3 s under TCG boot load.
  A longer budget fixes that where it happens and keeps the broker's
  "restart is not repair" stance: `Restart=on-failure` would also restart
  after real refusals, and would have needed a coordinated Fleetrepo change.
  A retry loop would have had to tell timeouts from refusals after the
  executor has already collapsed both to the same error.
- **30 s per command.** It is ten times the observed overrun. Startup has no
  overall deadline (the unit is `Type=simple`), so a wedged systemd now holds
  startup for 30 s per command rather than 3 s before it fails closed. Either
  way the broker does not serve until it answers.
- **Boot restore uses the same budgets.** Restore runs in the same busy boot.
  A timeout there leaves a person's listener unrestored until they sign in,
  and a timeout after a socket start latches all activation closed until the
  broker restarts. Each restore stays inside its existing 90 s activation
  bound, and the activation slot that sign-ins share was already held for up
  to that long.
- **Not changed:** the separate binding-activation-check gate process, which
  systemd runs before each socket starts, keeps its own budgets. If it times
  out at boot, only that person's restore fails, and their next sign-in
  retries it.

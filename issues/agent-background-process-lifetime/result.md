# Result

Added six sentences to `internal/daemon/host-context.md` covering new conversations,
browser closure, idle stopping, daemon restart and upgrade, durable workers and
shells, output files, and re-establishing waits without duplicating jobs.

## Accuracy review

Focused self-review checked each claim against code:

- `conversation_linux.go` creates a separate child, but calls `makeRoom` first.
  `pi_activity_linux.go` (`classify`, `backgroundActivity`, `makeRoom`,
  `stopIdleLocked`, `stopExpiredIdlePi`) protects running process-tool work,
  permits reclaiming idle children at capacity, and applies the ten-minute idle
  period only after both observed work and browser presence have ceased.
  Taskfleet work also holds an otherwise idle conversation against the timer.
- Browser event-stream disconnection in `events_linux.go` returns from the
  stream, not the conversation controller; controller shutdown follows its
  daemon context. `pi_rpc_linux.go` launches Pi independently of the HTTP
  request and sets `Pdeathsig`. The daemon service's `KillMode=mixed` ends
  remaining cgroup children on service stop. `upgrade_native_linux.go`
  quiesces the product system units, not user-manager units.
- `terminal_linux.go` (`survives`, `ensureServer`) uses a systemd user service
  only with lingering and a user bus; otherwise tmux remains a daemon child.
  The shell exposes `survives_restart`, consumed by `BrowserShell.tsx`.
- The runtime pins Taskfleet 0.20.0 at
  `6ad8d7ca22246804c6c79f038e57bba4c45acee5`. Its
  `crates/taskfleet/src/linux_lifetime.rs`, read at that exact commit, starts
  tmux through `systemd-run --user` and refuses an unsafe fallback when the
  user manager is unavailable. Thus the worker, unlike its parent's
  process-tool wait, is outside the daemon's cgroup.
- The daemon service gives `/tmp` a private lifetime; the guide keeps durable
  output outside it.

## Decisions for later review

- Corrected the issue's blanket claim that a new conversation never touches
  the old one: an idle Pi can yield its place at capacity. Running process-tool
  work is protected from that reclamation.
- Kept shell survival conditional: enabling lingering can fail without blocking
  login (`internal/provision/linger_linux.go`), and the shell has a fallback.
- Did not add a bare `systemd-run --user` recipe. User services are supported,
  but the conversation's bounded environment does not supply `XDG_RUNTIME_DIR`
  or `DBUS_SESSION_BUS_ADDRESS`; Taskfleet supplies them itself. Unqualified
  success for an arbitrary current user cannot be established from product code.
  Taskfleet and the checked browser shell cover the requested durable-work advice
  without adding user-bus setup to this short guide.
- Left the agent CLI skill unchanged: this is always-needed execution context,
  not an agent-command workflow. Existing embedding tests cover delivery; no new
  sentence-matching test was added merely to freeze prose.
- Jari's proofreading before the pilot release remains outstanding.

## Validation

Passed: `umask 077; scripts/test-focused.sh --area go --go-package ./internal/daemon`.
The focused runner installed its pinned Pi test dependencies and reported an npm
peer-version warning; the daemon package passed. No skill or web fixture changed.

Live check: not performed; no running conversation, service or upgrade was
interrupted. Evidence is source review and the focused daemon tests, not a live
restart-survival experiment.

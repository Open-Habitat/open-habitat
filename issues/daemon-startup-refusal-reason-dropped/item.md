---
created: 2026-11-13
updated: 2026-11-13
type: bug
status: untriaged
priority: normal
provenance: other
provenance_detail: observed during a release upgrade, 13.11.2026
source_ref: taskfleet:01m79ydxsvqmbx75ddb0y073hf/observed:daemon-server-failed-reason-dropped
originating_run: 01m79ydxsvqmbx75ddb0y073hf
originating_run_kind: spinoff
---

# A daemon that exits with server_failed at startup leaves no reason in the journal

## Description

## Observed

On an installation, after an upgrade, one person's daemon
(`open-habitat-daemon@<user>.service`) logs `service_ready` and then, about
0.2 s later, `service_failed` with `reason: server_failed`, five times in a row,
until systemd's start limit fails its daemon and agent sockets. Other people's
daemons on the same host start normally, and the same person's daemon fails
again on the next release, so the cause is in that person's state, not in the
release. A manual `systemctl start` repeats the failure.

Nothing on the host says why. `internal/cli/cli.go` wraps the error of
`daemon.ServeHTTP` as `server_failed: daemon socket service failed: <err>`
with the comment "surface the reason so an unsafe runtime can be repaired",
but `Run`'s service-exec branch logs only the code (`reason`) and drops the
message, deliberately, because other startup errors carry paths or native
error text.

## Expected

An operator can tell from the journal which startup check refused (listener
check, agent listener, Pi runtime, transport server, ...) without the log
carrying paths, home contents or credentials: for example a fixed, enumerated
detail code for each refusal `ServeHTTP` can return, logged next to
`server_failed`.

## Notes

`ServeHTTP` returns quickly from `transport.NewServer`, `PiDevice.validate`,
`transport.ServeAgent` and `Server.ServeMux` (the last two re-check the
activated listeners and return `denied`). Which one refuses here is unknown.

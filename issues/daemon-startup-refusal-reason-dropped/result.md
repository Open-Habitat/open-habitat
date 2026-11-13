# Result

## Part 1: the reason is visible (done)

`ServeHTTP` now tags every refusal with a fixed code, and the service log
carries it as a separate `detail` field beside `reason: server_failed`. The
message still never reaches the journal. Codes (`internal/daemon/startup_refusal.go`):
`adapter_unavailable`, `transport_config_refused`, `pi_runtime_missing`,
`pi_configuration_refused`, `pi_selector_refused`, `pi_runtime_untrusted`,
`pi_runtime_version_unsupported`, `daemon_listener_refused`,
`daemon_serve_ended`, `agent_listener_refused`, `agent_serve_ended`, and
`unclassified` for an untagged error. Transport returns `ErrServeEnded` when
an accept loop that passed its checks stops, so a refused listener is told
apart from a stopped one; no caller compared against the old opaque error.

## Part 2: the cause (found; the fix is outside this repository)

The worktree binary, started by hand for the failing person with the same
two named listeners systemd hands over, logged:

```
{"event":"service_failed","outcome":"failed","reason":"server_failed","detail":"pi_runtime_version_unsupported"}
```

The test installation does not install releases with `host apply`, which
would publish `pi-runtime.json` pointing at the release's own core runtime.
Its selector is written by the installation's own operator tooling and still
selects a Pi 1.3.0 tree. Since `c71971a8` (core runtime on Pi 1.5.2) the
daemon pins Pi SDK 1.5.2 and refuses any other version, so every person's
daemon on that host fails the same way. The one person's daemon was simply the
only one started: the others had listening sockets and no running daemon, so
"other daemons are fine" was never tested. The failure begins with the
first release installed there that contains `c71971a8`; the last verified
release that also contains it was never installed on that host.

Nothing in the person's state is involved, and no product change makes the
daemon start: the refusal is the intended fail-closed check. The fix is for
the test installation's runtime tooling to build, approve and select a Pi 1.5.2
runtime (with the Claude bridge and processes extensions the core runtime now
carries), or to switch that host to `host apply`'s release-bundled core runtime.
That change belongs to the installation tooling, not this repository, so this
issue stays open until the pilot verify is green again.

Ruled out along the way: unreadable release tree for that UID (all entries
readable), non-root or writable entries in the tree, escaping links, socket
ownership and mode, systemd sandbox properties (the hand run without them
reproduces it).

## Live check

- On the test installation, after the runtime tooling selects Pi 1.5.2: reset
  and start the failed daemon and agent sockets for a mapped person, open the
  site as that person, and the daemon serves (no `service_failed` in its
  journal).
- On any installation, a daemon that refuses at startup shows a `detail` word
  next to `reason: server_failed` in `journalctl -u open-habitat-daemon@<user>`.

## Validation

Focused Go tests for `./internal/cli`, `./internal/daemon` and
`./internal/transport` pass; `go vet ./...` is clean. The root-only
`TestTrustedPiRuntime`, which now also asserts the version/untrusted split,
was run as root on the disposable test host; its first run caught a real
misclassification (manifest shape and `node --version` failure were reported
as a version mismatch), fixed before commit. Review: one finder and one
focused verifier question on the transport sentinel change, both with no
findings.

## Decisions for later review

- `pi_runtime_version_unsupported` covers only a safe, correctly shaped tree
  whose Pi SDK or Node version differs from the pin; a wrong package shape or
  a Node that cannot run stays `pi_runtime_untrusted`, because only the
  version case is repaired by selecting another runtime.
- The daemon still refuses to start without a matching Pi runtime, which takes
  terminals, the editor and files down with it. Serving everything except Pi
  conversations would degrade more gently, but it changes what a daemon
  promises at startup; not done here and worth a separate decision if this
  recurs.

## Closed 13.11.2026 (conductor)

The installation's runtime tooling was moved to the Pi version the product
requires, outside this repository. Every person's daemon on the test
installation then started, and the next test release (product `c8dbbad1`)
installed and verified. The product part of this issue (the enumerated
startup detail code) landed in `42b6dbe7`. Catching such runtime drift
automatically is tracked in the installation's own repository.

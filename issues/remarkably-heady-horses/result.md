# Result

Both failures were test synchronization races, not product races:

- `relay.cancelAll` signals cancellation; it does not join the attempt. The
  discovery test now waits for `attempt.done`, which closes after native login
  cleanup, before allowing TempDir removal. Previously cleanup could recreate
  files while testing removed the home.
- The steady-sync subprocess can write `passes` while `tryResume` is still
  reconciling and has not cleared `resumeQueued`. A transient syncing card is
  valid then. The test now waits for the healthy card itself, preserving the
  earlier assertions about resumed direction and stale-lock removal.

Verified on the worker tree based on e9a50430 (the issue's fixing commit records
these exact test changes), Linux, umask 077, private disk-backed TMPDIR:

```sh
export TMPDIR=$(mktemp -d /var/tmp/oh-XXXX)
go test -race -count=50 -run '^(TestMicrosoftRemovalFencesAnAttemptBeforeItsIdentityIsPublished|TestMicrosoftRelayHidesApprovedCodeDuringDiscovery|TestDaemonStartResumesInterruptedFirstPass)$' ./internal/daemon/integrations
```

Passed all 150 executions (56.657s, TMPDIR `/var/tmp/oh-fxh8`). Also passed
`go test -race -count=1 ./internal/daemon/integrations` (30.062s, private
TMPDIR `/var/tmp/oh-D7OL`, umask 077), `go run ./cmd/contractgen -check`,
`git diff --check`, and issue metadata validation via `issuectl doctor --json`
(no schema violations or parse errors; existing attachment advisories remain).
The full gate and opt-in native/provider qualification were not run.

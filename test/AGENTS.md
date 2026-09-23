# Disposable fixtures

Everything below this directory is synthetic and safe to delete. Fixtures must
never read a real home, Pi history, SSH agent, browser profile, or credentials.
VM launch is bounded to `scripts/vm-test.sh`; reset removes only its temporary
run directory.

`test/vm/` holds the cloud-init-only systemd environment fixture and a digest-
pinned disposable tool-container recipe. Its marker files contain synthetic
strings; the socket responders are not product daemons. The explicit VM proof is
`scripts/vm-test.sh systemd-self-test --json`; the normal CI gate uses only the
offline `self-test`.

`./scripts/native-fixture.sh create --output <new-temp-path>` creates the long
2,500-event Pi-shaped JSONL, malformed event, long output, edit, question,
non-Git directory, local Git repository and linked manual worktree. The manifest
explicitly says that the foundation does not claim a Taskfleet-owned lifecycle;
that live fixture belongs to its later adapter slice.

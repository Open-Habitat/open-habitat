# Disposable fixtures

Everything below this directory is synthetic and safe to delete. Fixtures must
never read a real home, Pi history, SSH agent, browser profile, or credentials.
VM launch is bounded to `scripts/vm-test.sh`; reset removes only its temporary
run directory.

`./scripts/native-fixture.sh create --output <new-temp-path>` creates the long
2,500-event Pi-shaped JSONL, malformed event, long output, edit, question,
non-Git directory, local Git repository and linked manual worktree. The manifest
explicitly says that the foundation does not claim a Taskfleet-owned lifecycle;
that live fixture belongs to its later adapter slice.

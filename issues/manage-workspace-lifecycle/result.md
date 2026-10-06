# Workspace lifecycle — guarded local management, deletion disabled

## Decisions for review

- Adopted the conductor's narrower deletion guarantee (2026-10-06): pinned descriptors for traversal, never remove contents of a substituted target; a same-UID pathname race can move a substituted directory into a private quarantine, but must be recoverable on mismatch or crash. Linux provides no atomic compare-inode-and-rename syscall. This decision is recorded in `docs/architecture/workspaces.md`.
- **Deletion is disabled**, not a best-effort `rm`: a recoverable quarantine and verified process/worktree/mount observers are not yet implemented. In particular linked worktrees outside `~/src` and processes owned by other tools are unknown effects; allowing deletion without them would violate the issue's safety boundary. No delete endpoint is mounted. The browser states the limitation instead of presenting an unsafe confirmation dialog. A later implementation needs a quarantine recovery protocol and fresh preview, exact-name and inode confirmation, managed-process exit verification and conservative worktree/mount blocking.
- Local creation, name edits, hide/restore and Git initialization use the user's daemon and are re-observed from native files. Browser writes carry an inode-derived observation token; stale targets and incomplete source observations reject mutations. Hidden state is presentation only, under the user's XDG state path. If optional state is corrupt, visibility writes are blocked, without replacing it.
- Creation requires an existing trusted `~/src`; it does not provision the storage volume. A mutation whose native write succeeded but whose final verification fails returns a partial/uncertain error; the UI refreshes native state rather than retrying automatically. Git initialization uses an independent bounded context so a disconnected tab does not cancel it. No new workspace registry is maintained.

## Evidence

The earlier worker's committed primitive revision `cc3ef04` passed the clean gate in the preserved branch; that result cannot validate this implementation. This run cherry-picked all three preserved commits after inspecting their tests and deletion analysis. Its own final gate and focused test results are recorded below once validated.

## Limits

No delete/preview process exists. Browser tests are synthetic and cannot prove UID isolation or safe interaction with real processes, mounts or out-of-source Git worktrees. Visual fidelity awaits Jari's deployed review; no real user data was used.

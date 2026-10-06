# Workspace lifecycle — partial implementation, not landed

## Evidence

This attempt implemented and tested internal filesystem primitives only. There is no browser route or shipped workspace-management behavior. The issue remains in progress; this branch must not be merged as a completed issue.

- `TMPDIR=/var/tmp/nah-workspace-build go test ./internal/daemon -run 'TestWorkspace(Files|Settings)' -count=1` passed on the branch (synthetic home).
- Tests cover rejected symlink targets and invalid directory names, revalidation after a renamed directory is replaced by a symlink, metadata round-trip, and refusing to overwrite corrupt metadata. They do not exercise deletion, Git initialization, browser disconnection, mounted directories, processes, linked worktrees, or the listed CT scenarios end to end.

## Security decision needed

The deletion specification requires **no directory mutation at all** when a pathname is replaced after preflight. A descriptor pins the directory for traversal, but Linux `unlinkat` and `renameat2` address the final directory entry by name; neither accepts an expected inode as a compare-and-delete operand. Another same-UID native process can replace that entry between a final `fstatat` and the syscall. Renaming to a quarantine and checking the inode there can prevent deletion of the wrong *contents*, but it has already moved the wrong directory and can crash before restoring it. A daemon mutex only excludes its own writes, not SSH, Git, Pi, or other native tools. This is not a risk that tests or another immediate `stat` can eliminate.

Recommendation: agree explicitly that the guarantee is no traversal or content deletion of a replaced target, with a private quarantine and recoverable crash state; distinguish it from the stronger no-directory-mutation promise. If the stronger promise is required even against concurrent same-UID renames, deletion must stay disabled. Do not implement a misleading best-effort check and claim the stronger guarantee.

## Decisions for review

- No deletion endpoint or UI was exposed pending resolution of the pathname race above. This is a safety boundary, not a request for a visual verdict.
- Workspace source opening reuses the existing daemon's trusted `cloneSource` ownership check; the helpers do not accept paths from HTTP requests.

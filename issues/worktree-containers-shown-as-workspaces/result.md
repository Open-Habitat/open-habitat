# Result

## Cause

`scan` treated every ordinary directory directly below `~/src` as a workspace.
The agent workspace listing and icon consumers used that observation directly.
The browser snapshot then applied two extra filters: Taskfleet run/node paths,
and Git-registered worktrees whose parent contained only those checkouts.

This explains the inconsistent lists. The Git-based filter required at least
one registered, existing checkout, so removing the last checkout made its empty
container visible again. Taskfleet records could still suppress other empty
containers: their filter matched recorded paths rather than current directory
contents. A container without that record was listed. Workspace visibility is
keyed by workspace identity; hiding the main repository never hid its sibling
container. These are source-grounded mechanisms, reproduced with synthetic
homes; no installation's private records were inspected.

## Change

Discovery now excludes names ending in `__worktrees` before reading workspace
metadata or icons, independently of contents, parent repository, or run records.
The existing Git-backed recognition of nonstandard containers also runs in
shared discovery rather than only in snapshots. Individual worktrees remain
available under their parent workspace.

Create and clone refuse reserved workspace destinations before writing. Trash
still restores such directories, but does not claim they are workspaces or
return an unusable workspace ID. No new registry, cache, contract, switch, or
authority was added.

## Verification

- Focused `./internal/daemon` package: passed, including discovery with only
  empty containers, orphaned and occupied containers, removal of the last
  checkout, nonstandard registered containers, agent listing, icon inputs,
  create/clone refusal and Trash restoration.
- Existing alias/save-gate and deletion-blocker tests now use mixed-use
  directories, retaining their safety assertions without relying on a
  worktree-only container being a workspace. Taskfleet cache invalidation
  coverage uses a nonstandard name so it still tests record-driven filtering.
- Focused web checks after integration rebase: 227 files / 1,801 tests passed.
- New host-backed `lab-worktree-containers.spec.ts`: passed; then three repeats
  passed with two workers, reply jitter and port base 22100. Checks both home
  and sidebar against real synthetic host discovery.
- Focused contracts after integration rebase: generated files clean; 101 schemas
  and 162 fixtures valid.
- Independent review: claude-fable-5-2 finder, gpt-6-astra verifier, followed by
  assessment. Two confirmed findings (writer consistency and stale ADR wording)
  repaired; no unresolved findings. Final daemon tests cover the writer fixes.
- Integration rebase preserved the newly shared conversation catalog and moved
  its duplicate container filtering into discovery. Daemon, web, contracts and
  the host-backed container spec all passed again after resolving that conflict.
- No production deployment, real-home inspection, full browser suite, or full
  clean gate performed; those remain the conductor's integration checks.

## Decisions for later review

- Reserve the exact `__worktrees` suffix regardless of parent existence or
  extra content. Requiring current records would recreate the empty-container
  bug; requiring a parent would expose orphaned containers. An ordinary project
  deliberately using this suffix is therefore not a workspace.
- Keep the existing evidence rule for other names. Arbitrary empty directories
  remain workspaces; remembering a formerly custom container after all native
  evidence disappears would require the separate registry this project rejects.
- Keep Trash restoration available as a directory operation rather than refusing
  recovery of a reserved name. Creation and cloning instead refuse up front.

## Live check

On the test server, remove a repository's last worktree from Storage, then open
Home and inspect the sidebar, `agent workspace list`, and icon suggestions.
Its empty `__worktrees` parent must not appear as a workspace, including when
the main repository is archived. Remaining worktrees must still appear beneath
their main workspace.

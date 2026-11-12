# Result

`open-habitat agent file offer` and `agent view offer` now make a relative
`--source` absolute against the CLI process's physical working directory
(`syscall.Getwd`, not `$PWD`) before the request, so it means what it means in
any shell command. The daemon's no-follow open is unchanged and still decides
what exists and may be offered.

- A `..` is resolved lexically only after the CLI has checked, as the person,
  that the component it leaves is a real directory and not a symlink; a symlink
  there is refused (`unsafe_file_source` / `unsafe_view_source`), a missing or
  non-directory component is refused as not found with that path. A trailing
  `/` or `.` on a regular file is refused (the kernel would say ENOTDIR).
- A source the daemon does not find is refused with the absolute paths that
  were sent ("no file or directory found among: …; a relative --source is
  resolved against the current working directory").
- Help and the shipped agent skill now describe the new meaning; every changed
  agent text is in [agent-text.md](agent-text.md) for Jari's proofreading.

Tests: `internal/cli/offersource_linux_test.go` (relative from another cwd,
`..`, `.`, absolute, several sources, view offer, logical `$PWD` through a
symlink — verified to fail with `os.Getwd` —, refusals naming the path, daemon
not-found naming sent paths, missing source still reaching the daemon).
Focused Go checks for `./internal/cli` green; `go vet` clean.

Review: one `/llm-review` finder pass (gpt-6-astra). Three candidates, all
confirmed locally and fixed: a client-side existence check broke idempotent
replay of an offer whose source was since removed (the daemon answers a known
key before opening sources); `..` / trailing `/` were cleaned over regular
files; the `$PWD` test did not actually contain a symlink.

## Decisions for later review

- **Daemon keeps its workspace-root fallback for relative paths.** The CLI no
  longer sends relative paths, so it is unused by the product; alternatives
  were to reject relative paths in the daemon. Kept because it stays confined
  beneath the workspace (no safety gain from removal) and the daemon's tests
  use it; a comment on `openOfferSource` says so.
- **No client-side existence check.** The brief asked that not-found name the
  path; doing it client-side broke replay with the same idempotency key after
  the source is gone. The daemon's not-found is re-messaged with all sent paths
  instead; with several sources it cannot say which one was missing.
- **Absolute sources pass unchanged.** An unclean absolute path (`/a/../b`)
  remains the daemon's `invalid_request`, as before; cleaning it client-side
  could step over a symlink.
- **Shipped the skill/help text change** (recorded in agent-text.md) rather
  than leaving text that describes the old, now wrong, behaviour.

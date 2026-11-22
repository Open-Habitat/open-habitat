# Result

Companion files now reuse `/var/tmp/oh-pi-companion-<effective UID>` instead of
allocating `oh-recap-*` for each controller. The old implementation already
shared its directory among Pi children and removed it on graceful shutdown;
abrupt daemon exits were the unbounded-leak path.

Production startup removes legacy directories only when their complete name is
`oh-recap-` plus decimal digits, Lstat identifies a directory, and its owner is
the current effective UID. Descriptor-relative removal does not follow symlinks.
Failure is logged without exposing paths and does not prevent daemon startup.
The sweep runs before controller construction, never in synthetic constructors.

## Verification

Tested the fixing changes on base `18c67cfada2cf1f2a2e1f69d62369851766410ae`:

- `./scripts/test-focused.sh --area go --go-package ./internal/daemon`: final full
  package passed (277.015s).
- New synthetic tests prove stable reuse across controllers, refreshed bridge
  bytes, preservation across shutdown, recreation after removal, independence
  from a symlinked home cache, and rejection of a symlinked companion directory.
- Cleanup tests cover exact naming, regular files, owner mismatch, top-level and
  nested symlinks, outside-target preservation and repeated cleanup.
- `./scripts/test-focused.sh --area go --go-package ./internal/cli`: passed.
- `./scripts/test-focused.sh --area contracts`: passed (109 schemas, 174 fixtures,
  44 scenarios). Test commands used umask 077, scratch lease and outer timeouts.

The first full daemon run failed the helper recipe's old expectation (fixed in
the sibling change) and an untouched GitLab interrupted-clone test. The clone
test passed a focused retry and the final full package run; no clone code changed.

## Review

Focused self-review and independent `/llm-review` with assessment were used
because daemon lifetime and destructive cleanup changed. Finder
claude-fable-5-2 identified a real issue in the first design: using `~/.cache`
would reject otherwise valid symlinked home caches. The final temporary-root
location removes that prerequisite. Verifier gpt-6-astra confirmed the fix and
checked the cleanup boundary, including Go's no-follow recursive removal and
the systemd private temporary bind plus `KillMode=mixed`. No unresolved finding.

No real temporary directories were swept during development. Tests use synthetic
parents and an owner mismatch, not distinct-kernel-UID isolation evidence. No
live restart/deployment, browser suite, release packaging or clean gate was run.

## Decisions for later review

- Reuse one private directory per effective UID rather than depend on child-exit
  cleanup: crashes cannot accumulate directories, and all Pi children share the
  same product bytes. Leave it on shutdown; refresh it when a new daemon starts
  Pi, and recreate it if temporary storage was cleared.
- Keep it on the existing temporary filesystem, not under `~/.cache`, so normal
  personal cache layouts do not become launch prerequisites. Installed services
  have a per-user `/var/tmp` bind; the UID suffix also separates unbound users.
- Sweep only the exact legacy MkdirTemp naming grammar at production startup.
  Similar names, files and links are not ours. Existing service lifecycle stops
  the previous daemon's children before the replacement starts; no live-process
  registry or per-file lifetime store was added.

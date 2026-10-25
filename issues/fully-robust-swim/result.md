# Result

`browser-host` is removed from the index in an ordinary commit (no history
rewrite; the earlier 22 MB blob stays in history), and `/browser-host` is in
`.gitignore`. No repository script wrote it: `web/tests/host-build.ts` and
`scripts/lab.sh` already build to `.cache/browser-host`. The tracked file came
from a manual `go build ./test/browser-host` at the repository root, which Go
always writes to the current directory. The ignore rule is what stops a later
`git add -A` from staging it again.

Checked: after the change, `go build ./test/browser-host` at the root leaves
`git status` clean of `browser-host`.

## Decisions for later review

- No wrapper script for a root-level `go build`: the ignore rule covers the
  occurrence, and the documented builds already use `.cache/`.

---
created: 2026-10-24
updated: 2026-10-25
type: chore
status: open
priority: normal
provenance: other
provenance_detail: observed by a worker
source_ref: taskfleet:01m5qg5nb45c22m8d90ggtd546/observed:tracked-browser-host-binary
originating_run: 01m5qg5nb45c22m8d90ggtd546
originating_run_kind: spinoff
lane: unlaned
preparation: ready
---

# A 22 MB browser-host build output is tracked at the repository root

## Description

## Problem

Commit `b22ffa0a` ("test(browser): an administrator gives the site key to a
joined person; a new key replaces the copy", 2026-10-24) added a 22 MB build
output, `browser-host` (the compiled `test/browser-host` program), at the
repository root. It is tracked on `main` and `.gitignore` does not cover it.

## Occurrence

In the `gitea-clone-jobs` worker (run 01m5qg5nb45c22m8d90ggtd546), a routine
`go build ./test/browser-host/` from the repository root rewrote that file, and
`git add -A` staged a second 22 MB blob. It was caught before merging and kept
out of history, but any worker that builds the package the usual way and
commits with `git add -A` will add another large blob that every machine pulls
forever.

## Proposed direction

Remove `/browser-host` from the index (`git rm --cached browser-host`) and add
`/browser-host` to `.gitignore`. The earlier blob stays in history unless
history is rewritten, which main's auto-pulling machines rule out.

# Result

Fetched tag history is excluded from the local-only commit count only when a
configured remote advertises the exact same tag object. Lightweight and annotated
tags both work. A lookup failure leaves Git facts unknown and forbids outright
permanent deletion. No fetch, tag mutation, cache or contract changes were added.
The post-move check verifies tags again; a removed remote tag keeps the clone in
Trash.

## Evidence

- Synthetic bare remote with 24 release commits retained only by 24 mixed tags:
  a fresh clone reproduces the previous count of 24, now reports zero and completes
  outright deletion through the HTTP handler.
- Local commit, unpushed side branch, detached HEAD, local-only tag and locally
  moved tag each retain their unique commit. Stash remains counted and protected.
  Local tag-object replacement cannot hide unique work: deletion reads inspect
  stored objects with `--no-replace-objects`.
- Remote tag deletion, including between the check and removal, retains local
  history; unreachable remote leaves facts unknown.
- Initial fixture run failed because `git switch --orphan` already removed tracked
  files; redundant `git rm` removed and the focused regression passed.

- Passed `go test -race -count=1 ./internal/daemon ./internal/cli ./internal/gateway`
  and `./scripts/test-focused.sh --area contracts` (52 schemas, 47 fixtures,
  35 scenarios, 17 negative checks). Dependencies installed with both required
  `npm ci` commands. All Go runs used umask 077 and disk-backed short TMPDIRs.
- Passed project-view validation and `git diff --check`. `issuectl doctor --json`
  reports no schema/transition errors (existing PNG attachment advisories remain).
- Finder review identified too little network timeout margin; raised remote tag
  lookup from three to ten seconds. Dropped the reporting/latency candidate:
  remote verification is required for an exact count and unknown is conservative;
  repositories without tags perform no network lookup.
- Independent verifier found replacement-aware tag traversal could hide unique
  work. Reproduced `unpushed: 0`, outcome permanent, then fixed with
  `--no-replace-objects`; regression now yields one local commit and Trash.
  Two-call critical review completed (claude-fable-5-1, gpt-6-astra); all confirmed
  findings fixed. Corpus logging intentionally disabled to avoid its push.

## Decisions for later review

- Use live `ls-remote --tags --refs` only when the existing count finds commits
  outside remote branches and local tags exist. Alternatives were ignoring all
  tags (unsafe), storing fetch provenance (another state store), or contacting
  remotes on every check. Exact object matches distinguish fetched and locally
  moved tags without trusting a name. The network lookup gets
  ten seconds within the existing twenty-second overall check bound; a timeout
  is conservative, not permission to delete.
- Keep the existing reachability meaning of “unpushed”: a local branch/tag name
  whose history is already on a remote is not itself counted as a local commit.
  Unmatched tags with unique history remain protected. Protecting names as well
  would change the existing deletion policy and the commits-based contract.

## Integration

Rebased onto local main; the only conflict was simultaneous entries at the top
of `KOKEILTAVAA.md`, resolved by retaining both. An owner lookup attempted during
the detached rebase correctly refused; retry after completion resolved the exact
run. No outstanding command/test failures. Final tested daemon source matches
`f336782e` (rebase changed no Go content).

## Limits

Not deployed or tested on the live server; no live server access or push made.

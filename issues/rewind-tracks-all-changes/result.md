# Verification: shell changes delivered; restore scope still incomplete

Verified against main at `41c214dcba83b80a5d491cea5e649ce2a7aca9da`.
**Leave open.** The recorder closes the original shell/script tracking gap,
but two reproduced fallback behaviours do not meet the decision recorded on
21 November 2026. This supersedes the earlier design-only result; the design
and its measurements remain in `design.md` and git history.

## Acceptance against the agreed scope

- **Delivered: shell and script changes.** The recorder in
  `internal/daemon/turn-snapshots/` captures start/end trees without depending
  on tool names. `pathsChangedSince` selects paths changed during agent
  windows. `restoreSnapshot` in `internal/daemon/rewind-extension.mjs` saves
  an undo snapshot and restores those paths. `web/tests/turn-snapshots.spec.ts`
  verifies Python, `sed -i` and deletion changes, their Muutokset rows and
  diff, then byte-exact restoration through Palaa tähän.
- **Not delivered throughout: only files changed since the selected message.**
  `rewind()` excludes `snap.covered` from the per-file fallback, but that set
  contains only paths changed in the selected snapshot windows. It then uses
  `s.history.paths()` and `checkpointVersions()` for the rest. A path edited
  in an earlier turn can therefore be restored even when only the person
  changed it after the selected message.
- **Not delivered: ignored files stay untouched.** `tool_call` still captures
  ignored files named by edit/write; `rewind()` restores those copies when
  the snapshot does not cover them. The design draft recommended retaining
  this behaviour, but the later recorded decision says ignored files are not
  touched. The existing fallback cannot be treated as acceptance of that
  decision.
- **Delivered: Git workspaces only for snapshots, no Git-state rewind.**
  Plain folders record `not-a-repository`; existing edit/write copies still
  work there. The recorder writes its own store, not workspace HEAD, branch
  or index. Borrowed Git objects may have their mtimes refreshed; this is not
  restoring Git state.

## Reproduced remaining work

The synthetic probe invokes the production extension hooks and `/oh-rewind`
command with real Git snapshots and backups, using a disposable home:

1. Turn `u1` writes `a.txt` and an ignored `ignored.txt` through the write
   hook. Turn `u2` changes neither. Both turns have start and end snapshots.
2. After `u2`, the person changes `a.txt`. Files-only rewind to `u2`
   restores its `u1` contents, reporting one restored file and no errors.
   Expected: leave the person's change alone, since no agent window from
   `u2` changed this path.
3. Files-only rewind to `u1` restores `ignored.txt` to its original contents.
   Expected under the recorded decision: leave the ignored file alone.

Source and output: `/var/tmp/agent-keep/close-recorder-delivered-issues/`
(`reproduce-fallback.mjs`, `fallback.log`). Run from the repository root with
`flock --shared /var/tmp/agent-scratch/.lease timeout 60 node
/var/tmp/agent-keep/close-recorder-delivered-issues/reproduce-fallback.mjs`.
The probe asserts the observed defects; its successful exit is reproduction,
not an acceptance pass. No real session or home is read.

The remaining fix must align preview and the per-file restore fallback with
the chosen scope, including continuation switching and undo, without losing
fallback for genuinely uncaptured edits. Add regressions for both cases and
keep older turns without snapshots usable. This is not just a recorder change:
it touches restoration and backup selection, so it is left as explicit work
in this issue rather than hidden in a closure edit.

## Checks

On the revision above, under `umask 077`, scratch lease and outer timeouts:

- `./scripts/test-focused.sh --area web`: typecheck/lint and all 257 unit/
  component files, 2,176 tests passed.
- `OH_BROWSER_WORKERS=2 OH_LAB_WORKERS=2 OH_PORT_BASE=15300
  ./scripts/test-focused.sh --area browser --spec rewind-conversation.spec.ts
  --spec turn-changes.spec.ts --spec turn-snapshots.spec.ts`: 11 passed,
  one opt-in screenshot-only case skipped. No specs were changed; one run,
  not a repeated-run or whole-suite claim.
- `./scripts/test-focused.sh --area go --go-package ./internal/daemon`:
  passed, including `TestTurnSnapshotsThroughPinnedPi` (real pinned Pi,
  synthetic model/workspace; rewind, switch, files-only restore and undo).
- `node --test internal/daemon/pi-device-test/turn-snapshots.test.mjs
  internal/daemon/pi-device-test/rewind.test.mjs`: 37 passed, no skips;
  includes recorder retention, Git-state preservation and snapshot restore
  safety tests. TMPDIR was a leased disposable scratch directory.

Issue-only checks also passed: `issuectl doctor --json` (no findings),
`python3 scripts/validate-project-view.py` (14 pages) and `git diff --check`.

Logs are beside the probe (`web.log`, `browser.log`, `daemon.log`,
`recorder.log`, `doctor.json`, `project-view.log`). These tests do not cover
the two fallback defects above.
No live installation, whole browser suite or clean gate was run or required
for this issue-only verification.

## Decisions for later review

1. **Keep this issue open instead of equating shell support with completion.**
   Alternative: close it under the older design's permissive fallback rules.
   The explicit later scope decision and reproduced loss of a between-turn
   edit make that misleading.
2. **Record the remaining restoration work rather than patch it here.**
   Alternative: filter the current fallback immediately. Selection must also
   agree with preview, continuation switching, undo and older histories;
   changing just one path risks another misleading or incomplete restore.

## Review

Focused self-review of the issue-only diff, acceptance mapping and production
code, backed by the executable synthetic probe. No sessions, contracts,
daemon state or authorization code changed, so an independent code review was
not required. No product deployment or private test-server note is needed.

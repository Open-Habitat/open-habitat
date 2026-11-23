# Upstream fork prepared — 23 November 2026

Jari's latest decision replaces the separate-package plan: maintain an
Open-Habitat fork from which a later contribution can be offered to Raine.
That work is complete. **No upstream pull request was opened.** Jari still
decides submission after the agreed couple of weeks of real use; this issue
no longer asks for a separate pi-rewind package or a runtime dependency change.

## Published branch

- Public fork: `Open-Habitat/better-pi-rewind`, parent
  `raine/better-pi-rewind` (verified through GitHub).
- Branch: `turn-snapshots` at
  `2aa1b1c87d917144a9fc9193d316f6af7d8981d1`.
- Base: `e42fa9cbf14c300867fb2f31511979dde1898aee` (v0.4.0). Fresh fetches
  found both upstream and fork main still there, so no rebase was needed.
- First commit is the reviewed bundle's original
  `17dfa796d6b1daf2b0749afb69d035508f5ecebf`; the second carries the generic
  restore safety policy and its tests. Nothing was pushed to open-habitat.
- The updated, unposted draft is in
  [upstream-pr.md](../turn-changes-service-design/upstream-pr.md).

The initial comparison at Habitat `5ce3354e269551e75b7e19855e691538923dcdf9`
found all 16 embedded recorder files byte-identical to the reviewed proposal.
This run began at `38c6db3e5769e9f90e2be1aa6ba0be8275e9076d`; none of those
16 files had changed. The later fixes were in the adapter, not the recorder.
The previous detailed comparison remains in this file's git history.

## What moved, and what did not

A new portable `src/turn-snapshots/restore-policy.ts` contains the generic
parts of the adapter's already-used behavior. Habitat now imports that exact
file, rather than keeping a second implementation of the policy.

| Habitat fix | Portable code in the fork | Integration that remains here |
| --- | --- | --- |
| Port review, `53321720a`: never overwrite a file the undo snapshot skipped, including >20 MiB | `restoreWithUndo`: target skip filtering, undo presence/root/truncated-list checks, per-path undo coverage | Browser preview and Go read-side changes; outcome/marker encoding |
| Scope fix, `5d5e5e016`: only restore paths edited since the chosen turn, not earlier tracked files changed only by the person | `scopeFiles`: edited-path selection, explicit legacy fallback, current-ignore filtering, outside/nested-repository handling | `editedOn`, checkpoint validation and `edited` recording use Habitat's checkpoint schema |
| Review, `6c269b281`: broken Git config is not a plain folder | `checkIgnore` distinguishes Git's no-repository diagnostic from other exit-128 failures; unknown status refuses writes | Go preview's equivalent read-side policy |
| Same review: ignored files or files absent from undo must survive | `restoreWithUndo`: ignore check before writes and tree-membership check for existing paths | Adapter persists returned undo descriptor |
| Same review: restoring .gitignore must not broaden fallback; cancelled navigation restores only actual writes | `scopeFiles` is callable before restore; result exposes actual `changed`/`undo.paths`, tested with .gitignore restoration | Adapter preserves pre-restore call ordering and filters cancellation rollback by actual writes |

Habitat preferences, `/oh-rewind`, continuation markers, navigation, counts,
Go readers and browser contracts stay here. Upstream `extensions/rewind.ts`
is unchanged: this does **not** wire snapshots into its terminal selector.
Existing per-file deduplication, private modes and path handling that predate
the recorder port remain in the Habitat adapter; this branch does not claim
to port that separate storage implementation. The fork preserves upstream's
MIT licence and contains only generic code and synthetic fixtures.

## Keeping the copies in sync

While the upstream offer is pending, make portable fixes in either checkout,
copy them to the other in the same task, test both, and record the fork commit.
There is no generated variant and no transformation step.

| Habitat path below `internal/daemon/turn-snapshots/` | Fork path |
| --- | --- |
| `src/turn-snapshots/*` (including `restore-policy.ts`) | Same relative path |
| `extensions/snapshots.ts` | Same relative path |
| `src/host-adapter.ts`, `src/git-history.ts`, `src/types.ts` | Same relative path |
| `test/*.ts` | Same relative path |
| `LICENSE` | `LICENSE` |

Every file in the embedded directory maps byte-for-byte. The fork additionally
owns its full terminal package, manifest/exports, README/changelog and
`test/restore-policy-package.test.ts`. That test checks the fork's package
exports through Pi's loader under node_modules, not Habitat's embedded layout.
Habitat owns `internal/daemon/rewind-extension.mjs` and its command fixtures;
never copy that adapter into the fork.

Checklist for the next sync:

1. Fetch upstream main, fork main and fork turn-snapshots; inspect movement
   before rebasing or copying. Preserve others' commits; do not force-push.
2. Compare the entire embedded directory using the check below. Port fixes to
   portable policy rather than duplicating them in the adapter. Changes to
   Habitat record decoding or navigation stay in the adapter and its tests.
3. Run `npm ci --ignore-scripts` and `npm run check` in the fork under a
   disposable TMPDIR and timeout. Run the focused Habitat Node tests below
   plus the daemon Go package when runtime code changes. Review the diff.
4. Commit/push only the authorized fork branch, verify its remote SHA, and
   update this receipt and the draft PR. An upstream PR still needs Jari's call.

From the Habitat root, with `FORK` set to a clean fork checkout:

```sh
python3 - "$FORK" <<'PY'
from pathlib import Path
import sys
embedded = Path('internal/daemon/turn-snapshots')
fork = Path(sys.argv[1])
files = sorted(p for p in embedded.rglob('*') if p.is_file())
for p in files:
    q = fork / p.relative_to(embedded)
    if not q.is_file() or p.read_bytes() != q.read_bytes():
        raise SystemExit(f'mismatch: {p.relative_to(embedded)}')
print(f'{len(files)} embedded files byte-identical')
PY
```

Result for the published branch: **18 embedded files byte-identical**, including
all original 16 files plus the shared policy and its regression tests.

## Verification and review

Tests ran with `umask 077`, bounded timeouts and the shared scratch lease.
Final runtime source is the Habitat extraction over `38c6db3e5` and fork
`2aa1b1c87d917144a9fc9193d316f6af7d8981d1`:

- Fork `npm run check`: typecheck and **66/66 tests passed**, no skips.
- Habitat `node --test internal/daemon/pi-device-test/rewind.test.mjs
  internal/daemon/pi-device-test/rewind-scope.test.mjs
  internal/daemon/pi-device-test/turn-snapshots.test.mjs`: **50/50 passed**,
  no skips, including all 33 embedded recorder/policy tests.
- `./scripts/test-focused.sh --area go --go-package ./internal/daemon`:
  passed, including native pinned-Pi rewind/recorder integrations. This is
  same-UID synthetic integration, not live-user or distinct-UID acceptance.
- All-file byte comparison above: passed; both repositories' `git diff
  --check`: passed.
- `./scripts/test-focused.sh --area contracts`: generation clean, 109
  schemas, 176 fixtures and 44 scenarios valid.
- Project-view validator and `issuectl doctor --json`: passed.

Focused self-review checked the diff, mapping, licence, public contents and
unchanged terminal UI. Because the extraction touches session restoration,
an independent `/llm-review` plus `/assess-findings` was also run:
`claude-fable-5-2` found one packaging defect, locally reproduced; `gpt-6-astra`
verified the repair and unchanged undo/fallback guards. The initial MJS
helper could not dynamically load TypeScript from node_modules. It is now a
TypeScript module with checked implementation types, and a fresh-process Pi
loader regression covers that installation shape. Assessment: CONFIRMED,
REGULAR, readability IMPROVES, architecture MINOR, FIX; applied. No remaining
actionable findings and no follow-up issues filed.

Logs, review/assessment and fork checkout are retained at
`/var/tmp/agent-keep/pi-rewind-own-repo/`. No screenshots or real session data
were used. No deployment, browser suite, live-use qualification, Windows or
native OMP validation was performed; this work changes no UI. The full clean
gate was deliberately not run under the worker policy.

## Decisions for later review

- **Extract shared policy rather than copy Habitat's command extension.**
  Alternative: fork-only duplicate helpers. Sharing the same implementation
  lets parity checks prove the contribution is what Habitat actually uses,
  while leaving host protocol and checkpoint decoding in their owner.
- **Keep the optional policy separate from upstream's terminal UI.**
  Alternative: also redesign upstream checkpoint format and selector now.
  That would exceed the reviewed recorder scope and need upstream agreement.
- **Close this issue at fork preparation.** The 23 November decision supersedes
  the separate-package/runtime-removal criteria. Submission and real-use
  acceptance remain Jari's later decision, not an uncompleted publication step
  silently treated as done.

# Result

## Cause

`taskfleetWait` (`internal/daemon/processes_linux.go`) refused any command
containing `&`, so the commonest real shape `cd <repo> && taskfleet run wait …`
never matched, and its option list predated `--check-in` and `--terminal`.
With `run_ids` empty the browser treated the waits as ordinary processes, and
Pi's `crash` kind for `--check-in`'s exit 4 surfaced as "kaatui · koodi 4".

## Fix

- The grammar accepts one literal leading `cd <path> &&` (separate words, path
  free of shell metacharacters, globs, braces, `=` and `#`), then the
  unchanged `taskfleet run wait` grammar. It also accepts `--terminal` and
  `--check-in <positive duration|seconds>`. Everything else stays refused:
  `;`, `||`, `&`, a second `&&`, chained `cd`, quoted or `$` paths,
  `cd a&&…`, `--opt=value`, a path-shaped `--output`.
- `ProcessCompletion` reads exit 4 of a recognised wait as
  "odotuksen välitilanne", with a sentence in the expanded view saying the
  runs continue. An unrecognised process exiting 4 still reads as its native
  kind.

## Evidence

- `TestTaskfleetWaitRealCommandShapes`: the two exact command lines from the
  issue plus acceptances and refusals; the existing grammar test is unchanged.
- `ProcessTray.test.tsx`: exit 4 with run ids reads as a check-in, without as
  a crash.
- `./scripts/test-focused.sh --area web` (757 tests),
  `--area go --go-package ./internal/daemon`,
  `--area browser --spec process-tray.spec.ts` (6/6) pass on Birch.

## Not tested / notes

- On Birch the daemon package's `TestSnapshotDiscoveryAndSchema` and
  `TestSnapshotListsWorktreePlaces` fail without Python `referencing`
  (`requirements-ci.txt`); they pass with it in a throwaway venv. This is the
  documented requirement, not a regression.
- No live Pi session ran a `--check-in` wait to exit 4 end to end; the label
  is proven at the component level. The process-tray row status (not the
  completion line) still colours exit 4 by its exit code; how waits are shown
  stays with `proto-background-waits`.

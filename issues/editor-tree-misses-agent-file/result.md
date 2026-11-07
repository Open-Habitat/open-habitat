# Result

Habitat's browser-editor tree never refreshed an already loaded directory.
The root loaded on mount and folders on first expansion; focus and agent-tool
observations checked the open document only. External creates, renames and
removals therefore stayed absent indefinitely. The new browser regression
failed on the original implementation at the missing externally created file.

The tree now rereads only displayed branches and their compacted ancestors
every three seconds, on return to the window/tab, and on reopening the tree.
Hidden trees/tabs do not poll. Existing per-directory single-flight and unmount
abort handling apply. Background reads do not flash loading messages or replace
the document, selection, expansion or unsaved text. No daemon, contract,
security boundary, watcher setting or host sysctl changed.

## Evidence

Tested on Birch, starting at `6f3c7452d5445cdb59352f3c5b743ea4d4308694`,
with this commit's changes; `umask 077`, fresh `/var/tmp/oh-edtree.*` scratch,
`OH_PORT_BASE=16800`, `OH_BROWSER_WORKERS=2`.

- `npm ci --prefix web` and
  `npm ci --prefix internal/daemon/pi-device-test --ignore-scripts` completed.
- `./scripts/test-focused.sh --area web`: formatting, TypeScript and 182
  test files / 1382 unit/component tests passed.
- `./scripts/test-focused.sh --area browser --spec browser-editor.spec.ts`:
  23 passed, including external root/nested create, rename, removal, folder
  creation, retained dirty document and bounded background reads.
- `./scripts/test-focused.sh --area browser --spec browser-editor-concurrent.spec.ts`:
  5 passed, including concurrent agent edits and conflicts.
- `./scripts/test-focused.sh --area browser --spec workspace-editor.spec.ts`:
  9 passed; the explicitly opt-in native test skipped in this stand-in run.
- `BROWSER_HOST_CODE_SERVER=/opt/open-habitat/profiles/editor/bin/code-server
  ./scripts/test-focused.sh --area browser --spec workspace-editor.spec.ts
  --tag @native-editor-tree`: passed with real code-server 4.141.0 / Code
  1.141.0 through the production gateway and daemon editor relays. Its Explorer
  observed files written, renamed and deleted directly by Node outside the
  editor. No refresh click. Synthetic home, OAuth identity and browser profile;
  this proves native watcher/relay behavior under one UID, not live pilot use
  or distinct-UID isolation. A separate disposable direct-code-server probe
  also passed before the relay test was added.
- Unit coverage checks collapsed-branch exclusion, hidden picker/tab suspension,
  visibility return and unmount cleanup. Existing browser tests still cover
  compact directory chains, retry, keyboard focus, dirty buffers and axe.
- `issuectl doctor --json`, `python3 scripts/validate-project-view.py` and
  `git diff --check`: passed.

Focused self-review: callbacks remain stable across read replies (an initial
inline wrapper caused repeated reads and was corrected), refresh scope follows
unfiltered visible branches, stale unmounted replies are aborted, and the native
editor authority path is unchanged. Independent review was not required:
production changes are confined to browser tree observation, not daemon,
contracts, session state or an authority path.

## Decisions for later review

- Use a three-second visible-tree poll rather than a recursive inotify watcher
  or only the current conversation's tool events. External writers include
  other agents and shells; existing bounded list reads cover them without
  adding daemon state, watches or a new contract. Hidden tabs and closed trees
  do not consume polling work. The interval trades a short display delay for
  modest read traffic; loaded but collapsed branches are not polled.
- Leave host inotify policy and code-server exclusions unchanged. Birch's
  observed limits were 128 instances and 249243 watches; real code-server
  successfully observed all three operations. No exhaustion was established.
  Increasing limits or hiding workspace directories would not fix Habitat's
  missing refresh path. Jari's original pilot tab was not inspected, so this
  is not a claim that the pilot can never exhaust its limits.

## Development failures resolved

The original-code regression failed as intended. The first native relay probe
looked for a README absent from the synthetic fixture; waiting for its actual
`cmd` row fixed it. Early tree tests exposed an unstable callback read loop;
passing the stable loader directly fixed it. The filtering test now pauses the
independent polling timer while proving filtering itself does not read.
Passing the async loader directly also exposed a test's unawaited async `act`:
its deliberately pending read now uses a void block, preventing leakage into
six subsequent tests. All seven then passed. One formatter pass needed a second pass. A repeated `--spec` invocation selected
only its last value; the other specs were then run separately. Discovery had
missing-path lookups and two exact-edit mismatches, corrected without changes.
A native `--version` invocation unexpectedly created a default personal
code-server config; that newly created file was immediately removed and its
absence verified. No existing settings were overwritten. All final focused
checks passed. No full gate, live deployment or push was performed.

Landing initially encountered rewritten source history and attempted to replay
unrelated earlier commits. Aborted that replay and rebased only this worker's
commit onto `ed563c836` (current main). The touched editor files were identical
between the old and new bases. Preserved main's rewritten KOKEILTAVAA and added
only this issue's test line; range-diff confirms that was the sole replay
change. Web checks (1382 tests) and the external-file browser regression passed
again on the rebased tree.

# Result: Habitat records turn snapshots and reads them

Done 22.11.2026, following Jari's decision of the same day to carry the
recorder in Habitat's own code first and offer it upstream after a couple of
weeks of real use.

- **The recorder is ported unchanged.** `internal/daemon/turn-snapshots/` is the
  `turn-snapshots` branch of the better-pi-rewind contribution (commit
  `17dfa79` on upstream `e42fa9c`): `extensions/snapshots.ts`,
  `src/turn-snapshots/`, the upstream files they import, the upstream licence,
  and the four test suites. Entry format, store layout
  (`~/.pi/agent/file-history/<session>/tree.git`) and code are byte-identical,
  so the later upstream pull request is the same code. Its 29 tests run in the
  ordinary `node --test internal/daemon/pi-device-test/*.test.mjs` step through
  `turn-snapshots.test.mjs` (Node strips the types; a resolve hook finds the Pi
  SDK).
- **Loaded under Palaa tähän, never twice.** The daemon embeds the tree, writes
  it beside its other extensions and adds `--extension …/snapshots.ts` to its Pi
  child while the person's `rewind-conversation` switch is on
  (`turnSnapshotArgs`). A second copy in the same Pi stays passive through the
  recorder's own `globalThis` slot. Retention is the recorder's: stores of
  deleted sessions and snapshots older than 90 days are swept daily.
- **Muutokset reads the snapshots.** New read on the existing rewind route,
  `GET …/rewind?turn=<entry>` (files, kind, line counts, skipped paths, from the
  run's start and end trees, or start → next start when steered) and
  `?turn=&path=` (one file's diff, 256 KiB). Contract:
  `rewind.schema.json#/$defs/turnChanges`, `turnDiff`. The daemon reads only the
  session's own `turn-snapshot` lines (a cheap pass) and runs `git diff-tree`
  in the person's own store directory (not a link, owned by the person), with no
  system, global or attribute configuration. The browser, when the switch is on
  and the turn used tools, asks once per turn near the view: the snapshot
  decides files, kinds and counts (`withSnapshot`), files no edit or write made
  get *komennolla*, their diff is read on opening; tool calls keep the timeline
  and the edits the snapshots cannot see (ignored files, outside the repo).
- **Palaa tähän restores from the snapshots.** `/oh-rewind` with files takes
  `pathsChangedSince` from the message on, a `snapshotNow` undo point, then
  `restorePaths`; without an undo point nothing is restored from the snapshot.
  The per-file copies cover the tracked paths the snapshot does not. The undo
  point is recorded in the marker (`snapshot`), so *Peru palautus* and *Jatka
  tästä jatkosta* with files return through it. The preview unions the snapshot
  windows (compared with the files now) with the per-file copies.
- **Older turns are as before.** No snapshot entry, `tree: null`, a removed
  store or an unreadable tree → `snapshot: false` and the tool-call reading;
  the preview and restore fall back to the per-file copies.

## Checks

- Ported suites: 29/29 (`node --test turn-snapshots.test.mjs`); `rewind.test.mjs` 8/8
  (new: a restore never overwrites a file its undo point could not keep).
- Go: new `TestTurnSnapshotsThroughPinnedPi` drives the real pinned Pi with
  the recorder and the rewind extension against a synthetic model whose turns
  change a Git workspace only through `python3`, `sed -i`, `rm` and a
  generated file: turn read, diff, preview, rewind with files, switch back with
  files, files-only restore and undo, all byte-exact and validated against the
  contract. `TestTurnChangesReadTrustsOnlyTheOwnStore` (symlinked store,
  climbing store name, bad tree id, steered window), query grammar, switch
  gating, an open run in the preview; gateway exact shapes; the whole
  `./internal/daemon` package green (`test-focused.sh --area go`).
- Contracts drift and validation; web typecheck, lint, unit tests
  (`withSnapshot`, `snapshotPatch`).
- Browser (`OH_BROWSER_WORKERS=2`, `--repeat-each 3`): new
  `turn-snapshots.spec.ts` (scenario `pi-snapshots`: real snapshots by the
  recorder's module, Python/`sed -i`/`rm` turn, card lists the three files with
  a diff, Palaa tähän puts them back on disk), `rewind-conversation.spec.ts`,
  `turn-changes.spec.ts`: all green.
- Evidence: `/var/tmp/agent-keep/turn-snapshot-reader-migration/` (card and
  sheet screenshots from the spec).

## Decisions for later review

1. **No settings check for a person-installed better-pi-rewind.** The design
   suggested skipping Habitat's copy when the person's settings provide the
   package (as for pi-processes). No released better-pi-rewind has the
   recorder yet, and the recorder's own slot already prevents double
   recording, so the check would only matter once upstream ships it.
   Alternative: mirror `nativeSettingsProvideProcesses` now.
2. **"Removed with the conversation" needs no new code.** Habitat has no
   conversation deletion today (workspace deletion trashes the folder, sessions
   stay); the recorder's daily sweep removes a store whose session file is gone.
   When conversation deletion arrives it should remove
   `file-history/<session>/` with it.
3. **No history projection of the end entry's `stat`.** The design had the
   collapsed line come from the history page; instead the card asks the new read
   once per turn (only with the switch on and when the turn used tools). Avoids
   a history-schema change and a hidden entry kind in the timeline; costs one
   small read per visible turn.
4. **The turn read finds windows in file order**, not along the branch
   (`listTurns` over the session's records), so it needs no full parse; a
   visible turn's records are on the visible branch except in contrived
   rewinds mid-run. The preview and the restore use the active branch.
5. **The preview compares raw bytes** with the start tree's blob; a repository
   whose checkout converts line endings can list a file the restore then leaves
   unchanged. The restore itself applies Git's conversions.
6. **Open last window in the preview** (running, or Pi stopped before it
   settled) is compared read-only with `git diff-index` against the store's
   index: changed and removed files are listed. Files created in that window
   that no snapshot has seen are not listed (naming them needs the
   workspace's exclude rules), though the restore removes them; the undo
   point brings them back.
7. **Per-file copies still restore tracked paths the snapshot does not cover**,
   including a tracked file the person edited between turns (as before). Only
   snapshot-covered paths get the "between-turn changes stay" semantics.
8. **The read lives on the rewind route** (`?turn=`) rather than a new route:
   it is the snapshot record's reader and shares the route's owner-only gate.

## Review

Independent `/llm-review` (finder GPT-6 Astra, verifier Claude Fable 5.2) and
`/assess-findings` over the Habitat-side diff, the ported tree excluded (it was
reviewed upstream). Six findings, all confirmed and fixed with tests: an undo
snapshot that skipped a file over 20 MiB let the restore overwrite it with no
copy (reproduced by the verifier; now such paths go to the per-file copies);
target-skipped paths suppressed the per-file fallback; the preview missed an
open last run; a failed snapshot read stuck; a formatter after an edit left a
stale local diff; a cut snapshot list was shown as complete.

## Live check

With Palaa tähän on (Asetukset › Kokeelliset ominaisuudet), start a new
conversation in a Git workspace (the switch takes effect when Pi starts) and ask
the agent to change a file with a Python script, for example "lisää rivi
tiedostoon data.csv Python-skriptillä ja poista vanha.txt". The turn's
*Muutokset* card lists both with line counts and the tag *komennolla*; opening
one shows the diff. *Palaa tähän* on that message lists them, and confirming
with files puts them back; *Peru palautus* (files only) returns the script's
version.

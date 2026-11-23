# Result: rewind restores what the agent changed, whatever tool, and nothing else

The recorder already restored shell and script changes (verified at
`41c214dcb`, history of this file). This round closes the two fallback-scope
defects that kept the issue open, so the decision of 21 November 2026 now
holds throughout: Palaa tähän restores only files the agent changed from the
selected message on, never an ignored file, and never writes Git state.

## What changed

- **Each turn names its edits.** A turn checkpoint now carries `edited: []`,
  and every edit or write appends the paths it names to its turn
  (`tool_call` in `internal/daemon/rewind-extension.mjs`), including paths
  already copied at the turn's start. Before, a path tracked in an earlier
  turn left no trace when a later turn edited it again, so the fallback could
  not tell the agent's later edits from the person's.
- **One scope for the per-file copies** (`fallbackScope`): a path is
  restored from its copy only when an edit or write named it in a turn from
  the selected message on, no snapshot already restored it, and Git does not
  ignore it now (`git check-ignore`, asked as the person from the file's
  nearest existing folder; a file in no repository is never "ignored"). A
  path whose ignore status Git cannot tell is left alone and counted as an
  error.
- **Rewind, switch and undo agree.** A rewind copies every tracked path
  first (a switch back needs them) but writes only the scoped ones. A switch
  back writes what the rewind's copies changed (its own writes) plus what
  the current branch's edits named since the rewind and Git does not ignore;
  a file the person changed after the rewind that neither touched stays.
  Undo already wrote only what its restore changed.
- **The preview names exactly that** (`preview` / `rewindEditedOn` /
  `rewindIgnored` in `internal/daemon/rewind_linux.go`). The snapshot part
  of the preview also no longer claims a path the message's snapshot skipped:
  the restore leaves those to the copies, so the preview does too.
- **Older histories stay usable.** A turn checkpoint written before turns
  named their edits has no `edited` list; when one is among the turns from
  the selected message on, every tracked path counts as before (still minus
  ignored files). Plain folders keep their copies; there nothing is ignored.
- **A snapshot restore never writes an ignored file either**, nor any file
  on disk its undo point does not hold (`restoreFromSnapshot`). Before, a
  file the agent deleted and ignored in a turn, and that was recreated later,
  was overwritten with the message's content and had no copy anywhere; the
  preview applies the same ignore filter.
- **Review hardening.** The scope is decided before a snapshot restore can
  put back an older `.gitignore`; Git's exit 128 counts as "no repository"
  only with its own message (a broken configuration is no answer); a
  cancelled navigation puts back only what that restore wrote; the preview's
  ignore checks have their own budget, as the extension's do.
- The browser lab's fake extension records `edited` as the extension does.

## The probe, and what it actually showed

`/var/tmp/agent-keep/close-recorder-delivered-issues/reproduce-fallback.mjs`
wrote end snapshot records without `outcome`, which the recorder rejects, so
its turns had no end and the last one counted as still running: its window
reached the files as they were, and the person's between-turn edit was
restored *by the snapshot*, not by the copies. With valid end records the
same scenario still lost the edit through the copies, which is the defect
fixed here. The regression tests write valid records.

## Regressions

`internal/daemon/pi-device-test/rewind-scope.test.mjs` drives the
production extension's hooks and `/oh-rewind` against a synthetic home,
workspace and Pi-like session tree with real turn snapshots:

1. a file an earlier turn tracked and only the person changed since stays
   (probe case 1);
2. an ignored file the agent wrote is not restored (probe case 2), though it
   is still copied;
3. a file outside the repository the agent wrote is restored from its copy,
   the restore can be undone, and the same file changed only by the person
   since a later message stays;
4. a folder that is not a repository keeps its copies, scoped to the
   agent's writes;
5. a switch back leaves a file the person changed after the rewind;
6. a switch back restores what the branch's agent wrote, but not an ignored
   file;
7. a legacy checkpoint without `edited` restores every tracked path;
8. a broken repository configuration is no answer about ignored files;
9. a snapshot does not write a file Git ignores now, nor does its undo.

Cases 1 to 6, 8 and 9 fail on the code before this round; 7 passes on both.
`TestRewindPreviewScopesCopiesToTheAgentsEdits` and
`TestRewindIgnoredTellsNoRepositoryFromBrokenConfiguration` in
`internal/daemon/rewind_native_linux_test.go` check the preview for the same
rules. The snapshot preview's ignore filter has no Go test of its own; the
restore side is covered by case 9.

## Checks

On the final branch, under `umask 077` with the scratch lease and outer
timeouts:

- `node --test internal/daemon/pi-device-test/rewind-scope.test.mjs
  internal/daemon/pi-device-test/rewind.test.mjs
  internal/daemon/pi-device-test/turn-snapshots.test.mjs`: 46 passed.
- `./scripts/test-focused.sh --area go --go-package ./internal/daemon`:
  passed (includes the pinned-Pi rewind and snapshot tests).
- `OH_BROWSER_WORKERS=2 OH_LAB_WORKERS=2 ./scripts/test-focused.sh --area
  browser --spec rewind-conversation.spec.ts --spec turn-changes.spec.ts
  --spec turn-snapshots.spec.ts`: 11 passed, one opt-in screenshot case
  skipped.
- `./scripts/test-focused.sh --area web`: 257 files, 2,176 tests passed (run
  after the first commit; the review fixes touched no web code).

## Decisions for later review

1. **Edit evidence is recorded per turn rather than inferred.** Alternative:
   infer the agent's edits by comparing copies between turns. That cannot
   tell who changed a file between two turn starts, which is the defect.
2. **Ignored means ignored now, as Git in the workspace answers.**
   Alternatives: the rules at the selected message, or the recorder's own
   store view. The rules now are what the person sees, and a file the
   snapshots cannot see for any reason other than ignore rules (outside the
   repository, a nested repository, a skipped large file) keeps its copy.
3. **Unknown ignore status means "do not write".** Alternative: restore it.
   Restoring writes the person's file; leaving it costs at most a counted
   error the sheet shows.
4. **Legacy turns keep restoring every tracked path**, minus ignored files.
   Alternative: restore none of them. The brief requires older histories to
   stay usable, and the old rule is what the person agreed to when those
   turns were recorded; ignored files follow the newer decision because it
   says they are never touched.
5. **A switch back writes back what the rewind changed even if ignored.**
   It returns the person's own file to where the rewind found it; only a
   legacy rewind could have written an ignored file.
6. **An edit or write that changed nothing still puts its path in scope.**
   If the person changed such a file afterwards, the restore replaces it
   whole, as the sheet warns, and keeps the replaced content for undo or a
   switch back. Refining this with the snapshot windows would make preview
   and restore depend on whether the last window is still open, which they
   currently judge differently.
7. **A turn without an end snapshot extends to now.** That is the
   recorder's documented rule for a run still open (or a Pi that stopped
   before it settled): a person's edit after it counts as the agent's. The
   undo point keeps it. Left as is.
8. **A snapshot restore skips files ignored now, not only those missing
   from the undo point.** Alternative: only the undo-tree check. The ignore
   rule is what the decision says and what the preview can compute; the tree
   check stays as the guarantee that nothing is overwritten without a copy.
9. **No new browser spec.** The browser lab replaces the extension with a
   fake, so a browser spec would test the fake; the regressions run the
   production extension and the daemon's preview directly, and the existing
   rewind and snapshot specs cover the sheet.

## Review

Independent `/llm-review` (finder gpt-6-astra, then one focused verifier
question to claude-fable-5-2 on the data-loss and preview-agreement
boundary) and `/assess-findings`: five confirmed findings, all fixed in this
round (the two above, the snapshot overwrite of a now-ignored file, the
cancel path and the preview's Git budget). Two of them were rare by the
assessment rules but were fixed because they lose a person's file or break
the acceptance criterion. No findings were dropped and none filed.

# Result

Attachment count and combined size are checked as soon as files are selected,
dropped or pasted. The existing warning shows the whole selection immediately.
Files beyond 30 / 100 MiB stay as removable chips marked “Ei mahdu viestiin” /
“Does not fit this message”; their upload does not start. Send and Enter cannot
send an incomplete or oversized selection. Removing files recalculates the
warning and lets waiting files upload when there is room. Text stays untouched.

Rebased onto `attachment-refusal-sticks` (`b88951a0e`), retaining its scoped
upload-error lifetime and dismiss controls. Dismissing the combined warning
hides the notice, not the send guard; Enter or another selection reveals it
again. A changed session binding aborts the upload and discards its pending
selection, including late replies.

## Evidence and review

Focused self-review: checked combined accounting across batches, duplicate
stored references, exact boundaries, sequential upload admission, removal while
uploading, late replies, session-binding cleanup, send keyboard/button guards,
and the refusal worker's lifetime semantics. No daemon or contract changes.

- `./scripts/test-focused.sh --area web`: 200 files / 1521 tests passed after
  rebase; includes the refusal-lifetime regressions.
- `OH_BROWSER_WORKERS=2 OH_PORT_BASE=16200 ./scripts/test-focused.sh --area browser
  --spec attachments.spec.ts --spec attachment-documents.spec.ts`: six passed.
  Host-backed synthetic evidence, not a real provider or distinct-UID test.
- Tests cover immediate count/size warnings, exact 30-file/100-MiB admission,
  no HTTP upload for the crossing file, dismissal without enabling Send,
  removing a stored file to resume the pending upload, draft preservation,
  and cancelled session-binding uploads.
- The old browser overflow journey could upload all 101 MiB and then reload
  to provoke a host refusal. It now asserts the earlier boundary instead:
  the 30th upload never starts until room is made. Unknown-size restored
  references remain subject to the unchanged server checks; that reload
  fallback is not newly browser-tested here.
- `generate-ui-reference.py` and `--check` passed after regeneration. Kept
  only guides derived from this change; unrelated pre-existing worktrees
  catalog drift was excluded.
- Synthetic captures: `evidence/overflow-*` and `evidence/explain-*`, Finnish
  and US English at 1440 and 390 CSS pixels, scale 2, screenshot plus inert
  HTML. The capture script is `web/lab/capture-attachment-total-checked-late.mjs`.
  Inspected desktop warning/chips and narrow English Explain card: warning,
  marked pending file and explanatory card are readable. The existing narrow
  chip list scrolls when it fills. No new button or Explain target is added;
  V28 explains the changed state in both languages.

Development retries: the initial Biome run rejected effect dependencies;
fixed by reading the subscribed state. Rebase conflicts in Composer and the
browser spec were resolved retaining both workers' behavior. Capture attempts
first combined two preference updates (400), then pointed behind the initial
Explain situation card; the final script writes preferences separately and
points at the field before the warning. All final captures completed and each
lab was stopped. No live-host testing or full clean gate was run.

## Decisions for later review

- **Keep excess files locally and resume when space is freed.** Alternatives:
  reject them outright and require picking again, or upload everything despite
  the limit. Local removable chips meet the requested marking without wasting
  uploads or silently dropping selected files. Selection order determines the
  first file that cannot fit; smaller later files do not jump ahead.
- **Dismissal does not remove the guard.** The parallel refusal fix lets the
  person hide the warning. Its × still does so, but cannot make an oversized
  selection sendable. An Enter attempt reveals the reason again.
- **Pending files live only in the mounted field.** They are not uploaded or
  persisted just to survive navigation/reload; automatic application reload is
  held while any remain. Manually leaving/reloading requires picking those
  not-yet-uploaded files again. Uploaded references retain the existing draft
  persistence. Persisting binary files would introduce a separate store.
- **Known sizes only.** Existing restored references whose sizes this tab does
  not know still rely on the host's final check, as before; no new metadata
  fetching or storage was added.

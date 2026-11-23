# Rewind packaging: upstream comparison, 23 November 2026

## Recommendation for Jari

**Keep this issue at `preparation: pending`. Do not create or publish
`Open-Habitat/pi-rewind` now.** Offer the general-purpose recorder to
better-pi-rewind after the agreed real-use period, then propose the reusable
restore improvements separately. Keep Habitat's browser/RPC adapter here.

This is not a claim that the implementation difference is small: the recorder
is substantial. Rather, the largest addition is already written as an upstream
component, while the remaining product interface is not a usable replacement
for upstream's terminal extension. A second package would duplicate ownership
of the same checkpoint problem without giving plain Pi users a better entry
point today.

Jari's 22 November 2026 decision in @turn-changes-service-design is to gather
a couple of weeks of real use before offering the PR. Publishing the recorder
in a new package now would get ahead of that decision. Early December is a
possible review window, not an automatic submission date or evidence that the
real-use period has happened. Jari decides when and whether to submit. This
analysis neither opens a PR nor changes the existing packaging acceptance
criteria beyond completing their comparison prerequisite.

## Sources and exact comparison boundary

- Public upstream: `https://github.com/raine/better-pi-rewind`, freshly cloned
  on 23 November 2026; `git ls-remote origin HEAD refs/heads/main` returned
  `e42fa9cbf14c300867fb2f31511979dde1898aee` for both. `package.json` is
  version 0.4.0. This is still the base of the existing proposal, not a newer
  implementation containing the recorder.
- Habitat source inspected: `5ce3354e269551e75b7e19855e691538923dcdf9`, notably
  `internal/daemon/rewind-extension.mjs`, `rewind_linux.go`,
  `turn_snapshots_linux.go`, and `internal/daemon/turn-snapshots/`.
- Local, unsubmitted proposal: `17dfa796d6b1daf2b0749afb69d035508f5ecebf`,
  fetched from the preserved bundle named by
  `issues/turn-changes-service-design/result.md`. All 16 files carried under
  Habitat's `turn-snapshots/` (including licence and tests) are byte-identical
  to the same relative paths in that proposal. The proposal adds 3,085 lines
  and removes two across 16 upstream files; it does **not** change upstream's
  `extensions/rewind.ts`. Its package exports, README and changelog changes
  are not a standalone package manifest in Habitat's embedded directory.
- Upstream paths below are relative to that pinned public checkout. Habitat
  rewind symbols refer to `internal/daemon/rewind-extension.mjs`; recorder
  symbols refer to `internal/daemon/turn-snapshots/`.

The fetched checkout and proposal ref are retained for reproduction at
`/var/tmp/agent-keep/pi-rewind-own-repo/upstream`. This is source-comparison
material, not runtime acceptance evidence.

## Differences from current public upstream

| Area | Public better-pi-rewind 0.4.0 | Habitat now | Where it belongs |
| --- | --- | --- | --- |
| User interface | `/rewind`, `/checkpoint`, terminal selectors, double Escape and configurable cancellation; a restore prompt on native fork/branch. The command explicitly requires TUI mode. | `/oh-rewind` accepts JSON actions `rewind`, `switch`, `undo`; emits `oh-rewind:` JSON notifications consumed by the daemon. Browser preview and confirmation live outside the extension. No terminal selector or upstream keyboard/configuration UI. | Habitat adapter; a neutral programmatic API could be proposed, not the browser protocol verbatim. |
| Hosts and loading | Pi and OMP package entries, host navigation adapter, `getAgentDir()` and host/project configuration. | Rewind uses Pi's `navigateTree` directly and hard-codes `~/.pi/agent`. `rewindEnabled` reads `.config/open-habitat/preferences.json`; without the experimental flag it captures no new per-file checkpoints. The daemon embeds both sources and loads the recorder only when that flag is enabled at child startup. The recorder itself uses `getAgentDir()` and retains Pi/OMP adaptation. | Loading and preferences are Habitat-specific; recorder is host-neutral. Simply moving the files would not make rewind a plain-Pi product. |
| Capture coverage | Copies all previously tracked paths at each prompt start; registers new paths only through built-in `edit`/`write`. A shell-only new path is absent. | Same per-file fallback plus Git working-tree snapshots at first assistant message and run settle, independent of tool used. Captures eligible shell/script/formatter changes, deletions, new files, binary content, executable modes and symlinks. | Recorder and neutral readers are generally useful upstream. |
| Restore scope | `restoreCheckpoint` visits all tracked paths and compares their current contents with checkpoint versions; no per-turn edit set or current-ignore filter. | Snapshot `pathsChangedSince` unions agent-window changes from the selected prompt; per-file `fallbackScope` uses recorded `edited` paths, filters files Git ignores now, and skips unknown ignore status. Snapshots take precedence; copies cover otherwise uncovered paths. Legacy turns without `edited` retain all-tracked fallback. | Generally useful restore policy, but needs upstream agreement rather than silently changing its existing semantics. |
| Files versus Git history | File-only restore leaves refs/index alone; optional confirmed hard reset covers descendant commits and an immediately amended checkpoint commit. | No Git reset action at all. Snapshot Git state is observational; file restores do not roll back commits or staging. | Intentional product choice, not an upstream feature to remove. |
| Return/undo | Restores code and/or conversation sequentially; no explicit pre-restore undo point or switch-back operation in its extension. Pi navigation already uses the existing session tree. | Captures before overwriting, records continuation markers and snapshot undo points, supports switching back with files and undoing a files-only restore. Attempts to put changed files back if navigation is cancelled; invisible notes warn the agent that files changed. | Undo/cancellation handling useful upstream; Habitat marker protocol, anchors, counts and browser rows stay in adapter. Neither implementation is an atomic workspace transaction. |
| Per-file storage | Path hash plus random UUID for each capture; backup copies retain source permissions; failed capture does not record an explicit unavailable path. | Content-addressed copies (40 hex characters of SHA-256), private directory/copy modes, original mode stored as metadata, explicit `unavailable` paths prevent falling back to an older first copy on capture failure. | Reusable storage/recovery improvements. |
| File handling | `stat` and direct `copyFile` restore in `src/file-history.ts`; tool paths resolved with Node `resolve`. | Per-file path uses `lstat`, refuses a non-regular final target and restores through temporary file plus rename. `toolPath` follows Pi path conventions (`@`, `~`, Unicode spaces, `file://`). Snapshot restore separately validates paths and parent directories and can recreate symlinks. | Useful reusable improvements; do not describe the per-file path as having all of the snapshot path's parent-directory checks. |
| Session format | `better-pi-rewind.file-history`, version 1, with prompt/Git checkpoint metadata. | `oh-rewind-checkpoint`, `oh-rewind`, notes and anchors are separate Habitat entries; neutral `turn-snapshot` version 1 records start/end trees, store/root, skipped paths, outcome and statistics. Neither checkpoint reader treats the other's custom type as its own. | Snapshot format is the sharing boundary; Habitat checkpoint/marker format is not upstream compatibility. |
| Distribution | MIT Pi/OMP package, manifest, terminal UI, README, changelog and tests already exist. | Embedded MJS adapter plus TS recorder and tests; no standalone rewind package or plain-terminal acceptance established here. | Upstream already supplies the user-facing distribution this issue originally sought. |

Source anchors: upstream `extensions/rewind.ts`, `src/file-history.ts`,
`src/host-adapter.ts`, `src/tool-input-paths.ts`, `src/types.ts`, `package.json`;
Habitat `rewindEnabled`, `History.version`, `captureFile`, `fallbackScope`,
`restoreFromSnapshot`, `switchBack`, `undo`, and daemon `turnSnapshotArgs`.

## What the recorder adds, and its limits

The proposal's second extension entry, `extensions/snapshots.ts`, has no UI.
It writes `turn-snapshot` entries into Pi's own session and trees into
`file-history/<session>/tree.git`, using a private Git index and workspace
object alternates. It does not write workspace refs or its index. Git may
refresh an existing borrowed loose object's mtime; this is not a promise of
zero filesystem metadata effects in the workspace repository.

`src/turn-snapshots/index.ts` exposes readers, turn grouping, comparisons,
unified diffs, working-tree comparison, `pathsChangedSince`, `snapshotNow`,
`restorePaths` and retention. The proposal exports these as
`better-pi-rewind/snapshots`; current public upstream does not export that
module. Habitat imports the embedded files directly. Its Go readers and
browser previews are consumers, not part of the portable recorder.

This is **not literally every file change or attribution to a process**:

- Default capture limits are 20 MiB per new/changed file, 200 MiB new content
  per snapshot and a two-second budget, with the first 200 skipped paths
  named. No repository or Git means no tree; per-file fallback still works.
- Ignored/untracked excluded content, outside-root paths, nested untracked
  repositories and special files are not complete snapshot coverage. External
  clean/smudge filters, sparse checkout and split-index repositories are
  refused. Copies can cover supported edit/write paths that trees cannot;
  Habitat's restore policy still excludes currently ignored paths.
- Start → end is the agent window; end → next start is between runs. A missing
  end uses the next start, or the current working tree for an open final
  window. Concurrent human edits during such windows cannot be distinguished
  from agent edits. A selected file is restored whole, not merged with later
  human edits; the undo point preserves overwritten content where captured.
- Retention sweeps at most daily, drops snapshot refs older than 90 days and
  removes deleted-session stores while respecting fork referrers and recent
  activity. It manages recorder-owned `tree.git`, not adjacent per-file copies.
  Borrowed unreachable workspace objects can disappear after workspace GC,
  so a retained tree ref is not an independent backup of every blob.

These limits come from the carried `store.ts`, `read.ts`, `retention.ts` and
`extensions/snapshots.ts`, and remain relevant to any upstream offer. No new
Windows, OMP or live-use qualification was performed in this analysis.

## Proposed contribution boundary after real use

1. Offer the existing recorder-shaped PR, updated with actual use findings.
   Keep its neutral entry/store format and reader API; do not attach Habitat
   preferences, browser contracts or Go preview code to upstream.
2. Separately agree how upstream's terminal selector and restore consume
   snapshot coverage, and which undo, deduplication, path-resolution and
   capture-failure improvements it wants. The prepared PR deliberately leaves
   `/rewind` unchanged; merging it alone would not deliver shell-change
   restoration through upstream's UI.
3. Keep the Habitat command/marker adapter local until a supported upstream
   API can replace its reusable parts. Reconsider a separate repository only
   if upstream declines or a concrete independent user-facing product emerges.
   Upstream acceptance has not been requested or assumed by this work.

## Decisions for later review

- **Recommend upstream contributions, not a competing package.** Alternative:
  publish the whole derivative now. Rejected as a recommendation because its
  distinctive reusable component already has the upstream form, while its
  interface still requires Habitat preferences and a caller that knows the
  RPC protocol. A separate recorder-only package is another alternative, but
  contradicts the currently agreed second-entry direction without a new call.
- **Keep scope and timing as separate decisions.** Complete only the comparison;
  leave the remaining acceptance items unchecked and the issue open/pending.
  Alternative: treat extraction as already authorized by the older repository
  policy. The later 22 November real-use decision governs the recorder offer.

## Verification and focused review

Analysis only: no source moved, repository created, package published, upstream
PR opened, runtime changed or deployment performed. Source comparison used the
fresh upstream fetch and byte comparison with the preserved proposal; previous
implementation test results are not claimed as this run's tests.

Focused self-review is proportionate: only this issue's body, preparation field
and report change; no sessions, daemon state, wire contract or authority changes.
Reviewed the recommendation against both dated decisions, checked the claimed
host dependency against `rewindEnabled`, distinguished the unsubmitted proposal
from public upstream, and qualified snapshot attribution and restore limits.

Checks on this analysis diff over `5ce3354e269551e75b7e19855e691538923dcdf9`:

- `timeout 60 issuectl doctor --json`: passed, no findings or warnings.
- `git diff --check`: passed.

No implementation tests or independent model review were required or run.

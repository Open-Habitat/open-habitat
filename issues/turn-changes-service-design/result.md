# Verification: shared recorder delivered

**Close as done for the accepted Habitat capability.** Verified against main
at `41c214dcba83b80a5d491cea5e649ce2a7aca9da`. The decision of 22 November
2026 supersedes waiting for upstream: the recorder is embedded in Habitat,
and the upstream offer remains Jari's later action, not a missing product
implementation. Nothing was posted or pushed upstream; `upstream-pr.md` is
unchanged. The earlier results below are historical, including superseded
switch proposals and statements that no implementation existed.

## Acceptance verification

- **One record, both readers:** `turn-snapshots/extensions/snapshots.ts`
  records start/settle boundaries and counts. The read/restore module is in
  `turn-snapshots/src/turn-snapshots/`. `turn_snapshots_linux.go` reads the
  same session entries/store for Muutokset; `rewind-extension.mjs` uses them
  for Palaa tähän. There is no new service process or authority owner.
- **Same experimental feature:** `turnSnapshotArgs` in `rewind_linux.go`,
  wired through `recap_linux.go`, loads the recorder under
  `rewind-conversation`. Its process-wide slot prevents duplicate recording.
  No separate switch or agent tool was added.
- **Retention:** `retention.ts` defaults to 90 days and sweeps daily at
  session startup. Missing-session stores are removed, with active/recent
  stores and surviving fork referrers protected. Habitat has no conversation
  deletion operation to wire to immediate cleanup; this is sweep-based
  cleanup, not a claim of immediate deletion.
- **User-visible shared data:** `web/tests/turn-snapshots.spec.ts` uses real
  snapshot data for a Python/`sed -i`/deletion turn, checks the file list and
  diff, then checks disk contents after Palaa tähän. The pinned-Pi daemon
  test separately exercises the actual recorder hooks and rewind extension.

The fallback restore-scope defects reproduced during verification remain in
`issues/rewind-tracks-all-changes/result.md`. They prevent closing that
feature issue, but do not negate delivery of this shared recorder. The old
upstream draft's `/rewind` integration and the eventual upstream offer are
not claimed complete.

## Fresh checks and review

All checks below ran on the revision above with `umask 077`, scratch lease
and outer timeouts:

- `./scripts/test-focused.sh --area web`: passed typecheck/lint and 2,176
  tests in 257 files.
- `OH_BROWSER_WORKERS=2 OH_LAB_WORKERS=2 OH_PORT_BASE=15300
  ./scripts/test-focused.sh --area browser --spec rewind-conversation.spec.ts
  --spec turn-changes.spec.ts --spec turn-snapshots.spec.ts`: 11 passed,
  one intentionally disabled screenshot-only case skipped. No spec changed;
  this was one run, not the whole suite.
- `./scripts/test-focused.sh --area go --go-package ./internal/daemon`:
  passed, including the native pinned-Pi snapshot/restore journey.
- `node --test internal/daemon/pi-device-test/turn-snapshots.test.mjs
  internal/daemon/pi-device-test/rewind.test.mjs`: 37 passed, no skips,
  with TMPDIR in leased scratch. Includes recording, duplicate suppression,
  retention, ignored-path snapshot protection and undo safety.

Issue-only checks also passed: `issuectl doctor --json` (no findings),
`python3 scripts/validate-project-view.py` (14 pages) and `git diff --check`.

Logs: `/var/tmp/agent-keep/close-recorder-delivered-issues/` (`web.log`,
`browser.log`, `daemon.log`, `recorder.log`, `doctor.json`, `project-view.log`).
Focused self-review was chosen because the final diff changes only issue evidence/status, not session,
contract, daemon or authorization code. No live verification, full browser
suite or clean gate was run or required. No user-visible change was deployed.

## Decisions for later review

1. **Separate delivered Habitat capability from the upstream offer.**
   Alternative: keep the implementation issue open until a PR is submitted.
   The latest decision deliberately puts real use before the upstream offer;
   closing here records delivery without claiming that offer happened.
   The upstream draft and durable bundle below are retained unchanged.
2. **Track restore-scope gaps in the existing rewind issue.** Alternative:
   duplicate them here or file another issue. They concern fallback restore
   selection rather than the shared record, and already have an owner issue.

---

# Result: the recorder runs in Habitat (22.11.2026)

Following Jari's decision of 22.11.2026, the recorder from the branch below is
now carried in Habitat's own code, unchanged (`internal/daemon/turn-snapshots/`),
loaded while Palaa tähän is on, and read by Muutokset and Palaa tähän; the
details are in `issues/turn-snapshot-reader-migration/result.md`. What remains
here is the upstream pull request after a couple of weeks of real use: the
Habitat review found no defect in the ported recorder itself, so the branch
`turn-snapshots` (commit `17dfa79`) is still the code to offer.

# Result: the recorder, built as the upstream pull request

**Built (22.11.2026):** the turn-snapshot recorder as a better-pi-rewind
contribution, on branch `turn-snapshots`, commit `17dfa79` on top of upstream
`e42fa9c` (v0.4.0). Nothing was pushed and no pull request was opened; the
text for it is in [upstream-pr.md](upstream-pr.md). Habitat's runtime pin is
unchanged: Habitat does not install better-pi-rewind at all today, it embeds a
derivative (`internal/daemon/rewind-extension.mjs`).

- **Where it is:** the clone is `/var/tmp/agent-scratch/bpr-recorder.ccXl/repo`
  (marked `.keep`). The durable copy is the bundle
  `/var/tmp/agent-keep/turn-changes-service-design/better-pi-rewind-turn-snapshots.bundle`
  (prerequisite: the public upstream commit `e42fa9c`). The two raw review outputs are beside it.
  No GitHub fork of `raine/better-pi-rewind` exists under our accounts.
- **What it is:** `extensions/snapshots.ts` (second extension entry, no UI),
  `src/turn-snapshots/` (store, read/compare/restore, retention), exported as
  `better-pi-rewind/snapshots`; README and CHANGELOG sections. Format and store
  layout as in `design.md`, with the differences listed below.
- **Checks:** upstream's `npm run check` (tsc + `node:test`) green, 61 tests,
  29 new, four consecutive runs. Upstream has no separate lint. On a scratch
  clone of this repository (5 000 files): 27 ms first snapshot, 14 ms unchanged,
  26 ms after `sed -i` on 50 files, 7 ms for the run's `stat`.
- **Review:** independent `/llm-review` (finder GPT-6 Astra, then a focused
  false-negative probe by Claude Fable 5.2 on restore and retention after the
  first round of fixes) and `/assess-findings`: 8 defects confirmed and fixed,
  each with a regression test. Among them: restore could delete a file that
  had been ignored at the snapshot, retention could remove a store a fork still
  names, CRLF files came back normalized, a racy-clean index entry was recorded
  stale. 4 were dropped as documented trade-offs or outside the threat model.
- **Follow-up:** Habitat's reader migration is filed via intake as
  `turn-snapshot-reader-migration` (unlaned).

## Decisions for later review

1. **Habitat has no better-pi-rewind pin to read.** The brief asked how the
   runtime pins it; it does not, it embeds an adapted copy. The branch is
   based on upstream `main` (`e42fa9c`), which is also the commit the
   embedded copy credits.
2. **Local clone instead of a GitHub fork.** No fork existed; creating one
   is a public act on Jari's GitHub account, left for when he opens the PR.
3. **`/rewind` does not read snapshots in this PR.** The recorder, format and
   module can be judged on their own; wiring the selector and restore to
   `pathsChangedSince` is offered in the PR text as the next step. Alternative:
   one larger PR. Chosen because the maintainer's response is the gate, and a
   small first PR is easier to accept.
4. **Entry details beyond the design draft:** a top-level `reason` for
   `tree: null`; `skipped` as `{count, paths: [{path, reason}], truncated}`;
   `timestamp` means when the snapshot *began*, which restore uses to refuse
   removing files older than the snapshot.
5. **Plain folders get `tree: null` (`not-a-repository`).** Earlier design's
   question 4: phase 1 covers Git workspaces only; the per-file backups stay
   the mechanism elsewhere.
6. **No recording without a session file** (in-memory sessions): nothing
   would keep the entries, and no sweep could find the store.
7. **Repositories with filter drivers, sparse checkout or a split index are
   not recorded** (`unsupported-repository`), as the design said, until
   measured. Built-in eol/encoding conversions are supported and restored
   byte for byte.
8. **OMP settle hook:** `agent_end` without `willContinue`, with OMP detected
   by its extension API carrying `logger` and `typebox`; OMP forks register
   through `session_switch`. Checked against OMP's source, not run. Listed as
   an open point in the PR.
9. **Retention safety additions:** a store written within the hour is never
   removed whole or collected; a store young enough that its session file
   may not exist yet is kept; forks register themselves as referrers.
10. **Git refreshes the mtime of existing loose objects in the workspace**
    through alternates. Accepted and documented. The alternative, no
    alternates, costs roughly ten times the time and storage per the earlier
    design's measurements.

---

# Result: design for one shared record of turn changes

No implementation. `design.md` is the deliverable; the issue stays open
(`preparation: pending`) until Jari answers its five questions. Nothing was
filed upstream.

- **Recommendation:** the "service" is a record, not a process. A recorder
  extension snapshots the working tree at the start and settle of each turn
  into the conversation's private Git store and writes the tree id as a
  session custom entry. Vuoron muutokset, Palaa tähän and better-pi-rewind's
  `/rewind` read that record, each with its own UI. The recorder belongs
  upstream as a second extension entry of better-pi-rewind with a small
  read/restore module; Habitat's daemon stays a reader and no authority
  moves.
- **Rejected:** a standalone CLI (still needs the extension, adds a second
  artefact) and the daemon as owner (blind to terminal sessions, would start
  writing into the agent directory, cannot serve upstream).
- **In the document:** what each consumer needs, the entry format and the
  windows between boundaries, store layout and lifecycle, diff commands,
  limits and concurrency, Habitat's migration in five steps, the proposal
  text for upstream (about one page), three Mermaid diagrams.

## Decisions for later review

1. **The interface is the format** (a versioned session entry plus a bare Git
   store), not an RPC or an event-bus protocol. Alternative: extensions talk
   over Pi's `events` bus. Chosen because a reader outside Pi (the daemon)
   needs the on-disk form anyway, and the bus is not confirmed on OMP.
2. **Second extension entry inside better-pi-rewind**, with neutral names so
   it can be split out later. Alternative: a package of its own from the
   start. Left to the maintainer (question 2).
3. **The end entry carries the turn's file and line counts**, computed once
   at capture. Alternative: readers run Git per turn for the collapsed line.
   Chosen because trees are immutable, so the number cannot drift, and a
   history page then needs no Git call per turn.
4. **Snapshot from an explicit path list** (`ls-files` into `update-index`)
   instead of `git add -A`, so per-file limits can apply before anything is
   stored. Costs one extra listing per snapshot.
5. **One ref per kept tree, pointing at the tree**; pruning is deleting refs
   and `git gc`. Alternative: wrapper commits. The direct ref was checked to
   survive `gc --prune=now`.
6. **Store per session**, not per workspace: deletion with the conversation
   is one directory removal and needs no registry of references.
7. **The timeline stays on tool calls**; snapshots decide only the file
   list, counts and diffs. Per-command attribution remains the later phase
   of the earlier design.
8. **The switch takes effect when a conversation's Pi next starts**, because
   the recorder is loaded by argument rather than checking a Habitat
   preference each turn; an upstream extension cannot read Habitat's
   preferences.
9. **A new experimental switch for the record** rather than tying capture to
   the two existing switches (question 3).
10. **Starting limits** (20 MiB per file, 200 MiB per snapshot, 2 s, 90 days)
    are proposals to be set by measurement.

## Review

Focused self-review against the code and the upstream source. Today's
behaviour was checked against `rewind-extension.mjs`, `rewind_linux.go`,
`turnChanges.ts` and `recap_linux.go`; upstream against its README and
source at commit e42fa9c (v0.4.0); the hooks against Pi 1.3.0's extension
types. The store mechanics the design adds (explicit-list snapshot,
tree-to-tree and tree-to-files comparison without a store write, a ref
holding a tree through `gc`) were run on a scratch clone of this repository.
Timings quoted in the proposal come from the earlier design's measurements.
Not verified: OMP's settle hook and event bus, Windows, Git LFS and other
filters, a split index, and whether two extensions always share one
JavaScript realm on both hosts.

Live check: nothing to try on the test server; read `design.md` and answer
its five questions.

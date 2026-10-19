# Result

Archive completeness now compares archive annotations with **all discovered native Pi histories**, not just conversations attached to currently discovered workspaces. A readable history whose workspace is in Trash is no longer treated as missing. Restoring the directory associates the same native conversation and archive annotation again. Missing/unreadable archived histories and unreadable presentation annotations still warn.

No conversation lifecycle, Trash mutation, native history or annotation format changed. No new store or contract field was added.

## Decisions for later review

- Judge readability separately from workspace membership, rather than scan Trash to suppress specific warnings. Pi histories live outside the workspace; a readable session is not unreadable merely because its cwd is absent from today's catalog. This also avoids falsely warning after a workspace is permanently removed while Pi retains its native history. No conversations are displayed under another workspace or deleted.
- Use source-specific Finnish sentences instead of the old combined uncertainty text. History: “Keskustelujen Pi-historiaa puuttuu tai sitä ei voitu lukea. Osa keskusteluista voi puuttua arkistosta.” Annotations: “Keskustelujen arkistomerkintöjä ei voitu lukea. Emme voi näyttää, mitkä keskustelut on arkistoitu.” Both end with “Päivitä tiedot.” If both fail, show both explanations. Alternatives were a generic archive warning or new per-file error/count contract; the existing source facts support this distinction without exposing native errors or paths or inventing counts.
- Keep bounded header-only discovery. A malformed header makes an archived history unavailable to discovery and keeps the warning; corruption deeper in a history is detected by the existing selected-history read, not by eagerly parsing every conversation during snapshot discovery.

## Verification

- `scripts/test-web-fast.sh`: formatting, lint, TypeScript, 245 unit and 174 component tests passed on the final run.
- `scripts/test-focused.sh --area browser --spec browser-conversation.spec.ts --tag 'missing archive history'`: 1 passed, including both source-specific Finnish warnings and axe.
- `scripts/test-focused.sh --area browser --spec single-workspace-mode.spec.ts`: 5 passed, including warning-column geometry, routing and restoration behavior.
- `go test ./internal/daemon -run 'TestSnapshot(ArchiveCompletenessAcrossWorkspaceTrashAndRestore|MissingArchivedHistoryIsNotEmptyArchive)' -count=1`: passed after fixing the new fixture's HTTP RequestURI. The filesystem regression moves a real synthetic workspace into freedesktop Trash, checks no incomplete-history fact while only the other workspace is discovered, restores it and checks the archived conversation returns, then breaks its native header and checks the warning fact remains.
- `lab/pi_history.avif` and `lab/annotation.avif`, with adjacent static HTML: synthetic single-workspace home at 1440×1000, each source failure shown separately. Both screenshots visually inspected. Captured with `web/lab/capture-archive-notice.mjs` against a lab-mode host on 15901; failure facts are injected, not live faults. The lab host was stopped after capture.
- Independent `/llm-review` (routine, `claude-fable-5-1`, one finder call, local verification, performance logging disabled for this no-push run): found the same new-test RequestURI defect already fixed during validation; no remaining implementation finding. Examined all-session lookup, missing/oversized/duplicate histories, mutually exclusive notice rendering and route override assertions. `go test ./internal/daemon ./internal/gateway ./internal/transport` passed; `scripts/test-focused.sh --area contracts` passed (generated drift plus contract fixtures). No contract changes or regeneration needed.

- `python3 scripts/validate-project-view.py`, `issuectl doctor --json` and `git diff --check` passed; doctor retains the repository’s existing raster advisories.

## Limits and failed attempts

No live VM changes, restart, push or deployment. No live-browser or distinct-UID isolation claim. The source-failure browser fixtures inject failure facts into otherwise host-backed snapshots; native filesystem behavior is checked separately in Go.

## Resolved check failures

- The first fast web run timed out in the unchanged `Integrations.test.tsx` provider-page input case (5 seconds). A later complete fast run passed, including all 174 component tests. No timeout was raised or test changed.
- The first fast rerun found formatting in the new capture script; formatted it and reran the full fast checks successfully.
- The first complete Go run rejected the new snapshot test with HTTP 403 because `httptest.NewRequest` retained the absolute RequestURI. Set the origin-form RequestURI as the other snapshot fixtures do; both focused regression tests passed. Gateway and transport had already passed.
- One focused Go compilation raced the reviewer’s temporary `zz_scratch_linux_test.go` file that disappeared during compilation; an immediate retry passed. No scratch file remains.

- The reviewer’s independent package attempt had three environmental fixture failures (home ownership / Git facts / worktree places); it did not run Playwright. Host-run package and browser checks, not that attempt, are the acceptance evidence.

## Revision and integration

Implementation commit: `6d77678d`. Checks and screenshots cover its runnable contents (captured before commit); rebased cleanly onto local main `67130c4d`, whose only intervening change was an unrelated research issue. No implementation conflict or runnable-input change. Project-view, issue metadata and whitespace validators passed again after rebase. No full gate, push or deployment was performed.

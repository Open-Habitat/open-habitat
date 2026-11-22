# Result: × closes the last page and leaves a usable blank page

Adopted regression/investigation commit `6fca321b4` as `6d12b66b1` and implemented the conductor's decision: the viewer's × is enabled for a singleton inventory. The host creates a fresh `about:blank` target before closing the selected last target, so Chrome does not exit, then sizes and activates the replacement. Existing multi-page close behavior stays unchanged. No new switch or authorization is introduced.

The original reason for the missing opener remains unproven; the singleton inventory itself no longer makes × a dead control.

## Evidence and investigation

The inherited native test covered normal popups, OAuth-style self-close and a blank feature popup with both target identities retained. The extension explicitly removes the opener, observes only the blank popup, closes it through ×, requires one new blank target, and navigates it through real X input without selecting it. This distinguishes a fresh, activated replacement from navigating the old page or merely updating the list.

A separate disposable native Chrome probe checked:

- `window.open` with `popup,noopener`: both page targets remained listed;
- opener navigation: both remained listed, with the opener's identity unchanged;
- opener renderer crash: `Inspector.targetCrashed` was observed (the `Page.crash` command itself timed out), and both page targets remained listed;
- graceful Chrome shutdown and restart with native `restore_on_startup: 1`: both the navigated opener and blank popup were restored under new target IDs.

No missing-opener reproduction was found. This probe reads Chrome directly and is not daemon-restart or installed-server evidence. The earlier worker's restart observations remain in the external evidence directory; its failed post-restart keyboard assertion was not promoted to a passing interaction check.

## Checks

Final production/test diff based on `6d12b66b1` (including regenerated embedded schema descriptions) passed:

- `./scripts/test-focused.sh --area go --go-package ./internal/browserhost`;
- `OH_BROWSER_ACTION_CHROME=/usr/bin/google-chrome ./scripts/test-focused.sh --area go --go-package ./internal/cli` (native CDP fixture enabled);
- `./scripts/test-focused.sh --area web`: 255 files, 2156 tests plus static/component checks;
- `BROWSER_HOST_REAL_BROWSER=/usr/bin/Xtigervnc:/usr/bin/google-chrome OH_BROWSER_WORKERS=1 OH_PORT_BASE=18400 ./scripts/test-focused.sh --area browser --spec server-browser-popup-native.spec.ts`: three final separate invocations, all passed;
- `OH_BROWSER_WORKERS=2 OH_PORT_BASE=18400 ./scripts/test-focused.sh --area browser --spec server-browser.spec.ts`: all 11 passed;
- `./scripts/test-focused.sh --area contracts`, `python3 scripts/generate-ui-reference.py --check`, project-view validation, `issuectl doctor --json`, and `git diff --check`.

Commands used umask 077, scratch lease and outer timeouts. Go scratch came from the focused wrapper. Initial native test expected `about:blank` in the origin field; the contract intentionally strips non-HTTP origins. Corrected the assertion to native page title, then reran successfully. The first contracts check detected the changed description in embedded schemas; regenerated both copies and reran successfully.

The existing Explain-mode cases captured B13 in Finnish/English at 1440/390 px. All four images were inspected: the card fits, names the selected close control, explains blank replacement and unsaved-data loss, and still blocks the destructive press while explaining. English UK inherits the same text. No screenshot or captured HTML is committed.

No whole browser suite, clean gate, installed-server verification or deployment was performed. These are disposable-profile native interaction and synthetic-host checks, not distinct-UID or real-provider evidence.

External evidence: `/var/tmp/agent-keep/server-browser-popup-close-noop/` contains `final-{web,go,cli,browser}.log`, `harvest-final-native-{1,2,3}.log`, `harvest-contracts.log`, `harvest-probe.cjs`, `harvest-probe.log`, `harvest-cards/` (paired PNG/HTML), and raw independent review outputs. Earlier evidence remains there too.

## Review

Focused self-review plus independent `/llm-review` and `/assess-findings`: this changes explicit browser page destruction/lifecycle, so a second provider reviewed it even though identity and wire shape do not change. Finder `claude-fable-5-2`, verifier `gpt-6-astra`: two calls. Fixed stale generated UI references and the old last-page contract description (including generated schema copies). Dropped the proposed background activation after an uncertain close: failure is already explicit, status refreshes and selection remains available; successful close requires activation. No surviving actionable finding or new issue.

## Decisions for later review

- **Create before close, not after.** Closing first can terminate Chrome. The replacement is created only for a fresh singleton inventory, not for every close.
- **Preserve explicit uncertainty on partial failure.** Do not automatically retry close or delete the replacement when a reply is lost; either could lose the remaining usable page. The person can inspect and select the resulting windows.
- **Keep CLI last-tab protection unchanged.** The approved decision concerns the viewer's ×. The CLI has its separate refusal behavior; no CLI interface or agent action semantics were broadened.
- **Close the inert-× defect without claiming an opener-loss fix.** Navigation, crash, noopener and session restore did not reproduce missing inventory. No speculative inventory repair was added.

## Live check

After deployment, open Oma selain and create a normal or blank popup. Its × must close that popup while the opener remains usable. Then leave only the popup (explicitly close its opener), press its ×, and verify one empty page remains. Type an address immediately: the new page must receive input without a selection click. Closing the browser itself remains the separate stop action. This installed-server check is still pending deployment.

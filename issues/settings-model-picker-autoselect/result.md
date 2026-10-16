# Result

## Cause and change

The provider buttons were not tabs in behavior: their click handler chose the first non-refused catalog entry and immediately called `commit`, including a POST to Pi's native defaults. Returning to ChatGPT therefore selected whichever enabled model happened to appear first in the native catalog, even an older model. The older-model disclosure then opened because that newly saved selection lived inside it. This was not a focus-only bug.

Provider browsing now changes only the displayed catalog. The selected provider/model is tracked separately, so matching model IDs across providers cannot look selected accidentally. Only an explicit model or thinking-level click commits. The old confirmed choice stays selected during a write and after a failure; the selector shows pending and confirmation/error feedback, disables conflicting writes, and leaves unrelated settings responsive. Native model discovery/write latency has not been removed or measured on the live host.

A catalog entry is not proof of Claude sign-in. When the catalog contains Claude candidates, the picker now checks the existing validated Claude login endpoint, enables Claude only for `completed`, and otherwise shows a reason and a working Yhteydet link (including the compact settings detail view). The redundant Pi heading is removed, including the provider-list suffix. The gateway exposes its actual binary version through the existing authenticated server-information response; settings show it below every section, including Palvelin, without requiring administrator privileges to read the version. Missing information is reported as unavailable, not invented from the web bundle.

## Reproduction and visual comparison

Used `OH_PORT_BASE=29500 scripts/lab.sh start` and `web/lab/session.mjs`, with a disposable Chromium profile. No live host or real user data was captured. These are synthetic host-backed lab screenshots with adjacent inert HTML files, not live/provider/UID-isolation evidence.

The lab's default catalog contains no Claude models. For the same states as Jari's report, browser interception added one invented Claude row, a Sol default, and placed an enabled older row first in the catalog. This deliberately reproduces native catalog ordering rather than relying on a hand-chosen current-model-first order. Before the fix, ChatGPT → Claude → ChatGPT made **two default-write requests**, ending on older GPT 5.4 instead of Sol. See `lab-before-{initial,claude,return}.{png,html}`. The acceptance tests separately exercise successful persistence with the real host-backed synthetic model endpoint.

Compared the supplied live images directly with these before/after states:

| Live reference / state | Paired fixed lab evidence | Comparison and intentional differences |
| --- | --- | --- |
| `1-alussa.png`: Sol selected, older closed | `lab-after-initial.{png,html}` | Sol stays selected; older group stays closed. Same card, radio rows, provider segments and thinking controls. Pi heading removed as requested. |
| `2-claude.png`: browsing Claude | `lab-after-claude.{png,html}` | With simulated completed sign-in, Claude catalog opens **without any checked model or write**. This differs deliberately from the live auto-selected Fable row. The actual saved default is stated separately. |
| `3-takaisin.png`: return to ChatGPT | `lab-after-return.{png,html}` | Sol is still checked, older still closed; no Luna/older auto-selection. Visually compared initial and return: selection, card structure, thinking choice and disclosure agree. |
| `4-pi-otsikko.png`: redundant heading | `lab-after-unsigned.{png,html}` | No Pi heading; Kirjautumiset is the card's first row. Claude is disabled with an inline reason/link despite a catalog entry. |
| Slow write (no supplied live reference) | `lab-after-{pending,confirmed}.{png,html}` | Existing design controls retained. Inline Finnish status added; controls visibly disabled only while outstanding. Confirmed screenshot shows the explicitly chosen Nova. |
| Palvelin (no supplied live reference) | `lab-after-server.{png,html}` | Existing server-name card retained; small version line below it. `0.0.0-lab` is the synthetic gateway's version, not a claim about the deployed server. |

Other differences are fixture/viewport data, not redesign decisions: lab screenshots show the full 1440×1100 desktop shell rather than the supplied cropped/enlarged card; invented workspace names, observation times, model order/counts (five current and three older), model availability and thinking levels differ. The report's live Sol minimal level is not supported by the lab Sol fixture, so its confirmed level is off. We do not hard-code the live catalog or treat those values as design tokens. No layout/token redesign was made. `capture.mjs` recreates the fixed synthetic states from the repository root against a running lab.

## Verification

- Regression proof: restoring only the old `PiModelSelector.tsx` makes all three new browser cases fail; restoring the fix passes them. Assertions cover no POST on provider browsing, provider-qualified selection, disclosure behavior (user-open and current older default), one-click persistence, slow model/thinking writes, unchanged confirmed selection after failure, responsive unrelated controls, unsigned Claude despite catalog entries, the connections link, and the actual server version.
- Updated existing provider-toggle tests that previously asserted the unwanted automatic save: switching provider now requires an explicit model click; the signed-in Claude test asserts no write until an explicit thinking change.
- `umask 077; TMPDIR=/var/tmp go test -race ./internal/gateway ./internal/cli`: passed. Extended the existing gateway administration test to verify that an ordinary authenticated reader receives the running binary's version.
- `scripts/test-focused.sh --area contracts`: passed, including generated Go/TypeScript drift checks and 41 schemas.

Initial environment failures were diagnosed, not treated as product passes: the first native-key browser checks lacked `internal/daemon/pi-device-test/node_modules` (the isolated test also failed); installed its pinned dependencies with `npm ci --prefix internal/daemon/pi-device-test`. Initial gateway integration checks failed with checkout-unavailable because this shell's umask 0002 gave Go test child directories mode 0775; syscall inspection confirmed this. Re-running with private fixture umask 077 passed. No production clone logic was changed.

- Final `scripts/test-web-fast.sh`: passed format/lint/TypeScript, 144 unit tests and 133 component tests.
- Final focused browser runs: `settings-model-picker.spec.ts` **3/3 passed**, `account-settings.spec.ts` **12/12 passed** after installing the native SDK prerequisite. The earlier native-key timeout was not a flake; it was resolved by that dependency install.
- Regression run with old selector: **3/3 failed** for the intended reasons: four unintended POSTs across two round trips, unsigned Claude enabled, and no pending status. The preceding successful lab reproduction used one round trip (two POSTs).
- Focused self-review: checked provider-qualified selection across same-ID catalogs, explicit-only write call sites, late default initialization, write serialization/failure rollback, fail-closed Claude login parsing, hash navigation on desktop/mobile, and version ownership in the gateway composition root. No authority moves or sidebar/workspace changes.
- `python3 scripts/validate-project-view.py`, `issuectl doctor --json`, `git diff --check`: passed (doctor's existing evidence-format advisories are not functional failures).

### Full-gate attempts

The first `umask 077; OH_PORT_BASE=29500 scripts/ci-local.sh --clean --json` stopped during dependency setup with an npm registry `ETIMEDOUT` (20 s); no tests or receipt. The retry on commit `dbf78405` completed web checks/Storybook but failed overall (418 s): browser 179 passed, 20 failed, 2 skipped; native history watcher could not start and provision synchronization tests timed out. Shared-UID inotify allowance is only 128 instances on this host; no system setting or other session was changed. Packaging/receipt were not reached.

That run also exposed two local issues, fixed before the final rerun: the slow-response browser test could release the preceding request's resolver before the next interception had arrived; it now waits for the specific POST to enter before releasing it. The selector also read Claude login on every mount even in Codex-only catalogs. It now checks native Claude status only when Claude candidates exist, avoiding needless native work and preserving warm Codex navigation's read budget. These are not dismissed as unrelated timeouts.

The resource-bounded rerun waited for at least 4 GiB available memory before starting. Before that wait, another fast-web attempt passed all unit tests but timed out in the unrelated BashToolCard component case under pressure; that case then passed unchanged in isolation (5/5).

On committed tree `fd68db00` (before the later main rebase), the focused reruns passed: new picker 3/3, account settings 12/12, warm controlled return 1/1, and both previously failing native watcher/provision tests in isolation. Then `umask 077; OH_PORT_BASE=29500 OH_BROWSER_WORKERS=2 OH_GATE_SERIAL_HEAVY=1 scripts/ci-local.sh --clean --json` ran the full gate. Fast web checks passed (144 unit, 133 component), all Go packages/contracts/project-view checks passed, and Storybook built. Browser: **196 passed, 3 failed, 2 intentionally skipped**. The remaining failures were unchanged browser-conversation cases: reader-scroll following (timeout), missing daemon control/native-history recovery (timeout), and in-place restart recovery (five-second visibility timeout). The browser failure prevented the lab phase/packaging/receipt: **this is not a clean-gate pass and no gate receipt is claimed**.

Rebased onto the parallel sidebar worker's completed main integration (`90273471`), preserving its default-save eligibility refresh and warm-navigation guard. The only textual conflict was the two independent new sections at the top of `KOKEILTAVAA.md`; retained both in full. No uncommitted main-worktree files were modified. Final integrated isolated checks are recorded below.

## Limits / live check

This does not establish actual provider sign-in, Pi SDK response time, live model availability or separate-UID isolation. Jari's live follow-up is in `KOKEILTAVAA.md`; the release watcher must still deploy the merged tree before that check.

### Integrated rechecks

After the sidebar integration rebase, all three remaining gate-failing conversation cases passed unchanged in the one-worker isolated run (**3/3**, 12.4 s). The integrated picker spec passed **3/3** (8.5 s), account-settings **12/12** (30.7 s). The standalone full lab run passed **41/42**, including the parallel worker's three settings/home/workspace default-save scenarios and all affected settings/account journeys. Its sole failure was the unchanged slow sidebar-creation test attempting `created.json()` after navigation had discarded the response body (Playwright `Network.getResponseBody` protocol error). This is recorded separately from the full-gate result, not counted as a gate pass.

The slow sidebar-creation lab case passed unchanged when re-run alone (**1/1**). Final fast-web checks then passed all 144 unit and 133 component cases; contracts/generated checks and `go test -race ./internal/gateway ./internal/cli` also passed. Per the task's policy, the unrelated failures that passed unchanged in isolation do not block landing. They do **not** add up to a clean-gate receipt. No gate retry, production-isolation claim, live deployment verification or provider sign-in claim is implied.

Final rebase onto `78cad8a8` also preserved the independent spinoff process-tray changes. A second additive `KOKEILTAVAA.md` section conflict was resolved by retaining the complete spinoff and settings sections. On that integrated runnable tree, fast web checks passed (**145 unit, 133 component**), picker browser regressions **3/3**, and process-tray browser checks **5/5**, plus project-view validation and `git diff --check`. The final evidence-only commit changes no runnable inputs. The manual lab was stopped after capture.

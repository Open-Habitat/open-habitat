# Result — partial, not merged

The confirmed misleading first-code window is repaired: token acquisition retires the code/link before Graph discovery. Outlook is explicitly step 2/2 with a new prompt. Success now precedes the past-tense skipped-site explanation and the final action; Finnish copy no longer claims every Microsoft account completed a file sync. Storybook includes discovery, Outlook and partial-success states.

**Not fixed/claimed:** the cause of Jari's same-code resubmission report; real-provider acceptance; one-code login. A native adapter is explicitly deferred to @very-quizzical-dock (untriaged, no lane). The pinned tool's native encrypted cache accepts MSAL serialization in an empty-cache probe, but account/refresh interoperability and a packaged library closure are not qualified.

**Blocking requirement 2:** files polling counters and both flows' lifecycle transitions are logged without secrets. The Outlook CLI exposes no individual polling outcomes: its rows mark counts unavailable rather than fabricating zeros. The issue remains open and the branch is preserved, not merged, because the requested complete per-flow instrumentation is not delivered.

## Validation

Final runnable inputs are committed as **55470411**. Only issue documentation/evidence changed afterwards. All commands used `TMPDIR=/var/tmp` and private synthetic homes; heavy checks used the installed execution placement, one browser suite at a time.

- `./scripts/test-focused.sh --area web`: passed format, lint, typecheck and **89 files / 502 tests** (`/var/tmp/microsoft-web-final2.log`).
- `./scripts/test-focused.sh --area go --go-package ./internal/daemon/integrations`: passed, 25.166 s (`/var/tmp/microsoft-go-contracts-final.log`).
- `npm ci --prefix internal/daemon/pi-device-test --ignore-scripts`, then `go test -count=1 ./internal/daemon -run '^TestAgentCredentialsAndIntegrationRoutes$'`: passed on retry after installing the required fixture, 1.631 s (`/var/tmp/microsoft-daemon-contracts-retry.log`).
- `./scripts/test-focused.sh --area contracts`: generated contracts clean; positive/negative validation passed, including phase/state/provider refusals (same retry log).
- `./scripts/test-focused.sh --area browser --spec integrations.spec.ts`: **6 passed**, including a11y (`/var/tmp/microsoft-browser-final.log`).
- `./scripts/test-focused.sh --area browser --spec lab-microsoft-login.spec.ts`: **4 passed**, each auditing/capturing discovery, Outlook and completion (`/var/tmp/microsoft-lab-final.log`).
- `TestMicrosoftCatalogRelaysBothCodesAndSupervisesChoice`: **10 separate final `go test -count=1` invocations passed**, no reproduced flake (`/var/tmp/microsoft-ten-runs-final.log`).
- One targeted `claude-fable-5-1` review; findings adjudicated and corrected as described in investigation.md. Fast web typecheck covers the updated production Storybook stories; no separate Storybook build or full clean gate was run.
- `issuectl doctor --json`, `python3 scripts/validate-project-view.py`, and `git diff --check`: completed. Doctor still reports unrelated historical non-AVIF/large images; the new review images are AVIF.

## Visual review

`review/` contains paired static synthetic-lab HTML and screenshots for discovery, Outlook and partial completion, at desktop/390 px in light/dark. Compared with the current settings/modal idiom and design-system tokens: no CSS/token overrides, code remains monospace, one primary provider link, warning below success, final action at the bottom, no horizontal overflow. The review caught conflicting outer/substep numbering and a warning below the final action; both were corrected before final capture. There is no separate current Microsoft-dialog prototype; the current settings reference is `design-system/drafts/Navigaatio ja asetukset.dc.html`, with shared modal/control tokens and the existing production integration dialog as the component reference. Screenshots are human review material, not automated visual-diff acceptance.

Representative final pairs: [Outlook desktop dark](review/outlook-1280-dark.avif) / [HTML](review/outlook-1280-dark.html), [discovery phone dark](review/files_discovery-390-dark.avif) / [HTML](review/files_discovery-390-dark.html), [completion phone light](review/completed-390-light.avif) / [HTML](review/completed-390-light.html). All 12 states have both files.

## Workflow failures and limits

- Initial fast-web run failed Biome's effect-dependency rule for an unnecessary copy reset effect; removed it (device-step identity already resets the control), then reran successfully. The initial shell's final `cat` masked its exit status; subsequent runs use `pipefail`.
- Optional exploratory reads/searches used missing globs/files (including an incorrect skill path, corrected to the declared path). All required source/instructions were subsequently read. No required input was skipped.
- Remote execution wrappers do not forward the screenshot environment override or copy artifacts back. The first local image reads found no files; recovered all paired captures through the supported warm runner's synthetic result archive. No local browser fallback or personal browser/home was used.
- Exploratory `fleetrepo-exec job --help` was invalid, and `command show` refused because the ordinary command belongs to warm placement. Used the installed warm runner for artifact export; tests had already passed remotely. Test/source state was not changed by the refused queries.
- The targeted review completed, but its optional package-test subcheck reported two baseline failures under its scratch environment. This worker's affected-package runs are the validation authority; no unrelated production fix was inferred from the review's report.

- The daemon caller check initially failed `native_unavailable` at credential save because the required Pi SDK fixture was absent. Installed the documented synthetic fixture and the identical test passed; no product change was needed.
- Optional AVIF conversion first failed because system Python has no pip. Retried with `uv pip --target /var/tmp/oh-ms-avif-codec`; all twelve captures were converted successfully without a global install.

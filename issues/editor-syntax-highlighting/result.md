# Result

Completed extension-selected, lazy CodeMirror highlighting, including PHP, Rust, SQL and TOML alongside the existing JS/TS/JSX/TSX, Python, Go, JSON, YAML, Markdown, HTML, CSS and shell grammars. Only official CodeMirror packages were added, with exact manifest/lock pins. TOML and shell use official legacy stream modes. Unknown extensions stay plain, including extensionless files inside dotted directories. Failed grammar chunks leave the plain editor usable.

Type/tag/property names and Markdown emphasis now use the existing design-system syntax tokens. The production Browser editor story includes a TSX highlighting state. Save, conflict, identity and document ownership are unchanged.

## Evidence and self-review

Four synthetic-lab screenshot/offline-HTML pairs are in [evidence/](evidence/): 1440 and 390 px, light and dark. Reviewed all four against the existing editor captures and the accepted `2026-10-22-tiedostopuu-r2` / `2026-10-21-editorin-painikkeet-2` prototype sources. Keyword, string and comment hues use the prototype's same tokens; the neutral current-file row, monospace text, local toolbar, bounded viewport and compact stacking remain unchanged. The screenshot file list/content is a browser response fixture, not native-filesystem evidence.

Focused self-review checked extension aliases, JSX/TypeScript flags, lazy-only imports, obsolete async replies after unmount, plain fallback, live theme switching and preservation of scrolling/save behavior. No shared state, contracts or daemon changes; no external reviewer required.

## Validation

- `npm ci --prefix web`: passed with the final lockfile.
- `./scripts/test-focused.sh --area web`: format, lint, TypeScript, **91 files / 527 tests passed**, including grammar parsing/highlighting for every requested language and unknown-extension cases.
- `./scripts/test-focused.sh --area browser --spec browser-editor.spec.ts`: **15 passed**, including save/conflict/identity/lazy engine behavior, scrolling and axe at desktop/390 px in both themes.
- `./scripts/test-focused.sh --area browser --spec lab-editor-syntax.spec.ts`: **5 passed**. Four width/theme cases assert actual token colors for TSX, PHP, TOML and SQL, live theme changes without buffer replacement, unknown-file plain editing, editor-scoped axe and no page overflow. Recapture with `--tag 'editor syntax'`: **4 passed**; those are the committed captures.
- `npm run storybook:test --prefix web`: passed.
- `issuectl doctor --json`, `python3 scripts/validate-project-view.py`, `git diff --check`: passed (existing attachment advisories remain).

Browser suites ran serially through Fleetrepo's Cedar warm runner, not locally on Alder. No Go/contracts/full clean gate, live-server, physical-device or deployment claim; none of those boundaries changed. Tested runnable inputs: base `a81a5ea5` plus the committed web delta, whose staged `git diff --cached -- web` SHA-256 is `ac43b5535aa1d34291deaede6f194501090006d42e60bb78eb12bc4747bd3699`. Issue/evidence changes do not alter runtime inputs.

## Startup and bundle measurement

The lab reloads the same synthetic conversation seven times per version. An in-page click listener and DOM observer measure the actual file click → editor mount, including API time: median **342.2 ms before → 338.1 ms after** (ranges 331.5–346.2 / 332.9–345.2 ms). Startup is unchanged within this run's variability; no speedup claim. The separate Playwright-wide click → visibility medians are 396.4 → 392.4 ms. Baseline uses the original engine from `a81a5ea5`; these are sequential single-test warm-runner Chromium observations, not a controlled network benchmark. Both final paired measurement tests passed.

Raw timing samples and asset results are recorded in `performance.json`. Initial entry JS remains **1,404.99 kB / 398.94 kB gzip**, shared Icon JS remains **397.12 / 121.89 kB**, and initial CSS is unchanged. All growth is behind the already-lazy editor: CodeMirror's lazy chunk grows **0.90 kB / 0.28 kB gzip**, with additional grammar chunks. Total emitted JS grows **199.61 kB / 67.20 kB gzip** (Vite's rounded sizes); these grammars are not fetched at application startup. Existing browser regression still verifies that the engine is absent before a file is opened.

## Recovered failures and limits

- First baseline test selected root `main.go` (generic fixture text) instead of `cmd/main.go`; its token assertion failed. Replaced text matching with exact resource paths; baseline rerun passed. Log: `/var/tmp/syntax-baseline.log`.
- First web run assumed the official YAML parser semantically colors bare numeric scalars. It tags these as content, so changed the test to assert a quoted string rather than invent a parser enhancement. Final grammar/web suite passes. Log: `/var/tmp/syntax-web.log`.
- First lab matrix checked visibility before the asynchronous listing arrived, toggling the initially open picker closed. Added an explicit initial-entry readiness assertion; all four cases pass. Log: `/var/tmp/syntax-lab.log`.
- The first native-event timing instrumentation installed its listener before the asynchronous file entry existed, leaving an undefined mark in both versions. Waited for the exact entry before instrumenting; both paired runs then passed. Logs: `/var/tmp/syntax-{baseline,final}-event.log` (final successful reruns); original failures remain in the run transcript. Earlier Playwright-wide timings were confounded by concurrent tests and click scheduling, so they are not used to infer startup performance.
- An evidence retrieval ran after the next Playwright suite had cleared its output directory. Recaptured the four cases and retrieved their pairs before starting another suite. The first empty archive is disposable; committed pairs are complete. Log/attempt: `/var/tmp/syntax-evidence.tar.gz`; final: `/var/tmp/syntax-evidence-final.tar.gz`.
- The file reader/Pillow cannot decode AVIF here; visual inspection used the existing scroll-fix PNG references instead, alongside the actual prototype source. Several guessed discovery paths were absent; scoped discovery found the real component and contract paths. No required input remained missing.
- The first staged whitespace check found trailing spaces in CSS serialized by the HTML snapshot helper. Removed line-end whitespace from the static HTML (no layout/content change), reran the check and amended the unpublished commit. No check remains failing.
- `npm ci` reports six existing lockfile advisories; no dependency-security remediation or full-page lab axe claim is made. Build chunk/PostCSS and jsdom canvas messages are existing advisories, not skipped failed checks.

Focused logs are `/var/tmp/syntax-{web-final,lab-fixed,recapture,editor-regressions,storybook,baseline-event,final-event}.log`. The feature uses the repository's legal completion status **done**; **fixed** is reserved for bugs.

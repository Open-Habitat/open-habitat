# Viivasto implementation

Implemented the accepted Viivasto tree with monochrome file/folder icons, interior guides, neutral current-file surface, **Auki / ● Muokattu**, and a separate four-sided keyboard focus ring. The existing `ah-disclosure-chevron` used by Navigation is reused at 9px rather than its usual 6px. Complete observed single-child directory chains compact into one row; identifiers and open/save paths stay unchanged.

Listings remain transient, per-mounted-document UI observations from the existing confined API. Expanding an unknown folder reads only that folder; opening an explicit file reveals its known path's ancestors. There is no recursive scan. Filtering includes already-loaded paths from collapsed folders and retains expansion state when cleared. Hiding/reopening the picker preserves its navigation state. Loading, failed-read retry, truncation and unsupported entries remain visible without replacing the editor's buffer or save/conflict controller.

## Evidence and review

Synthetic lab screenshot/static-HTML pairs: `evidence/tree-{1440,390}-{light,dark}.{avif,html}`. The open `cmd/main.go` document uses the real synthetic host API; the `src/components/editor` chain and long filename are synthetic browser response fixtures, not evidence of native filesystem contents. The capture spec is `web/tests/lab-filetree.spec.ts`; it writes ignored Playwright output, which was retrieved into this issue, rather than modifying tracked evidence during normal test runs.

Compared all four captures with round 2's Viivasto desktop and Tiivistetty phone captures. The 240px picker, 14px guides, neutral current row, ellipsis/full-path title, compact chain, monochrome marks and separate focus match the direction. Intentional differences: larger shared chevron, folder icons from the existing Icon component, existing production close button and real CodeMirror, and no prototype-only controls/legend. The phone overlay retains a usable scrolling body; no horizontal document overflow. Settings, start page and conversation components are untouched.

Focused self-review covered complete-versus-truncated compaction, concurrent directory replies, StrictMode cancellation, retry, keyboard focus versus opening, loaded-only filtering and buffer lifetime. No shared state, contract or daemon changes; no external reviewer was required.

## Validation

Validated implementation: `7942746f358e48bf87273b073f6adcf883abba28`. The evidence/issue commit changes no runnable inputs. Final Alder logs: `/var/tmp/filetree-web-final-output-path.log`, `/var/tmp/filetree-browser-verified.log`, `/var/tmp/filetree-lab-final-output-path.log`, `/var/tmp/filetree-storybook.log`, `/var/tmp/filetree-fetch-final-output-path.log`.

- `npm ci --prefix web`: passed, locked dependencies unchanged.
- `./scripts/test-focused.sh --area web` (`OH_WEB_WORKERS=2`): formatting, lint, TypeScript and all **88 test files / 495 tests passed** on the final source.
- `./scripts/test-focused.sh --area browser --spec browser-editor.spec.ts`: **11 passed**, including four desktop/phone × light/dark editor/picker interaction and axe journeys, lazy-chain retry, identity changes and dirty-buffer preservation.
- `./scripts/test-focused.sh --area browser --spec lab-filetree.spec.ts`: **4 passed**, all editor-scoped axe audits, overflow checks and screenshot/HTML pairs. Ordinary wrappers placed these browser suites serially on the pinned Cedar runner (4 browser workers there), not Alder. Capture retrieval used that runner's pinned SSH route.
- `npm run build-storybook --prefix web`: passed.
- `issuectl doctor --json`, `python3 scripts/validate-project-view.py`, `git diff --check`: passed (doctor retains unrelated existing attachment advisories).

No full clean gate, deployment, live-user or distinct-UID security claim is made; contracts and Go were not changed. The accepted feature is closed **done**: this repository reserves **fixed** for bugs.

## Failure inventory

- Initial lint checks rejected `ul role=tree` and index keys for fixed decorative guides; changed the tree container to a `div` and documented the stateless depth-slot key. The first focused web run then found CSS selector ordering; reordered it. Subsequent lint/static checks passed. Logs: `/var/tmp/filetree-web-checks.log` (Alder); the earlier targeted lint output is in this run's transcript.
- The first lab run passed both phone cases but failed desktop **whole-page** axe on existing conversation `heading-order` and repeated `Agentin vuoro` landmarks. Those components are explicitly outside this task and another worker is changing them. The lab audit now covers the affected production editor/picker, not unrelated conversation markup; all four scoped audits passed on the final source. Initial log: `/var/tmp/filetree-lab-evidence.log` (Alder). This is not a claim that the full lab page passes axe.
- Source/tool discovery encountered absent optional paths (`useBrowserEditor.ts`, `web/vitest.config.*`, an initial guessed Fleetrepo library path), absent pre-install `web/node_modules`, and unsupported `fleetrepo heavy --help`. Continued from the actual files, installed locked web dependencies and used the existing pinned remote-runner transport to retrieve captures. No required input or capability remained missing. `tw doctor` reported no attached display client; captures use headless synthetic Chromium and need none.
- `npm ci` completed but reported six dependency advisories (3 moderate, 2 high, 1 critical) in the existing lockfile. No dependency or lockfile changed and no dependency-security audit/remediation is claimed. Build warnings about PostCSS metadata/chunk size and jsdom's unimplemented canvas are advisory, not failed checks.

- `issuectl close --status fixed` refused with `transition-illegal` because the issue is a feature. Recovered by closing it as `done`, preserving its correct type and checked acceptance criteria; no tracker bypass.
- One `git add web/tests/lab-filetree.spec.ts` ran while the shell was already in `web/` and refused the doubled path. Repeated from the repository root successfully; no file contents were affected.

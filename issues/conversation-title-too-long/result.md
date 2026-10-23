# Result

Generated titles now ask for 2–5 words, at most 32 characters including spaces, in the latest user's language, without a label such as `Muistutus:`. The shared production generator caps the result at five whole words and 32 Unicode code points. If even the first word cannot fit, generation fails without writing a partial word. This applies to automatic first/refined titles, live regeneration and stopped-history regeneration. Native user-chosen names retain their separate existing safety limit. No retry, new store, contract or layout change.

## Validation

Tested implementation revision: `4a527c57` (all code, tests, story and capture script; evidence/issue closure follows separately).

- Installed the pinned Pi SDK fixture with `npm ci --prefix internal/daemon/pi-device-test --ignore-scripts` and web dependencies with `npm ci --prefix web`.
- `TMPDIR=/var/tmp ./scripts/test-focused.sh --area go --go-package ./internal/daemon`: passed, 94.146 s; `/var/tmp/title-go-final.log`.
- Extended `TestTitleModelUsesPinnedPiRuntimeWithSyntheticProvider`: real Pi 1.3 ModelRuntime and the production helper, synthetic homes/provider, Finnish and English first-title and regeneration excerpts, deliberate overlong responses, existing provider fallback. All four pass. This proves actual SDK request/response handling and the code bound, not a live model's obedience or entitlement.
- Boundary cases cover exactly 32 characters, Unicode words, six short words, normalized whitespace, an overlong later word and refusal of an overlong first word.
- `./scripts/test-focused.sh --area web`: passed on final sources (format, lint, typecheck, unit/component checks); `/var/tmp/title-web-final.log`.
- `./scripts/test-focused.sh --area browser --spec title-regeneration.spec.ts`: passed all three cases (5.7 s), including native stopped-history regeneration, pending/error interactions, and header/model-info axe checks in light/dark at 1366/390 px; `/var/tmp/title-browser-final.log`. One browser suite ran at a time through the maintained focused entrypoint.
- Final synthetic lab capture and AVIF conversion completed successfully; `/var/tmp/title-lab-capture-final.log`.
- `./scripts/test-focused.sh --area contracts`: passed; `/var/tmp/title-contracts-final.log`. No schema changed.
- `npm run build-storybook --prefix web`: passed; `/var/tmp/title-storybook-final.log`. The foundation story uses a representative bounded Finnish title.

## Focused review and visual evidence

One targeted independent reviewer, `claude-fable-5-1`, completed. Its sole actionable finding was that a horizontal scroll-width assertion could pass despite the header's wrapping/clamp. Local CSS inspection confirmed it; the final browser assertion measures the text Range against the available width and one line height, and checks the opposite for a long native name. No production defect found by the reviewer. Raw review: `/var/tmp/title-review.txt`. No further reviewer or issue filing.

Synthetic lab screenshots and adjacent self-contained HTML: `light-1366`, `dark-1366`, `light-390`, `dark-390` (`.avif` and `.html`). Reproduce with `web/lab/conversation-title-too-long.mjs` while the lab is running. They show the real stopped-history retitle journey with its existing deterministic fixture title, not a live model. The separate pinned-Pi tests establish the production bound.

Compared desktop and phone captures with `design-system/drafts/Agentin vuoro.proto.html` (phone toggle enabled). Short topic-first header titles match the prototype's intent and remain readable without expansion. Production already has additional process/model information and multiple phone header rows; this task leaves that existing layout and its tokens unchanged. No visual restyling was needed.

## Tool/sub-workflow inventory

All failures below were recovered; none is accepted as a passing check:

- Initial searches guessed nonexistent `internal/daemon/pi/*title*`, `internal/daemon/pi` and `internal/daemon/fixture*` paths. Scoped searches located `title_linux.go`, `title-helper.mjs` and the history handler; no required read remains missing.
- First focused Go run had an incorrect expected value for a 33-character accented phrase. Corrected the expectation to the whole-word prefix; the final complete daemon package passed. `/var/tmp/title-native-focused.log` retains the initial failure.
- First lab capture used relative API URLs in a context without a base URL (`Invalid URL`); the second used the ordinary fixture workspace ID instead of lab's `workspace-aurinkokello`. Corrected both, added a timeout and settlement wait, and the corrected capture completed. Failed logs: `/var/tmp/title-lab-capture.log`, `/var/tmp/title-lab-capture-retry.log`.
- Initial web check rejected formatting in the newly added capture script. Formatted it and reran the complete web checks. The chained contracts step had not run on that attempt; its subsequent explicit run passed.
- The first revised fit test assumed long native text wraps on desktop, but desktop uses horizontal clipping (height 21.6875 px). Replaced the assumption with a text Range width/height check for both layouts. No production code was changed to accommodate the test.
- Initial prototype phone inspection narrowed the outer page rather than enabling its phone frame. Repeated with `#phone` checked before comparison.

`issuectl doctor --json`, `python3 scripts/validate-project-view.py` and `git diff --check` passed.

The full gate, live provider/server verification and distinct-UID tests were not run: this change adds no authority or ownership behavior. The conductor pushes after landing.

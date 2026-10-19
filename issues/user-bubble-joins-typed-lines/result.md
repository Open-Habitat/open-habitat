# Result

Own messages preserve typed newlines, blank lines and indentation as wrapping plain text: ordinary bubbles, held messages and readable native-history text blocks. Pi replies retain sanitized Markdown. Copy still uses the original source; collapse/expand is unchanged.

## Decisions for later review

Chosen: plain text with `pre-wrap`, rather than Markdown with hard breaks. The bubble should show what was sent. Pasted fences, list markers, Markdown links and HTML stay literal; long lines wrap. User links are not clickable. Hard-break Markdown would retain formatted fences/lists/links but still reinterpret pasted syntax and spacing. Assistant Markdown is unchanged.

## Evidence and self-review

- Component assertions cover exact text, blank lines, indentation, fences, links and escaped HTML, plus held messages. Existing table/list/Unicode Markdown coverage moved to an assistant bubble, where that behavior remains supported.
- The seven-line Playwright journey measures strictly increasing painted line positions (textContent alone would miss soft-break joining), plus the existing eight-line clamp/fade assertions.
- `evidence/seven-lines.png` and adjacent inert HTML show the synthetic lab, not the live server.
- Reviewed the native block override in HistoryView: changing only UserMessage's fallback would miss it. Tool/unknown rendering, clipboard source, contracts and dependencies are unchanged.
- Rebased onto local main `7dc2868a`; only KOKEILTAVAA.md conflicted. Both additions retained, own checks first.

## Validation and failure inventory

Final validation: `./scripts/test-web-fast.sh` passed (248 unit + 176 component tests, format/lint/types); `OH_PORT_BASE=16400 OH_BROWSER_WORKERS=2 PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright npm run test:e2e --prefix web -- browser-conversation.spec.ts --retries=1` passed all 67 cases without retries (2.8 min). This includes the seven-line/fade case and the real-stream logout case. `issuectl doctor --json`, `python3 scripts/validate-project-view.py` and `git diff --check` passed.

Validation used `82b7a572` plus the identity-test fixture correction shown in the final commit; production code was unchanged after that revision. Screenshot was captured before the rebase, with identical user-bubble code.

Earlier attempts: fixed unused-import/CSS lint warnings, capture-script formatting and code-panel styling leaking into user blocks. Bubble screenshots raced tail-following and the jump-to-latest overlay; capture now suspends following and centers the bubble. The focused seven-line/fade journey passes.

Full browser attempts exposed unrelated cold-open/refresh timing and changed-identity failures after main's stream-revocation change. The identity test now waits for initial status before intercepting a refresh and isolates its journal; the separate real-stream revocation case remains untouched. Focused identity validation passes. One transient-status case passed only on retry in an earlier run.

Bubble and identity traces were inspected. Two attempts to inspect older identity traces failed because a new Playwright run had already cleared them; those older traces are unavailable. An initial skill read used the wrong location, then the declared location succeeded. The obsolete first browser run and lab host were intentionally stopped. No full gate, independent model review or live-server check was run; none is required for this user-only change.

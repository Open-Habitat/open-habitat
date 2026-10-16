# Result

## Changes

Every opening starts at the latest content, including a warm return through the home card, sidebar or workspace. Controlled conversations no longer restore a previous visit's reading anchor. Read-only history previously did not scroll on opening at all; it now follows initial layout changes (including lazy Markdown rendering). Reader input stops following. Paging within the current visit still keeps its keyed anchor.

Empty, display-enabled native `custom_message` entries are omitted by the daemon, rather than converted to an empty extension card. Nonempty extension text is displayed as text, not Markdown: XML-shaped notifications must not lose their contents to Markdown's raw-HTML filtering. Known process notifications show their human summary under **Prosessin ilmoitus**, with the full public message folded under **Ilmoituksen sisältö**. Extension `details` never enter the browser projection. Recaps retain their existing separate recap presentation; hidden extension messages remain hidden.

## Native shape and attribution

Inspected Pi **1.3.0**'s `dist/core/session-manager.js` (`appendCustomMessageEntry`), the published **pi-claude-bridge 0.9.3** source, the daemon's `recap-extension.mjs`, the installed recap extension, and **@aliou/pi-processes 0.10.9** (`notification-sender.ts`, `constants.ts`, `notifications/render-content.ts`). No personal session files or live-server histories were read.

- Pi persists `{type:"custom_message", customType, content, display, details, id, parentId, timestamp}`. `display:true` permits presentation but does not guarantee useful content.
- Processes emits `customType:"ad-process:notification", display:true`, with XML-shaped **plain text** in `content`: `<process_event ...>\n  <summary>…</summary>\n  <command>…</command>…\n</process_event>`. This is the confirmed emitter of that shape. Rendering it through Markdown dropped the summary and command elements. The regression fixture uses the real native envelope and this content structure with invented values.
- Recap uses `appendEntry("conversation-recap", data)`, i.e. a native `custom` entry, not a `custom_message`; it already has a dedicated projection. Bridge 0.9.3 does not call `sendMessage` or `appendEntry`.
- **The exact emitter of Jari's screenshot cannot be identified from the image alone.** The lab reproduces both an actually empty native custom message and the loss of useful process notification content. The empty-content variant is an explicit boundary fixture, not a claim that the processes extension emits empty messages. Identifying the original entry would require its redacted native envelope, which was not available and was not obtained by reading Jari's sessions.

## Evidence

`before-opening.{png,html}` and `after-opening.{png,html}` show the same synthetic home-card opening. `before-extension.{png,html}` and `after-extension.{png,html}` show the empty card and notification treatment. All are synthetic loopback-lab evidence (`OH_PORT_BASE=28000`), not live-host evidence. The fixture is `/fixture/open-at-end`, scoped to the disposable lab and the invented Alice session.

## Validation

On the implementation tree before the first commit, with `TMPDIR=/var/tmp/oh-open-end`, `OH_PORT_BASE=28000`, `OH_BROWSER_WORKERS=2`, and `PLAYWRIGHT_BROWSERS_PATH=/home/maintainer/.cache/ms-playwright`:

- `scripts/test-focused.sh --area web`: passed (format, lint, typecheck, 132 unit tests, 119 component tests).
- `go test ./internal/daemon`: passed, after installing its pinned synthetic Pi dependencies with `npm ci --prefix internal/daemon/pi-device-test --ignore-scripts --no-audit --no-fund`.
- `scripts/test-focused.sh --area browser --spec lab-open-at-end.spec.ts`: 3/3 passed after splitting notification coverage into its own browser case. Both controlled and read-only sessions exercise home-card, sidebar and workspace openings after deliberately scrolling away. The notification case tests real-shaped native XML, readable summary, folded public content, no empty card, and no private details in the feed.
- `scripts/test-focused.sh --area browser --spec native-history.spec.ts`: 10/10 passed, including older-page anchoring and accessibility.
- `scripts/test-focused.sh --area contracts`: passed.
- `issuectl doctor --json`, `python3 scripts/validate-project-view.py`, `git diff --check`: passed.

Earlier runs caught two implementation mistakes (read-only lazy layout following, then explicit paging while following) and a missing jsdom ResizeObserver stub; all were fixed and the complete focused sequence rerun. An initial direct daemon-suite attempt lacked its Pi fixture dependencies and also hit the shared inotify limit; the installed-dependency rerun passed without changing machine limits.

Baseline verification: with the three implementation files replaced temporarily by their `acb276b1` versions, both opening journeys failed for the intended reasons: the read-only final answer was outside the viewport, and controlled reopening remained 155 px above the end. The implementation files were restored byte-for-byte from HEAD afterwards. A separate old-code run of the notification case also failed: no readable process-summary note was rendered after Markdown settled. The implementation was again restored afterwards.

### Full gate and integration

Ran `OH_GATE_SERIAL_HEAVY=1 OH_BROWSER_WORKERS=2 OH_PORT_BASE=28000 scripts/ci-local.sh --clean --json` on commit `a66d1774` (tree `fd2cef75252685f120552c195e09483fadd39f78`) after checking memory (`free -g`: 4 GB available). Serial heavy phases and two workers limited shared-host pressure. **The gate failed** after 670 seconds; no clean-gate receipt is claimed. Static/unit/component checks and Go/race/contracts/Storybook/docs checks passed. The normal browser suite had 170 passes, two intentional visual-capture skips and five failures:

- restart offers native continuation and archive without a handle;
- receipt lost on daemon restart remains unknown (port 28021 was already in use);
- empty composer replacement releases its previous native child;
- archive offer expires after eight unpaused seconds;
- latest pill names working and unread reply with its count.

Reran those five with one worker: four passed. Archive-expiry still failed. Replacing **all three implementation files** with their original `acb276b1` versions reproduced exactly the archive-expiry failure; restored the fix byte-for-byte afterwards. This is a pre-existing failure, also documented by the settings worker, not a timeout-only clean gate. The lab phase was skipped by the failed normal browser run, so it was run explicitly with `npx playwright test --config playwright.lab.config.ts`: **27/27 passed**. Packaging was not reached by the failed gate and is not claimed tested here; packaging inputs did not change.

Landing follows `TESTING.md`'s affected-check policy rather than describing the gate as passed. No unrelated archive/controller code or tests were changed. Final focused integration checks after rebasing onto `e39e16e1` passed on `08150ab1`: fast web checks, all three `lab-open-at-end` browser cases and all ten `native-history` cases (41-second complete sequence). Subsequent changes only record these results.

Rebased onto main's settings and thinking-title changes. The only conflict was simultaneous additions to `KOKEILTAVAA.md`; both workers' live-check sections were preserved. No source-code conflict. Focused self-review checked route resets, lazy layout following, explicit older-page anchors, unknown blocks, extension visibility and plain-text escaping. No new authority, storage, identity flow or dependency was introduced.

## Live check

Open a long conversation via the home card, sidebar, and workspace page, including after leaving it scrolled upward. It should open at its latest content each time. Check a fresh conversation for empty extension cards; if a process notification appears, its summary should be readable and its original content expandable. No real provider response or live-server behavior was exercised by this worker.


## Reopened-card investigation (2026-10-16)

**Cause: Pi core 1.3.0, not an extension.** The screenshot's extension label was our fallback for an unrecognised message role. Through Fleetrepo's pinned guest SSH path, running the bounded inspector as the mapped user, the newest native session contained **zero custom-message entries** (also checked native `custom` and `message.role:custom`). No conversation text or system prompt from that session was output or copied here. The extension hypothesis was therefore not supported.

Reproduced locally with the cached pinned Pi 1.3.0 plus pi-claude-bridge 0.9.3 in a disposable home under `/var/tmp/oh-extension-repro`, without personal credentials. A synthetic first prompt produces this native shape before the user message:

```json
{"type":"message","message":{"role":"system","content":"","sections":{"preamble":"synthetic internal instruction"},"toolsAdded":[{"name":"synthetic","parameters":{"type":"object"}}],"timestamp":1792143755045}}
```

The source confirms attribution: Pi's `core/agent-session.js` `_preparePromptAndToolLoadout` creates `{role:"system",content:"",sections,timestamp}`, and its `message_end` handler persists it with `appendMessage`. Pi's interactive renderer explicitly does nothing for `case "system"`. Bridge 0.9.3 has no custom-message emitter; recap writes separate `custom` recap records; processes writes real notification messages only for process events. No extension emitted this empty startup card. The old projection treated role `system` as `unknown` with one empty text block; the browser labelled that **Laajennuksen viesti** and drew the empty grey plain-text box. The synthetic lab reproduces the screenshot's distinguishing empty box.

**Rule:** omit all native system messages, regardless of whether `content` is empty or nonempty, matching Pi's own rendering. Their structured sections/tool declarations are internal prompt state, not reader-facing notifications. Explicit block reads also refuse them. Existing custom-message rules remain unchanged: `display:false` and empty content are hidden; process notifications retain their readable summary and folded public content; recap retains its dedicated presentation; extension details are never projected. No new storage, contract, dependency or authority is introduced.

The regression test uses the actual core envelope with invented sections and tools, proving both full/windowed history readers skip it without losing the following user turn and explicit block reads refuse it. It failed on the old implementation with an `unknown` empty text block. The existing lab notification test now includes this startup entry and still requires zero extension cards while the meaningful process notification remains usable.

`before-system-prompt.{png,html}` and `after-system-prompt.{png,html}` are paired synthetic loopback-lab screenshots, `OH_PORT_BASE=28300`. They contain invented conversation text only. The earlier investigation above is retained as historical evidence, not the attribution of the reopened screenshot.

### Reopened-fix validation and self-review

With `TMPDIR=/var/tmp/oh-extension-build`, `OH_PORT_BASE=28300`, `OH_BROWSER_WORKERS=2`, `PLAYWRIGHT_BROWSERS_PATH=/home/maintainer/.cache/ms-playwright`:

- `go test ./internal/daemon`: passed, including the real-shaped system-entry regression, both history readers and block-read refusal.
- `scripts/test-focused.sh --area web`: passed (format/lint/typecheck, unit and component suites).
- `scripts/test-focused.sh --area browser --spec lab-open-at-end.spec.ts`: 3/3 passed, including startup-system omission alongside the readable process notification and all opening paths.
- `scripts/test-focused.sh --area browser --spec native-history.spec.ts`: 10/10 passed, including accessibility, narrow view, older-page anchors and continuation.
- `scripts/test-focused.sh --area contracts`: passed. `issuectl doctor --json`, project-view validator and `git diff --check`: passed.

Focused self-review traced the projection through full/windowed readers, journal ingestion and explicit block reads. The fix is role-specific rather than suppressing all unknown entries or all extension messages: unfamiliar native content remains distinguishable, legitimate process notifications remain readable, and prompt sections/tool metadata cannot become browser content. Compared the paired lab screenshots: before has precisely the empty grey extension card; after starts with the first user turn. No real provider success or live signed-in browser check is claimed.

Full gate attempted on `0f507eca` after `free -g` showed 6 GiB available, using the same environment plus `OH_GATE_SERIAL_HEAVY=1`. It failed after 459 s: 177 normal browser cases passed, two intentional capture skips, one continuation case returned HTTP 409 where its intercept expected 200 (`stale recovery during continuation never strands controls or reposts`). That case passed immediately in isolation with one worker. Web static/unit/component, Go/race/contracts, Storybook and documentation checks passed. No clean-gate receipt is claimed; packaging was not reached. The separately run lab suite passed 30/31, including all changed-area tests; the unrelated Pi-onboarding non-admin account-menu focus assertion timed out. These are not represented as a clean full gate.

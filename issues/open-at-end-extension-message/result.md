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
- `scripts/test-focused.sh --area browser --spec lab-open-at-end.spec.ts`: 2/2 passed. Both controlled and read-only sessions exercise home-card, sidebar and workspace openings after deliberately scrolling away. The notification case tests real-shaped native XML, readable summary, folded public content, no empty card, and no private details in the feed.
- `scripts/test-focused.sh --area browser --spec native-history.spec.ts`: 10/10 passed, including older-page anchoring and accessibility.
- `scripts/test-focused.sh --area contracts`: passed.
- `issuectl doctor --json`, `python3 scripts/validate-project-view.py`, `git diff --check`: passed.

Earlier runs caught two implementation mistakes (read-only lazy layout following, then explicit paging while following) and a missing jsdom ResizeObserver stub; all were fixed and the complete focused sequence rerun. An initial direct daemon-suite attempt lacked its Pi fixture dependencies and also hit the shared inotify limit; the installed-dependency rerun passed without changing machine limits.

Full clean gate and baseline regression run: pending.

## Live check

Open a long conversation via the home card, sidebar, and workspace page, including after leaving it scrolled upward. It should open at its latest content each time. Check a fresh conversation for empty extension cards; if a process notification appears, its summary should be readable and its original content expandable. No real provider response or live-server behavior was exercised by this worker.

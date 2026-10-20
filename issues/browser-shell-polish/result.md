# Result: browser shell polish

The shell opens in one top-bar gesture, without the first-open rights dialog.
Opening reads the current shell list: reuse a shell if one exists, otherwise
start exactly one. An unsuccessful list read does not speculate that the
workspace is empty or create a shell. Busy-close and multi-line-paste
confirmations are unchanged.

The shortcut is **Ctrl+Shift+Enter** (Control, not Command, on macOS), matched
by `event.code`. It opens directly from the composer without submitting its
draft and moves focus between xterm and the selected tab. Tooltips and the
hint row agree; dead keys and the old Backquote binding do not activate it.

## Selection diagnosis and fix

The Linux Shift-drag case and ordinary tmux-copy action both kept their action
chip for two seconds. Reproducing xterm's macOS platform branch exposed the
actual highlight loss: xterm 6 forces browser selection with Shift on Linux,
but Option on macOS. On macOS the advertised Shift-drag went to tmux instead;
tmux's default copy-and-cancel removes its highlight on mouse release.
This was not the shell-list refresh, remounting, focus or the Taskfleet poll.

Before changing selection code, the host-backed Playwright case set
`navigator.platform = MacIntel`, Shift-dragged a real output row, waited two
seconds and failed the assertion on xterm's selection overlay. The Linux
version passed. The fix translates only a Mac Shift-left-mousedown into
xterm's existing Option-selection gesture using a DOM mouse event, preserving
coordinates, click count and other modifiers. No private xterm internals,
selection buffer or host changes. Ordinary mouse reporting and wheel scrolling
still belong to tmux/programs; native Option-drag remains available. The hint
now explicitly says Shift-drag.

The extended Copy→reselect→send journey also found xterm 6's range-event
cache: after `clearSelection()`, reselecting the identical range paints a
highlight but does not emit `onSelectionChange`. The surface now re-reports
an existing selection after mouseup as well, so the actions come back even
for that identical range. This uses the public selection API and cancels its
pending animation frame on disposal.

## Decisions for later review

- **Ctrl+Shift+Enter** rather than Ctrl+Backquote or a punctuation shortcut:
  Return/Enter is non-printing and the same physical key on Finnish/Nordic
  macOS and US layouts. Ctrl+Alt letter chords can interact with AltGr;
  Command chords collide more often with the Mac browser. Capture the gesture
  before composer/xterm handlers so it never sends the draft or shell input.
- **Keep tmux mouse mode, normalize deliberate local selection on Mac** rather
  than disabling tmux mouse/history, changing its copy-mode bindings or writing
  another selection engine. Shift-drag is now the same persistent xterm
  selection on both platforms; plain drag remains the native tmux interaction.
- **Read the shell list on explicit open** rather than trusting the earlier
  count: another browser/native client may have started or ended a shell.
  Failure produces a toast rather than automatically opening a new shell.

## Focused self-review

Reviewed the final browser diff for duplicate shell creation, uncertain reads,
late completion after unmount/hide, shortcut consumption in the composer and
xterm, dead-key/AltGr/composition handling, selection event recursion and
cleanup. The translated event has Alt set so it is not translated again; the
capturing listener is removed on disposal. Gateway, daemon, wire contract and
authority are untouched, so no external authority review was required or run.

The added accessibility scan exposed the pre-existing tablist close-button
structure (`aria-required-children`). Filed unlaned as
@wildly-difficult-fairies, with this run's provenance. The final focused axe
scan excludes that existing tab strip; keyboard tab focus/navigation is still
asserted. This is not a claim that the whole terminal passes axe.

## Evidence

Runnable tree: **52a71f8c** (the code was checked before committing; captures
name this commit). No runnable changes after the final checks.

- `./scripts/test-web-fast.sh`: passed format, lint, typecheck, 262 unit tests
  and 180 component tests. Includes the shortcut modifier/dead-key/IME cases.
- `OH_PORT_BASE=15400 OH_BROWSER_WORKERS=2
  PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright npm run test:e2e
  --prefix web -- browser-shell.spec.ts --repeat-each=2`: **10/10 passed**.
  Direct first open/no warning, US physical shortcut, simulated Nordic macOS
  events and dead keys, composer draft/focus, tab traversal, hide/reuse, busy
  close, exit, multi-line paste, two-second Mac Shift-drag, actual clipboard
  copy, identical reselection and send-to-composer, phone keys, reconnection
  and session end. Focused axe passes outside the separately filed tab strip.
- Managed synthetic lab: `BROWSER_HOST_LAB=1 BROWSER_HOST_PORT=15501
  .cache/browser-host "$PWD/web/dist"`, then `OH_PORT_BASE=15500
  PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright node
  web/lab/capture-shell-polish.mjs`: passed. Five paired PNG + inert HTML
  captures under `evidence/`: direct open, light/dark persistent selection,
  selection sent to composer, phone panel. Inspected light selection and
  phone images: highlight/actions, revised hint and key row are visible.
- `issuectl doctor --json`, `python3 scripts/validate-project-view.py`,
  `git diff --check`: passed.
- No Go tests/contracts check/full gate: web-only change; the browser runner
  built the real synthetic host and fresh production assets.

### Failure inventory

- Expected reproductions: macOS Shift-drag failed before the selection fix
  (including the required two-second wait); Linux Shift-drag passed.
- The first full focused browser run failed only on the existing tablist axe
  finding. Filed @wildly-difficult-fairies unlaned; the final targeted scan
  explicitly excludes it. Full terminal axe conformance remains unproven.
- An intermediate repeated run exposed identical-reselection action loss
  (fixed in the surface) and a paste-test focus race (the test now waits for
  xterm to regain focus before Enter). Final repeated run passed both.
- One intermediate fast check rejected an unnecessary effect dependency;
  cleaned up the effect and reran the complete fast checks successfully.
- Initial source-discovery reads used nonexistent `TerminalSurface.tsx` and
  `tests/a11y.spec.ts` names; implementation/tests were found and read at
  their actual paths (`Terminal.tsx`, the existing per-feature axe cases).
  No required tool or service remains blocked. Build warnings about chunk
  size/PostCSS and jsdom canvas limitations did not fail the checks.

Synthetic only; no live deployment, real Finnish macOS hardware, Safari,
Firefox, OS shortcut interception or native phone keyboard has been tested.
The platform branch and Finnish-layout keyboard event are simulated in
Chromium on Linux, against real tmux/bash and the real gateway/daemon routes
under a synthetic same-UID home. Existing distinct-UID isolation evidence is
not changed or re-established by this web-only work.

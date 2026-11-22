# Result: popup windows no longer trap the browser view

The viewer's header now keeps a scrollable list of every page target, including
feature popups. Select a title to bring that page forward; its × closes just
that page. Both actions give the person control and return keyboard focus to
the picture. The opener continues working after explicit close and after a
popup sends a message and closes itself.

**No runtime package or core runtime closure change.** This uses Chrome's
existing CDP connection, not a window manager. The issue is in testing for the
person's installed-site check; no installation was changed by this worker.

## Decisions for later review

- **Use CDP, not a window manager or popup-to-tab rewriting.** A real Xvnc
  experiment and the native viewer test establish that Target.activateTarget
  raises a feature popup or its main window without a window manager.
  Target.closeTarget preserves the opener; no rewriting of window.open,
  opener relationships or provider flows is needed.
- **Keep page chips visible in the existing header.** Rebased onto the
  single-bar and conversation-card changes. Window chips occupy a scrollable
  second row of the same header, outside the remote picture; control and
  clipboard actions remain together on its first row. This avoids hiding the
  recovery control behind the popup or another menu, including on phones.
- **A chip represents a page, not a whole group of Chrome tabs.** Closing it
  closes exactly its target, so another tab in the same native window survives.
  Selecting normalizes its native window to the virtual screen's bounds before
  raising it; no maximization request depends on a missing window manager.
- **Selection and close take person control.** The agent waits through the
  existing control mechanism. Explain mode holds both mutations. No new agent
  HTTP route, identity selector or other-user authority was added; the new
  person POST reuses session/Origin/CSRF and trusted-daemon checks.
- **Protect the last page, not against the page's own script.** The person uses
  Close browser to end the final page. Human close/control requests serialize;
  mutation preconditions always fetch native inventory, never the thumbnail
  cache. Native self-close or another same-UID CDP client remains Chrome's own
  authority, not something Habitat locks out.
- **Do not silently hide pages after the first 24.** Removed that existing
  inventory truncation in host, daemon and schema so a later popup still has a
  control. Existing response byte limits remain. Host and daemon regressions
  exercise 30 pages.
- **Keep the agent command surface unchanged.** Existing `agent browser tabs`,
  targeted actions and `close --tab` already use page targets. The native CLI
  regression now opens a feature popup, finds it in tabs, closes it and checks
  its opener remains usable. The daemon's agent inventory also retains pages
  beyond the former count cutoff.

## Verification

Final executable code: `e2161c66e`.
Subsequent changes only record results and regenerate agent-reference Markdown.
All commands ran with private scratch, bounded timeouts and umask 077.

- `./scripts/test-focused.sh --area go`, with `OH_BROWSER_ACTION_CHROME`
  enabling the native CLI fixture: **passed**, including the race-enabled
  internal packages. Host regressions cover stale inventory, last-page/iframe
  protection, missing targets, native refusal and window bounds. Daemon tests
  cover malformed/foreign-peer requests and exact target forwarding; gateway
  tests cover CSRF and exact routes. An initial shorter 420-second run timed
  out; subsequent complete runs passed, including final `go-land.log`.
- `./scripts/test-focused.sh --area web`: **253 files / 2054 tests passed**,
  plus formatting, type and catalog checks on the rebased implementation.
- Named `server-browser.spec.ts`, two workers, `--repeat-each 3`, reply jitter
  0–60 ms: **33/33 passed**. Includes the existing phone layout and bilingual
  Explain checks, extended to prove selection and close are held in Explain
  mode. One earlier parallel run missed the existing conversation-card element
  once (32/33 passed). Repeating the complete named spec with that same jitter
  seed passed 33/33 without a code change; the intermittent result is retained
  in `browser-intermittent.log`. Native page titles, not translated UI wording,
  identify popup fixtures.
- Named `server-browser-popup-native.spec.ts`, one worker, same jitter and
  `--repeat-each 3`: **3/3 passed**. Production viewer and host, extracted
  TigerVNC 1.13.1 and Chromium 153, synthetic local site/profile. Real X input
  reaches the main page after selecting it, then the popup after selecting it.
  Explicit close leaves main input working without reselecting; a second popup
  completes postMessage/self-close and main input still works. The final close
  button is disabled for the remaining page.
- `server-browser-keyboard-native.spec.ts`: **6/6 passed** (Ctrl and Cmd,
  three repetitions), preserving the existing Finnish/Latin, password-input
  and newly integrated clipboard-free paste behavior. Together with popups,
  final native evidence is **9/9** in `native-land.log`.
- Focused contracts, generated-contract drift, UI-reference check,
  `issuectl doctor --json`, project-view validator and `git diff --check`:
  **passed**. Agent-reference regeneration also incorporates already-landed
  navigation/Explain source drift; those generated files were not hand-edited.
- No whole browser suite or clean gate was run, as requested.

Evidence is outside git at
`/var/tmp/agent-keep/server-browser-popup-takes-over/`: `go-land.log`,
`web-land.log`, `browser-land.log`, `native-land.log`, `keyboard.log`,
`contracts-land.log`, model outputs and assessment. `popup.{png,html}` shows
only the synthetic native site. B12/B13 paired captures show both cards at
1440 and 390 CSS pixels in Finnish and English; inspected cards fit and point
to the intended controls. No real installation capture is committed.

## Review and limits

Independent critical `/llm-review` with claude-fable-5-2 and gpt-6-astra,
followed by `/assess-findings`: four confirmed findings fixed (keyboard focus,
Explain mutation guard, refusal-after-mutation, concurrent last-page closes).
The verifier exposed the remaining presentation-cache race; direct native
mutation reads remove it. No unresolved finding or follow-up issue remains.
Later rebases were checked locally and all affected web/native evidence rerun.
The paste change used B11 for its eye toggle, so popup Explain cards are now
B12/B13; both intents and their action guards are preserved.

These are synthetic same-UID tests. They do not qualify Chrome's sandbox,
installed systemd behavior, cross-UID isolation or a real OAuth provider. The
lab's Chromium wrapper disables its sandbox only for disposable test profiles.
The production sandbox flags and authorization boundaries are unchanged.

## Live check

1. Start the server browser with the new product version. Open a site that
   launches a separate popup (for example a sign-in window).
2. Keep the popup open and select the main page's header chip. Type into the
   main page; select the popup chip and verify typing goes there instead.
3. Close the popup with its ×. The main page remains usable, without closing
   and restarting the whole browser. Reopen it and complete a flow that closes
   itself; its opener should receive the result as usual.
4. Repeat at phone width; scroll the window row if needed. The final page's ×
   is disabled; Close browser still ends the browser deliberately.

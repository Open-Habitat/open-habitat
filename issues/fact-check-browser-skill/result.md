# Browser skill fact-check — 2026-11-23

Checked the rewrite from `13f4abc17` against the browser implementation on main
(`8f5b66aec` at the initial comparison), installed help, and the UI that the
instructions name. Only the skill and this issue changed. Its headings,
paragraph structure and line count are unchanged; nine factual corrections
replace 17 lines. No test pins the corrected prose.

## Corrections and evidence

1. **Feature-off refusal is not every command.** Page actions and `start`
   check `feature_enabled`; status remains readable and the request route has
   no feature guard. Evidence: `executeBrowserAction` in
   `internal/cli/browser_actions_linux.go` and `agentRoutes` in
   `internal/daemon/browser_linux.go`.
2. **Control is present only while running; person control blocks page
   actions, not status/request.** The daemon adds `control` only in its
   running branch. The CLI's action guard refuses person control.
3. **Not every later command takes a tab.** `parseBrowserAction` exempts
   `tabs`; status/start/request have their own grammar. Restricted the claim
   to later page actions.
4. **Load waits are not universal.** `runBrowserAction` returns tabs without
   loading, and close/download have their own branches. `loaded`, `navigate`
   and `settleClick` in `internal/cli/browser_cdp_linux.go` establish the
   page-read/input/navigation waits, not application readiness.
5. **A failed goto does not always name its tab.** Preflight and connection
   failures have none, and `executeBrowserAction` unwraps typed refusal errors
   (including takeover) without the enclosing tab context. Kept the advice
   to inspect a named tab and added `tabs` when the error does not name one.
6. **Truncation flags do not cover shortened link labels.** The links
   expression slices each label to 1,000 characters but sets `truncated` only
   when there are more than 2,000 anchors. Text truncation is independently
   flagged at 200,000 characters. Evidence: the text/links expressions in
   `runBrowserAction`.
7. **Cookies are selected by Chrome in a frame context, not owned by a tab.**
   `download` in `internal/cli/browser_download_linux.go` supplies the selected
   frame ID and `includeCredentials: true` to `Network.loadNetworkResource`.
   An unrelated frame can affect cookie eligibility; it does not invariably
   strip all needed cookies. Changed the absolute claim to “may”. The CDP
   Network reference confirms the frame/credentials interface; actual cookie
   selection remains Chrome/site policy.
8. **The masked field is “Password as keystrokes” / “Salasana näppäilyinä”.**
   The ordinary-text control is “Type as keystrokes”. Evidence:
   `web/src/text/serverBrowser.ts`, `BrowserClipboard` in
   `web/src/components/ServerBrowser.tsx`, and `sendType`/keystroke dispatch in
   `web/src/app/BrowserViewer.tsx`.
9. **Takeover does not undo an already-started action.** `fromAgent` and
   `setControl` in `internal/browserhost/cdp_linux.go` hold individual CDP
   calls arriving during person control, then reject those on give-back.
   Previously forwarded calls are not recalled. One CLI action sends several
   calls, including metadata after the write: it may have clicked before a
   later call is held. The old whole-action “without having been carried out”
   assurance was therefore false. Existing tests:
   `TestPersonsControlHoldsTheAgentUntilGivenBack` and
   `TestHeldCommandFailsAsPersonTookControl`.

## Claims retained and checked

- The daemon owns a persistent per-person Chrome profile; the viewer provides
  person control, and `remote-browser` determines skill installation.
  `internal/daemon/browser_linux.go`, `internal/browserhost/host_linux.go` and
  `internal/browserhost/control_linux.go` provide that wiring. The embedded
  browser skill is also exposed by `open-habitat skill print browser`.
- Window IDs, origin-only listings, last-agent-tab marking, one agent
  connection and Unix-only CDP endpoints are implemented by the host mux,
  daemon status projection and CLI listing. There is no per-tab ownership.
- CLI envelope `data.result` and the browser-visit record agree with
  `web/src/app/turnBrowserVisits.ts`. New-tab goto, explicit-tab navigation,
  last-tab close refusal, selectors, verbatim file/stdin input, password/file
  refusal and value-preservation checks are in `browser_actions_linux.go`.
- Promise evaluation uses `awaitPromise: true`; ordinary uncertain failures
  warn against replay. Download saves the original Chrome network response,
  accepts only successful 2xx streams, and reports the tab's URL/title.
  `saveBrowserFile` uses exclusive creation and mode 0600, not automatic name
  suffixing. “Under an unused name” means the caller supplies one.
- `DefaultDownloadDirectory` and `preparePreferences` in
  `internal/browserhost/preferences_linux.go` establish profile/Downloads and
  preserve native preference changes. Native download locations can differ
  from CLI outputs. Site settings remain the person's choices.
- Request creation/clear and give-back clearing are implemented in the daemon
  and mux; the viewer sends an empty remote clipboard before returning control.
  The masked field sends keystrokes rather than the clipboard. Passwords are
  not hidden from same-user agents by that UI.
- The Playwright primary API documentation describes HTTP/CDP WebSocket
  endpoints, not this product's `ws+unix` encoding. The cautious “not promised
  to accept” wording remains appropriate; no external client was installed.

External primary references consulted: CDP Network `loadNetworkResource` and
`LoadNetworkResourceOptions`, and Microsoft's Playwright
`docs/src/api/class-browsertype.md` (`connectOverCDP.endpointURL`). No external
page was used as evidence of local product behavior.

## Installed tools versus main

Read the installed top-level help and version of all four requested tools:
Open Habitat **0.1.6**, build **41c214dcba83b80a5d491cea5e649ce2a7aca9da**;
Pi **1.5.2**; issuectl **0.21.0**; Taskfleet **0.20.0**, build
**6ad8d7ca22246804c6c79f038e57bba4c45acee5**. Taskfleet uses `version`, not
`--version`. The browser skill names no Pi/issuectl/Taskfleet command.

Read every installed browser leaf's help and the skill command help. Built
the checkout binary in disposable scratch and checked its browser help too.
Comparison of the installed release commit against main found no differences
in the browser CLI, browserhost, daemon browser implementation or the three
viewer/UI files checked; the bundled skill itself had been rewritten on main.
The corrections therefore describe main without assuming the installed skill
already includes the rewrite.

One referenced-help limitation remains outside this file's scope: browser
`request --help` inherits a generic `--text` description saying 1–4096 bytes
and mentioning `--text-file`, while `agentBrowserRequest` accepts only
`--text`/`--window`, limits text to 300 characters, and supports `--clear`
separately. The skill's actual request example is valid. No CLI source was
changed in this instruction-only task.

## Validation

Under `umask 077`, with TMPDIR below task scratch and a shared scratch lease:

- `./scripts/test-focused.sh --area go --go-package ./internal/browserhost`
  passed (31.055 s).
- `./scripts/test-focused.sh --area go --go-package ./internal/cli`
  passed (0.617 s); the native Chrome case is opt-in and was not enabled.
- `./scripts/test-focused.sh --area go --go-package ./internal/daemon`
  passed on the final full run (247.985 s).
- An initial daemon attempt exceeded the command runner's 240-second budget.
  The next full attempt completed with one unrelated
  `TestAgentConversationControls` archive `writer_conflict` failure. A focused
  retry of that test plus all `TestBrowser` cases passed, then the full daemon
  rerun above passed. No runnable source was changed to obtain that result.
- `go build ./cmd/open-habitat` to a disposable output and `git diff --check`
  passed. `TestBrowserSkillPrintInstall` compares embedded print/install
  output, not pinned wording, so no test update was necessary.

The first focused invocation supplied several `--go-package` flags; the runner
uses only the last. The daemon and CLI were consequently run separately as
listed above; the first invocation proves only browserhost.

## Not checked and decisions left to Jari

No personal browser session, signed-in service, download, purchase, message,
MFA, clipboard or password manager was exercised. Whether a particular site
returns sign-in HTML with 200, omits cookies, prints a viewer instead of its
source, or delivers all requested files is site-specific; the retained advice
is a diagnostic precaution, not a claim tested against live accounts. A native
Chrome/browser-viewer end-to-end run was not performed.

The earlier rethink result explicitly left a consent question for Jari:
whether the original request to book/buy/send is sufficient or whether the
agent must confirm again immediately before acting. This pass preserves the
current wording and does not decide policy. The reasons for keeping secrets
out of conversation history and keeping the password manager on the person's
own device are likewise policy intent, not facts a CLI can settle. No new
architectural or authority decision was needed for these factual repairs.

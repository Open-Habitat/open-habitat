# Result

Agents now have built-in `browser goto`, `text`, `links`, `click`, `type`,
`screenshot`, `download`, `tabs`, `close` and `eval` commands. They use the
existing own-UID CDP endpoint and signed-in context; no Node installation,
external client, new service or credential copy is needed. `goto` creates an
own tab unless an explicit tab is supplied. The existing window list marks the
target when the command attaches.

Status includes `feature_enabled`, `socket_path`, `ws_path`, the retained
`cdp_endpoint`, `default_download_directory` and `skill_command`. Commands
refuse when the experiment is off or the person currently has control.
`open-habitat skill print browser` works in an already-running conversation;
the bundled skill and host context explain ask-first actions and PDF originals.
The invalid Playwright example and unverified Unix-endpoint claim are gone.

Downloads use Chrome's selected frame and network stack, then save original
response bytes, not a printed PDF viewer. Files are private, never overwrite,
and use the settings worker's `DefaultDownloadDirectory(profile)` API. The
status names the default, not a possibly changed native Chrome preference.
The runtime worker's missing-runtime explanation and the settings worker's
site-settings guidance are preserved after rebasing onto both landings.

## Verification

Implementation revision: `ab3a7429c7978e9a8d15057afc8bfeb73a04ccf7` (tests ran
against these source bytes before the final evidence-only commit).

Under `umask 077`, scratch lease and outer timeouts:

- `./scripts/test-focused.sh --area go --go-package ./internal/cli` — pass.
- `./scripts/test-focused.sh --area go --go-package ./internal/daemon` — pass.
- `./scripts/test-focused.sh --area go --go-package ./internal/browserhost` — pass.
- `./scripts/test-focused.sh --area contracts` — pass; generated code clean.
- `python3 scripts/validate-project-view.py`, `git diff --check` — pass.
- Opt-in `TestBrowserActionsNative`, built through the focused runner with
  `GOARCH=amd64 GOFLAGS='-c -o=<scratch>/cli.test'`, then run with a 100-second
  outer timeout and `-test.count=3` on a sandbox-capable Linux host — **3/3 pass**.
  This exercises the production browser host/multiplexer and CLI action entry
  point against a synthetic localhost site and disposable headless Chrome
  profile: navigation waits for a deliberately held resource; a pre-load
  redirect reaches its final document; cookies authenticate an exact multichunk
  binary PDF-response download; SVG links, form typing/click activation,
  pre-action refusal, PNG capture, tab enumeration/marking/closing and last-tab
  refusal work. Evidence: `/var/tmp/agent-keep/server-browser-agent-tool/native.log`.

The first display stand-in lacked its socket and was repaired. The first native
flow then exposed the real short-connection cleanup race (a 409 before the next
handshake); the client now retries only a refused handshake with bounded
backoff, never a CDP action. All final native repetitions pass. Local browser
sandbox restrictions were not bypassed for acceptance: the native fixture was
run on a host that can run sandboxed Chrome.

No whole browser suite or clean gate ran. No existing profiles, signed-in real
accounts, services or installed binaries were changed. The fixture uses a
synthetic display and calls the CLI action implementation, not a deployed
systemd-owned agent socket; it is not VNC, gateway, distinct-UID isolation or
real-service acceptance evidence. The ordinary CLI test skips the opt-in native
case without its Chrome environment variable; the separate 3/3 run supplies
that missing evidence. Real installed-server trials remain below.

## Independent review and assessment

Critical `/llm-review`: `claude-fable-5-2` finder and `gpt-6-astra` adversarial
verifier, two calls, followed by `/assess-findings`. Nine actionable findings
were fixed: last-tab shutdown, pre-load redirects, click user activation, SVG
links, precise known guard refusals, sanitized-input protection, busy-handshake
log volume, stale usage help, and unnecessary full-URL disclosure in all-tabs
listing. Cross-site cookie restrictions were correctly classified as browser
policy, not a defect; guidance now explains choosing the service's own tab.
Arbitrary script/transport failures remain uncertain, and raw page exception
text is not exposed as an error. No residual finding needed an issue.

Local review and assessment artifacts are under
`history/review-server-browser-agent-tool.md` and
`history/assessment-server-browser-agent-tool.{json,md}`. Finder-reported local
unsandboxed experiments are not counted as sandboxed acceptance; the independent
native evidence above is. Model-performance publication was omitted under this
run's no-push rule. Final source review also added the explicit feature-off
check for an already-running host; focused daemon/CLI tests and the native
fixture were rerun afterwards.

## Decisions for later review

- **CLI, not another MCP process:** every agent already has the binary and can
  compose commands; another server/runtime would add a prerequisite rather than
  remove one. External CDP tools remain optional.
- **Explicit tab ids, no persisted selection:** `goto` returns the id; subsequent
  commands require it. This avoids an agent tab registry or accidentally picking
  whichever personal tab is active. `tabs` lists origin/title, not every full
  URL; targeted inspection can read the required URL.
- **Shared default download directory:** use the profile's private `Downloads`
  directory, as agreed with the settings work. An explicit unused filename is
  required. Do not read or rewrite the person's current Chrome preference.
- **Bounded synchronous operations:** 30-second default, configurable to 120;
  64 MiB downloads; bounded text/link output with truncation indicators. Larger
  and POST/blob downloads require an explicit site-specific workflow, not an
  invented generic fetch or automatic retry.
- **Close refuses the final page:** opening a replacement would be another
  mutation; leaving one page prevents cleanup from stopping headed Chrome.
- **`eval` is an advanced escape hatch, not a different authority:** same UID,
  explicit target, deadline and ask-first rule. Only explicit `click` supplies
  user activation; read helpers and arbitrary scripts do not gain it silently.

## Live check

After deployment, enable the experimental server browser and sign in to a
service through its viewer. In a conversation that was already open, ask the
agent to read `open-habitat skill print browser`, inspect status, open its own
tab, read links/form content and download an original PDF. No Node installation
should be requested; the agent's tab should be marked; the returned private
file should contain the original, not an image of the viewer. Ask for a
purchase, cancellation or message and confirm the agent asks permission before
acting. With person control or the experiment off, new commands must refuse.
These are human/installed-service checks, not claims made by the synthetic run.

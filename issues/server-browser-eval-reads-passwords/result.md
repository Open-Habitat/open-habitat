# Result: the agent cannot read passwords the person typed

## What changed

The agent no longer gets general DevTools access to the person's server
browser. The browser host (`internal/browserhost/agentpolicy_linux.go`)
forwards only the commands the CLI needs: tabs, attach and close,
navigation to http(s), lifecycle events, frame tree, screenshot, a left
mouse button, original downloads and their stream reads. It rebuilds each
command from validated parameters. Page scripts come only from the host's
own templates (`OpenHabitat.pageAction`: load wait, URL and title, page
text, links, click, type), and none of them reads a field's value. Every
other command is refused before it reaches Chrome.

`open-habitat agent browser eval` is removed. The CLI now explains why
when it is called, and the help and the browser skill no longer offer it.

## What the agent can no longer do

All of these were confirmed in a native run (headful Chrome on a real Xvnc
display, the password typed as viewer key events). Each read the typed
value without the change and is refused with it:

- run its own JavaScript in a page: `eval`, `Runtime.evaluate`,
  `callFunctionOn`, scripts that run in every new document, bindings,
  debugger breakpoints. This covers flipping a password field to text,
  `new FormData(form)`, and a keydown listener installed before the person
  types;
- read the DOM, a DOMSnapshot (which carries input values) or the
  accessibility tree (which carries the value after a type flip);
- watch or intercept the network (`Network.*` and `Fetch.*`, where the
  sign-in request's body would show);
- press keys or insert text (select-all and copy), press right or middle
  buttons, open `javascript:`, `data:`, `chrome:` or `view-source:`
  addresses, use nested sessions, or auto-attach to new tabs;
- grant itself any site permission. Clipboard grants already were
  refused, but Go's case-insensitive JSON decoding let a crafted grant
  past the name check, so permissions are now refused entirely;
- use a selector as a yes/no question about a field's `value` attribute
  (React and others copy a controlled field's value, a password's too, into
  that attribute). Such selectors are refused after the browser's own
  parser has resolved escapes and comments;
- take a screenshot while a password field shows its value in clear. Before
  every agent press, and when the person takes control, the host notes
  which fields are passwords, so it can tell when a site's own "show
  password" button has been clicked. A screenshot also waits until the
  agent's earlier commands have finished. A picture taken while the person
  took control, or a command whose host check overlapped their turn, is
  answered as "the person took control".

What agents lose: arbitrary page reads and waits through `eval`,
setting native `<select>` values, reading a field's value as text (a
screenshot shows it), and using Playwright, Puppeteer or another DevTools
client on the endpoint. The skill tells agents to read again with `text`
and to ask the person when a page offers no clickable way.

The person's own use is unchanged: their typing, pasting and **Password as
keystrokes** go through the viewer, not this socket. The native test shows
the site receiving exactly what they typed. The clipboard properties stay as
they were.

## Residual risk, plainly

- **The agent is the same Unix user.** This closes the browser's routes,
  not that user's own sockets and files. An agent that deliberately goes
  around the product can connect to `vnc.sock` as a viewer and type into
  Chrome (opening DevTools, say), use the X cookie in the browser directory
  to log keys on the display, or read Chrome's profile. Saved passwords are
  off by default (`credentials_enable_service: false`), so the profile holds
  none unless the person turned saving on. Only a separate Unix user for the
  browser or the agent closes this.
- **The screenshot check is best-effort.** It cannot see into cross-origin
  iframes (embedded sign-in widgets) or closed shadow roots. It misses a
  reveal that replaces the field with a new text input, and a field that
  appeared during the person's turn and that they unmasked themselves,
  unless the field carries a `current-password` or `new-password`
  autocomplete token. It also refuses screenshots of pages that use
  `autocomplete="new-password"` on an ordinary text field that has text in
  it. Filed as `server-browser-reveal-guard-frames` (untriaged).
- **A password in a URL is visible.** A site whose sign-in form submits by
  GET puts the password in navigation URLs, which the agent sees in
  `goto`/`text` results and page events.
- **Pages the agent opens run their own script.** The agent can still open
  any http(s) site, including one it controls, and ask the person to sign
  in there. The person sees the address in Chrome's address bar.

## How to try it

1. In Habitat, enable the server browser and have an agent open a sign-in
   page (`open-habitat agent browser goto https://… --json`).
2. Take control, type a password, and give control back.
3. Ask the agent to read it: `agent browser eval …` is refused as
   unavailable, `text` shows no field values, `type` into the password field
   is refused, a selector such as `input[value^="a"]` is refused, and after
   it clicks the site's "show password" button `screenshot` is refused.

Automated:

```sh
go test ./internal/browserhost ./internal/cli
OH_BROWSER_ACTION_CHROME=/usr/bin/google-chrome OH_BROWSER_ACTION_XVNC=/usr/bin/Xtigervnc \
  go test ./internal/cli -run 'TestAgentCannotReadThePersonsPassword|TestBrowserActionsNative' -count=1
```

## Checks run

- `go test ./internal/browserhost` (fake-Chrome refusal, rebuild, guard,
  press record, control-epoch and unanswered-screenshot cases), repeated 5×.
- `go test ./internal/cli` with both native tests enabled, repeated 3×.
  Negative runs: without the host policy, the listener, type flip, FormData,
  DOMSnapshot and accessibility attempts returned the typed value. Without
  the selector check, `click input[value^="s"]` matched. Without the
  password record, the screenshot of the unmasked field was taken.
- `./scripts/test-focused.sh --area go --go-package ./internal/daemon`.
- `/llm-review` (finder claude-fable-5-2, verifier gpt-6.1-sol; gpt-6-astra
  refused the prompt) and `/assess-findings`: 9 findings fixed, 3 kept as
  the residual risk above.
- `OH_PORT_BASE=14600 ./scripts/ci-local.sh --clean --json` passed (clean, no reused phases) at ee89377ee, the tree that contains all code in this change.

## Decisions for later review

- **The host forwards a fixed command set, and raw DevTools access is
  gone** (architecture/security model). Filtering results or blocking
  `eval` alone cannot hold: a listener installed earlier, a type flip,
  FormData, the Network domain and DOMSnapshot each read the typed value.
  The host is the only place every agent client passes through. The rule
  is in `internal/AGENTS.md`. External DevTools clients no longer work.
- **`eval` is removed, not narrowed.** No safe subset of arbitrary script
  exists. A declarative `wait --selector` or a `<select>` option setter
  would be new fixed templates, if agents need them.
- **The screenshot check stays heuristic** rather than refusing whenever
  something cannot be checked. Failing closed on cross-origin frames would
  refuse most captcha and widget pages, which are exactly where the agent
  needs to show the person something. See the filed improvement.
- **The record of password fields lives in the page's main world**
  (`Symbol.for('open-habitat.password-fields')`, a WeakSet of elements, no
  values), shared by the host's and the agent's sessions. The site's own
  scripts can see it. They already have the field.
- **Same-UID routes** (`vnc.sock`, the X cookie, the profile) are left as
  stated. Closing them means running the browser or the agent as a
  separate Unix user.

## Jari 28.11.2026

The threat model is accidental reading, not an attack: it is enough that the
agent really does not read a person-typed password by accident. The eval
changes are to be reconsidered later: `server-browser-eval-reconsider`.


## Reverted 28.11.2026

The three product commits of the implementation run (`055c6cee7`,
`2bcfdba90`, `53b71d8a8`) were reverted: the fixed host command set, the
removal of `eval`, the cut-off of external DevTools clients, the
revealed-password screenshot refusal and the person's-turn rule. The browser
host, CLI, the `internal/AGENTS.md` rule and the agent skill/help are back to
their state before the run. The change went further than asked: the threat
model is accidental reading, not an attack, and the fix removed capabilities
agents use. How to keep the agent from reading a person-typed password by
accident is reconsidered in `server-browser-eval-reconsider`.

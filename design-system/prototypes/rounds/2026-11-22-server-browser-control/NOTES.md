# Server browser: control and clipboard

2026-11-22. Prototype only; no production state, contract or authority changes.

Axis: **how the person returns control**. All directions take control on a
canvas click or non-modifier key, consuming that first input. Default view is
the person signing in, not an introductory screen.

- **Oma / Yours (recommended):** a persistent ownership strip and Done button.
- **Tauko / Pause:** a visible idle-policy strip; two minutes offer a return,
  never grant it. Use the scenario button to advance the simulated clock.
- **Pyyntö / Request:** the agent's next step and permission request sit beside
  the browser (below it on a phone).

The top has one summary per direction. Shared picker is unmodified. The round
uses the shared offline builder, bundled tokens/fonts and its own renderers;
it deliberately does not pretend that an HTML form is an actual VNC canvas.
The real sign-in button and password field are disabled. Use synthetic text.

## Try

Return control, then click the view or focus it and type. The first input takes
control without activating the underlying page. “Agent mid-action” followed by
a click shows the pending-action warning; simulate completion or cancel.
Clipboard opens a paste field and a type-as-text alternative. Both feed the
synthetic username field and clear the draft. A real paste event on the focused
view also works. “Remote copy received” supplies a synthetic remote selection;
the copy button uses the local Clipboard API and retains manually selectable
text on refusal. The prototype never reads the local clipboard in the background.

FI/EN control translates the comparison, view and chrome. Theme and phone
controls are shared. Every state change is local to this page. No request is
sent to a daemon, no credentials are accepted and no browser session is started.

## Build and check

From the repository root, with web dependencies installed from its lockfile:

```sh
node design-system/prototypes/rounds/2026-11-22-server-browser-control/build.mjs
node design-system/prototypes/rounds/2026-11-22-server-browser-control/check.mjs
```

Both accept an explicit output path; check also accepts an evidence directory.
`PLAYWRIGHT_MODULE` can identify an existing Playwright entrypoint without
installing or changing global dependencies. Wrap these commands with the scratch
lease and a timeout on shared hosts. Default output is ignored prototype dist.

Check covers 24 combinations (three directions × two languages × two themes ×
two widths), picker contract, overflow, ownership acquisition by mouse/key,
pending action, both paste routes, text fallback, copy denial/success, idle and
request retention. Clipboard mocks and a synthetic paste event test UI routing,
not OS permissions or a real VNC clipboard. Screenshots are review material,
not pixel-comparison assertions. No generated HTML or images are committed.

The requested terminal-settings reference round is absent at the starting
revision. Existing take-back-rights build/check convention and the common
builder/picker contract were used instead. Architecture, review questions and
validation receipt are in `issues/server-browser-control-clipboard/result.md`.

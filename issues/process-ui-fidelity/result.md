# Process UI fidelity

## Cause and fix

The CSS was **not missing from the bundle**. `ProcessTray.tsx` already imported
`ProcessTray.css`; the original production-build lab reproduced Jari's screenshots
(`before-light-{bar,list,output}.{png,html}`). The stylesheet was a minimal
placeholder, not the accepted design: a full-width top border, default quiet
buttons (44px, semibold accent text), unbounded/default group headings, and no
output frame. Its heading selector even targeted `h3` while the component used
`h2`. The old `--ah-error` reference was not a design-system colour token.

The production component now supplies the missing layout roles: conversation-width
34px summary, connected rounded inventory, small group headings with clear action
on the right, two-line selectable rows (mark/name/status/time, then command),
selected outline, wake mark, stop/force action, and a framed independently scrolling
monospace output surface. Completion uses the quiet bordered session-marker family,
not an accent link with a left border. Controls are still shared `ControlButton`
(React Aria); glyphs are shared `Icon`; colours, font families, spacing and radii
come from `design-system/tokens/`. There is no parallel prototype CSS import,
fixture flag in production, state-flow change, or native-process implementation change.

## Paired visual review

All new application captures are **synthetic lab**, served from a fresh production
bundle at `OH_PORT_BASE=28900`; process endpoints and completion history are explicit
wire fixtures. Every lab PNG has its adjacent inert HTML twin. The original two
reporter images remain untouched. Prototype screenshots come from the two selected
rounds, built without reading their built HTML:

```sh
node design-system/prototypes/build.mjs design-system/prototypes/rounds/2026-10-16-prosessit --out .cache/prosessit.html
node design-system/prototypes/build.mjs design-system/prototypes/rounds/2026-10-16-prosessilohkot --out .cache/prosessilohkot.html
OH_PORT_BASE=28900 scripts/lab.sh start
OH_PORT_BASE=28900 PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright node issues/process-ui-fidelity/capture.mjs
OH_PORT_BASE=28900 PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright node issues/process-ui-fidelity/capture-completion.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright node issues/process-ui-fidelity/capture-prototype.mjs
```

Review pairs use `desktop` = 1440×900 and `phone` = 390×900, each `light` and
`dark`. Prototype files use the numeric width instead. This naming applies to
**all four combinations**, not just a single desktop image:

| State | Lab screenshot suffix | Prototype screenshot suffix | What was compared |
| --- | --- | --- | --- |
| Collapsed | `-bar.png` | `-finished-bar.png` | Quiet rounded row, chevron, count, bounded column |
| Finished inventory | `-list.png` | `-clear.png` (blocks direction 1) | Small Päättyneet heading, right-aligned clear action, two-line rows |
| Finished output | `-output.png` | `-finished-output.png` (processes direction 3) | Selection outline, bordered output, sunken monospace log, exit result |
| Running output | `-running.png` | `-output.png` (processes direction 3) | Running mark, command, status, independent output box, stop |
| Follow paused | `-paused.png` | `-paused.png` | Pause state and explicit way to resume without stopping the process |
| Stop timed out | `-stop-timeout.png` | `-stop-timeout.png` | Error state, force action, retained output and reachable composer |
| Completion | `-completion.png` | `-completion.png` (blocks direction 1) | Quiet session-marker family, not a message bubble/card |

Direct live-report comparison: `before-light-output.png` reproduces the large
Päättyneet heading, link-like clear/process actions and unframed output in
`prosessi-auki.png`. `desktop-light-output.png` removes those defects. Likewise
`before-light-bar.png` reproduces the full-width bar in `prosessit-palkki.png`;
`desktop-light-bar.png` is now a compact rounded conversation-width control.

### Deliberate differences from the prototype

- **Fixture content and application shell:** the lab has one five-second completed
  demo (the same state as the report), then one running `testit`; the prototype has
  four processes, longer histories, a recap, a centred application demo frame and
  prototype controls. We do not fabricate those native facts in production. Counts,
  output lines, timestamps and vertical position consequently differ; comparison
  is by matching state and component geometry, not whole-page pixel equality.
- **Summary wording:** retains the discoverable `Prosessit · N käynnissä` name and
  a separate finished count rather than dropping the noun when no process runs.
  The existing header/recap own the idle/waiting wording; an inventory alone does
  not establish whether Pi's turn has ended. This change does not infer that state.
- **Stop and follow use visible words**, not icon-only controls. This preserves
  their existing discoverability and makes pause versus process termination
  explicit. The force action retains its danger surface. On phones the name and
  command ellipsize to keep the state and action accessible; full command remains
  in the native tool receipt. The prototype also ellipsizes inventory commands.
- **Output toolbar:** no duplicate name/status header, copy button or detached
  output window is introduced. The selected row immediately above already names
  the process and state. Those extra prototype actions were not part of the
  existing production capability or this reported failure. Follow is an explicit
  text toggle; pausing freezes the bounded tail, resuming fetches a new one. There
  is no invented “N new lines” badge while polling is paused.
- **Retention uncertainty is visible** above the log, and the exit result remains
  below it rather than being positioned inside the log. These are actual contract
  facts, including unknown earlier retention; the deterministic prototype knows
  all of its generated lines. Output is fixed at the prototype's 240px desktop /
  200px phone and scrolls both axes without wrapping native lines.
- **Completion wording contains native code/delivery only when known.** Missing
  event time/duration is not invented to fill the prototype's right-hand timestamp.
  Details and current-inventory navigation remain expandable within the marker;
  start stays the existing ordinary tool row with details, not a new process card.
- **Unavailable state remains expandable** with an explanation instead of a dead
  dashed row, preserving existing recovery information. Empty available inventory
  still removes the tray entirely, per the later empty-conversation decision.
- **Spinoff status between tray and composer** is pre-existing shared composition,
  not moved here while sibling workers change live conversation UI. Its lab
  “Spinoffien tilaa ei saada” is a synthetic host limitation, not process styling.
- **Motion:** no new breathing/spinning animation is added to the compact marks;
  the static glyph and the state word carry the same information without motion.

## Tests and self-review

- Focused production-host `process-tray.spec.ts`: **4/4 passed**, including two
  Axe journeys. The new browser test exercises both themes at 1280px and 390px:
  compact/bounded bar, small group heading, visible clear/stop, separately scrolling
  bounded monospace output on a distinct surface, no page overflow, composer below
  the output and in view. Existing cases still exercise follow, stale stop/force,
  clearing the last record, unavailable inventory, and waiting/completion routing.
- Regression experiment: restored **only the original CSS**, retaining new markup
  and tests; the new case failed with `Expected <= 40, Received 44` for the summary
  height. Restored fixed CSS afterwards. This is a real rendering assertion against
  the production bundle, not a screenshot-file existence assertion.
- Fast web checks: format, lint, TypeScript, unit and component suites passed.
- `issuectl doctor --json`: no schema/metadata errors; existing repository PNG /
  oversized-attachment advisories remain (new paired evidence is PNG by convention).
- Focused self-review checked imports and built CSS, both theme surfaces, long
  native text, keyboard-focusable output, status accessible description, no nested
  buttons, existing native owner/token fences, clearing, and unchanged polling.

Full clean-gate outcome and final integration revision are recorded below after
validation. These checks do not establish live-host rendering, native Pi extension
behaviour or distinct-UID isolation. The pending live check is in `KOKEILTAVAA.md`.

### Validation environment

Implementation commit: `57c4fb43` (before integration rebase). The fast check on
this final code passed 140 unit tests and 133 component tests. A subsequent
browser invocation could not start Vite: the shared UID had exhausted inotify
watch instances (`EMFILE` on `vite.config.ts`). No product change was made for
that environmental failure; the focused retry uses `CHOKIDAR_USEPOLLING=1` and
`OH_BROWSER_WORKERS=2`, with the same production build and assertions.

The manual lab capture initially accumulated fake-Pi children over repeated
explorations. The reproducible scripts now reset disposable conversations for
each capture, as the existing lab browser journeys do. This is not a live-host
or process-bridge claim.

Final focused retry passed 4/4, and final fast checks passed on `57c4fb43`.
One capture retry collided with a concurrent production rebuild removing font
assets while HTML was being embedded; captures were rerun after builds finished.

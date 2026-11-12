# Web client

`web/` is the browser application: a React and TypeScript single-page client
built with Vite, with Redux Toolkit for the synchronized model and React Router
for the route, React Aria Components under the product components, and
sanitized React Markdown for host content. State has one owner each: the route
is the only record of which workspace or agent is selected, and selectors
resolve it against the current snapshot rather than a second field; Redux holds
application and session state and the facts the host synchronizes;
conversation metadata and opened history windows live in the separate
in-memory store in `src/app/` that components subscribe to per conversation,
so a streaming answer rerenders only its own view; session storage keeps
per-tab drafts and outstanding command markers; ephemeral things such as focus
and open menus stay in the owning component. History is never persisted in
browser storage, and no database library is added. The UI is in Finnish and
English (below) and desktop-first. Keyboard shortcuts must work on a Finnish keyboard, the one its
users type on: match `event.code`, and never require a dead-key character
such as `` ` ``, `´` or `~` (Ctrl+` could not be typed there). `design-system/AGENTS.md` holds the visual decisions and the
token source, and `src/components/` holds the production components that both
the app and Storybook import, so a story shows states of the real component
rather than a copy of it.

The interface speaks Finnish and English through typed catalogs, without an
i18n library. Each view or module owns one catalog file in `src/text/`, named
after it (`src/text/ownMachines.tsx` for `components/OwnMachines.tsx`): a
`const fi = {...}` that defines the messages and
`export const xText = catalog(fi, {...US English...}, {...UK overrides...})`,
whose type makes a missing, extra or differently shaped English message a
compile error. The optional UK overlay contains only messages that differ,
including nested messages or whole functions; never rewrite interpolated user
content to change spelling. Named external controls keep their original names. A
module gets its own file so that several people can translate different
views at once without touching a shared one. Messages are strings or small
functions of their parameters; a sentence with a link or `<code>` inside is a
function taking those nodes (the file is then `.tsx`), never a sentence
glued from fragments, because word order differs between the languages.
Plurals go through `plural()` and numbers and dates through `formatNumber()`
and `formatDate()` in `src/i18n`, never a hard-coded `fi-FI`. A component reads
a catalog with `useText(xText)`; a module that names its messages once at the
top uses `const txt = liveText(xText)`, which reads the current language at
the moment a message is read, so a module-level constant must stay a function
or getter rather than a string fixed at import. Identifiers are not
translated: route slugs (`/settings/tili`), test ids, settings row ids and
anything another program compares stay as they are, and a comparison against
a displayed word (a status in the rail) accepts both languages.
`src/i18n/catalogs.test.ts` checks every catalog for parity and Finnish
letters in English. `scripts/catalog-review.test.mjs`, included in the fast
web checks, also checks literal text inside every function branch and JSX
message, a small fixed catalog-derived vocabulary in both directions, and
regional spelling. It is a leftover detector, not a semantic translation
review. External names and native identifiers need a reasoned, key-scoped
exception in the checker.

From the repository root, after installing web dependencies:

```sh
mkdir -p .cache && node web/scripts/catalog-review.mjs > .cache/catalog-review.json
```

Give that one JSON file to a reviewing agent: each key has Finnish, US and effective UK
English side by side, including UK fallbacks, nested entries, arrays, complete
function source, local helper source and literal text fragments. Settings search labels are included
from their separate index; bilingual search synonyms are not messages. Review
meaning, missing translations and regional usage from source rather than
assuming the heuristic proves quality. The extract is disposable, not a second
catalog to maintain.

`src/i18n/finnishScan.test.ts` fails on Finnish (a
Finnish letter, or a word only the Finnish catalogs use) in a string, template
or JSX text anywhere in `src` outside the catalogs, tests, stories and
fixtures. Finnish that stays on purpose, such as an identifier or a value the
host sends and the browser words, goes in that test's allowlist with its
reason. Text the daemon or gateway would show is better sent as a code or an
empty value the browser words, as the title of an unnamed conversation is.

Interface copy says what the person can do and what happens for them, not
how it is implemented. Do not explain internal files, paths, encodings, model
IDs or mechanisms in helper text. Show a size or character limit only in the
error when it is reached. Actual user content and controls for choosing a file
or model keep their identifiers. Technical facts an agent needs belong in the
agent reference (catalog source comments are included), or the operator guide,
not in screen copy.

The shipped `open-habitat-ui` agent skill derives its references from these
catalogs, the settings index/routes and keyboard-handler sources. Release
packaging regenerates them in private build sources so the shipped guide always
matches the UI without changing the approved checkout. Checked-in references
support direct Go development builds; refresh them with
`python3 scripts/generate-ui-reference.py` when testing that guide locally.
Edit the browser sources, not the generated copies.

Use the repository skill `explain-card` (`.pi/skills/explain-card/SKILL.md`)
when writing or revising these cards.
The explain mode finds each part of the screen by the element's own test id
or class, never by position: `src/components/explainParts.ts` names the
element and `src/text/explainMode.ts` holds its card, which the agent
reference reads too. Renaming such a test id or class means updating its
part, and every new chip, button, panel or row control gets its card in the
same change, in both languages: a control without one is unfinished (Jari
8.11.2026, after the Avustajat chip shipped without). Standing rule text
about how a feature works belongs in that card, not as a permanent line in
the panel. Presses keep working in the mode; only lasting effects (archive,
delete, sign out, send, stop, close, save) wait, so exploring never changes
anything by accident.

The language resolves as the person's choice (System, Suomi, English (US),
English (UK), kept in
their daemon's account preferences so it follows them), then the server's
default (the administrator's choice in Settings › Palvelin, else the
installation's `ui.default_language`), then the browser: a first preference of
`fi`/`fi-*` is Finnish, `en-GB` is UK English, anything else US English.
The legacy `en` choice is a UK alias, preserving its earlier formatting. Before sign-in only the server
default and the browser are known; `public/landing-bootstrap.js` paints the
static landing in the last load's language, remembered as `nah:language`.
`<html lang>` follows. Unit tests and the Playwright suites run in Finnish
(`src/test/setupLanguage.ts`, `locale: "fi-FI"`); a test of English sets the
language or the browser locale itself, and Storybook has a language toolbar.

The browser is a viewer of native state, not an owner. It never chooses a Unix
user; the gateway does that from the authenticated identity. It never keeps
native history or credentials. Everything that arrives from the host is treated
as untrusted text even though it came from the person's own processes, because
Pi history and tool output can contain anything. `src/app/snapshot.ts` and
`src/app/history.ts` validate responses against the schemas in `contracts/v1/`
before Redux sees them, read the body under a size cap even when Content-Length
is missing or wrong, and fail with generic messages so that response text never
reaches the UI or the console. The gateway forwards daemon replies without
parsing their shape. The browser validates
snapshot, status and Pi-status responses and renders host content only as text
or sanitized Markdown. Background refreshes leave the existing view mounted;
a failed transport refresh shows a connection banner and never turns an old
snapshot into proof of a new identity. A 401 opens login and a snapshot with a
new `web_identity_id` resets the previous person's state. CSRF on the actual
write request protects writes; a preflight session read would not prove that
the session will remain unchanged through the write. A refresh therefore
reads `/auth/session` beside the snapshot rather than before and after it, and
renders the snapshot only when both name the same `web_identity_id`; a changed
CSRF binding clears the person and reads again. The store resets filter
state on a new identity. A background tab can continue showing its last known
snapshot until the next host event or refresh; a new identity must never inherit
that snapshot or the previous person's draft. A stale response from the old
identity must not overwrite the new view.

Replies, events and renders have no guaranteed order. Apply a reply only when
its cursor, revision or command identity makes it current for the same daemon
instance. Focus, caret and scroll follow a ready, enabled element that will
remain mounted, not a guessed later frame, timeout or microtask. Take an
event's side effect where the event is handled, not from rendered state that
may skip it. Action callbacks read moving values such as the route when they
run. Keep input until the view can act on it or refuse it visibly; never drop
it silently. Loading and opened views share elements the person may be using.

Every write goes through `src/app/mutations.ts` (ADR 0023). A new
write names its command in `mutationClasses`, which also decides what the
person sees before the host answers: optimistic (the result), pending (the
result dimmed and marked) or confirmed (only that it is on its way).
`mutations.test.ts` fails on a `fetch` with a method anywhere else. Read the
outcome with `writeOutcome`: a typed 4xx is a refusal that wrote nothing, and
only a lost reply or a 5xx is uncertain. Confirm from the reply's changed
resource through `hostChanged`, not with `refresh()`: a snapshot read after
every write was what made each click cost seconds live.

Three ways to run the client prove different things, and the difference matters
when reporting evidence. `npm run dev` serves the source with Vite.
`npm run demo` is a loopback-only rehearsal on port 4184 with in-process
fixture snapshots, selected by `VITE_SYNTHETIC_DEMO`; it exercises the UI, not
the host. `test/browser-host/` is a standalone Go TLS host that Playwright builds and
starts against a fresh production `web/dist`. Each Playwright worker's active case starts its own host on
`OH_PORT_BASE + 20 + parallelIndex`, with fresh invented homes, scenario,
sessions, clock and fake Pi. The port is reused only after the previous case's
host exits. Lab Playwright cases similarly use fresh lab-mode hosts at
`OH_PORT_BASE + 40 + parallelIndex`; the manual lab stays on base + 1. It mounts
the real gateway and daemon handlers with synthetic seams: two invented
identities on same-UID Unix sockets under a private `/tmp/oh-browser-*`
directory, a fake OAuth provider, and a `/fixture/` prefix through which tests
switch scenarios and history modes and expire sessions. That switch is process-wide within each case's host; fresh hosts prevent both
cross-worker interference and leaked fixture state between cases on the same
worker. The default suite runs eight workers and the lab suite four, including
concurrent cases in one spec. The host is
test-only code, never imported by `cmd/open-habitat`. Its Unix HTTP server uses
the production daemon's five-second write deadline, including after fixture
restarts; native-operation handlers must extend that deadline themselves.
The `pi-slow-start` scenario delays fake Pi's initial state response beyond
five seconds rather than delaying a browser route; creation does not wait for
it, so tests exercise messages the daemon holds while Pi starts. The
`pi-start-fail` scenario makes fake Pi exit before it is ready, for failed-start
retries. The `pi-slow-intake` scenario makes fake Pi take its input in slowly
and shortens the daemon's budget for handing over a prompt to two seconds, so
a few megabytes of pictures miss it as a hundred megabytes miss the real one. Both the default browser suite and lab mode run the real daemon conversation
controller and native-history path against a fake Pi child. This
proves routing and the browser/host contract but not UID isolation; the two-UID systemd VM
scenarios in `scripts/vm-test.sh` prove that. A browser test passing here is
host-backed synthetic evidence and should be described as such.

Run `biome` from `web/`: invoked from the repository root it fails on the nested root configuration in `web/biome.json`.

For extended synthetic UI exploration, `scripts/lab.sh start|stop|status|url` builds a production bundle and starts the lab on port 4175 by default, choosing a free port and recording it in `.cache/lab/port` if occupied. Set `OH_PORT_BASE` to a distinct value for concurrent browser suites in other worktrees (default listeners: 4174, 4175, 4183, 4184). Sign in through the fake provider as Alice or Bob. From the repository root, `PLAYWRIGHT_BROWSERS_PATH="$PWD/.cache/ms-playwright" node web/lab/shoot.mjs /workspaces .cache/lab/shots/workspaces.png` captures a desktop view (`--narrow` for 390px, `--bob` for Bob); `web/lab/session.mjs` is reusable for scripted Chromium exploration. Screenshots and lab logs live under ignored `.cache/lab/`. The lab scans invented homes and histories, adds richer fixture content to the same real controller/fake Pi setup, and uses synthetic gh/git/OAuth, and supports `/fixture/scenario?value=pi-onboarding`. It does not establish separate-UID isolation, real Pi/provider behavior or live-host behavior. Never use a personal Chrome profile or real home for exploration. A capture script written for one issue lives in `web/lab/` and writes only into that issue's directory; `scripts/prune-closed.py` removes it together with the issue.

Fixture code and the production bundle are kept apart by construction.
`VITE_ENABLE_TEST_FIXTURES=true` makes the app lazy-load
`src/test/CatalogPreview.tsx` behind `?fixture=design`, which the design-system
Playwright tests reach through a second Vite dev server on port 4183. The
production build is made with neither flag, `vite.config.ts` refuses to build
with the demo flag set, `demo/check-build.mjs` and `scripts/ci-local.sh` grep
`dist/` for fixture markers, and `tests/workspace-slice-security.spec.ts` checks
that the served bundle ignores `?fixture=`. A fixture flag on a build meant for
the host would ship test seams to the internet, so a new fixture with new
marker text belongs in those checks too.

Dependencies are pinned in the committed lockfile and installed with
`npm ci --prefix web`; `npm install` rewrites the lock. The gate checks that
the committed lock and manifest permit a fresh install, but does not promise
an air-gapped install: the release preparer also installs from the lockfile
with network access available and packages built assets, not npm dependencies.
The root `TESTING.md` gives the commands, scope and full-gate policy; the
`scripts` block in `package.json` names the individual checks. Use
`./scripts/test-focused.sh --area browser --spec <name>.spec.ts` for targeted
host-backed evidence. For remote placement add `--writers-paused` after pausing
cooperating writers, or use a closed disposable copy; select new inputs with
`--untracked`. The maintained npm `test:browser` routes through this same
entrypoint. Every host runs focused checks and the full gate with these ordinary
commands; remote placement belongs to the local environment, not something a
worker routes by hand.
Focused evidence skips Go/contracts/packaging and never produces a clean-gate
receipt; `TESTING.md` owns commands, capture cooperation and reconnect/cancel
semantics. The supported local full gate runs browser and Go/contracts checks
concurrently after building shared web assets.
Fresh per-case hosts remain in place: resetting a process-wide scenario alone would
not isolate OAuth sessions, fake Pi leases and filesystem history. Pi onboarding
browser cases no longer sleep 2.2 seconds before setting their synthetic state:
that wait assumed a previous case's helper could affect this case's fresh host.
The poll single-flight case advances the browser clock through its 2-second
intervals; native fake-Pi transitions and the production interval remain real.

For Playwright traces, use `./scripts/inspect-trace.sh web/test-results/<test>/trace.zip`
from the repository root, or pass a test-results directory containing exactly
one trace. It extracts into a fresh disk-backed temporary directory, prints a
short error summary and the viewer command, and never deletes files. `--json`
is available for scripted inspection. Record traces with Playwright's
`--trace on`; lab runs use `--config web/playwright.lab.config.ts` and write
`web/test-results-lab`. Do not clear an extraction directory with shell globs;
each invocation gets its own directory.

UI evidence is always a screenshot paired with a static HTML snapshot from the
synthetic lab, saved side by side in the issue folder. Use `snapshot(page, outBase)`
from `lab/session.mjs` for scripted journeys; `lab/shoot.mjs` includes HTML by
default (`--no-html` is only for exceptional debugging). Never capture a live
host, real profile or real user data. Open the HTML offline to inspect layout
and semantics without a running lab; the image remains the visual reference.

Own-computer folders are shared through native OneDrive/Dropbox sync, not browser
folder permissions. Browser folder sharing was deliberately removed: it required
an open supported tab and gave a less reliable route than cloud sync. Individual
file attachments remain available. Do not rebuild a browser folder bridge.

The editor choice belongs in the person's own configuration, read and written
by the daemon as their UID, never in gateway or browser storage. Browser
observations are scoped to the validated identity and CSRF binding; only the
choice enum may persist, never paths, tokens, file contents or editor drafts.
Identity/CSRF changes dispose live documents even when dirty. Compact layouts
use CodeMirror without rewriting the desktop choice; growing the viewport
must not switch engines inside a live document. Browser editors treat text as
data, with no active-content preview or project-provided plugins.

Native writers, the person's agents first, change open files concurrently.
The document controller notices a newer version by reading the file (when an
agent tool call beside it finishes, when the window regains focus and before
every save), marks where it lands and brings it in as one undoable editor
event after a typing pause or at the latest on Save, so text never changes
under the person's fingers. Lines both changed wait for the person's choice and
nothing is written meanwhile. A write carries the version it merged; the
daemon's base-version refusal stays the arbiter, and a refused write is read
and merged again, never forced. An uncertain save is settled by reading the
file, never by resending it. The editor names the agent only when the agent's
own file tool call names the file; otherwise the wording stays neutral,
because nothing else tells who wrote it. The note about replaced agent changes
is this tab's view state: it never enters Pi's history or a new store, and the
agent learns of it only from a message the person sends.

A background workspace observation cannot discard an unsaved editor buffer.
Keep the document bound to its original resource until the person saves or
explicitly discards it, even when its workspace is no longer available or
selected. This is document lifetime, not another owner of route selection;
real identity/CSRF changes still dispose it.

Editor saves confirm from their validated document reply in the mounted
document, not Redux's snapshot `hostChanged` path: neither file contents nor
versions belong in snapshots or the host journal.

Editor engines are bundled trusted app code, loaded only on an effective choice
and document open; settings and unselected engines must not fetch their chunks
or workers. CodeMirror is the sole browser engine, with no CDN, extension host,
workspace plugin or language-server process. Keep the shared document controller
as the sole save, conflict and uncertainty owner. No timed autosave, force
save, persistent drafts or resent writes. Leaving a document is the one save
nobody presses (Jari's choice): closing the editor, opening another file,
another workspace's conversation and a route that unmounts the editor save
through that same save, and the notice's Kumoa writes the earlier version back
on the saved version, so the daemon refuses it after any later change. Only a
save that cannot be done asks, in Habitat's own window; moving between
conversations that keep the editor asks and writes nothing, and the browser's
`window.confirm` is never used. Habitat cannot see or save VS Code's buffers:
narrowing past the phone breakpoint asks on its own row to save there first,
and VS Code stays until the person switches. Selecting VS Code only records a choice;
only explicitly opening it may start code-server. Leaving it unmounts the frame,
not the shared per-user process another tab may still use. Browser engines never
mint editor grants or borrow code-server's separate-origin relay.
A refreshed editor preference is a background observation: it must not prompt
for discard while the person types. A dirty/saving document keeps its engine;
a later clean closed opening adopts the stored choice, including FileRef links.

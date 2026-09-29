# Web client

`web/` is the browser application: a React and TypeScript single-page client
built with Vite, with Redux Toolkit for the synchronized model and React Router
for the route. The stack and the reasons for it are in
`docs/adr-0002-frontend-stack.md`. Its state-ownership table and its
"Rendering and security boundary" section are the design this code implements,
so read them before changing how state flows or how host content is rendered.
In short: the route is the only record of which workspace or agent is selected,
and selectors resolve it against the current snapshot rather than a second
field; Redux holds the facts the host synchronizes; ephemeral things such as
focus and open menus stay in the owning component. The UI is in Finnish and
desktop-first. `design-system/AGENTS.md` holds the visual decisions and the
token source, and `src/components/` holds the production components that both
the app and Storybook import, so a story shows states of the real component
rather than a copy of it.

The browser is a viewer of native state, not an owner. It never chooses a Unix
user; the gateway does that from the authenticated identity. It never keeps
native history or credentials. Everything that arrives from the host is treated
as untrusted text even though it came from the person's own processes, because
Pi history and tool output can contain anything. `src/app/snapshot.ts` and
`src/app/history.ts` validate responses against the schemas in `contracts/v1/`
before Redux sees them, read the body under a size cap even when Content-Length
is missing or wrong, and fail with generic messages so that response text never
reaches the UI or the console. The store retains the last verified snapshot only when the session and Pi gate
have been positively rechecked with the same session binding and the snapshot
transport then fails (network, timeout, 500/503/504). The gateway rejects
invalid daemon envelopes as 502 and foreign identity as 403; these clear the
view rather than risking cross-identity content. It marks that snapshot stale,
keeps reading available and disables writes until a fresh snapshot arrives.
Failed authority checks, 401/403, malformed responses, session expiry, logout
and identity or session changes clear the old view instead. The store resets
filter state when the identity in a new snapshot differs from the previous one. A tab can outlive a session: if one
person's session expires and another signs in on the same tab, nothing from the
first identity may remain visible. Showing one identity's facts under another
is a product defect, not a UI glitch.

Three ways to run the client prove different things, and the difference matters
when reporting evidence. `npm run dev` serves the source with Vite.
`npm run demo` is a loopback-only rehearsal on port 4184 with in-process
fixture snapshots, selected by `VITE_SYNTHETIC_DEMO`; it exercises the UI, not
the host. `test/browser-host/` is a standalone Go TLS host on port 4174 that
Playwright builds and starts against a fresh production `web/dist`. It mounts
the real gateway and daemon handlers with synthetic seams: two invented
identities on same-UID Unix sockets under a private `/tmp/nah-browser-*`
directory, a fake OAuth provider, and a `/fixture/` prefix through which tests
switch scenarios and history modes and expire sessions. That switch is
process-wide, which is why Playwright runs with one worker. The host is
test-only code, never imported by `cmd/native-agent-host`. It proves routing
and the browser/host contract but not UID isolation; the two-UID systemd VM
scenarios in `scripts/vm-test.sh` prove that. A browser test passing here is
host-backed synthetic evidence and should be described as such.

For extended synthetic UI exploration, `scripts/lab.sh start|stop|status|url` builds a production bundle and starts the lab on port 4175 by default, choosing a free port and recording it in `.cache/lab/port` if occupied. Set `NAH_PORT_BASE` to a distinct value for concurrent browser suites in other worktrees (default listeners: 4174, 4175, 4183, 4184). Sign in through the fake provider as Alice or Bob. From the repository root, `PLAYWRIGHT_BROWSERS_PATH="$PWD/.cache/ms-playwright" node web/lab/shoot.mjs /workspaces .cache/lab/shots/workspaces.png` captures a desktop view (`--narrow` for 390px, `--bob` for Bob); `web/lab/session.mjs` is reusable for scripted Chromium exploration. Screenshots and lab logs live under ignored `.cache/lab/`. The lab scans invented homes and histories, runs the real conversation controller with a fake Pi child and synthetic gh/git/OAuth, and supports `/fixture/scenario?value=pi-onboarding`. It does not establish separate-UID isolation, real Pi/provider behavior or live-host behavior. Never use a personal Chrome profile or real home for exploration.

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
`npm ci --prefix web`; `npm install` rewrites the lock, and `scripts/ci-local.sh`
proves the lock complete by reinstalling offline. The root `TESTING.md` gives the commands, scope and full-gate policy; the
`scripts` block in `package.json` names the individual checks.

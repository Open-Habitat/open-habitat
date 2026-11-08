# Result: server browser as an experimental feature

Settings › Kokeelliset ominaisuudet › *Oma palvelinselain* (`remote-browser`,
off by default) turns on the person's own Google Chrome on the server, built
as the research decision describes and with the round 4 direction *2 Esiin*.

## What was built

- **Browser host** (`internal/browserhost`, the binary's `daemon browser-host`
  role, run as the person). It starts TigerVNC's `Xtigervnc` (`-rfbport -1`,
  `-rfbunixpath …/vnc.sock -rfbunixmode 0600`, `-nolisten tcp -nolisten local`,
  `-SecurityTypes None`, a fresh MIT cookie in a 0600 Xauthority on every start,
  `-displayfd` so the display number never collides) and Google Chrome with
  `--remote-debugging-pipe`, its profile in
  `~/.local/share/open-habitat/browser/profile` (session restore on) and cache
  in `~/.cache/open-habitat/browser` (256 MiB). Three 0600 sockets in a 0700
  directory, and every accepted connection is checked to come from the same
  UID (`SO_PEERCRED`):
  - `cdp.sock`: the agent's DevTools WebSocket. The host multiplexes Chrome's
    one pipe between one agent and its own use (window list and pictures),
    rewriting command ids and routing replies and events by session owner.
    A second agent is refused (409) while one drives. When an agent leaves,
    the host detaches its sessions and resets auto-attach, discovery and the
    download behaviour, so the next client sees the same pages.
  - `control.sock`: the daemon's status, window pictures (half-size JPEG via
    the host's own CDP session), control, the agent's request for a window,
    viewer heartbeat and stop.
  - `vnc.sock`: Xvnc's own RFB socket.
  The agent's `Input.dispatchMouseEvent` is observed as it passes, giving the
  pointer and the last presses per window. While the person has control the
  agent's commands wait in the host (events still reach it) and are sent in
  order when control returns; more than 2000 messages or 16 MiB disconnects
  the agent. Giving control back clears the request. The host stops itself
  24 h after the last agent or viewer, with `Browser.close` so Chrome saves
  the session it restores next time; nothing is logged about URLs or pages.
- **Daemon** (`internal/daemon/browser_linux.go`): starts the host like the
  editor (a transient `systemd-run --user --unit=open-habitat-browser` unit
  with `OOMPolicy=continue` when the person lingers, else the daemon's child),
  using its launch path so upgrades are followed. App routes
  `GET /api/v1/browser`, `POST …/start|stop|control`, `GET …/window?id=`
  (checked to be a JPEG) and the viewer WebSocket `…/view`, which pipes binary
  frames to `vnc.sock` and pings every 25 s. The host's answers are decoded and
  re-encoded, so only known fields of known shape reach the app. Agent routes
  `GET /agent/v1/browser` (state, windows, `cdp_endpoint`
  `ws+unix://…/cdp.sock:/devtools/browser`), `POST …/start` (refused while the
  switch is off) and `POST …/request`; CLI `open-habitat agent browser
  status|start|request`. Pi gets the `open-habitat-browser` skill while the
  switch is on and the browser is installed.
- **Gateway** (`internal/gateway/browser_linux.go`): the routes as ordinary
  authenticated relays (writes need CSRF), and the viewer through the shell's
  relay, now shared as `relayWebSocket`: exact Origin, CSRF proof as the first
  message before the daemon is dialled, closed with the session, at most four
  viewers per session (separate from terminals).
- **Contract** `contracts/v1/browser.schema.json` with examples and negative
  checks (no path in an origin, no TCP DevTools address).
- **Web**: the *Selain* chip above the message field, the strip with live
  window pictures, the agent's pointer and press rings, a requesting window
  large with the agent's words beside it (*Ota ohjaus ja hoida* / *Katso
  ensin*), the sheet with the live view (noVNC 1.7.0, MPL-2.0, lazy chunk) in
  view-only mode until the person takes control, and *Oma selain* as the top
  row of the sidebar. The sheet says the agent may use everything the browser
  is signed in to.

## What Fleetrepo must install

No new unit file: the browser runs in a transient user unit like the editor,
so the release watcher's unit inspection does not change. On every Open
Habitat host (Birch, the test server):

1. Ubuntu package `tigervnc-standalone-server` (provides `/usr/bin/Xtigervnc`;
   1.13.1 on noble, both architectures). The host writes its X cookie itself,
   so `xauth` is not needed.
2. Google's apt repository and key: `deb [arch=amd64,arm64
   signed-by=/usr/share/keyrings/google-chrome.gpg]
   https://dl.google.com/linux/chrome/deb/ stable main` with the key from
   `https://dl.google.com/linux/linux_signing_key.pub`, and package
   `google-chrome-stable` (provides `/opt/google/chrome/google-chrome`).
   Declared as a qualified minimum version, updated as apt delivers
   (`internal/AGENTS.md` package rule); tested with 157.0.8103.38 arm64.
   The package's postinst adds a cron job that re-adds the repository; leave
   it or manage the list file, but do not pin.
3. AppArmor: nothing extra. Ubuntu's `apparmor` package already ships
   `/etc/apparmor.d/chrome` for `/opt/google/chrome/chrome` with `userns`, and
   Chrome's own package ships one too; Chrome's sandbox needs it because
   `kernel.apparmor_restrict_unprivileged_userns=1`. Never `--no-sandbox`.
4. The daemon offers the browser only when both executables are root-owned
   and not group/world-writable in root-owned directories, as for the editor.

## Evidence

- Real stack on Birch (arm64), as `maintainer`, with Xtigervnc and Google
  Chrome 157 extracted from their `.deb`s into a scratch directory (not
  installed) and a temporary path AppArmor profile with `userns` for the
  scratch Chrome (loaded with `apparmor_parser -r`, removed with `-R`,
  `aa-status` shows none). Chrome ran sandboxed: renderers in their own user
  and PID namespaces with a seccomp filter. Xtigervnc listened only on
  `vnc.sock` and `/tmp/.X11-unix/X0`, no TCP and no abstract socket.
  Playwright connected over `ws+unix`, worked, disconnected and reconnected
  three times and saw the same pages each time.
- End to end through the real gateway and daemon routes in the synthetic lab
  with the real host in-process (`web/lab/remote-browser-e2e.mjs`,
  `evidence/e2e-log.txt`, screenshots with HTML): the browser started and the
  viewer connected in under a second (`e2e-1-sheet-view`); the agent's window
  and request showed in the strip with real pictures (`e2e-2-strip-request`);
  the person took control and typed a code through noVNC into real Chrome
  (`e2e-3-sheet-control`) while the agent's CDP command waited and answered
  `"123456"` only after control was given back (`e2e-4-after-give-back`);
  stopping left no process. The run was repeated after the review fixes.
- Tests: `internal/browserhost` (id rewriting, host sessions never reach the
  agent, cleanup on leave, second agent refused, hold and replay, hold limit,
  pointer only in pages, request text cleaning, cookie format, `-race`),
  `internal/daemon` browser tests (unavailable without programs, other peer
  refused, sanitized status, control validation, JPEG check, viewer relay,
  agent routes and the switch), `internal/gateway` (viewer Origin and CSRF
  before the daemon, viewer cap, write CSRF), `internal/cli`, contracts
  validation, web fast checks, and `web/tests/server-browser.spec.ts` (three
  host-backed cases with an RFB stand-in that counts input: a look sends no
  input, control does) and `settings-experimental.spec.ts`.

- Review: independent `/llm-review` (finder gpt-6-astra, verifier
  claude-fable-5-1) and `/assess-findings`: six findings, all confirmed and
  fixed in this run: the next agent waits for the last one's cleanup in the
  pipe; agent commands, replay and cleanup share one dispatch order; the
  host's screenshot attach no longer takes an agent's attachment event for
  the same page (ambiguous events are held until the host's reply names its
  session); shutdown kills Chrome even if its pipe stalls; stop and start
  trust only a vanished control socket as an ended host; the agent CLI waits
  55 s for a start.

## Could not be done here

- Nothing was installed on Birch or the test server; Fleetrepo does that.
- The agent's request went to the host's control socket in the lab e2e (the
  synthetic host has no agent listener); the daemon's agent route is covered
  by its Go test.
- A real service sign-in (cookies surviving a restart) was not tried: Birch's
  egress is limited and evidence must not use a real account.

## Known limits

- A tab behind another tab never paints, so its picture stays a placeholder
  until it has been in front; the host asks it again only every 10 s.
- No window manager: new windows open over each other at the display's
  corner; the person sees the front one in the live view.
- Control is a guardrail inside the person's UID: any process of theirs,
  the agent included, can reach `control.sock` and give control back to
  itself, as it can reach the profile.

## Decisions for later review

- **Transient unit instead of a unit file in `systemd/`.** The brief asked for
  units; the editor's pattern needs none, works whether the person lingers or
  not, and avoids the release watcher refusing a release whose units Fleetrepo
  has not installed yet. Alternative: a static user unit installed by
  Fleetrepo.
- **Agent waits rather than is disconnected when the person takes control.**
  Commands are held and replayed; the skill tells the agent to use long
  timeouts. Alternative (research text): disconnect and refuse until given
  back, which breaks a waiting script.
- **Taking control for a request brings that window to the front**
  (`Target.activateTarget`), so the live view shows what needs the person.
- **Only one agent at a time**; a second CDP connection gets 409 with a
  message rather than replacing the first.
- **Request clears when control is given back**, when the agent withdraws it
  or when its window closes; nothing else infers that the person is done.
- **Agent start is refused while the switch is off**; status is always
  readable. The person's own start is not gated (only the UI hides it).
- **The window list is page targets** (tabs count as windows); the status
  shows a window's origin (scheme and host), never its path.
- **Viewing is noVNC's view-only mode**; the daemon relays RFB unparsed rather
  than filtering input, since control is the person's own choice in their own
  browser.
- **Display 1280×800**, pictures at half size, status polled every 1.5 s
  while running and 8 s otherwise, pictures every 2 s while the strip is open.
- **No conversation entries** ("Otit selaimen ohjauksen klo …") in this demo:
  they would need native notice writes and are left for the finished feature.

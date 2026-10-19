# Research: a browser shell and file viewing/editing for each person

Research run `01m59mmt4k00emrtfsybwzfkw3`, 2026-10-19. This report feeds the
decision that `docs/product.md` defers ("laajemmat editori- ja
työkalunäkymät … päätetään erikseen") and the prototype rounds
`proto-browser-shell` and `proto-file-viewing`. The experiments marked
**measured** were run on alder in a disposable `/var/tmp` directory with a
throwaway `HOME`, through a 30-line Go stand-in for the gateway route (TCP on
loopback → Unix socket, WebSocket passthrough via `httputil.ReverseProxy`) and
headless Chromium. The directory was removed afterwards. No real account,
credential or global install was used.

## Tiivistelmä (Jarille)

- **Shell: suosittelen xterm.js:ää selaimessa ja PTY:tä henkilön omassa
  daemonissa. PTY ajaa aina `tmux new-session -A` -komentoa tuotteen tunnettuun
  tmux-palvelimeen `/run/user/<uid>`-hakemistossa.** Tmux on natiivi istunnon
  haltija. Mitattuna se piti saman bash-prosessin ja sen taustatyön hengissä
  selaimen sulkemisen yli, ja toinen käynti liittyi samaan istuntoon. Ilman
  tmuxia "tavallinen shell" kuolisi selaimen mukana, tai daemonin pitäisi
  säilyttää istuntoja itse, ja se olisi juuri se rinnakkaisvarasto, jota emme
  rakenna. Erillistä ttyd/gotty/wetty-palvelua en suosittele. Selaimen ja
  daemonin välissä kulkee WebSocket. Gateway välittää siinä vain tavuja, kun se
  on tarkistanut Originin, istunnon ja CSRF-tunnisteen.
- **Tmux ei selviä daemonin uudelleenkäynnistyksestä**, jos se on daemonin
  lapsi: `KillMode=mixed` tappaa sen, ja `PrivateTmp=yes` piilottaa sen
  `/tmp`-socketin muilta. Taskfleet on jo ratkaissut saman ongelman ajamalla
  tmuxin `systemd-run --user` -palveluna. Se vaatii jokaiselle henkilölle
  lingerin, ja testipalvelimella linger on nyt vain sinun tunnuksellasi.
  Lingerin päälle laittaminen tilin luonnissa olisi brokerille uusi
  root-valtuus, joten se on sinun päätöksesi.
- **Editori: kaksi tasoa.** (1) Oma kevyt tiedostonäkymä (daemonin
  lukurajapinta + CodeMirror 6, MIT) viestien tiedostolinkeille ja puhelimelle.
  Monaco ei tue mobiilia, ja VS Code -istunto vie mitattuna 0,4–0,8 Gt
  henkilöä kohden. (2) "Avaa koko repo" -toimintoon code-server (MIT, Coder).
  Daemon käynnistää sen tarvittaessa Unix-socketille ja sammuttaa sen
  joutoajan jälkeen. **openvscode-serveriä en suosittele**: sen viimeisin
  julkaisu on helmikuulta 2026 (VS Code 1.109; upstream on nyt 1.142).
  Microsoftin `code serve-web` -palvelun lisenssi kieltää sen tarjoamisen
  muille.
- **Editori tarvitsee oman originin.** Mitattuna code-server tarjoaa
  webview-sisällön samasta originista kuin työpöytänsä. Jos se olisi Open
  Habitatin originissa, mikä tahansa webview- tai editori-XSS voisi käyttää
  selainistuntoa, esimerkiksi luoda laitelinkin ja saada pysyvän pääsyn
  henkilön tilille. Yksi erillinen ensimmäisen tason aliverkkotunnus, esim.
  `open-habitat-test-code.example.test`, riittää ja kuuluu Cloudflaren
  ilmaisen Universal SSL:n piiriin. Henkilökohtaiset aliverkkotunnukset
  (`*.open-habitat-test.example.test`) vaatisivat maksullisen Advanced
  Certificate Managerin.
- **Turvallisuus:** shell ei anna henkilölle uutta valtaa, koska Pi:n
  bash-työkalu ajaa jo komentoja hänen tunnuksellaan. Varastettu istunto ei
  siis muutu vaarallisemmaksi. Selainreitti vaatii kuitenkin kolme puuttuvaa
  asiaa. Ensinnäkin tarkan Origin-tarkistuksen WebSocket-avaukselle.
  Toiseksi elävien yhteyksien katkaisun uloskirjautumisessa ja istunnon
  peruutuksessa: nykyiset SSE-virrat jatkuvat niiden jälkeen. Kolmanneksi
  `frame-ancestors`-suojauksen, jota sovelluksella ei nyt ole lainkaan.
  Erillistä uudelleenkirjautumista en suosittele.
  **Ensimmäinen viipale:** työtilakohtainen shell (tmux + PTY daemonissa,
  WebSocket gatewayn läpi, xterm.js + puhelimen näppäinrivi). Sen jälkeen
  vain luku -tiedostonäkymä ja linkit, ja vasta kolmantena code-server omassa
  originissaan.

## Summary

- **Shell: xterm.js in the app, a PTY in the per-user daemon running
  `tmux new-session -A` against one product-known tmux server under
  `/run/user/<uid>`, carried over a WebSocket that the gateway relays byte for
  byte after checking Origin, session and CSRF.** tmux is the native thing that
  keeps a shell alive. A "plain shell without tmux" would either die with the
  browser tab or force the daemon to keep sessions itself, which would be a
  parallel session store. **Measured:** the same bash PID and its background job
  survived the browser closing, and the next visit reattached.
- **Survival across daemon restarts needs the tmux server outside the daemon's
  cgroup and `PrivateTmp`.** Taskfleet already does this with
  `systemd-run --user` transient services and a socket in `/run/user/<uid>`.
  That needs lingering per person, which today exists on the test guest only
  for `maintainer`. Whether the broker enables lingering at account creation
  is Jari's call.
- **Editor: two tiers.** A small built-in, read-mostly file view (daemon file
  API + CodeMirror 6) serves message file links and phones. Monaco does not
  support mobile, and an open VS Code session cost 0.4–0.8 GB RSS per person
  when measured. **code-server** (MIT, Coder) serves "open the whole
  repository": the daemon starts it on demand on a Unix socket and stops it
  when idle. openvscode-server is not recommended: its last release is v1.109.5
  of 2026-02-20, while upstream is at 1.142. Microsoft's `code serve-web` and
  VS Code Server license forbids offering it to others.
- **The editor must live on its own origin.** **Measured:** code-server serves
  webviews from the workbench's own origin; its `webview.diff` patch does this
  deliberately. Mounted on the app's origin, any webview or workbench script
  could use the Open Habitat session, for example to mint a device link. One
  separate first-level host such as `open-habitat-test-code.example.test` is
  covered by Cloudflare's free Universal SSL. Per-person subdomains one level
  deeper need Advanced Certificate Manager or a custom certificate.
- **Security:** a shell grants the person nothing new, because Pi's bash tool
  already runs arbitrary commands as them. A stolen session is already
  code-execution-equivalent. The browser path does need three things the
  gateway lacks today:
  - an exact Origin check on the WebSocket upgrade;
  - closing live upgraded connections on logout, revocation and expiry (today a
    streaming proxy outlives sign-out);
  - `frame-ancestors` protection (the app currently sends none).

  I do not recommend a shell-specific re-authentication.

## Background: what exists today

- The gateway's `proxy` (`internal/gateway/proxy_linux.go`) builds a fresh
  request to the session's mapped daemon socket. It forwards only selected
  headers, and supports finite responses plus one-way streams (SSE, with a 60 s
  idle read deadline per read and a 10 s write deadline). **There is no
  WebSocket or bidirectional path.** It checks the session once, at request
  start. Nothing in `revoke.go` or `session.go` cancels an already-running
  stream when the session ends.
- Writes require `Origin == cfg.Origin` (single value) and the
  `X-Agent-Host-CSRF` header (`authorizeWrite`, `internal/gateway/session.go`).
  The cookie is `__Host-agent-host`, `Secure; HttpOnly; SameSite=Lax`
  (`auth.go:180`, `:642`). A "recent sign-in" precedent exists:
  `recentGitHubSignIn` (5 minutes) gates GitHub disconnect.
- Device linking (`link.go`, ADR 0018) lets a signed-in browser mint a
  one-minute token that another browser redeems for its own session. This
  matters for the origin analysis below: a script on the app's origin can mint
  a session for someone else.
- The daemon unit (`systemd/open-habitat-daemon@.service`) has `User=%i`,
  `PrivateTmp=yes`, `KillMode=mixed`, `UMask=0077`, `NoNewPrivileges=yes` and no
  memory or task limits. Pi runs as a child with `Pdeathsig: SIGKILL` and its
  own process group (`pi_rpc_linux.go:124`), so everything the daemon starts
  today lives and dies with the daemon's cgroup.
- The daemon socket is created by systemd as `%i:open-habitat-gateway 0660`
  under a root-prepared `/run/open-habitat/users/<user>/`. The gateway can
  reach only that socket.
- Test guest (Fleetrepo `infra/open-habitat-test/`):
  - `OMEGA-ACCESS.md`: `open-habitat-test.example.test` through a Cloudflare
    Tunnel to cloudflared on alder, then an SSH forward to the guest's
    `127.0.0.1:8443` gateway. Cloudflare Access was removed. Any GitHub account
    is admitted (`admission:any`).
  - `GUEST-TASKFLEET-RUNTIME.md`: mapped accounts keep an intentional
    `nologin` login shell, so a tmux wrapper sets `SHELL=/bin/bash`. Lingering
    and `user@21032.service` are enabled only for `maintainer`. Taskfleet
    v0.15.0 starts its tmux server as a transient user service with its socket
    at `/run/user/<uid>/taskfleet/tmux-<hash>.sock`
    (`crates/taskfleet/src/linux_lifetime.rs`, `start_tmux`). It does this
    "outside the product daemon's cgroup and PrivateTmp".

## Shell

### Options

| | PTY + tmux in the per-user daemon (recommended) | Raw PTY in the daemon, no tmux | ttyd / gotty / wetty as a separate per-user server |
|---|---|---|---|
| Survives browser close | Yes (tmux server). **Measured.** | Only if the daemon keeps the PTY and a scrollback buffer, which is a parallel session store. | ttyd with a tmux command: yes, through tmux. Its own PTY: no. |
| Same session as SSH/tmux | Yes, any `tmux attach` on the same socket. | No. | Through tmux only. |
| Browser UX | tmux owns the screen. xterm.js scrollback stays empty, scrolling goes through tmux copy mode (mouse or keys), and copy/paste needs care on phones. | Best native browser scrollback, selection and copy. | Same as the left two, depending on the command. |
| New code | PTY spawn (~50 lines with `golang.org/x/sys/unix`, or `creack/pty`, MIT), WebSocket endpoint, xterm.js (MIT, 6.0.0). | Same, plus session keeping and replay. | A second listener per person, its own origin and auth model, plus a process to supervise. |
| Fit with architecture | The daemon holds no state. tmux is the native truth. | Conflicts with "no parallel stores". | Duplicates the gateway's job (auth, origin) inside another server. |

Notes on the separate tools, from primary sources:

- **ttyd** (MIT, [tsl0922/ttyd](https://github.com/tsl0922/ttyd)). Last release
  1.7.7 on 2024-03-30, with commits through 2026-08. It listens on a Unix socket
  (`-i /path.sock`), and `-O` rejects cross-origin WebSocket upgrades.
  **Measured** through the stand-in proxy: a cross-origin upgrade was refused,
  the same-origin upgrade got `101`, and ttyd used about 9 MiB RSS. It is a
  credible building block, but adopting it means one more server per person
  whose origin rules must agree with the gateway's. Embedding xterm.js
  ourselves costs about the same.
- **gotty** (MIT; the maintained fork
  [sorenisanerd/gotty](https://github.com/sorenisanerd/gotty), v1.10.0 on
  2026-10-10). It is similar to ttyd.
- **wetty** (MIT, [butlerx/wetty](https://github.com/butlerx/wetty), v4.0.1 on
  2026-10-14). It connects over SSH, or runs `login` when started as root. That
  assumes either the SSH route Jari has ruled out as a default or a root
  process, so it does not fit.

**Where credible views disagree.** The PTY-in-daemon camp, which most web IDEs
take (VS Code's integrated terminal, code-server), lets the server keep the PTY
and replay a buffer on reconnect. VS Code's server keeps terminals for a
reconnection grace period. **Measured:** openvscode-server logged a default of
10800 s. The tmux camp (ttyd/gotty recipes, many self-hosters) relies on tmux
for persistence and shared sessions. For Open Habitat the tmux side wins on
architecture grounds: persistence and sharing come from a native tool, not
from daemon state. The UX cost, tmux owning scrollback and selection, is real
and is what `proto-browser-shell` should look at.

**A small deviation from Jari's phrasing.** "Attach to tmux if there is one,
otherwise a plain shell" works better as "always through tmux; create the
session if there is none". A plain shell outside tmux cannot survive the browser
closing without the daemon becoming the session holder. Whether the person sees
tmux (status bar, window list) or a plain-looking terminal is a presentation
choice for the prototype. The daemon must not rewrite the person's tmux
configuration, so the product can only pass options on the command line.

### Which tmux

- **The product's own server**: one product-known socket,
  `$XDG_RUNTIME_DIR/open-habitat/tmux.sock`, one session per workspace
  (`new-session -A -s <workspace-id> -c <workspace dir>`). Opening the
  workspace's shell lists and creates windows there. Pi's own bash tool and
  any SSH login could use the same socket if the daemon exports `TMUX_TMPDIR`.
- **The default tmux socket** is `/tmp/tmux-<uid>/default`. Inside the daemon
  this is its private `/tmp` ([`PrivateTmp=`,
  systemd.exec(5)](https://www.freedesktop.org/software/systemd/man/latest/systemd.exec.html#PrivateTmp=)),
  so a tmux started from an SSH login would be invisible to the daemon, and the
  reverse is also true. Moving the product's server to `/run/user/<uid>` avoids
  this.
- **Taskfleet's server** (`/run/user/<uid>/taskfleet/tmux-*.sock`) holds
  spinoff workers. Root `AGENTS.md`/`internal/AGENTS.md` say the daemon never
  writes to a spinoff for the browser. Attaching an interactive terminal to a
  worker's pane is exactly such a write. The options are to list them and allow
  only read-only attach (`tmux attach -r`), or to leave them out. This is a rule
  change, so it is Jari's (decision 4).

### Lifetime and transport

- Browser closes: the WebSocket closes, the daemon's `tmux attach` client in the
  PTY exits, and the tmux server and shells continue. **Measured:** a
  background `sleep 600` and the shell PID were still there on the next visit.
- Daemon restarts or upgrades: a tmux server started as a daemon child is
  killed (`KillMode=mixed`). Started with `systemd-run --user` (Taskfleet's
  pattern), it continues, but this requires lingering and a running
  `user@<uid>.service`. Without lingering the shell still works; it just does
  not survive a daemon restart, and the UI should say so rather than pretend.
- Accounts have `nologin` shells on the guest, so the daemon must set
  `SHELL=/bin/bash` (or the operator's chosen shell) for tmux. The guest's
  wrapper shows the trap.
- Transport is a WebSocket from browser → gateway → daemon socket. xterm.js has
  an official `@xterm/addon-attach` for exactly this
  ([xterm.js README](https://github.com/xtermjs/xterm.js)). The gateway does an
  HTTP/1.1 upgrade relay. **Measured:** `httputil.ReverseProxy` over a Unix
  socket relays the `101` and both directions, for ttyd and for both VS Code
  servers' WebSockets. Cloudflare Tunnel carries WebSockets. The current
  60-second idle read deadline means the daemon or browser must ping, which
  ttyd also does (`-P`, default 5 s).
- Alternative transport: SSE for output plus POST for input. It reuses today's
  gateway paths and needs no upgrade support, but costs one request per
  keystroke batch and differs from what xterm.js and every editor expect. The
  editor needs WebSocket relaying anyway, so I recommend building the upgrade
  relay once.

### Resource limits

**Measured:** tmux server + bash ≈ 15–30 MiB RSS per person. The real risk is
what people run in the shell, and that risk already exists through Pi. Limits
belong on systemd slices, set by the operator (Fleetrepo), not by the product:
`MemoryMax=`/`TasksMax=`/`CPUWeight=` on `user-<uid>.slice` (user services) and
on the daemon unit (daemon children)
([systemd.resource-control(5)](https://www.freedesktop.org/software/systemd/man/latest/systemd.resource-control.html)).
Disk is already capped by ext4 user quotas on the guest. The product can cap
concurrent terminal connections per session and frame sizes. OWASP suggests
message limits of about 64 KB and idle timeouts
([OWASP WebSocket cheat sheet](https://cheatsheetseries.owasp.org/cheatsheets/WebSocket_Security_Cheat_Sheet.html)).

## Editor and file viewing

### Options

| | License | Maintenance (GitHub API, 2026-10-19) | Unix socket / on-demand / idle stop | Measured footprint | Marketplace | Webview origin |
|---|---|---|---|---|---|---|
| **code-server** ([coder/code-server](https://github.com/coder/code-server)) | MIT | v4.141.0 on 2026-10-08 = VS Code 1.141; upstream 1.142 came on 2026-10-14. Releases track upstream within days. | `--socket`, `--socket-mode`, `--socket-fd` (systemd socket activation), `--idle-timeout-seconds`, `--auth none`, `--disable-file-downloads/uploads`, `--disable-update-check`. **Measured:** listened on a 0600 socket, no TCP. | 705 MB unpacked. Idle with no client: ~155 MiB RSS. Folder + file + terminal open: 829 MiB RSS / 533 MiB PSS (7 node processes). Unchanged 20 s after the browser closed. Workbench ready 3.4 s. | Open VSX. The browser contacted `open-vsx.org` directly. | **Same origin** as the workbench (`…/static/out/vs/workbench/contrib/webview/browser/pre/index.html`, `parentOrigin` = the page). Deliberate: [`patches/webview.diff`](https://github.com/coder/code-server/blob/main/patches/webview.diff), "Serve webviews from the same origin". |
| **openvscode-server** ([gitpod-io/openvscode-server](https://github.com/gitpod-io/openvscode-server)) | MIT | Last release v1.109.5 on 2026-02-20; last commit 2026-02-03. About 33 upstream releases behind. | `--socket-path`, `--connection-token[-file]`, `--without-connection-token`, `--reconnection-grace-time` (default 10800 s, **measured** from its log). No socket-mode flag (**measured** 0775 under the default umask). No idle stop. | 244 MB. Idle: ~90 MiB. Folder + file + terminal: 381 MiB RSS / 219 MiB PSS (5 processes). Ready 1.4 s. | Open VSX (`product.json` `extensionsGallery`). | **Microsoft CDN, per-webview origin:** `https://<uuid>.vscode-cdn.net/insider/<commit>/…` (**measured**). Isolated, but webview code comes from a third party at runtime. Self-hosting needs a `{{uuid}}.<host>` wildcard via `webviewContentExternalBaseUrlTemplate`. |
| **VS Code `code serve-web`** (Microsoft CLI) | Microsoft [VS Code Server license](https://code.visualstudio.com/license/server) | Current | `--socket-path`, connection token; downloads the server from Microsoft at first run. | Not run (see below). | Microsoft Marketplace | Microsoft's design |
| **VS Code Remote Tunnels / vscode.dev** | Same license; Microsoft service | Current | `code tunnel`, relayed through Microsoft dev tunnels; the person logs in with their own GitHub/Microsoft account ([docs](https://code.visualstudio.com/docs/remote/tunnels)). | – | Microsoft | vscode.dev's |
| **Eclipse Theia** ([eclipse-theia/theia](https://github.com/eclipse-theia/theia)) | EPL-2.0 | v1.76.0 on 2026-09-24 | A framework to assemble an IDE from, not a drop-in server. | Not measured | Open VSX | Assembler's choice |
| **Built-in view: daemon file API + CodeMirror 6 / Monaco** | MIT ([CodeMirror](https://github.com/codemirror/dev), [Monaco](https://github.com/microsoft/monaco-editor)) | Active | Within the existing daemon; no new process. | Small | – | The app's own; renders text, executes nothing |
| **filebrowser** ([filebrowser/filebrowser](https://github.com/filebrowser/filebrowser)) | Apache-2.0 | **Archived** (v2.63.23, 2026-07-27) | – | – | – | – |
| **Coder** ([coder/coder](https://github.com/coder/coder)) | AGPL-3.0 | Active | A whole workspace platform with its own users and workspace registry. That is the parallel store the architecture rules out. | – | – | – |

Why not `code serve-web` / the VS Code Server: its license forbids "provide the
software as a stand-alone offering or combine it with any of your applications
for others to use" and "host, share, publish, rent or lease the software"
([license §5](https://code.visualstudio.com/license/server)). Microsoft's FAQ
answers "No, hosting it as a service is not allowed"
([VS Code Server docs](https://code.visualstudio.com/docs/remote/vscode-server)).
For the same reason, the Microsoft Marketplace terms limit offerings to
"Visual Studio Products and Services", which is why both forks use Open VSX
([code-server FAQ](https://github.com/coder/code-server/blob/main/docs/FAQ.md)).
I did not run `serve-web`, because starting it requires accepting that license
on Jari's behalf. Its socket flag is from `code serve-web --help` of the
downloaded CLI.

**Where credible views differ: code-server vs openvscode-server.** The
code-server FAQ frames the difference as patches on a submodule versus direct
commits, with extra self-hosting features in code-server. The openvscode-server
camp's argument is minimal divergence from upstream (it keeps Microsoft's
webview CDN, no auth layer) and a smaller footprint. My measurement agrees on
footprint: about half the RSS, at a different VS Code version and from a single
sample with no language extensions, so treat it as indicative. The deciding
fact is maintenance. openvscode-server has had no release for eight months.
A VS Code fork that lags upstream also lags its
security fixes. code-server's patches also give exactly the operational knobs
the daemon needs: a socket with a fixed mode, socket activation, idle shutdown
and upload/download switches.

### How code-server would run per person

- The daemon starts it on demand when the person opens the editor. The
  process runs as the person, preferably as a `systemd-run --user` service like
  tmux (otherwise as a daemon child). Settings:
  - socket in a 0700 directory under `$XDG_RUNTIME_DIR/open-habitat/`;
  - `--auth none`; the socket's permissions and the daemon relay are the
    authentication;
  - `--disable-update-check --disable-telemetry --idle-timeout-seconds N`.
- Route: gateway → daemon socket → daemon relays to the code-server socket.
  The gateway cannot and should not dial a per-person socket other than the
  daemon's. Adding a second root-prepared socket per person would widen the
  broker's job.
- **Measured:** the backend kept the extension host and terminals alive after
  the browser closed. Memory is freed only by the idle timeout, so N is a real
  setting.
- Same files and same UID as Pi. The integrated terminal can `tmux attach` to
  the product's session, so the person sees the same shell in the editor and in
  the app. Not verified: code-server's IPC socket (its log showed
  `code-server-ipc.sock`) may let the daemon open `path:line` in the running
  window. That would let message links open in the editor.
- Phones: VS Code's workbench is a desktop UI. Monaco states "Is the editor
  supported in mobile browsers…? No." in its
  [README](https://github.com/microsoft/monaco-editor). This is why the
  file-link view should be the built-in one.

### The origin problem

VS Code for the web runs webviews (extension-supplied HTML: Markdown preview,
image preview, extension pages) in iframes on a separate origin. Matt Bierner,
the VS Code webview author, explains why: "This prevents iframe content from
accessing the state (cookies, local storage, service workers, etc.) of the main
VS Code client" ([blog](https://blog.mattbierner.com/vscode-webview-web-learnings/)).
Upstream now gives each webview its own `<uuid>.vscode-cdn.net` origin.
**Measured** in openvscode-server.

For Open Habitat the question is one level up: whether the whole editor can sit
on the app's origin. It cannot.

- code-server's webviews and service worker share the workbench origin
  (**measured**). On the app's origin, any script in a webview, an extension's
  web code or a workbench XSS could:
  - read `/auth/session`, which returns the CSRF token;
  - call every app API with the cookie;
  - mint a device link (`link.go`) and send it out. That turns a moment of
    script execution into a persistent session elsewhere: remote control of the
    person's Pi, and through Pi, a shell.
- The app would also need to loosen its CSP for VS Code (dynamic code,
  workers, `open-vsx.org`).

What a separate origin needs:

- **One editor host for everyone** (recommended start). Example:
  `open-habitat-test-code.example.test`, a first-level subdomain covered by
  Universal SSL. Cloudflare: "Universal SSL … covers only the root domain and
  first-level subdomains"
  ([limitations](https://developers.cloudflare.com/ssl/edge-certificates/universal-ssl/limitations/)).
  It needs one more DNS record, a tunnel ingress rule, and the name in the
  guest gateway's private-CA certificate; all three are Fleetrepo operator work.
- The gateway serves that host with its own **editor-scoped session**,
  established by a one-time hand-off minted from the app session (the
  device-link shape). That cookie grants only "relay to my daemon's editor".
- It is a sibling, same-site with the app. The app's `__Host-` cookie cannot be
  overwritten from there (cookie tossing). Requests from the editor host
  *would* carry the app's `SameSite=Lax` cookie, so the existing exact-Origin
  check on writes is what stops cross-host writes; it already exists. Reads
  stay protected by CORS. This all makes a sibling host acceptable.
- **Per-person hosts** (`<id>.code.open-habitat-test.example.test`) would
  separate service workers and storage when two people share one browser.
  Second-level names need Advanced Certificate Manager (Total TLS) or a custom
  certificate (same page). Cloudflare proxies wildcard DNS records on every
  plan
  ([wildcard records](https://developers.cloudflare.com/dns/manage-dns-records/reference/wildcard-dns-records/)),
  and cloudflared ingress accepts `*.example.com` but not a wildcard in the
  middle
  ([ingress config](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/configure-tunnels/local-management/configuration-file/)).
  This is not needed for a first slice.
- openvscode-server would additionally need a `{{uuid}}.` wildcard host to stop
  depending on `vscode-cdn.net`.
- Open the editor in a new tab rather than an iframe at first. This works on
  phones and avoids frame-policy work. The app must send
  `frame-ancestors 'none'` either way (see below).

### Zero-build options people already have, and what the product adds

- VS Code Remote-SSH, Zed remote development, JetBrains Gateway and SFTP all
  need SSH. Jari's direction is that the browser is the person's only route by
  default, and the test VM's firewall admits SSH only from alder. These are not
  options for an ordinary person unless SSH is opened as a product decision.
- VS Code Remote Tunnels becomes zero-build **once a browser shell exists**.
  The person runs `code tunnel` in their shell, signs in with their own
  GitHub/Microsoft account and uses vscode.dev or desktop VS Code. The license
  permits this because the person runs it for themselves, not us for them.
  Microsoft's relay sits in the path, and the server needs outbound access.
  Worth mentioning in the help text, not building on.
- What the product adds over all of these:
  - no SSH keys or ports;
  - the same sign-in as the conversation;
  - file links from the agent's messages land on the file;
  - a phone-friendly view;
  - a shell already sitting in the workspace's tmux session.

## Security analysis

**What a browser shell changes in the threat model.** The person gets nothing
new: Pi's bash tool (`internal/daemon/bash_failure_linux.go` observes its
results) already runs arbitrary commands as their UID. The Unix boundary stays
where it is, because the PTY and tmux run as the person under the same
`NoNewPrivileges` and quotas. An attacker holding a stolen session already
gets code execution by sending Pi a message; a shell makes it interactive and
faster. The changes are therefore about the browser path, not the account.

What the browser path needs:

1. **Origin check on the upgrade.** WebSockets are not subject to CORS, and
   browsers send cookies on the handshake. OWASP: "Validate the `Origin` header
   on every handshake… explicit allowlist"
   ([cheat sheet](https://cheatsheetseries.owasp.org/cheatsheets/WebSocket_Security_Cheat_Sheet.html);
   [RFC 6455 §10.2](https://datatracker.ietf.org/doc/html/rfc6455#section-10.2)).
   The gateway already requires an exact single `Origin` for writes; the
   upgrade route must do the same. Because browsers cannot set custom headers on
   a WebSocket, the CSRF token goes in `Sec-WebSocket-Protocol` or the first
   message. The daemon side refuses anything until it arrives.
2. **Ending live connections when the session ends.** Today the session is
   checked only when a request starts, and a running SSE stream continues after
   logout or administrator revocation. For a read stream that is a leak; for a
   shell it is a live write channel. The gateway should keep a per-session
   registry of upgraded connections and close them on logout, revocation, idle
   or absolute expiry. The tmux session itself keeps running, which is correct:
   it is the person's work. The existing gap is filed as
   `streams-outlive-revocation`.
3. **Framing.** No `frame-ancestors`/`X-Frame-Options` is sent anywhere
   (checked across `internal/` and `web/`). The `SameSite=Lax` cookie is not
   sent in cross-site frames. It *is* sent in same-site frames, and
   `glasspad.example.test` publishes arbitrary HTML on the same site as the test
   app, so a shell would make clickjacking from a sibling host matter more. Add
   `Content-Security-Policy: frame-ancestors 'none'` to the app, and `'self'`
   or the app's origin on the editor host if it is ever embedded.
4. **Recent re-authentication.** Credible practice differs here. GitHub's
   "sudo mode" and cloud consoles ask again before sensitive acts, and the
   gateway already uses a 5-minute recent-sign-in check for GitHub disconnect.
   But a stolen session can already execute code through Pi. Re-auth before a
   shell would add friction for the owner and no barrier for the thief. I
   recommend none for the shell. If anything, device-link minting is the act
   that turns a stolen session into a durable one and is the better place for
   a recent-sign-in check; that is outside this research.
5. **Idle timeouts.** A WebSocket idle timeout with pings closes dead
   connections. Browser sessions keep their 90-day idle limit. The shell's
   *process* is not timed out, by design, just as in SSH + tmux.
6. **Audit.** sshd logs session open and close, not keystrokes. Do the same:
   the daemon's JSONL diagnostics record `terminal_open/terminal_close`
   (component, event, outcome, user, workspace ID), never input or output. The
   existing rule already forbids user content in diagnostics.
7. **Public test server.** `admission:any` means any GitHub account gets an
   account, so it already gets Pi's bash. A shell lowers the effort, not the
   capability. Outbound abuse from the guest, such as scanning or mining, is
   the realistic risk, and the slice limits and egress policy are the
   operator's tools.
8. **Editor-specific.**
   - A separate origin with an editor-scoped session (above).
   - `--disable-file-downloads/uploads` are UX choices, not security, because
     the shell can move files anyway.
   - Extensions from Open VSX run with the person's UID; that is the person's
     choice, as on a desktop.
   - The editor host must never accept the app cookie as authority.

## Decisions this needs from Jari

1. **Gateway: WebSocket relay and a second (editor) host with editor-scoped
   sessions.** The gateway gains no access to homes. It still authenticates and
   picks the daemon, and it relays bytes. But it adds a new authenticated
   surface and a second cookie realm. Recommendation: yes.
2. **Broker: enable lingering (`loginctl enable-linger`) when it creates an
   account**, so tmux and the editor can run as `systemd-run --user` services
   that outlive daemon restarts. This is a new root act for the broker, whose
   current only service start is the daemon. Taskfleet spinoffs already need
   the same thing for every person. Recommendation: yes, as one decision for
   both. The alternative is accepting that shells and editors die on daemon
   restart or upgrade.
3. **Daemon: start and stop long-lived interactive services** (the tmux server,
   code-server) and relay to their sockets. It stores nothing: the tmux socket
   and code-server's own data directory are the truth. Recommendation: yes.
4. **Taskfleet's tmux sessions in the browser shell**: read-only attach, or not
   shown. This changes the "never writes to a spinoff" rule only if write
   attach were allowed. Recommendation: read-only attach.
5. **Always tmux** (create it if missing) rather than a bare shell when none
   exists. Recommendation: yes, for the survival reason above.
6. **No shell-specific re-authentication.** Recommendation: none; harden device
   linking instead (separate issue if wanted).
7. **`docs/product.md` scope**: move "laajemmat editori- ja työkalunäkymät"
   from out-of-scope into the product once the slices are accepted.

## Suggested first slice

**Slice 1: a workspace shell.**
- Daemon: an upgrade endpoint per workspace ID. Its first message carries the
  CSRF proof. It runs `tmux -S $XDG_RUNTIME_DIR/open-habitat/tmux.sock
  new-session -A -s <workspace-id> -c <workspace dir>` in a PTY with
  `SHELL=/bin/bash`, and handles resize messages.
  - With lingering, the tmux server is started via
    `systemd-run --user … tmux -D -S …`, as Taskfleet does.
  - Without lingering, it is a daemon child, and the snapshot reports "does not
    survive restart".
- Gateway: an upgrade relay route that checks session, exact Origin and
  per-session connection caps, and keeps a registry so logout, revocation and
  expiry close the relayed connections. The slice also adds
  `frame-ancestors 'none'` to the app and `terminal_open/close` diagnostics.
- Web: xterm.js with the fit and attach addons, plus an on-screen key row for
  phones (Ctrl, Esc, Tab, arrows), as the prototype decides.
- Contract: one new route in `contracts/v1/`.
- Proof: a VM test (`scripts/vm-test.sh`) as a nonroot mapped user that shows:
  - a cross-origin upgrade is refused;
  - logout closes the socket;
  - the shell survives browser reconnect;
  - with lingering, the shell survives a daemon restart.

**Slice 2: read-only file view and message links.** A daemon file-read API
(workspace ID + relative path; no symlink escape, no crossing filesystems, size
cap, text and images) rendered with CodeMirror 6. The daemon validates
candidate paths from messages, so only existing workspace paths become links,
as `proto-file-viewing` requires.

**Slice 3: code-server on the editor host.** A Fleetrepo operator adds the host
(DNS, ingress, certificate SAN). The gateway adds the editor-session hand-off.
The daemon starts code-server on demand with an idle stop and relays to it.

## Experiment log and limits

- **Measured on alder** (Linux x86_64, 8 cores), with a disposable `HOME` and
  `TMPDIR` under `/var/tmp`, all removed afterwards:
  - code-server 4.141.0 and openvscode-server 1.109.5, both on Unix sockets
    behind the stand-in relay;
  - ttyd 1.7.7 with tmux 3.6;
  - headless Chromium driven by Playwright; RSS/PSS from
    `/proc/<pid>/smaps_rollup` summed over each server's process tree;
  - workspace: a `git archive` of this repository.
- Memory figures are single samples with no language extensions. Per-person
  cost with Go/TypeScript extensions would be higher.
- **Not run:** `code serve-web`, which needs acceptance of Microsoft's server
  license; Theia; real Cloudflare paths. WebSocket over the tunnel is
  Cloudflare's documented behaviour, not tested here.
- **Not verified:** code-server opening `path:line` through its IPC socket from
  outside the editor; idle-timeout behaviour of code-server (flag documented,
  not timed).
- Another session's directory `/var/tmp/oh-shell-editor-research.DNkdwJ`
  (created before this run) was found and left untouched.

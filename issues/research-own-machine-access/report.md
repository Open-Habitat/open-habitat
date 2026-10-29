# Research: the agent reaches the person's own computer over Tailscale + SSH

Research date 2026-10-29, on Birch as `maintainer`. Jari decided on 29.10.
that a person's Habitat agent may reach that person's own computer, over
Tailscale + SSH, managed in the product UI (`research-ville-feedback`, item 1).
This report answers how that can be built. It does not reopen whether it should
be.

Method: a spike with the real `tailscaled` 1.104.2 (arm64) on Birch, run under
my own account only; reading Tailscale's source at tag `v1.104.2`; Fleetrepo
`tw`; the product's integrations and provisioning code; and primary
documentation (listed at the end). No tailnet was joined, no auth key was used,
and every process the spike started was stopped. Nothing was tried on a Mac or
Windows machine.

## 0. Answer in one paragraph

A per-person, unprivileged `tailscaled` in userspace-networking mode works:
it starts as an ordinary user and as a systemd *user* unit, keeps all its state
where it is told, opens no TCP port, and stops at a login URL the person can
open in the browser. Two of its defaults are unsafe on a multi-user host,
though, and the product has to override both. **First**, its LocalAPI socket is
created `0666` in a `0755` directory, and LocalAPI's `dial` endpoint (what
`tailscale nc` uses) does not require write permission. Any other Unix user
who can reach the socket can open connections into the person's tailnet. The
spike showed this with a second host UID. **Second**, in userspace mode,
connections that arrive *from* the tailnet at the node's address are forwarded
to `127.0.0.1:<port>` on the host. `--shields-up` stops that. With the
socket under `$XDG_RUNTIME_DIR` and shields up, the authority stays in the
person's UID, as the product's rules want. The SSH half is plain OpenSSH. A key
is generated in the account and the person installs its public half on their
machine with `restrict`, `from=` and `expiry-time=`. On a Mac this goes
through Remote Login, because the App Store Tailscale cannot be a Tailscale SSH
server. Two things no design here can change. The agent gets everything the
person's user on that machine can do. And root on the Habitat host can do the
same with the person's key. The UI must say both plainly.

## 1. Spike: unprivileged per-user `tailscaled`

### Setup

- Host: Birch (Ubuntu 24.04, arm64, kernel 6.8). The system `tailscale`
  1.104.2 package supplies the binaries; its root `tailscaled` was only read,
  never touched.
- Account: `maintainer` (uid 32000), no sudo used. Scratch in
  `/var/tmp/oh-research.sbayXr` (`0700`).
- Command: `tailscaled --tun=userspace-networking --socket=<dir>/ts.sock
  --statedir=<dir>/state --port=0 [--no-logs-no-support]`, always under
  `timeout`, then `systemd-run --user` with `RuntimeMaxSec=30`.
- A second host UID for the visibility test came from my subuid range:
  `podman unshare setpriv --reuid=1000` runs as host uid 166535, which is not
  the daemon's UID and is not root. No container image was pulled.

### What was observed

| Question | Observation |
| --- | --- |
| Starts without root? | Yes. Warnings only: no TPM, UDP buffer sizes not raised (`operation not permitted`, "impacts throughput only"), no tun ifIndex. `BackendState` is `NeedsLogin`. |
| Network changes on the host? | None. No interface, no route, no DNS change (`dns: using dns.noopManager`). |
| Listeners | Two UDP sockets on ephemeral ports (WireGuard/disco, `--port=0`) and the Unix socket. **No TCP listener.** No SOCKS5 or HTTP proxy unless asked for. |
| State | `--statedir` gets `tailscaled.state` `0600` and `dns-cache/` `0700`. |
| Files outside the state dir | Log policy writes `~/.local/share/tailscale/tailscaled.log.conf` (and, without `--no-logs-no-support`, log buffers) unless `TS_LOGS_DIR` points elsewhere. With `TS_LOGS_DIR=<statedir>` nothing landed outside it. |
| Socket mode | `srw-rw-rw-` (0666) in every run. When the parent directory did not exist, `tailscaled` created it `drwxr-xr-x` (0755). Source: `safesocket/unixsocket.go` (`MkdirAll(sockDir, 0755)`, `Chmod(path, 0666)` on platforms with peer credentials). |
| Login | `tailscale --socket=… up --hostname=… --json` returned `{"AuthURL": "https://login.tailscale.com/a/…", "QR": "data:image/png…", "BackendState": "NeedsLogin"}`. The spike stopped there; the URL was never opened. |
| As a systemd user unit | `systemd-run --user -p RuntimeDirectory=… -p RuntimeDirectoryMode=0700 -p NoNewPrivileges=yes …` ran `active (running)`. The socket was at `/run/user/32000/<unit dir>/ts.sock` in a `0700` directory, `tailscale status` answered "Logged out.", and stop removed the runtime directory. Specifiers such as `%t` are **not** expanded on a `systemd-run` command line (the first attempt created a literal `~/%t/`, removed afterwards); a unit file expands them. |
| Owner's rights | Same UID gets read and write: `ipn/ipnauth/ipnauth.go` `IsReadonlyConn` gives write to "non-root user matching daemon". `tailscale set --shields-up` succeeded. |
| Another UID, socket dir 0755 | `GET /localapi/v0/status` → **200**. `POST /localapi/v0/dial` (`Dial-Host: 100.100.100.123`, port 22) → **200** with `Dial-Self` (the logged-out node has no route, so it told the caller to dial directly). `tailscale set --shields-up` → `Access denied: checkprefs access denied`. |
| Another UID, socket dir 0700 | `connect: permission denied` for everything. |
| Process visibility | Birch mounts `/proc` with `hidepid=invisible`, so other users do not see the process or its command line. `ss` shows other users that the UDP sockets exist, without owner. |

### What the source adds

- **`dial` has no permission check.** `serveDial` in
  `ipn/localapi/localapi.go` checks neither `PermitRead` nor `PermitWrite`. Any
  connection that LocalAPI accepts, including a read-only one from another
  UID, may ask the daemon to `UserDial` a tailnet address. On a logged-in node,
  that is a TCP connection into the person's tailnet as their node. The spike
  reached the handler from another UID; it could not complete a tailnet dial
  without joining a tailnet. So the only boundary is whether another UID can
  `connect()` to the socket: the directory permissions, not Tailscale's
  read/write split.
- **Inbound connections reach host loopback.** `cmd/tailscaled/netstack.go`
  sets `ProcessLocalIPs = onlyNetstack`. In `wgengine/netstack/netstack.go`
  `acceptTCP`, a connection to the node's own Tailscale IP is rewritten to
  `127.0.0.1:<port>` and forwarded (`case isTailscaleIP: dialIP =
  ipv4Loopback`); UDP does the same (`backendRemoteAddr` at 127.0.0.1). On a
  multi-user host, any tailnet peer allowed to reach the Habitat node would
  reach every loopback listener of every Unix user. On Birch today that is
  only the resolver plus whatever an agent starts (a dev server, an OAuth
  loopback callback such as rclone's `localhost:53682` during a Dropbox login).
- **`--shields-up` blocks it before netstack.** The shields-up filter
  (`wgengine/filter.NewShieldsUpFilter`, set in `ipn/ipnlocal/local.go`) runs
  in `tstun.Wrapper.filterPacketInboundFromWireGuard` before
  `PostFilterPacketInboundFromWireGuard`, which is netstack's `injectInbound`.
  Only peerapi is let through, and `tailscaled` handles it itself (Taildrop
  and similar), so it does not reach loopback. Replies to the node's own
  outbound connections still pass.

### Verdict and limits

**Proven:** unprivileged per-user `tailscaled` starts, runs as a user unit, stays
inside the account when told where to write, stays out of the host network
configuration, and its LocalAPI is reachable only by the owner when its socket
directory is `0700`. **Refuted as safe by default:** the default socket and
directory modes, and the default inbound forwarding. **Not tested** (needs a
real tailnet): a completed login, `tailscale nc` as an SSH `ProxyCommand`,
key-expiry behaviour, shields-up against a live peer, and persistence across a
reboot. That last one relies on the state file plus systemd lingering. The
account has `Linger=yes`, and the broker may enable lingering for admitted
accounts.

### Incidental observation: Birch itself is on the tailnet host-wide

Birch runs the system `tailscaled` with a kernel `tailscale0` interface
(`100.120.102.17`, owner `jari.mustonen@`), and its LocalAPI socket is
`/var/run/tailscale/tailscaled.sock` `0666` in a `0755` directory. So every
Unix user on Birch, including Kaisa's Habitat account and every agent
running there, can route to Jari's tailnet peers through the kernel. They can
also `tailscale status` and `tailscale nc`. This is exactly the shape §2 warns
against for a Habitat host. It may be acceptable on a household machine Jari
owns, but nothing records that it was decided. It is Fleetrepo's configuration,
not product code (proposal S4).

## 2. Architecture

### Shape

```
person's browser ──► gateway ──► person's daemon (UID u)
                                   │  systemctl --user, LocalAPI over
                                   │  $XDG_RUNTIME_DIR/habitat-tailscale/ts.sock
                                   ▼
                     tailscaled (UID u, userspace, --shields-up, state in ~)
                                   │  WireGuard over UDP, no host interface
                                   ▼
                person's tailnet ──► person's machine: sshd (Remote Login)
                                   ▲
           agent (UID u): ssh <machine> … via ProxyCommand tailscale nc
```

### Authority split

| Component | What it does here | What it never does |
| --- | --- | --- |
| **Gateway** | Nothing new: relays the person's requests to their own daemon as it already does. The auth URL passes through like an integration's login URL. | Holds no tailnet credential, auth key or SSH key; never routes one person to another's tailnet; has no "machines" state. |
| **Daemon (UID u)** | Installs and starts the person's `tailscaled` user unit; reads and changes its state over LocalAPI as the same UID; relays the login URL; runs `ssh-keygen`; writes the person's SSH client config; shows the public key and a ready `authorized_keys` line; runs a verification `ssh … true`. | Keeps no machine registry or usage log of its own; never sends a private key, node key or state off the account; never opens a TCP listener for this. |
| **Broker (root)** | Nothing new. Lingering for admitted accounts already exists. | Does not start, inspect or configure `tailscaled`; does not widen the `sync-at-boot` signal to mean "tailnet". |
| **Host / operator** | Ships the `tailscale` and `tailscaled` binaries in a runtime profile (Tailscale's static tarballs exist for arm64 and amd64 at `pkgs.tailscale.com/stable/`, matching the artifact-lock rule for non-Ubuntu components). | Runs no system `tailscaled` for this feature; joins no Habitat host to any tailnet; holds no tailnet of its own or admin access to anyone's. |
| **Person's machine** | Holds the real controls: Remote Login on or off, the `authorized_keys` line, the tailnet device list and policy. | — |

### Native components reused, and the decision for each

- **`tailscaled` / `tailscale` (official static binaries).** Mode is
  `--tun=userspace-networking`, with `--socket=%t/habitat-tailscale/ts.sock`,
  `--statedir=%h/.local/state/habitat-tailscale` and `--port=0`. The
  environment sets `TS_LOGS_DIR` to the state dir. No `--socks5-server` and no
  `--outbound-http-proxy-listen`. Tailscale's own userspace page shows
  `--socks5-server=localhost:1055` as *the* way to use the mode. On a
  multi-user host that hands the person's tailnet to every local user, so the
  product must ignore that advice.
- **systemd user unit** (`~/.config/systemd/user/habitat-tailscale.service`,
  `RuntimeDirectory=habitat-tailscale`, `RuntimeDirectoryMode=0700`,
  `NoNewPrivileges=yes`, `Restart=on-failure`). It is better as a user unit
  than as a daemon child (the integrations `Supervisor`):
  - it outlives daemon restarts and upgrades, which by rule never stop a
    person's user units;
  - it starts at boot through lingering;
  - it needs no broker-visible signal.

  It is still the person's own unit, so the person or their agent can stop it
  with `systemctl --user`.
- **Tailscale's own login.** `tailscale up` / LocalAPI login gives an
  `AuthURL` (and a QR code). The person opens it, signs in to *their* tailnet
  with their identity provider, and approves. This matches the existing rule
  that provider consent belongs to the person through a browser URL, never
  through password automation. Auth keys are a fallback for tailnets that
  need tagging or pre-approval. A key arrives on stdin or as a file, never as
  argv; the person makes it one-off, never reusable.
- **OpenSSH client.** An `ed25519` key in `~/.ssh/habitat_<machine>`. A
  native config snippet in `~/.ssh/config.d/habitat-<machine>.conf` (included
  from `~/.ssh/config`) with `HostName <100.x>`,
  `ProxyCommand tailscale --socket=%d/… nc %h %p`, `IdentitiesOnly yes`,
  `BatchMode yes` and a `known_hosts` pin. That snippet is the list of
  machines: the product keeps no second list. `tw`'s warm `ControlMaster` is
  worth copying for speed; its `ControlPath` must also sit under
  `$XDG_RUNTIME_DIR`.
- **OpenSSH server on the person's machine.**
  - **macOS:** System Settings → General → Sharing → Remote Login, "Allow
    access for: Only these users" (their own), "Allow full disk access for
    remote users" **off**. Tailscale SSH is not an option with the App Store
    or Standalone app ("Can be a Tailscale SSH server: no"); only the
    open-source CLI variant can be one.
  - **Linux:** `sshd`, or Tailscale SSH if they already run it.
  - **Windows:** the OpenSSH Server optional feature. If the person's account
    is an administrator, Windows ignores `~/.ssh/authorized_keys` and reads
    `%programdata%\ssh\administrators_authorized_keys`, which must be
    ACL-restricted to SYSTEM and Administrators. The guide must branch on
    this, or the key silently will not work.
- **The `authorized_keys` line** the UI hands over:
  `restrict,from="<habitat node 100.x>",expiry-time="<YYYYMMDD>" ssh-ed25519 AAAA… habitat:<person>@<site>`.
  - `restrict` turns off port, agent and X11 forwarding, PTY and `~/.ssh/rc`,
    and any future restriction, while commands still run (`sshd(8)`).
  - `from=` binds the key to the node's tailnet address.
  - `expiry-time=` makes every grant end without anyone remembering it.

  A forced `command=` is **not** recommended for the first round. A useful
  allowlist would be a script of ours on the person's machine, which is the
  client this design avoids. A forced `/usr/bin/true` would make the grant
  useless.

### Which tailnet

- **Default: the person's own tailnet.** They log the Habitat node into it
  with the auth URL; there is nothing for us to administer. A personal tailnet
  usually has the default allow-all policy, so the Habitat node can reach all
  their devices and they can reach it. `--shields-up` covers the inbound
  direction locally. Outbound is limited only where an SSH server and a key
  meet: the `from=` line, and only on the machines the person enrols.
- **Stricter, for people who manage policy:** tag the node (`tag:habitat`) and
  grant it only `<machine>:22`. A tagged node's key expiry is off by default,
  so revocation becomes a deliberate act.
- **Node sharing** (share only the Mac into some other tailnet) is not a fit.
  The Habitat node would need a tailnet of its own, which someone would
  administer. A shared node is quarantined, and Habitat needs to *start*
  connections.
- **An organisation tailnet** (Northwind) works the same way, with the org's
  admin owning the policy. That is Northwind's configuration, not the product's.

## 3. What the person controls

The honest split is between controls that bind the agent and controls that
only bind the product.

| Control | Where | Binds the agent? |
| --- | --- | --- |
| Remote Login off / sshd stopped | Person's machine | **Yes** |
| Delete the `authorized_keys` line, or let `expiry-time` pass | Person's machine | **Yes** |
| Remove the Habitat node from the tailnet / policy denies it | Tailscale admin console | **Yes** |
| Quit Tailscale on the machine | Person's machine | **Yes** (while quit) |
| "Pause" in Habitat (stop the user unit) | Habitat | **No.** The agent runs as the same UID and can `systemctl --user start` it again, or use any other route. It stops ordinary use and says so. |
| "Remove" in Habitat (`tailscale logout`, delete key and config) | Habitat | Ends it for the product. The person still removes the `authorized_keys` line, because a copy of the key may already exist (see §5). |

So the UI should offer **Pause** and **Remove** on the Habitat side and say
what each one does *not* do, and walk the person to the machine-side revoke
as the real off switch. A default expiry (for example 30 days, renewable by
replacing the line) means a forgotten grant ends on its own.

## 4. What the agent sees

No new CLI is needed for the first round; plain `ssh <machine> -- …` covers
the `tw` verbs. A generated skill (like the personal-data skill) names the
machines from the SSH config and the commands per OS:

| `tw` verb | Over Remote Login on macOS | Notes |
| --- | --- | --- |
| `client-exec` | `ssh mac -- defaults read com.apple.HIToolbox` | The Ville case (dictation shortcut) is `defaults read` work and needs no extra permissions. |
| `fetch` | `ssh mac -- cat <path>` / `scp` | With full-disk access off, macOS privacy protection still guards Desktop, Documents, Mail and similar. |
| `clipboard copy` | `ssh mac -- pbcopy` | `tw` does this every day; it works while the person is logged in to the GUI. |
| screenshot | `ssh mac -- screencapture -x …` | Expected to need the Screen Recording permission for the SSH session and to give only the wallpaper without it. **Not verified**; check in the prototype on a real Mac. The browser `getDisplayMedia` single-frame action (`research-ville-feedback` §1) stays the better default. |
| `browser-open` | `ssh mac -- open <url>` | Opens on the person's screen; useful, and visible. |

Divergent view: a security reviewer would want Devin's model (Local Hands),
where every tool call on the person's machine asks *Allow once / Allow for
session / Deny*, and the connection ends when the session ends. That needs
our own client on the machine, which is the route Jari set aside. The plain
SSH route instead relies on a narrow grant (`from=`, `expiry`, one machine at
a time) and on telling the truth in the UI. A middle path is possible later
without a client: the agent asks in the conversation before using a machine
for the first time in a turn. But Pi's approval prompts are guardrails inside
the UID, not a boundary, so this would be courtesy rather than control.

## 5. What must never happen, and what cannot be prevented

Must never happen, and the design above prevents it:

1. **Another Unix user reaching the person's tunnel.**
   - The socket lives only under `$XDG_RUNTIME_DIR` (`0700`, the person's own
     `/run/user/<uid>`), never in a default or shared path.
   - No SOCKS5 or HTTP proxy port.
   - The `ControlMaster` socket also lives under the runtime directory.

   The spike shows why each point matters.
2. **Tailnet peers reaching the Habitat host's loopback.** `--shields-up` is
   always on. A person (or their agent) can turn it off with `tailscale set`.
   That re-exposes loopback, but loopback TCP is already no boundary between
   Unix users: any of them can relay it out today. So this is no new class of
   leak. Still, the product never turns it off, and a status read reports it.
3. **The host joining a tailnet.** No system `tailscaled` on a Habitat
   installation for this feature. Host apply could even assert that no
   product unit adds a TUN interface.
4. **An operator-held tailnet or Habitat-held tailnet credentials.** There is
   no tailnet of ours, no OAuth client and no reusable auth key.

Cannot be prevented: **root on the Habitat host can reach the person's
machine.**
- Root can read `~/.ssh/habitat_*` and the `tailscaled.state` node key, or
  simply run `ssh` as the person.
- `from=` does not help, because root's connections come from the same node.
- A FIDO/`sk-` key would need a touch on a device the server does not have.
- Encrypting the key at rest does not help either: the agent must use it
  unattended, so the passphrase would sit on the same disk.

What remains is to bound it and say it:
- the grant names one machine and has an expiry;
- Remote Login is limited to one user, without full-disk access;
- the UI and `docs/operations.md` state that the server's administrator can
  technically use the grant.

For Northwind that means Jari, as root of the pilot VM, could reach Ville's Mac
once Ville enrols it. That is the same exposure as his OpenAI credentials
there today, but on a more personal target.

## 6. UI surfaces the prototype round must cover

For `proto-own-machine-access`:

1. **Entry point.** Where "Oma kone" lives: settings integrations list (it
   behaves like an integration: login relayed, native store, one card) or its
   own settings section. One axis for the prototype.
2. **Connect to Tailscale.** States: not installed on this server (profile
   missing) / not connected / waiting for login (button that opens the auth
   URL, QR on phone) / connected as `<node name>` in `<tailnet>` / shields up
   confirmed. Copy explains that this is the person's own tailnet and the
   server joins only as their node.
3. **Add a machine** (per OS: macOS, Linux, Windows; Windows admin branch).
   - Steps: install Tailscale on the machine, turn on Remote Login with the
     right two settings, add one line. The line is ready to copy, or comes as
     a Terminal one-liner that appends it with correct permissions.
   - Then choose the machine from the tailnet's peer list (read from LocalAPI)
     and choose an expiry.
   - Verify: the daemon connects once and shows the host key fingerprint for
     the person to confirm; that pins `known_hosts`.
4. **The machine card.** Name, tailnet address, grant expiry date, connected /
   paused, what the agent can do (honest one-liner: "everything your user can
   do on this machine"), what the administrator can do.
5. **Pause / Remove / Renew**, each with what it does and does not do, and
   the machine-side revoke steps.
6. **In the conversation.** How the person sees that the agent used their
   machine:
   - Pi's tool rows already show the `ssh` command;
   - the prototype can try a machine chip on such a row, or a live
     "connected to <machine>" indicator from the `ControlMaster` socket's
     presence (native, no log of ours);
   - and what the agent says when a machine is unreachable (asleep, Tailscale
     quit, expired).
7. **Phone.** Mostly the connected/paused state and Pause; setup is a desktop
   task. Desktop and phone, light and dark, per the prototype method.

## 7. Comparison

| | Habitat route (this report) | `tw` seat channel | Devin Local Hands | VS Code Remote Tunnels |
| --- | --- | --- | --- | --- |
| Direction | Server agent → person's machine | Server → attached client | Cloud agent → machine via local client | Editor → remote machine |
| Transport | Person's tailnet, userspace node per Unix user | Jari's tailnet, host-wide | Client dials out | Microsoft relay |
| Auth | Key generated in the account, `authorized_keys` with limits | Jari's key in his machines' `authorized_keys` | Pairing code + per-call approval | GitHub/Microsoft login |
| Client on the machine | None (sshd) | None (sshd) | Devin client | VS Code server |
| Per-call approval | No | No | Yes (unless bypass) | n/a |
| Revoke | Machine-side line / expiry / tailnet | Remove key | Revoke / Ctrl+C / session end | Unregister tunnel |

`tw` is the model, with two differences that the multi-user host forces.
`tw` runs on a single-user server with a host-wide tailnet, which is fine
there. It finds the client from `SSH_CLIENT`; Habitat has no SSH client to
follow, so the person names machines explicitly.

## spinoff_proposals

Not filed; for the conductor and Jari.

- **S1: runtime profile `tailscale`.**
  - Ship the official static `tailscale`/`tailscaled` tarballs for arm64 and
    amd64 under an exact artifact lock with notices.
  - Add a profile test in a disposable Ubuntu container: start
    unprivileged, socket mode, no TCP listener, shields-up default.
  - Product; precondition for the feature.
- **S2: live spike with a disposable tailnet.**
  - Use a throwaway Tailscale account that Jari creates (no real tailnet) and
    a disposable sshd target, both on the test server.
  - Prove: the login URL flow end to end; `tailscale nc` as `ProxyCommand`;
    shields-up against a live inbound probe; another UID cannot `dial`;
    survival across a reboot; `expiry-time=` refusal.
  - Needs Jari to create the account.
- **S3: macOS verbs check on a real Mac.**
  - Run with Remote Login limited to one user and full-disk access off: does
    `defaults read`, `pbcopy`/`pbpaste`, `open` and `screencapture` work over
    SSH, and which TCC prompts appear?
  - Needs a Mac and Jari's consent (maple or a spare machine).
- **S4: Fleetrepo, Birch's host-wide tailnet.**
  - Decide whether Birch, which hosts Kaisa's and Jari's Habitat accounts,
    should stay a full tailnet node reachable by every Unix user on it.
  - Alternatives: tag and restrict it by policy; or move Jari's own tailnet
    use to his per-user node once S1 exists.
  - Fleetrepo repository, not this one.
- **S5: product, own-machine feature** after the prototype round chooses the
  surfaces:
  - the daemon side (user unit install, LocalAPI read, login relay, key and
    config writing, verification);
  - the generated skill;
  - `docs/operations.md` wording on the administrator's reach.

## Sources

Spike and code (read 2026-10-29):

- Tailscale v1.104.2 source, https://github.com/tailscale/tailscale/tree/v1.104.2:
  `safesocket/unixsocket.go`, `ipn/ipnauth/ipnauth.go` (`IsReadonlyConn`),
  `ipn/ipnserver/server.go` (`Permissions`), `ipn/localapi/localapi.go`
  (`serveDial`), `cmd/tailscaled/netstack.go`, `wgengine/netstack/netstack.go`
  (`acceptTCP`, UDP forwarding), `wgengine/filter/filter.go`
  (`NewShieldsUpFilter`), `net/tstun/wrap.go`, `ipn/ipnlocal/local.go`.
- Fleetrepo `software/tw/src/reverse.rs`, `client.rs` (ControlMaster, `SSH_CLIENT`).
- Open Habitat `internal/AGENTS.md`, `internal/daemon/integrations/supervisor_linux.go`,
  `internal/provision/bootsync_linux.go`, `runtime/profiles/AGENTS.md`,
  `issues/research-ville-feedback/report.md`.

Documentation:

- Tailscale, Userspace networking mode: https://tailscale.com/kb/1112/userspace-networking
- Tailscale, macOS variants (Tailscale SSH server: no for App Store and Standalone): https://tailscale.com/kb/1065/macos-variants
- Tailscale SSH and check mode: https://tailscale.com/kb/1193/tailscale-ssh
- Tailscale, Sharing (quarantine, revoke): https://tailscale.com/kb/1084/sharing
- Tailscale, Auth keys (one-off vs reusable): https://tailscale.com/kb/1085/auth-keys
- Tailscale, Tags (key expiry disabled on tagged devices): https://tailscale.com/kb/1068/tags
- Tailscale, Client preferences ("shields up"): https://tailscale.com/kb/1072/client-preferences
- Tailscale, Ephemeral nodes: https://tailscale.com/kb/1111/ephemeral-nodes
- Tailscale static packages: https://pkgs.tailscale.com/stable/
- OpenSSH `sshd(8)` AUTHORIZED_KEYS FILE FORMAT (`restrict`, `from=`, `expiry-time=`, `command=`), OpenSSH 9.6p1 man page on Birch; https://man.openbsd.org/sshd
- Apple, Allow a remote computer to access your Mac: https://support.apple.com/guide/mac-help/allow-a-remote-computer-to-access-your-mac-mchlp1066/mac
- Microsoft, OpenSSH Server configuration (`administrators_authorized_keys`): https://learn.microsoft.com/en-us/windows-server/administration/openssh/openssh-server-configuration
- Devin, Local Hands: https://docs.devin.ai/work-with-devin/local-hands
- VS Code Remote Tunnels: https://code.visualstudio.com/docs/remote/tunnels

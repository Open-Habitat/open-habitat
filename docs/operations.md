# Install and operate Open Habitat

This guide is for a Linux operator installing the **current** host on their own server. Open Habitat is not yet a turnkey package: the release includes the binary, web assets and neutral systemd/sysusers/tmpfiles templates, but **not** an installer for quota setup, broker state seeding, per-user socket ACLs, boot ordering, TLS or ingress. Do not enable public sign-in until those site-specific policies have been implemented and tested. The steps below distinguish shipped commands from work the installer must supply.

## Before installing

Provide a systemd Linux amd64 host with root access, a dedicated gateway Unix UID/GID, a **reserved, unoccupied** UID/GID range (1000–60000, at most 4096 slots) for first-login accounts, `/home` on a filesystem with **enforced user quotas**, and working `git`, `gh`, `getent`, `useradd`, `groupadd`, `setfacl` and `getfacl`. Reserve the range against all other account creators; check NSS, existing homes, groups and unit instances. The broker creates accounts under `/home` and applies per-UID quotas. Merely enabling quota *accounting* is insufficient. Verify enforcement on the filesystem actually containing `/home`, including a real disposable-UID EDQUOT check, before starting the broker. Quota setup differs by filesystem and can require offline maintenance; do not run filesystem conversion commands on a mounted root.

Supply a public HTTPS origin, certificate and key readable by the gateway but not ordinary users, and a GitHub OAuth application with callback `https://<your-origin>/auth/github/callback`. Choose a private listener/ingress arrangement and restrict its network exposure. Choose whom to admit: the broker defaults to a numeric GitHub-ID allowlist. `admission: "any"` permits every verified GitHub identity and is **not** an appropriate substitute for a private access policy. The operator must also supply the OAuth client ID and secret, gateway UID, UID pool, initial numeric subject IDs, default storage quota and a pinned Node/Pi installation. Do not put secrets in command arguments, shell history or the release tree.

## Install a release and site policy

On the **build** host, use a clean, committed, pushed source tree and build the Linux amd64 archive with `scripts/prepare-test-release.sh --version <semver> --output <new-private-directory>` (requires the matching clean-gate receipt by default). This is the repository's verified build-and-package path, **not** a remote installer. The `--ungated` option is for disposable test releases only. Alternatively, obtain a release archive and its `.sha256` sidecar from a trusted release channel. Verify both before extraction with `scripts/verify-release.sh --archive <archive> --json` from the matching source checkout; compare its source/version approval with the embedded `bin/open-habitat --json version`. The archive contains `bin/`, `web/`, `systemd/`, `sysusers.d/`, `tmpfiles.d/` and `MANIFEST.sha256`, not an installed Node/Pi runtime.

The `.sha256` sidecar and `MANIFEST.sha256` establish **integrity, not authenticity**: an attacker who replaces the archive can replace both. Establish the archive's provenance through your independently trusted release channel before running its binary or extracting it as root. A public key downloaded alongside an archive is not independently trusted. The current package script does not produce a signed, qualified Node/Pi/tool closure; a checksum-only package must not be treated as an approved installation generation.

As root, extract verified bytes into a new, root-owned, non-user-writable immutable directory under `/opt/open-habitat/releases/`; use `tar --no-same-owner` if extracting an archive transferred from another host. Select it with `/opt/open-habitat/current`, a symlink to that release. The supplied units expect an executable at `/opt/open-habitat/current/open-habitat`: either provide a root-owned relative symlink `open-habitat -> bin/open-habitat` inside each release or adapt and re-review the units. Keep the web path in the gateway config aligned with the selected release. Never extract or switch an unverified archive in place of a running release.

Install the release's `systemd/open-habitat-*` units under `/etc/systemd/system/` and review any local drop-ins; reload systemd with `systemctl daemon-reload`. `sysusers.d/open-habitat.conf` declares the gateway account without a fixed UID: if using `systemd-sysusers`, record the allocated UID/GID and put them in the broker and gateway configs. If allocating a fixed UID instead, do not apply the dynamic template as well. `tmpfiles.d/open-habitat.conf` creates only the base state and runtime directories. **Neither template installs the boot-time ACL/quota gate or initializes the broker ledger.**

### Hide other users' processes (Ubuntu 24.04)

Install `systemd/polkit.service.d/open-habitat-proc.conf` and
`systemd/systemd-logind.service.d/open-habitat-proc.conf` into the corresponding
`/etc/systemd/system/<name>.service.d/` directories, retaining other site
policy. Apply `sysusers.d/open-habitat.conf` before starting the new
`open-habitat-proc.service`: its dedicated `open-habitat-proc` group has **no
ordinary members**. The service resolves that group's numeric GID and remounts
the host's `/proc` with `hidepid=invisible` (Linux `hidepid=2`) and `gid=`.
Enable it with `systemctl enable open-habitat-proc.service` for boot, then
`systemctl daemon-reload` and `systemctl start open-habitat-proc.service`.
Do not run it in a private mount namespace: hiding processes only inside the
gateway or daemon leaves SSH and browser shells able to read foreign argv.

The two drop-ins give only logind and polkitd the exempt supplementary group.
Ubuntu 24.04's logind runs as root but its capability bounding set omits
`CAP_SYS_PTRACE`; root alone is not a reliable hidepid exemption. Polkitd runs
as `polkitd` and needs foreign process start times and UIDs to validate D-Bus
subjects. Apply these drop-ins to **running** services with a planned restart
before exposing multi-user login (a logind restart affects sessions; arrange
this as installation maintenance). The host drop-ins only want/order the
policy; stopping or restarting the proc oneshot must not stop logind or polkit. When removing this installation, remove
both host-service drop-ins and run `systemctl daemon-reload` **before** removing
the exemption group: an unresolved `SupplementaryGroups=` name prevents those
services from starting (systemd `216/GROUP`). No Open Habitat service belongs
in the exempt group: the gateway proxies sockets and does not inspect foreign procfs;
the broker's root account work uses NSS, files and systemd; each daemon scans
only its own UID for Pi writers and trash busy-checks. Do not exempt people,
the gateway, per-user services, or a shared administrative group. Review any
other host agents that need process visibility individually.

The product services require the proc policy service, so a failed remount
blocks their startup. A successful oneshot is not a continuous drift monitor:
remove conflicting fstab/remount policies and verify the **effective** mount
with `findmnt -no OPTIONS /proc` after installation and reboot. Verify the
effective logind/polkit drop-ins and their running supplementary groups against
`getent group open-habitat-proc`; restart services that predate the policy.
Before admission, as two real distinct users, require `ps -e -o uid,pid,args`
and direct `/proc/<other-pid>/cmdline` and `stat` reads to hide the other user,
while own processes, the process tray, Taskfleet and trash busy-check still
work. Verify a polkit authorization for a real process subject and logind
session/linger operations. The synthetic check is
`scripts/test-proc-hidepid-uids.sh`; it does not replace boot/session verification
on the installed host. Keep `/proc` and this policy host-wide, including native
SSH sessions and user-manager services.

Prepare these authority-separated locations before activation:

| Location | Owner / role |
| --- | --- |
| `/etc/open-habitat/gateway.json` | Root-owned config, gateway-readable; restrict its parent to root + gateway. Contains OAuth secret, TLS and asset paths. |
| `/etc/open-habitat-daemon/daemon/user-mappings/` | Root-owned, searchable binding parents; the broker writes individual root:per-user-group `daemon-<username>.json` files. Do not put gateway secrets here. |
| `/var/lib/open-habitat/broker/` | Root-only `0700` ledger and `broker.json`, regular single-link `0600` files. Never hand-edit an active ledger. |
| `/var/lib/open-habitat-gateway/` | Gateway-owned `0700` session and administrator state; systemd's `StateDirectory` creates it. |
| `/opt/open-habitat/pi-runtime.json` | Root-owned installation-wide selector, readable by mapped users; separate from user bindings. |
| `/run/open-habitat/` | Temporary socket tree; must be restored and checked after **every boot**. |
| `/home/<username>/` | Individual user's workspaces under `src/`, native Pi history/config and credentials. Preserve UID/GID on restore. |

The gateway config uses the following shape (substitute real paths and a **numeric** gateway UID; write it with protected ownership and permissions, not via a world-readable here-document):

```json
{
  "component": "gateway",
  "listen": "127.0.0.1:8443",
  "static_dir": "/opt/open-habitat/current/web",
  "gateway_uid": 12345,
  "tls_cert": "/etc/open-habitat/tls/fullchain.pem",
  "tls_key": "/etc/open-habitat/tls/key.pem",
  "oauth": {
    "client_id": "<github-oauth-client-id>",
    "client_secret": "<secret-from-secure-input>",
    "origin": "https://<your-origin>",
    "callback_url": "https://<your-origin>/auth/github/callback",
    "identities": []
  }
}
```

The gateway must be able to read the TLS files; the authenticated config is root-owned with non-writable root-owned ancestors. An OAuth gateway requires the root-only `open-habitat-revoke.socket` (the administration CLI also uses it). `broker.json` is fixed at `/var/lib/open-habitat/broker/broker.json`; it takes `version:1`, `gateway_uid`, `gateway_gid`, `uid_min`, `uid_max`, `state_dir:"/var/lib/open-habitat/broker"`, optionally `admission:"allowlist"` (the default). Seed `allowlist.json` (`version:1`, `epoch:1`, `ids:[{"id":"<numeric-GitHub-ID>"}]`), `bindings.json` (`version:1`, `generation:1`, `bindings:[]`) and `head.json` (`version:1`, `epoch:1`, `generation:1`) as one root-only **initialization transaction**. Implement durable creation, collision checks, a persistent high-water record and recovery rules before allowing first login: copying these example JSON objects into a live/partially initialized directory is not a safe initializer. The product has no general-purpose seed/repair CLI. Subsequent bindings and admission changes move counters forward; never reset them to 1.

Pin Node **v22.21.1** and `@earendil-works/pi-coding-agent` **1.3.0** in a root-owned non-writable tree readable by mapped users, with `bin/node`, `node_modules/@earendil-works/pi-coding-agent/dist/index.js` and its `package.json`. Write `/opt/open-habitat/pi-runtime.json` with absolute `node`, `entry`, `manifest` paths to these files. The daemon checks both versions and the entire runtime tree; putting Pi on `$PATH` alone will not work. Install `gh` and `git` so they can run as each user. Pi and gh authentication remain each user's own native credentials. Pin the complete transitive Pi/npm/native dependency tree at release build time, not with `npx` or a download at login. Qualify it using the production daemon's startup validator as each mapped UID with only that person's HOME and the declared PATH; a root `--version` check is insufficient. The required Pi version is **1.3.0**, not the earlier 0.85.1. No release-qualified closure is supplied by the manual instructions here.

Treat pinned git/gh/tmux and account/ACL/quota **tool packages** separately from the supported OS platform's security updates. An installed tool-package version different from the qualified release lock is `runtime_package_drift` and blocks convergence until a new qualified lock covers it. Do not downgrade a customer's security update, add apt holds, or weaken the lock to a minimum version to make a check pass.

Install `tmux` 3.2 or newer for the browser shell. Each person's daemon runs their shells as tmux sessions on a product-owned tmux server. When the account lingers (`/var/lib/systemd/linger/<user>`) and its user manager is running, the daemon starts that server with `systemd-run --user` as `open-habitat-tmux.service`, under `/run/user/<uid>/open-habitat/`, and shells survive daemon restarts and upgrades. Otherwise the server is the daemon's own child in its private `/tmp`, and shells end when the daemon stops; the browser says so. The daemon stores nothing about shells. What people run in a shell is limited only by the account's own limits: set `MemoryMax=`, `TasksMax=` and `CPUWeight=` on `user-<uid>.slice` and on the daemon unit if the host needs them.

The workspace editor is optional and needs three things. First, a same-site per-person hostname namespace: for `app.example.org`, set `oauth.editor_origin` to `https://oh-code-*.example.org`. The single `*` is substituted with a deterministic 52-character lowercase identity hash. It must occur inside the leftmost DNS label; that expanded label must fit 63 characters. HTTPS DNS names only, without ports, paths, credentials, queries or fragments. The browser frames the editor beside the conversation, and its session cookie reaches the frame only when app and editor share the registrable domain.

Reserve this namespace for the gateway. Supply wildcard DNS and tunnel/ingress routing to the same gateway listener, preserving the browser's Host header, and a public-edge certificate covering the resulting hosts. This single-label form works with Cloudflare Universal SSL's `*.example.org` coverage. A zone-wide wildcard route also sends unrelated names to the gateway: only the exact configured app host serves the app, only identity-bound child hosts accept editor sessions, and other hosts are rejected (health/readiness probes remain available). Do not delegate editor child names or serve unrelated content on them. Apply the same access policy and trusted ingress-header handling to every child host. For a TLS origin hop, retain certificate verification with an explicit verified origin TLS server name and CA, or provide a certificate covering the child hosts.

Alternatively, `https://code.example.org` reserves deep children `<id>.code.example.org`. This costs an additional wildcard certificate for `*.code.example.org`; Cloudflare Universal SSL does **not** cover it (use Advanced Certificate Manager or an appropriate custom edge certificate). Route and secure those children as above. The base host itself never accepts editor sessions. A previous single-host configuration therefore fails closed at that host without breaking the app; changing DNS alone does not make a shared editor host safe. Without `editor_origin` no editor is offered. Never serve the editor on the app's own host: code-server runs extension and webview code on its origin.

Second, a pinned code-server release (4.141.0 is the verified one) unpacked into a root-owned, non-user-writable tree, and `/opt/open-habitat/editor.json` with `{"code_server": "<tree>/bin/code-server"}` and optionally `"idle_timeout_seconds"` (default 1800), root-owned like `pi-runtime.json`. Third, nothing else: the daemon writes Open Habitat's small built-in VS Code extension (it opens conversation file links at their line) next to code-server's own built-in extensions in a private per-person directory at each start, so no extension is installed into code-server or any home. The daemon starts code-server as the person on first use, on a `0600` socket with authentication off (the socket and the daemon relay are the authentication), as `open-habitat-editor.service` with `systemd-run --user` when the account lingers and otherwise as its own child; code-server stops itself when idle. Its settings, extensions and workbench state are code-server's own, under `~/.local/share/code-server/`; the host stores nothing else about the editor. Each editor process costs roughly 150 MiB idle and 0.5–0.8 GiB with a folder, a file and a terminal open, so budget memory per active person.

## Optional Dropbox integration

Create a **Scoped access → Full Dropbox** application in the Dropbox App
Console. Enable these permissions before connecting accounts:
`account_info.read`, `files.metadata.read`, `files.metadata.write`,
`files.content.read`, `files.content.write`, `sharing.read`, `sharing.write`.
Register exactly `http://localhost:53682/` as an OAuth2 redirect URI. This is an
authorization-code flow with PKCE and offline refresh tokens, **not** device
flow or implicit grant. No listener, public callback, gateway OAuth secret or
inbound firewall opening is needed: the person pastes the final loopback URL
from their browser into the integration dialog. In development mode, enable
additional users in the App Console so testers other than the app owner can
authorize it; obtain production approval before exceeding Dropbox's development
limits.

Install and pin **rclone v1.71.2**, including its bisync command, in a root-owned
non-user-writable tree (for example
`/opt/open-habitat/tools/rclone-v1.71.2/rclone`). The distro's old 1.60 release
is not sufficient. Merge the following into
`/opt/open-habitat/integrations.json`, preserving other tool entries:

```json
{
  "tools": {"rclone": "/opt/open-habitat/tools/rclone-v1.71.2/rclone"},
  "dropbox": {"client_id": "<Dropbox app key>", "client_secret": "<Dropbox app secret>"}
}
```

The file and its ancestors must be root-owned and not writable by users; make
it readable by the mapped users (for example `root:root 0644`). These are the
installation's app credentials, not a person's tokens. Keep actual values out
of git and shell arguments. No person's connection is configured by the
operator: each person authorizes Dropbox in Settings → Integrations. Without
the executable and app settings, Dropbox is unavailable on this server.

Verify a real account's consent, initial quota-checked sync, local edit upload,
cloud edit download and reconnect after a daemon restart before relying on it.
The initial choice covers the **whole Dropbox**, not selected subfolders. Its
files live under `~/cloud/dropbox/<lowercase-email>/`. The first import can take
minutes or hours; the dialog stays open while it runs and can cancel it.
Other integration writes are refused while the initial import is busy rather
than queued to execute after a browser timeout. Normal bisync passes run about a
minute apart and never automatically resync after loss of native state. If a
mass-deletion or listing safeguard stops sync, inspect both sides before an
explicit recovery; do not add `--force` or automatically reinitialize. The
native-default 50% deletion safeguard is retained. The current page reports
restarts, not the specific native block; an operator may need to resolve it
using rclone as the person after inspecting both copies. On
reconnection, differing local files replaced during the initial cloud-preferred
union are backed up under `~/.local/share/rclone/dropbox-backups/<account>/`.
Removing a connection keeps local files unless the person chooses Trash, and
does not revoke the app grant at Dropbox.

## Optional Google integration

Install **gog v0.39.1** and **rclone v1.71.2** in root-owned,
non-user-writable trees readable/executable by mapped users. Make the same
pinned gog executable available to agents (for example a root-owned
`/usr/local/bin/gog` symlink); the generated skill also names its configured
absolute path. Merge these exact keys into `/opt/open-habitat/integrations.json`
without replacing existing tool or Dropbox settings:

```json
{
  "tools": {
    "gog": "/opt/open-habitat/tools/gog-v0.39.1/gog",
    "rclone": "/opt/open-habitat/tools/rclone-v1.71.2/rclone"
  },
  "google": {
    "client_id": "<installed Google OAuth client ID>",
    "client_secret": "<installed Google OAuth client secret>"
  }
}
```

Apply the same ownership and readability rules as the Dropbox configuration.
Use an **installed/Desktop** OAuth client, with redirect `http://localhost`
(no port). Enable Drive API, Gmail API, Google Calendar API and People API in
its Google Cloud project. The requested permissions are `openid`, `email`,
`https://www.googleapis.com/auth/drive`,
`https://www.googleapis.com/auth/gmail.modify`,
`https://www.googleapis.com/auth/calendar`, and
`https://www.googleapis.com/auth/contacts`. No Gmail settings/sharing or
Workspace domain-wide delegation is requested. Configure the consent screen
and add every tester (including additional accounts) while the app is in
Testing. Testing-mode refresh tokens for these scopes expire after seven days;
production needs Google's applicable app verification/approval, not a host-side
workaround. Partial consent is rejected. No incoming port, shared localhost
listener, public callback or gateway credential handling is involved.

Each person connects their own accounts in Settings → Integrations. Ordinary
**My Drive files** sync to `~/cloud/google-drive/<lowercase-email>/`; the first
choice imports the whole My Drive file tree, subject to the home quota. Shared
Drives are not selected. Google-native documents and shortcuts are deliberately
excluded from filesystem sync: exported Office copies are not editable native
Google documents, and shortcut aliases are not independent files. Agents use
`gog drive` online for those documents, and gog for Gmail, Calendar and Contacts.
The personal-data skill supplies the account, executable, native home and
file-keyring environment. Its fixed file-keyring password is not a secret:
Unix home permissions protect tokens, just as they protect rclone's token
files. No desktop keyring service or additional operator password is needed.

Both tools keep their own refresh token in the person's home, and refresh
independently. Normal sync runs about a minute apart; all Dropbox bisync
safeguards and explicit initial-union/recovery rules above apply to Drive too.
Initial local conflicts are backed up under
`~/.local/share/rclone/google-backups/<account>/`. Removing an account removes
both tools' native tokens; local files remain unless Trash is selected. Removal
does not revoke Google's app grant; that is available in the person's Google
Account security settings. A failed renewal can leave an existing account in
need of another renewal; no automatic write retries are made.

Before relying on a live account, verify browser consent, initial sync,
local-file upload, cloud-file download, daemon restart, all three gog services,
a second account and removal. Synthetic tests do not establish provider consent
or live synchronization. Keep the test installation's actual app values in its
operator secret management, never in this repository or command arguments.

## Agent command search path

Users install optional agent executables in their own `~/.local/bin`. The administrator installs shared tools in `/usr/local/bin` and verifies that `/usr/local` and `/usr/local/bin` are root-owned and not writable by any mapped user or group (for example, `stat -c '%U:%G %a' /usr/local /usr/local/bin` should show `root:root 755` for both). Debian installations may default to group-writable `root:staff 2775`; restrict that access before mapping users. Review provenance and updates because shared programs run with each invoking user's credentials. Browser-started Pi and its children search `$HOME/.local/bin:/usr/local/bin:/usr/bin:/bin`, with the account's own directory taking precedence. The daemon takes HOME from its verified Unix account binding, not browser input. Configure each user's SSH login shell to use the same ordering if it does not already; systemd does not source shell profiles. Host-managed `gh` and `git` actions still use fixed `/usr/bin` executables and restricted environments, never a user's override. The separately pinned Pi runtime does not come from this PATH.

Before any broker/daemon socket starts, arrange a boot-time, root-owned policy that restores and verifies `/run/open-habitat` (`root:gateway 0750`) and `/run/open-habitat/users` (`root:gateway 0710`), and prepares **each** per-user socket directory root-owned with search access only for its mapped UID and gateway. Add a per-instance pre-start check against the committed broker binding and its ACL. `DirectoryMode=0710` in the shipped daemon socket is only a fallback, not this policy. Order broker activation after quota enforcement and runtime-directory preparation, including after reboot; after proving that boot ordering, use `systemctl enable open-habitat-broker.socket open-habitat-broker.service` so the latter restores bound users' sockets at boot. Leave individual daemon sockets under broker control. Restore and preflight
both `open-habitat-daemon@<name>.socket` and `open-habitat-agent@<name>.socket`
for every admitted account: `daemon.sock` stays owner:gateway 0660, while
`agent.sock` is owner:owner 0600 in the same root-owned, non-owner-writable
parent. Both units must be active before starting the daemon service, whichever
listener triggers it; both named descriptors (`daemon` and `agent`) are required.
The agent unit explicitly targets `open-habitat-daemon@<name>.service`.
A deployment restoring only the old socket cannot start this release's daemon.
Verify a cold request on each listener, including the first queued request,
after boot and after an upgrade. Run `open-habitat agent environment show --json`
as the mapped user to prove native quota reads under the installed confinement;
`quota.state: unavailable` is not evidence of working quota observation. If these local gates do not exist yet, **stop here**: installing the templates alone cannot establish multi-user isolation.

## Start and prove first use

Once quota, state, ACL and boot ordering have passed on this host, start the broker socket and service, then the root-only revoke socket and gateway:

```sh
systemctl start open-habitat-broker.socket open-habitat-broker.service
systemctl start open-habitat-revoke.socket open-habitat-gateway.service
systemctl status open-habitat-broker.service open-habitat-gateway.service
/opt/open-habitat/current/open-habitat --json version
/opt/open-habitat/current/open-habitat admin settings update --default-limit-bytes 8589934592 --json
/opt/open-habitat/current/open-habitat admin settings show --json
```

Choose the quota in bytes for your site (the example is 8 GiB; valid limits are 1 MiB–1 PiB in 1024-byte steps). Set a **nonzero** default before sign-in: provisioning applies it before binding a new user. `admin` commands require root and the running gateway control socket. Optionally set the displayed name with `admin settings update --name <name> --json`. Check `curl --fail --cacert <trusted-ca.pem> https://<your-origin>/healthz` through the real ingress with certificate validation, then test GitHub sign-in with an admitted identity; inspect its created Unix account, quota, home and daemon socket and try a workspace and Pi authorization as that user. A redirect from `/auth/github/start` does not prove callback, browser sign-in or Pi model access. After that first binding, use `admin users list --json` to find the **numeric GitHub subject**, and as root grant the browser administrator role with `admin role update <subject> --administrator true --json`; granting a role never admits or creates an account. Run a two-user isolation check before offering the service to multiple people.

`/healthz` shows a responding service, not a fully functional installation. `/readyz`, `admin readiness show` and `doctor --component gateway|daemon --json` do not prove provider access, quota enforcement or user isolation. Do not treat their foundation responses as deployment approval.

## Daily operation and recovery

- **Version and upgrade:** run `/opt/open-habitat/current/open-habitat --json version` and `readlink -f /opt/open-habitat/current` to identify binary provenance and selected release. Verify the new archive and its embedded commit, install to a fresh immutable directory, preflight configs, selector, quotas and effective units, then switch the `current` symlink and restart the gateway. Restart per-user daemon services deliberately to adopt the new binary or Pi runtime; a gateway restart does **not** stop daemon-owned Pi processes, but a daemon restart/stop **does** interrupt active turns (systemd kills the service cgroup). Native histories survive. A binary update is not necessarily in effect for daemons still running the old executable. Do not assume `maintenance enter` drains requests: it only writes a marker and services do not consult it. Do not replay a partially failed install/switch without inspecting actual selected bytes and service state.
- **Logs and failures:** `journalctl -u open-habitat-gateway.service -u open-habitat-broker.service --since today` and `journalctl -u 'open-habitat-daemon@<username>.service' --since today` read classified JSONL stderr diagnostics. Mutating, failed and slow (≥250 ms) requests appear as `http_request` records; `slow: true` marks those over 1 s, and a gateway and daemon record with the same `request_id` belong to one browser request (for example `journalctl -u open-habitat-gateway.service -u 'open-habitat-daemon@*' -o cat | grep '"request_id":"<id>"'`). Restrict journal access and retention. For failures, inspect `systemctl status` of the corresponding socket/service, `journalctl`, socket owner/mode and parent ACLs, quota enforcement and free space, config owner/parent paths, OAuth callback/HTTPS and pinned Pi selector. Broker startup refuses pending or drifted ledger/account/ACL/quota state; investigate it rather than deleting state or blindly restarting. A broken administrator state stops gateway startup; invalid session state may discard sessions and require login. Login records are not joined across services, and the system does not provide an audit log.
- **Backups:** back up `/home` with ownership, ACLs and user credentials protected; `/var/lib/open-habitat/broker` as **one consistent snapshot** including its monotonic head and an independently retained high-water record; `/var/lib/open-habitat-gateway`; the protected gateway configuration/TLS secrets; the UID-pool and quota/boot policy; and the selected release and Pi runtime provenance. Keep backup keys separate from the server. Do not back up `/run` as persistent authority. Test a restore offline and reestablish UID/GID, quotas, ACLs and socket activation before reopening ingress. A stale broker ledger can reassign another person's UID: if the snapshot's high-water cannot be proved current, do not restore it onto a host with newer identities. There is no supported one-command recovery, deprovision or rollback operator for arbitrary installations. Lost session state requires new browser login; lost native home/history or credentials cannot be recreated from the release archive.

Local automation should encode and verify the site's missing boot, account-policy and release-switch steps rather than treating these examples as a production-ready installer.

## Optional Microsoft integration

Use a **public client** Entra app supporting work/school tenants **and personal
Microsoft accounts**, with device-code flow enabled. For the shared app use
`common`, not the operator's home tenant ID, as the login audience. The native
redirect registration is
`https://login.microsoftonline.com/common/oauth2/nativeclient`. Grant delegated
Graph permissions `User.Read`, `offline_access`, `Files.ReadWrite.All`,
`Sites.ReadWrite.All`, `Mail.ReadWrite`, `Mail.Send`, `Calendars.ReadWrite`, and
`Contacts.ReadWrite`. No client secret is used. Home-tenant admin consent does
**not** approve the app in other organisations.

Install root-owned, non-user-writable **rclone v1.71.2** and
**@softeria/ms-365-mcp-server 0.170.1** (Softeria), with its locked Node runtime
and dependencies. Give each an absolute executable wrapper that works with only
`HOME`, `PATH=/usr/bin:/bin`, and the catalog's `MS365_MCP_*` environment. In
particular, a wrapper must use the pinned Node executable, not `npx` downloading
packages at login. Also expose the installation's pinned **Pi 1.3.0** executable
wrapper for native `pi mcp add/remove`; it must run with the person's `HOME`.
The product uses the **rclone fallback** for files; **abraunegg/onedrive is not
invoked and need not be installed** (the feasibility version was 2.5.11).

Merge, rather than replace, these keys in the trusted operator file:

```json
{
  "tools": {
    "rclone": "/opt/open-habitat/tools/rclone-v1.71.2/rclone",
    "ms-365-mcp-server": "/opt/open-habitat/tools/ms-365-mcp-server-0.170.1/run",
    "pi": "/opt/open-habitat/tools/pi-1.3.0/run"
  },
  "microsoft": {
    "client_id": "<public Entra application client ID>",
    "tenant_id": "common"
  }
}
```

Paths are examples; use the actual pinned installation paths. Apply the same
root ownership and readability rules as the other integration settings.
Deploy a Microsoft-capable binary **before** publishing the `microsoft` key to
older daemons: older strict config readers reject unknown sections. Keep
existing Google, Dropbox and IMAP settings. The product never reads Fleetrepo's
SOPS file. Supply the existing public app ID from the operator's secret
management; the home tenant ID is not the audience for a multi-tenant app.

The page shows **two successive device codes**: first OneDrive/SharePoint,
then Outlook mail/calendar/contacts. Finish both as the same account. The second
code replaces the first; do not reuse the first code. Each tool obtains its own
refresh token. Personal OneDrive accounts use the native `consumers` refresh
authority after initial `common` discovery; work accounts retain the configured
audience. The MCP cache is private to that account, uses the native
headless file-encryption backend, and is pinned by username. Pi's own
`~/.pi/agent/mcp.json` holds the server entry; no host connection registry exists.
New agent conversations discover it and the generated personal-data skill;
existing conversations may need a reload.

For a consent-required failure the page shows an administrator link plainly.
Send it to an administrator **of the connecting person's tenant**, not merely
the operator's home tenant. The administrator must select that tenant when
using the organisations endpoint. The equivalent link is:

```text
https://login.microsoftonline.com/organizations/v2.0/adminconsent?client_id=<APP_CLIENT_ID>&redirect_uri=https%3A%2F%2Flogin.microsoftonline.com%2Fcommon%2Foauth2%2Fnativeclient&scope=User.Read%20offline_access%20Files.ReadWrite.All%20Sites.ReadWrite.All%20Mail.ReadWrite%20Mail.Send%20Calendars.ReadWrite%20Contacts.ReadWrite
```

A Conditional Access policy blocking device code is a different failure; an
administrator must decide whether that flow is allowed. Do not bypass policy.

Folder choice selects whole OneDrive roots and whole document libraries from
**followed SharePoint sites**, not every site in the tenant or individual
subfolders. Follow the desired site in Microsoft first, then reconnect to
rediscover libraries. Re-login offers folder choice again, with the current
selection preselected; keeping a healthy pair does not reinitialize its bisync
listings. Deselecting stops that pair without removing local files. Existing
local roots stay stable when a cloud site/library is renamed. Discovery refuses truncated lists rather than silently
omitting libraries. OneDrive syncs under `~/cloud/onedrive/<account>/`;
SharePoint under `~/cloud/sharepoint/<organisation>--<account>/<site>/<library>/`.
Provider identity hashes disambiguate names; the account in the organisation
component prevents two grants syncing the same local directory. An Exchange-only account without OneDrive or followed libraries can connect
Outlook without a folder step. Only chosen roots run bisync. Native listings determine readiness; restarts never resync
implicitly. Initial cloud-preferred union conflicts are backed up under
`~/.local/share/rclone/microsoft-backups/<account>/<remote>/`. Removal deletes
the native login and Pi entry; files remain unless the person selects Trash,
and the Entra app grant is not revoked.

After deployment, verify with a consenting person: both device codes, folder
choice/quota, OneDrive and followed SharePoint upload/download, Outlook drafts,
calendar/contacts reads, a second account, daemon restart, and removal. Also
verify a non-home work tenant's consent-required link and any applicable device
policy. Synthetic tests cannot establish real tenant consent or token refresh.

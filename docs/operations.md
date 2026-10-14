# Install and operate Open Habitat

This guide is for a Linux operator installing the **current** host on their own server. Open Habitat is not yet a turnkey package: the release includes the binary, web assets and neutral systemd/sysusers/tmpfiles templates, but **not** an installer for quota setup, broker state seeding, per-user socket ACLs, boot ordering, TLS or ingress. Do not enable public sign-in until those site-specific policies have been implemented and tested. The deployment [architecture](architecture/deployment.md) explains the trust boundaries; the steps below distinguish shipped commands from work the installer must supply.

## Before installing

Provide a systemd Linux amd64 host with root access, a dedicated gateway Unix UID/GID, a **reserved, unoccupied** UID/GID range (1000–60000, at most 4096 slots) for first-login accounts, `/home` on a filesystem with **enforced user quotas**, and working `git`, `gh`, `getent`, `useradd`, `groupadd`, `setfacl` and `getfacl`. Reserve the range against all other account creators; check NSS, existing homes, groups and unit instances. The broker creates accounts under `/home` and applies per-UID quotas. Merely enabling quota *accounting* is insufficient. Verify enforcement on the filesystem actually containing `/home`, including a real disposable-UID EDQUOT check, before starting the broker. Quota setup differs by filesystem and can require offline maintenance; do not run filesystem conversion commands on a mounted root.

Supply a public HTTPS origin, certificate and key readable by the gateway but not ordinary users, and a GitHub OAuth application with callback `https://<your-origin>/auth/github/callback`. Choose a private listener/ingress arrangement and restrict its network exposure. Choose whom to admit: the broker defaults to a numeric GitHub-ID allowlist. `admission: "any"` permits every verified GitHub identity and is **not** an appropriate substitute for a private access policy. The operator must also supply the OAuth client ID and secret, gateway UID, UID pool, initial numeric subject IDs, default storage quota and a pinned Node/Pi installation. Do not put secrets in command arguments, shell history or the release tree.

## Install a release and site policy

On the **build** host, use a clean, committed, pushed source tree and build the Linux amd64 archive with `scripts/prepare-test-release.sh --version <semver> --output <new-private-directory>` (requires the matching clean-gate receipt by default). This is the repository's verified build-and-package path, **not** a remote installer. The `--ungated` option is for disposable test releases only. Alternatively, obtain a release archive and its `.sha256` sidecar from a trusted release channel. Verify both before extraction with `scripts/verify-release.sh --archive <archive> --json` from the matching source checkout; compare its source/version approval with the embedded `bin/open-habitat --json version`. The archive contains `bin/`, `web/`, `systemd/`, `sysusers.d/`, `tmpfiles.d/` and `MANIFEST.sha256`, not an installed Node/Pi runtime.

As root, extract verified bytes into a new, root-owned, non-user-writable immutable directory under `/opt/open-habitat/releases/`; use `tar --no-same-owner` if extracting an archive transferred from another host. Select it with `/opt/open-habitat/current`, a symlink to that release. The supplied units expect an executable at `/opt/open-habitat/current/open-habitat`: either provide a root-owned relative symlink `open-habitat -> bin/open-habitat` inside each release or adapt and re-review the units. Keep the web path in the gateway config aligned with the selected release. Never extract or switch an unverified archive in place of a running release.

Install the release's six `systemd/open-habitat-*` units under `/etc/systemd/system/` and review any local drop-ins; reload systemd with `systemctl daemon-reload`. `sysusers.d/open-habitat.conf` declares the gateway account without a fixed UID: if using `systemd-sysusers`, record the allocated UID/GID and put them in the broker and gateway configs. If allocating a fixed UID instead, do not apply the dynamic template as well. `tmpfiles.d/open-habitat.conf` creates only the base state and runtime directories. **Neither template installs the boot-time ACL/quota gate or initializes the broker ledger.**

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

Pin Node **v22.21.1** and `@earendil-works/pi-coding-agent` **0.85.1** in a root-owned non-writable tree readable by mapped users, with `bin/node`, `node_modules/@earendil-works/pi-coding-agent/dist/index.js` and its `package.json`. Write `/opt/open-habitat/pi-runtime.json` with absolute `node`, `entry`, `manifest` paths to these files. The daemon checks both versions and the entire runtime tree; putting Pi on `$PATH` alone will not work. Install `gh` and `git` so they can run as each user. Pi and gh authentication remain each user's own native credentials.

Before any broker/daemon socket starts, arrange a boot-time, root-owned policy that restores and verifies `/run/open-habitat` (`root:gateway 0750`) and `/run/open-habitat/users` (`root:gateway 0710`), and prepares **each** per-user socket directory root-owned with search access only for its mapped UID and gateway. Add a per-instance pre-start check against the committed broker binding and its ACL. `DirectoryMode=0710` in the shipped daemon socket is only a fallback, not this policy. Order broker activation after quota enforcement and runtime-directory preparation, including after reboot; enable both `open-habitat-broker.socket` **and** `open-habitat-broker.service` so the latter restores bound users' sockets at boot. Leave individual daemon sockets under broker control. If these local gates do not exist yet, **stop here**: installing the templates alone cannot establish multi-user isolation.

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
- **Logs and failures:** `journalctl -u open-habitat-gateway.service -u open-habitat-broker.service --since today` and `journalctl -u 'open-habitat-daemon@<username>.service' --since today` read classified JSONL stderr diagnostics. Restrict journal access and retention. For failures, inspect `systemctl status` of the corresponding socket/service, `journalctl`, socket owner/mode and parent ACLs, quota enforcement and free space, config owner/parent paths, OAuth callback/HTTPS and pinned Pi selector. Broker startup refuses pending or drifted ledger/account/ACL/quota state; investigate it rather than deleting state or blindly restarting. A broken administrator state stops gateway startup; invalid session state may discard sessions and require login. The system does not provide a complete cross-service trace or an audit log.
- **Backups:** back up `/home` with ownership, ACLs and user credentials protected; `/var/lib/open-habitat/broker` as **one consistent snapshot** including its monotonic head and an independently retained high-water record; `/var/lib/open-habitat-gateway`; the protected gateway configuration/TLS secrets; the UID-pool and quota/boot policy; and the selected release and Pi runtime provenance. Keep backup keys separate from the server. Do not back up `/run` as persistent authority. Test a restore offline and reestablish UID/GID, quotas, ACLs and socket activation before reopening ingress. A stale broker ledger can reassign another person's UID: if the snapshot's high-water cannot be proved current, do not restore it onto a host with newer identities. There is no supported one-command recovery, deprovision or rollback operator for arbitrary installations. Lost session state requires new browser login; lost native home/history or credentials cannot be recreated from the release archive.

The [deployment architecture](architecture/deployment.md) has further detail about state and restart behavior. Local automation should encode and verify the site's missing boot, account-policy and release-switch steps rather than treating these examples as a production-ready installer.

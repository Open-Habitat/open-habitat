# Install and operate Open Habitat

## Supported fresh installation

Use Ubuntu 24.04 LTS amd64 with systemd and a separately mounted ext4 `/home`
with a journal and internal, enforced user quotas. The customer supplies the
machine, current OS security updates, DNS, ingress/firewall, certificates,
GitHub OAuth registration, protected secrets and persistent `/home` mount
configuration. The product never formats a volume or edits fstab.

Obtain the product package from an **independently trusted release channel**.
Its checksum inventory detects corruption, not a malicious replacement. Verify
that channel's source/version approval before executing `bin/open-habitat` as
root. Extract the package into a root-owned, non-writable directory, retaining
its `bin/` and `web/` layout. No source checkout, Fleetrepo, npm or Go is needed
on the installation host.

Separately obtain the signed runtime release (`release.json`, `release.sig`,
selected `.tar.gz` archives) and its independently approved Ed25519 public key.
A key delivered by the same untrusted bundle is not a trust root. Before root
execution, use the independently trusted runtime verifier shown below. Copy
the authenticated runtime files into `/var/lib/open-habitat/release/`, as
root-owned, non-writable regular files, and the raw 32-byte public key to
`/etc/open-habitat/release-key.pub`. Parents must be root-owned and not writable
by other users. The runtime manifest version and SHA-256 go in the site file.
Development-signed runtime releases are for disposable testing only, not a
production signing-key custody claim.

Start from the shipped `site/example.json` and `site/schema.json`. Write a
private root-owned `/etc/open-habitat/site.json` declaring the home UUID,
gateway UID/GID, an unoccupied reserved UID/GID pool, numeric GitHub admission
and administrator subjects, nonzero default quota, exact runtime target and
selected profiles. Keep OAuth/TLS secrets in the protected files referenced by
the site, not in argv, environment variables, the release tree or the site
itself. Both site and secret references must be single-link regular files with
mode `0600` and trusted parents. Reserve the UID/GID range against other account
creators. Gateway UID/GID must also be unused initially. Do not precreate the
gateway account/group, broker files or user bindings. Its non-login service
identity must remain exclusive: another member of its primary group could
read OAuth/TLS secrets. The generated secret parent must have no named/default
ACLs; unsafe existing metadata is refused, never silently cleared.

Product service/socket fragments are fixed qualified policy. Foreign fragments,
full instance units and overrides (including global service/socket drop-ins)
are refused rather than adopted: they can add root hooks, ambient capabilities
or extra groups despite correct base template bytes. Put resource budgets on
user slices. Keep the declaration and referenced secret inputs unchanged while
maintenance runs; external delivery that changes them is an input drift refusal.
Unbundled integration/app declarations remain typed blockers.

Inspect effective inputs and the fixed installation paths:

```sh
./bin/open-habitat host config path --json
./bin/open-habitat host config show --site /etc/open-habitat/site.json --json
```

No environment interpolation, includes or hidden per-key overrides apply to
privileged site operations. Preparation is explicit disruptive maintenance:

```sh
./bin/open-habitat host prepare --site /etc/open-habitat/site.json --dry-run --json
./bin/open-habitat host prepare --site /etc/open-habitat/site.json \
  --approved-plan <prepare-plan-id> --approve-disruption --output=jsonl
./bin/open-habitat host plan --site /etc/open-habitat/site.json --json
./bin/open-habitat host apply --site /etc/open-habitat/site.json --dry-run --json
./bin/open-habitat host apply --site /etc/open-habitat/site.json \
  --approved-plan <apply-plan-id> --output=jsonl
```

Take the plan IDs from the returned documents; preparation and apply approvals
are different. Failed read-only qualification exits 1 with the typed document
under stderr `error.result.data`, never a successful empty observation. Live
maintenance streams progress and exactly one terminal result/error/cancelled
record. `--json` is single-document and only valid with `--dry-run` here.
Signals use exits 130/143. `host operation show <operation-id> --json` inspects
durable intent; a phase is not proof that its action completed. No terminal
record means an unknown outcome, not proof of unchanged state or closed HTTP.
A returned apply failure after maintenance starts reports `entry_closure` as
`verified_closed` or `unavailable`. For `unavailable`, keep external ingress
closed and inspect the gateway: closure could not be durably confirmed, and
stopping only that gateway is the operator's last-resort fallback.

Preparation proves bounded unprivileged EDQUOT and cleanup, establishes the
empty proc exemption group, installs the storage/binding boot gates and
restarts proc/logind/polkit policy. Schedule a maintenance window; this affects
native sessions. Apply never runs preparation or a release upgrade implicitly.

Apply reopens inputs and compares approval under the shared root lock, stages
and authenticates immutable runtime generations, installs exact offline tool
packages without fetching, removals or downgrades, installs numeric gateway
sysusers and nested units, and initializes only a genuinely empty broker.
A root-owned HTTP fence keeps entry points closed while the gateway starts;
the private control socket remains usable for quota/role convergence. Apply
sets the quota default through that API and verifies readback. Generated gateway
configuration and TLS copies live under `/etc/open-habitat/gateway/`; per-user
bindings stay separate under `/etc/open-habitat-daemon/daemon/user-mappings/`.
Use the installed unit's explicit ExecStart configuration path for component
inspection, not an assumed global default. Unbound requested
administrators return `deferred_until_bound`; after their first successful
binding, rerun apply to grant their role. Per-user quota overrides, committed
bindings, native credentials and personal files are never reseeded or reset.

An exact successful repeat verifies postconditions and returns `no_change`
without another receipt or service restart. Before an operation starts, a
changed approved observation is `stale_plan`; obtain a fresh plan. After it
starts, changed protected inputs block continuation: a fresh approval cannot
supersede the incomplete operation. Restoring file bytes alone does not restore
reference identity. Inspect operation evidence and `entry_closure`; there is no
force/supersede route. An interrupted apply may continue only the
same protected desired inputs and original approval, after native
postconditions are reobserved. Malformed, partial broker transactions and
foreign state stay closed for diagnosis. Never delete a fence/ledger, reset a
counter or add a force/repair step to make it pass. Release changes and native
tool drift require a separately qualified upgrade, not ordinary apply.

### Named-release upgrade

The predecessor must have been installed by this operator version’s apply, which
records authenticated release/site/unit generation evidence. Earlier experimental
generations without it are not adopted or migrated; use this contract for the
first installation, before admitting pilot users.

Deliver the independently signed successor runtime manifest/archives to the same
incoming release directory, and its verified product package to a root-owned
non-writable directory. Change only `site.release`; converge admission, roles,
profiles or quota changes separately before planning the release transition.
The signed successor must name this exact predecessor, its executable digest,
the compatibility protocol and every successor binary/web file. A package checksum supplied by the package itself
is not independent release authentication.

```sh
/path/to/successor/bin/open-habitat host upgrade --site /etc/open-habitat/site.json --dry-run --json
/path/to/successor/bin/open-habitat host upgrade --site /etc/open-habitat/site.json \
  --approved-plan <upgrade-plan-id> --approve-maintenance --output=jsonl
```

The first real invocation stages the complete immutable generation and preflights
its offline packages without changing selectors or installed packages. Its
`staged` result names `plan.owner_binary`. Invoke **that exact absolute binary**
with the same arguments/approval to enter maintenance. Never use `current` as the
upgrade or recovery owner. Predecessor operation inspection reports the owning
generation and binary; an older journal parser must not rewrite unfamiliar
records. Upgrade journals use schema 2 and name their owner.

Schedule the maintenance window explicitly. Add `--approve-interruption` only
when interruption of daemon work and enumerated persistent user services is
approved. A live daemon is conservatively unobservable work: an idle list cannot
exclude a previously admitted in-flight request. Without that approval the
operator refuses rather than assuming drain. The old `maintenance enter`
marker is unrelated. Root's upgrade fence denies new native agent mutations;
HTTP entry and product socket activation close independently. Unpublished
`.next` deny markers also close entry; they grant no startup permission, even
with a live lease. Opening/completion refuses an unresolved publication instead
of deleting it or claiming readiness. Native SSH/tmux
sessions outside the product daemon and recorded user services are not killed.

After quiescence, any failure remains closed for diagnosis and same-input
fix-forward. Do not remove fences, restore a ledger, hand-switch selectors or
request a new plan over an incomplete operation. The cold-start gate refuses a
dead upgrade writer: a durable upgrade fence permits structural listener probes
only while a live upgrade holds both the shared operation lock and its
upgrade-specific kernel lease. Another host command cannot authorize probes
after an interrupted upgrade. Structural acceptance is recorded durably before
reopening; a crash after that checkpoint finishes reopening without a second
quiescence. Gateway/session/administration hashes are preservation evidence only while
entry is closed, never frozen snapshots to enforce after ordinary use resumes.
Accepted recovery revalidates the installed successor and starts missing product
consumers under the live lease without quiescing healthy user work or replaying
historical administrator/quota values. Protocol 1 qualifies policy-content
changes within the fixed policy path set; adding/removing policy paths requires
a separately qualified compatibility protocol. A
journal phase is not a readiness bit. Actual component executable adoption,
production mapped-UID Node/Pi startup, both peer-authenticated listeners, broker
and gateway state preservation precede reopening. A malformed/split publication
returns `recovery_required`; no automatic binary rollback exists.

Keep public ingress closed until you verify certificate validation, an admitted
GitHub browser callback, first-login quota and native Pi authorization. VM
production-daemon startup under two UIDs is not provider entitlement or browser
sign-in acceptance. After a reboot, require the real storage/proc gates, broker,
gateway and admitted per-user listeners healthy before reopening ingress.

### Build and verify runtime archives (development releases)

On a trusted Linux build host with Go, rootless Podman and the repository's
Ubuntu 24.04 VM-tools image available, build the companion core archive:

```sh
export TMPDIR=/var/tmp
CGO_ENABLED=0 go build -o /var/tmp/runtime-release ./cmd/runtime-release
./scripts/build-core-runtime.sh /var/tmp/new-core-release
# Development/test only. Keep this private file outside the release directory.
/var/tmp/runtime-release key-create --key-file /var/tmp/development-release.key
/var/tmp/runtime-release sign --directory /var/tmp/new-core-release \
  --key-file /var/tmp/development-release.key --version 0.0.0-runtime-test \
  --commit "$(git rev-parse HEAD)"
```

The signing result reports the exact manifest SHA-256. Transfer only
`core.tar.gz`, `release.json` and `release.sig` from that directory to the
recipient. Build scratch, `artifact.json` and private keys are not installation
inputs. The checked-in npm and Ubuntu locks are build inputs; missing pinned
repository versions require preparing a new lock/release, not substituting
`latest`. Install-time verification and staging use no network or package solver.
The manifest retains complete component/file digests and upstream licence
records, including Node's third-party notices, npm package notices/declared
licences and Debian copyright/common-licence texts. These records do not grant
rights beyond upstream terms; in particular the Claude SDK/bridge dependencies
retain their supplied terms, not a blanket MIT licence for the bundle.

Optional archives use the same trust boundary and link-free format. Build a
selected, release-qualified profile from its checked-in lock, then sign one
array of descriptors together with core. For example:

```sh
./scripts/build-profile-runtime.sh editor /var/tmp/new-editor-profile
cp /var/tmp/new-editor-profile/editor.tar.gz /var/tmp/new-core-release/
python3 - <<'PY_ARTIFACTS'
import json
from pathlib import Path
out = Path('/var/tmp/new-core-release')
artifacts = [json.loads((out / 'artifact.json').read_text()),
             json.loads(Path('/var/tmp/new-editor-profile/artifact.json').read_text())]
(out / 'artifacts.json').write_text(json.dumps(artifacts))
PY_ARTIFACTS
# Run instead of the core-only sign command, in a fresh unsigned directory.
/var/tmp/runtime-release sign --directory /var/tmp/new-core-release \
  --artifacts-file /var/tmp/new-core-release/artifacts.json \
  --key-file /var/tmp/development-release.key --version 0.0.0-runtime-test \
  --commit "$(git rev-parse HEAD)"
```

Transfer every archive named by the signed manifest, not just `core.tar.gz`.
The helper signs, verifies and stages **all** manifest profiles; it cannot
silently call core-only verification a complete profile verification. Every
profile needs a complete file/component/licence inventory. Debian and npm
components require their corresponding complete native locks even in optional
archives. The uv archive also carries the exact release source and every crate
in that source's Cargo.lock, with retained notices and declarations; keep those
sources with the archive when redistributing. Editor executable aliases use its
bundled Node and real target paths, not the recipient's ambient Node.

A buildable lock alone is not a qualified or advertised capability. Exclude a
profile from the delivered manifest when its licence/redistribution closure or
mapped-user workflow remains unverified; report a typed reason with the release
evidence. Never copy personal skills, provider configuration or credentials.
Profile selection and install/activation still belong to the host executor;
this helper does not write runtime selectors or provider/editor configuration.

Exact tool locks also need a compatible, security-matched Ubuntu platform.
The expanded-profile VM uses its own pinned current OS image; the older core/
quota diagnostic image stays unchanged. Offline package checks/installations
forbid removals: they must not delete OS services to make a lock fit. A platform
suite mismatch blocks qualification; it is not permission to force a partial
systemd/libc update or downgrade a customer security update.

For copyleft redistribution, provide corresponding source or a compliant offer
as the applicable licences require. A retained copyright inventory alone is not
that offer. The uv profile carries its locked source graph; Ubuntu source
provision and any provider entitlement remain release/operator obligations,
not a blanket licence grant from this development signature.

Provision an **independently trusted verifier binary**, approved public key,
exact version and manifest digest through the operator's trusted channel.
Neither a key nor an executable taken from the untrusted runtime bundle can
bootstrap trust. The `key-create` command makes a disposable **development**
key only; no production key or production trust root is supplied by this project.
With those approved inputs, verification can run unprivileged:

```sh
runtime-release verify --directory /srv/incoming/core \
  --key-file /etc/release-trust/core.pub --version 0.0.0-runtime-test \
  --manifest-sha256 <approved-64-hex-digest>
```

For private staging, root may use `runtime-release stage` with the same inputs
and `--stage-parent <existing-root-owned-0700-directory>`. The caller must
establish trusted parent ancestry; this build tool is not an installation
executor. It verifies signatures, target, complete inventory, file bytes,
licence references and both locks before extracting into a new private child;
it never activates that child, starts a service or installs/downgrades a package.
No installation readiness follows from staging alone. On a customer host,
security-updated package drift blocks convergence; never use a downgrade or
an apt hold to make it match this lock. Kernel/systemd and OS policy remain
customer platform responsibilities even where the conservative tool-package
closure carries matching shared-library packages.

`./scripts/test-core-runtime-vm.sh <release-dir> <trusted-public-key> <version>
<approved-digest>` exercises independent verify → private stage → offline tool-package
installation on the existing OS platform and production daemon startup as two mapped UIDs on a fresh,
networkless Ubuntu 24.04 QEMU guest. Its explicit fixture publication is not a
host apply executor; runtime startup qualification is separate from customer browser/provider acceptance. An explicit fifth argument,
`test/vm/profile-runtime-proof.py`, adds native profile workflows under both
mapped UIDs with minimal HOME/PATH, using only the staged archives and a synthetic
container entrypoint. Check the per-profile markers and the uncapped serial
receipt; version output alone is not acceptance. The fixture's editor health
probe does not establish browser grants/origin/TLS behavior. PHP/psql checks do
not establish a complete Moodle service or external database connection. Generic
Python/C builds do not establish Python 3.14 or a particular npm native addon.
Provider consent, conversations, customer repositories, quota preparation and
live-host activation remain separate acceptance.

### Headless QA browser assets

When selecting the `browser` archive, also select its authenticated Python/uv/
native-build dependency profiles. Publish its `runtime/` as the root-owned,
non-user-writable `/opt/open-habitat/profiles/browser/` tree, and retain the
qualification wheelhouse separately from customer dependencies. Set
`PLAYWRIGHT_BROWSERS_PATH=/opt/open-habitat/profiles/browser/browsers` for QA
processes. Project-local Playwright must match the archive's locked version;
use the project's frozen uv lock, not a global Playwright install. An ordinary
`uv run playwright install` without a browser argument also requests unavailable
browsers; do not silently download or advertise them. The selected headless shell
is used by `chromium.launch(headless=True)` with no explicit channel. Full Chrome,
headed Chromium, other Playwright versions, video/FFmpeg assets and GPU/media
parity are separate qualifications, not implied by a screenshot/click probe.
Retain the shell's complete `LICENSE.headless_shell` and wheel notices; source
provision obligations above still apply. This development build does not grant
Google Chrome redistribution rights. Browser sandbox/security acceptance is not
established by the default Playwright headless workflow.

### Runtime and native session policy

The supported operator path above installs proc/logind/polkit policy and the
separate gateway secret and broker binding parents. Do not install the dynamic
gateway sysusers template alongside its generated numeric declaration. Never
hand-copy the broker's initial JSON examples into an occupied installation.
The gateway cannot read homes; mapped daemons cannot read gateway secrets.

The daemon validates the pinned Node/Pi tree selected by
`/opt/open-habitat/pi-runtime.json`. Pi and gh authorization still belong to
each person's native stores. No install or login step downloads Pi or shares a
provider key. Host tool-package drift is a typed qualification failure, not
permission to downgrade a customer security update or install apt holds.

The proc exemption group must have no ordinary members. Only logind and polkit
receive it through the installed drop-ins; never exempt the gateway, daemons,
users or a shared administrative group. Check the effective `/proc` mount and
running service groups after installation/reboot. User resource budgets such
as `MemoryMax=`, `TasksMax=` and `CPUWeight=` remain customer policy.

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

Before starting the broker, install the tmpfiles policy and establish the base
`/run/open-habitat` (`root:gateway 0750`) and `/run/open-habitat/users`
(`root:gateway 0710`) directories. Systemd tmpfiles restores these after reboot.
The shipped broker and both listener templates require the storage guard.
Both listeners additionally require `open-habitat-binding@<name>.service`,
which takes the broker's ledger lock, refuses incomplete/revoked/unbound state,
and verifies native account, binding config and quota before reconstructing an
**absent** per-user runtime directory with exact named search ACLs. Existing
partial/foreign ACL state is refused, not repaired. `DirectoryMode=0710` is a
fallback, not authorization. After proving the installed boot ordering, enable
`open-habitat-broker.socket open-habitat-broker.service` together; the service
restores committed admitted accounts without waiting for browser login. Leave
individual socket instances under broker control. Restore and preflight
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
`quota.state: unavailable` is not evidence of working quota observation. Installing
templates alone cannot establish a complete multi-user installation; test the
effective gates and both native user managers on the customer host.

## Start and prove first use

After successful apply, inspect the selected version and administrative readback:

```sh
/opt/open-habitat/current/open-habitat version --json
/opt/open-habitat/current/open-habitat admin settings show --json
/opt/open-habitat/current/open-habitat admin users list --json
```

Apply has already set the declared nonzero quota and started the units. Keep
those values in the site if using declarative convergence. Optionally set the
unmanaged displayed name with `admin settings update --name <name> --json`.
Check the real HTTPS ingress with certificate validation, then sign in as an
admitted identity and inspect the new account, quota, home and daemon socket.
After binding, rerun apply for any deferred administrator grant. The person's
native Pi/provider authorization remains a separate first-use step. A redirect
from `/auth/github/start` alone proves neither callback nor sign-in.

`/healthz` shows a responding service, not a fully functional installation. `/readyz`, `admin readiness show` and `doctor --component gateway|daemon --json` do not prove provider access, quota enforcement or user isolation. Do not treat their foundation responses as deployment approval.

## Daily operation and recovery

- **Version and upgrade:** identify the running binary with `version --json`
  and `readlink -f /opt/open-habitat/current`. Ordinary apply is not a release
  upgrade and never silently switches a predecessor. Use the explicit named-release upgrade above; it accounts for native work,
  not just the gateway. Do not hand-switch `current`, replay an uncertain operation or restore
  an older ledger. The older `maintenance enter` command is only an unrelated
  marker; it is not the installer HTTP fence or a request drain.

- **Logs and failures:** `journalctl -u open-habitat-gateway.service -u open-habitat-broker.service --since today` and `journalctl -u 'open-habitat-daemon@<username>.service' --since today` read classified JSONL stderr diagnostics. Mutating, failed and slow (≥250 ms) requests appear as `http_request` records; `slow: true` marks those over 1 s, and a gateway and daemon record with the same `request_id` belong to one browser request (for example `journalctl -u open-habitat-gateway.service -u 'open-habitat-daemon@*' -o cat | grep '"request_id":"<id>"'`). Restrict journal access and retention. For failures, inspect `systemctl status` of the corresponding socket/service, `journalctl`, socket owner/mode and parent ACLs, quota enforcement and free space, config owner/parent paths, OAuth callback/HTTPS and pinned Pi selector. Broker startup refuses pending or drifted ledger/account/ACL/quota state; investigate it rather than deleting state or blindly restarting. A broken administrator state stops gateway startup; invalid session state may discard sessions and require login. Login records are not joined across services, and the system does not provide an audit log.
- **Backups:** back up `/home` with ownership, ACLs and user credentials protected; `/var/lib/open-habitat/broker` as **one consistent snapshot** including its monotonic head and an independently retained high-water record; `/var/lib/open-habitat-gateway`; the protected gateway configuration/TLS secrets; the UID-pool and quota/boot policy; and the selected release and Pi runtime provenance. Keep backup keys separate from the server. Do not back up `/run` as persistent authority. Test a restore offline and reestablish UID/GID, quotas, ACLs and socket activation before reopening ingress. A stale broker ledger can reassign another person's UID: if the snapshot's high-water cannot be proved current, do not restore it onto a host with newer identities. There is no supported one-command recovery, deprovision or rollback operator for arbitrary installations. Lost session state requires new browser login; lost native home/history or credentials cannot be recreated from the release archive.

Local automation invokes the shipped host operator; it must not replace its lock, qualification or broker transactions with ad-hoc state edits.

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

### Rootless container session prerequisites

The container profile needs kernel user namespaces, disjoint subordinate UID/GID
ranges for every mapped account, `newuidmap`/`newgidmap`, cgroup v2 and a native
systemd user manager with linger. Set per-tenant budgets on `user-<uid>.slice`;
container memory controls must run inside a delegated user service/scope. A
setuid child of the gateway alone is not a delegated session. Supply each user
`XDG_RUNTIME_DIR=/run/user/<uid>` (owned by that UID, mode 0700) and their own
user bus. Never supply another user's runtime directory or a rootful socket.

The authenticated container profile includes its session initializer and user
unit. Publish `runtime/` at the immutable profile path
`/opt/open-habitat/profiles/containers`, and install its
`systemd/user/open-habitat-containers.service` in the system user-unit directory.
Enable/start it in each mapped user's manager **before their first container**;
host preparation/activation must arrange this after each boot. The fixture does
this explicitly; the host executor does not yet activate optional profiles.
The profile's compose provider reruns the idempotent initializer before each
invocation, including after a native pause-process loss/reset/migration. Before
direct `podman run` after such an event, rerun `bin/initialize-netns` in that
user's manager. An active oneshot alone cannot attest the native pause process. A
nonempty, uninitialized namespace directory is refused, not forcibly cleaned.

The initializer pre-binds the namespace parent in Podman's persistent rootless
mount namespace. Podman 4.9's `keep-id` path otherwise binds a child before
initializing that parent and can duplicate mounts at teardown. This does not
suppress cleanup errors or mount/unmount anything as host root. The profile's
`bin/podman-compose` is the qualified provider; the old Ubuntu 1.0.6 provider
does not remove networks on `down` and is not installed by this profile. Use the
explicit provider path (or its selected profile PATH) rather than assuming any
ambient `podman compose` provider is equivalent. Customer OCI images, Moodle
application dependencies, database contents and credentials remain separate
inputs, not part of the tool profile.

The qualified provider defaults to `--in-pod=false`: Podman 4.9 rejects per-service
`userns_mode: keep-id` combined with compose 1.5's default pod grouping. Ordinary
Compose containers retain their separate namespaces. An explicit later
`--in-pod=true` overrides that default but is not the qualified keep-id workflow.

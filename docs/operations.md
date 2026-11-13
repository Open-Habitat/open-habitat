# Install and operate Open Habitat

## Supported fresh installation

Use Ubuntu 24.04 LTS on amd64 or arm64 with systemd and `/home` on an ext4 filesystem.
The customer supplies the machine, current OS security updates, DNS,
ingress/firewall, certificates, GitHub OAuth registration, protected secrets
and any persistent `/home` mount configuration. The product never formats a
volume or edits fstab.

Choose the storage mode before the first preparation; it is part of the
installation's identity and cannot be changed later without a fresh
installation:

- **Per-user limits** (`storage.enforce_user_quota: true`): `/home` is a
  separately mounted ext4 volume with a journal and internal, enforced user
  quotas, and every new account gets `storage.default_limit_bytes`.
  Administrators can change each person's limit, and a full limit stops only
  that person.
- **No per-user limits** (`storage.enforce_user_quota: false`, no
  `default_limit_bytes`): `/home` may be a directory on an ordinary
  single-filesystem server's root filesystem, or a separate ext4 mount without
  quotas. Every home shares that filesystem with no limit, so **one person,
  or one of their agents, can fill the disk for everybody, and on a single
  filesystem also for the operating system and the product's own state**
  (journals, broker and gateway state, logs). Use it only where the people
  trust each other with the disk and the operator watches free space.
  Settings and the administrator storage page say that limits are not in use
  and show the shared disk.

`storage.home_uuid` is the UUID of the ext4 filesystem that holds `/home` in
either mode: `findmnt -no UUID -T /home`. On a single-filesystem server that is
the root filesystem's UUID.

`/`, `/var` and `/opt` may be separate filesystems. Apply and upgrade stage a
runtime generation in `/opt/open-habitat/staging` and publish it with one
atomic rename into `/opt/open-habitat/generations`, so everything below
`/opt/open-habitat` must stay on one filesystem: do not mount anything below
it. Otherwise maintenance stops with `generation_staging_cross_device` before
anything is published, and the same approved input continues once the mount
is gone.

Obtain the product package and the runtime release from the GitHub release.
The release trust is the SHA-256 that GitHub states for each asset
(`assets[].digest` in `gh api repos/Open-Habitat/open-habitat/releases/tags/<tag>`,
also shown on the release page). The downloaded package and manifest must hash
to those figures before anything is extracted or run as root; the package's own
checksum inventory detects corruption, not a replacement. Extract the package into a root-owned, non-writable directory, retaining
its `bin/` and `web/` layout. No source checkout, fleet-management tooling, npm or Go is needed
on the installation host.

Each architecture has its own product package (`open-habitat-VERSION-linux-amd64`
or `-linux-arm64`) and its own runtime release, whose manifest names its
platform (`ubuntu-24.04-amd64` or `ubuntu-24.04-arm64`); the operator refuses a
release for another architecture with `release_platform_mismatch`.
A published release that carries both architectures names every
architecture-specific asset after its architecture: the manifest is
`release-linux-<arch>.json` and the archives are `<profile>-linux-<arch>.tar.gz`.
Save the manifest as `release.json`, the name the operator reads; keep the
archives' names, because the manifest names them. An artifact's optional
`archive_release` names the immutable published GitHub tag in this same
repository that holds that archive; when absent, download it from the chosen
release itself. Authenticate the chosen manifest against GitHub's stated digest
**before** following those tags. Require each referenced release to be published
and immutable and its asset's GitHub digest and size to equal the chosen
manifest's `sha256` and `size`; verify the downloaded bytes against both.
Do not follow arbitrary URLs or recursively load another manifest. A source tag
is a location, never a substitute for the chosen manifest's digest, inventory
or version. All archives still arrive locally before the offline operator runs. Copy `release.json` and every
selected archive into `/var/lib/open-habitat/release/` as root-owned,
non-writable regular files; parents must be root-owned and not writable by other
users. The manifest's version goes in `site.release.version` and GitHub's stated
digest of `release-linux-<arch>.json` in `site.release.manifest_sha256`. That
pin is the whole runtime trust: the operator accepts exactly the manifest bytes
that hash to it and checks every archive and product file against the manifest.
Releases are unsigned, and nothing else in the download, such as a checksum
file, can stand in for that pin.

Register the GitHub OAuth app with its callback at
`https://<origin>/auth/github/callback`, and under the app's **Optional
features** opt out of expiring user tokens. GitHub enables them by default
for OAuth apps registered since August 2026. Such a token works for eight
hours. The person's `gh` cannot refresh it, and Habitat keeps no refresh
token, so after eight hours `git push` and `gh` stop working until the person
signs in again. A sign-in that receives an expiring token logs
`github_token_expiring` in the gateway journal. Run
`open-habitat host check --site /etc/open-habitat/site.json` (or add `--json`)
to see the same condition as a non-blocking warning with the fix. The warning
reflects the gateway's latest successful GitHub exchange, survives restarts,
and clears after a later sign-in receives a non-expiring token. It does not
assert that every person's existing gh token has been replaced. No observation
yet means no expiry warning; unreadable or invalid observation state produces
a separate warning. The gateway records only `expiring` or `non-expiring` in
its private `/var/lib/open-habitat-gateway/github-token-expiry` file, never a
token or account name. JSON carries warnings in the result's `warnings` array
(inside `error.result` if other host checks block); text prints `warning:` lines.

Tokens issued before the opt-out still expire. Waiting until the old token
expires and then signing in again installs a lasting one. An ordinary sign-in keeps gh's login while it works, so
after the opt-out each person reconnects once from Settings › Koodipalvelut
(GitHub › Yhdistä GitHub uudelleen), which replaces gh's token with a lasting
one at once.

A GitHub team can admit people beside those allowed one by one. While
`identities.runtime_admission` is on, an administrator adds
`organisation/team` in Settings › Käyttäjät ja pääsy; the broker keeps it with
the other runtime admissions, and `admin access list` shows it. At every
sign-in the gateway asks GitHub, with that person's own token (the `read:org`
scope sign-in already requests), whether they are an active member; a pending
invitation is not membership. Nothing is stored for this but the answer.
Leaving takes effect at the next sign-in: it is refused, the account and files
stay, and an open session continues until it ends, so use Poista pääsy to end
it at once. Someone also allowed one by one keeps access. Before adding a
team:

- If the organisation restricts OAuth app access, an owner approves Open
  Habitat's OAuth app in the organisation's Settings › Third-party access ›
  OAuth app policy (a member can request it from their GitHub
  Settings › Applications › Authorized OAuth Apps). Without the approval GitHub
  answers no membership question: members are refused with "membership could
  not be checked", and the access page says when GitHub last failed to answer.
  If the organisation enforces SAML single sign-on, each member's
  authorisation must be granted for it as well.
- Use a team without child teams: GitHub counts a child team's members as the
  parent's.
- The first member's sign-in pins the team to its numeric id; renaming the
  team keeps it, and a new team that later takes the old name does not inherit
  it. Until then the access page says the team waits for its first member.

Start from the shipped `site/example.json` and `site/schema.json`. Write a
private root-owned `/etc/open-habitat/site.json` declaring the home UUID,
gateway UID/GID, an unoccupied reserved UID/GID pool, numeric GitHub admission
and administrator subjects, the storage mode (with a nonzero default limit
when limits are in use), exact runtime target and selected profiles. Keep
OAuth/TLS secrets in the protected files referenced by the site, not in argv, environment variables, the release tree or the site
itself. Both site and secret references must be single-link regular files with
mode `0600` and trusted parents. The shared `/etc/open-habitat` must be
root:root `0711` (or `0755`), without access/default ACLs, **not 0700**.
Create it with `install -d -o root -g root -m 0711 /etc/open-habitat`;
create source `/etc/open-habitat/secrets` separately as root:root `0700`.
The shared parent's search permission grants no read access to 0600 inputs or
the separate generated root:gateway-group 0750 subtree. Check/plan report
`gateway_parent_requires_root_0711_or_0755_no_acl` for unusable metadata.
After stat/getfacl confirms an otherwise root:root ACL-free 0700 parent, the
operator repairs it with `chmod 0711 /etc/open-habitat`; apply does not change
customer bootstrap permissions. Never recursively chmod or add ACLs. Reserve the UID/GID range against other account
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
App registrations go in the operator file described under Integrations; the
site's `integrations.browser_setup` only decides whether a browser
administrator may write them.

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

Preparation proves bounded unprivileged EDQUOT and cleanup (per-user limits
only; without them it reports `prepare.quota_probe` as `no_change /
user_quota_not_declared`), establishes the empty proc exemption group, installs
the storage/binding boot gates and restarts proc/logind/polkit policy. Without
per-user limits, host check reports `storage.quota_format` and
`storage.enforcement` as `pass / user_quota_not_declared`, and the boot gate
verifies only that `/home` is on the declared ext4 filesystem, writable and
without mounts below it. Schedule a maintenance window; this affects
native sessions. Apply never runs preparation or a release upgrade implicitly.

### Continuing a preparation stopped at session restart

If `host operation show <id> --json` reports a running **prepare** at
`session_restarting`, use the corrected product binary without changing the
site's runtime release pins. Run `host prepare --site /etc/open-habitat/site.json
--dry-run --json` again. A supported continuation reports check
`operation.fence: pass / prepare_session_continuation_verified` and plans only
policy roll-forward and session restarts, not another quota probe. Approve
**that newly returned prepare plan ID**, with `--approve-disruption` and
`--output=jsonl` as above. This narrowly scoped prepare continuation differs
from apply's original-approval continuation below.

The operator retains the original operation ID/approval in the journal and
rolls its intent forward. It accepts only matching receipt/fence copies, the
same runtime target, a completed/cleaned EDQUOT probe with no residual directory
and unchanged original quota limits on the same mount, and matching product
policies (allowing the old name-based proc unit to become numeric). It does not
reset a journal, replay the quota probe, repair identities or waive storage
checks. A complete trusted policy `.next` matching the desired bytes and mode may
finish publication; unknown/partial policy stages and any journal publication
split remain fenced. Any other phase, changed policy, missing probe or changed
mount stays fenced for diagnosis. Continue before reboot/remount: the legacy
probe is bound to its original kernel mount instance, not just a UUID. Do not delete files or hand-edit
the unit. An interruption after numeric policy publication can be continued by
the same preview/approval procedure. Successful continuation returns `prepared`;
verify the operation is completed and run `host check` before apply. Missing
runtime inputs may still block installation independently of preparation.

Apply reopens inputs and compares approval under the shared root lock, stages
and authenticates immutable runtime generations, installs unmet Ubuntu minimum-version
requirements through the host apt (no removals, downgrades or held-package changes), installs numeric gateway
sysusers and nested units, and initializes only a genuinely empty broker.
A root-owned HTTP fence keeps entry points closed while the gateway starts;
the private control socket remains usable for quota/role convergence. With
per-user limits apply sets the quota default through that API and verifies
readback; without them it leaves the gateway's default alone, and the broker
creates accounts with no limit. Generated gateway
configuration and TLS copies live under `/etc/open-habitat/gateway/`; per-user
bindings stay separate under `/etc/open-habitat-daemon/daemon/user-mappings/`.
Use the installed unit's explicit ExecStart configuration path for component
inspection, not an assumed global default. Unbound requested
administrators return `deferred_until_bound`: apply records them as pending
(`admin settings show` lists `pending_administrators`), and the gateway grants
the role at the sign-in that creates the binding, without another apply. A
browser administrator can also name an admitted person administrator in
Käyttäjät ja pääsy, before or after their first sign-in; apply leaves such
designations (`designated_administrators`) alone, and declaring the same id in
site.json makes the role site.json's. Per-user quota overrides, committed
bindings, native credentials and personal files are never reseeded or reset.

### Rotating the TLS certificate and key

Renew externally before expiry, covering the app hostname and every configured
editor hostname/wildcard. The operator owns renewal scheduling and any DNS
provider credentials; do not put DNS administration credentials on the host.
Read `gateway.tls_cert_file` and `gateway.tls_key_file` from the protected site
file for the **source** paths. The serving copies are
`/etc/open-habitat/gateway/tls.crt` and `tls.key`; do not edit those generated
copies or `gateway.json` directly.

1. Finish any incomplete host operation first. During a maintenance window,
   obtain a valid renewed PEM chain/key, check expiry/SANs and verify that their
   public keys match (for example compare `openssl x509 -pubkey -noout -in
   NEW_CHAIN` with `openssl pkey -pubout -in NEW_KEY`). Keep private-key bytes
   out of command arguments and logs.
2. Stage each new source file beside its configured path, owned by root with
   mode `0600`, no symlinks or hardlinks, under protected root-owned parents;
   atomically rename it over the old source. Replace both files before planning
   and retain a protected recoverable copy until verification succeeds. Keep
   the site declaration and runtime version/manifest digest unchanged.
   For example, after setting `cert` and `key` to the exact source paths
   declared by the site (not the generated copies), and `newcert`/`newkey`
   to protected renewal files:

   ```sh
   install -o root -g root -m 0600 "$newcert" "$cert.renewing"
   install -o root -g root -m 0600 "$newkey" "$key.renewing"
   mv -T "$cert.renewing" "$cert"
   mv -T "$key.renewing" "$key"
   ```

   Refuse preexisting `.renewing` paths/symlinks before staging. Keep backup
   copies root-only. These commands run as root in a maintenance window with
   no concurrent operator; never print the private key.
3. Use the installed product's ordinary `host apply --site
   /etc/open-habitat/site.json --dry-run --json`, inspect its plan and approve
   its **new** plan ID with `--output=jsonl`:

   ```sh
   "$oh" host apply --site /etc/open-habitat/site.json --dry-run --json
   "$oh" host apply --site /etc/open-habitat/site.json \
     --approved-plan <NEW_PLAN_ID> --output=jsonl
   ```

   Here `oh` is the authenticated product executable. Apply copies the source TLS files
   into the generated gateway directory with root:gateway-group `0640` under
   `0750`, then **restarts `open-habitat-gateway.service`** when configuration
   bytes change. There is no TLS hot reload or `systemctl reload` path. The
   restart interrupts browser connections; it does not replace personal homes
   or native credentials. Do not change source files again mid-operation; an
   interrupted apply continues only with its original protected inputs and
   original approval.
4. Require successful apply, `systemctl is-active open-habitat-gateway.service`
   and `host check --site /etc/open-habitat/site.json --json`. From outside,
   use CA-validating `curl --fail https://APP_HOST/healthz` (never `-k`) and
   inspect the presented certificate with `openssl s_client -connect
   APP_HOST:443 -servername APP_HOST -verify_hostname APP_HOST -verify_return_error`, checking the new
   serial/expiry/SANs. Verify editor hosts too. When an ingress proxy terminates
   TLS, rotate/verify that edge independently and check the origin hop's new
   certificate using its verified TLS server name and appropriate CA.

For apply, an exact successful repeat verifies postconditions and returns `no_change`
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
non-Ubuntu tool drift require a separately qualified upgrade, not ordinary apply.

### Named-release upgrade

The predecessor must have been installed by this operator version’s apply, which
records authenticated release/site/unit generation evidence. Earlier experimental
generations without it are not adopted or migrated; use this contract for the
first installation, before admitting pilot users.

Deliver the successor runtime manifest/archives to the same incoming release
directory, and its product package, checked against GitHub's stated digests, to a root-owned
non-writable directory. Change only `site.release`; converge admission, roles,
profiles or quota changes separately before planning the release transition.

The upgrade converges no administration. Administrators must already be
site.json's (`upgrade.predecessor` reports `predecessor_administrators_not_applied`
otherwise). The quota default is the gateway's current value: a default an
administrator changed in the browser after the last apply neither blocks the
upgrade nor is reset by it, and per-user limits are never touched. Site.json's
`storage.default_limit_bytes` still says what the next host apply sets, so
before that apply either write the browser value into site.json or accept that
apply returns the default to the declared one (existing accounts keep their
limits; only accounts created afterwards get the new default). A refused
predecessor names the failing observation in `upgrade.predecessor`'s reason
(`predecessor_admission_not_applied`, `predecessor_unit_policy_drift`,
`predecessor_runtime_packages_not_ready`, `predecessor_service_inactive`, and
so on); diagnose that observation on the running predecessor rather than
editing the successor's inputs.
The successor's manifest, pinned by its GitHub-stated digest in
`site.release.manifest_sha256`, must name this exact predecessor, its executable
digest, the compatibility protocol and every successor binary/web file. A
package checksum supplied by the package itself is not release authentication.

A product-only replacement still needs a new release manifest: the
transition authenticates the successor executable and web assets, not only the
runtime archives. Reuse unchanged runtime archive bytes and descriptors, but
issue a distinct release version/digest with the exact predecessor and successor
product inventory. Leaving `site.release` on the old runtime manifest cannot
install a new product. Publish the new manifest together with the product and
identify unchanged archive hashes in the handoff.

A maintainer's release operator cuts such a product-only release of this repository
from a commit whose clean gate passed. When runtime inputs changed since the
predecessor it refuses unless each changed profile is passed as a native
build output with `--rebuilt ARCH=DIR` for both architectures; those archives
then replace the profile's descriptor and are uploaded with the release. Its
parts also work alone.
`scripts/successor-descriptors.py --archive-release vPREDECESSOR` annotates
archives without a source tag and preserves an existing source tag, so
repeated cuts point directly to the original asset. A rebuilt profile uses its
new descriptor without `archive_release` and is uploaded with the new release.
Keep the complete local archive closure for writing and verifying the
manifest, even when those bytes will not be uploaded.
`python3 scripts/release-upload-plan.py --directory ASSETS --tag vVERSION
--json` then lists the exact assets to upload. A release consists of both
architectures' packages and manifests, `release-gate.json` and any new
archives; the planner checks each reused archive's immutable source with
authenticated `gh` and refuses mismatched or other files. Upload only its
`upload` paths, **not a directory glob**, and before publishing compare the
digest GitHub states for each draft asset with the verified local bytes.
Retain every referenced source release for as long as any supported successor
needs it: immutability of its bytes does not replace source availability.

```sh
/path/to/successor/bin/open-habitat host upgrade --site /etc/open-habitat/site.json --dry-run --json
/path/to/successor/bin/open-habitat host upgrade --site /etc/open-habitat/site.json \
  --approved-plan <upgrade-plan-id> --approve-maintenance --output=jsonl
```

The first real invocation stages the complete immutable generation and preflights
its Ubuntu requirements with a read-only apt simulation, without changing selectors or installed packages. Its
`staged` result names `plan.owner_binary`. Invoke **that exact absolute binary**
with the same arguments/approval to enter maintenance. Never use `current` as the
upgrade or recovery owner. Predecessor operation inspection reports the owning
generation and binary; an older journal parser must not rewrite unfamiliar
records. Upgrade journals use schema 2 and name their owner.

Schedule the maintenance window explicitly. Add `--approve-interruption` only
when interruption of daemon work is approved; the preview's `work` lists each
live daemon and its active turns. A live daemon is conservatively unobservable
work: an idle list cannot exclude a previously admitted in-flight request.
Without that approval the operator refuses rather than assuming drain. The old `maintenance enter`
marker is unrelated. Root's upgrade fence denies new native agent mutations;
HTTP entry and product socket activation close independently. Unpublished
`.next` deny markers also close entry; they grant no startup permission, even
with a live lease. Opening/completion refuses an unresolved publication instead
of deleting it or claiming readiness.

The upgrade stops only the product's system units. Native SSH/tmux sessions and everything in a
person's user manager (the browser shell, the editor, Taskfleet runs, timers)
keep running on the generation they started with; the preview lists those units
under `user_units_left_running`. Browser Pi conversations are daemon children
and are cut. A later command through `current`, the profile links or `PATH`
runs the new generation; a security fix that must reach a long-running user
process needs that process restarted deliberately.

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

On a trusted Linux build host with Go and rootless Podman, build the core and
integrations archives every release carries, and write one manifest for
them. The scripts build their own multi-architecture builder image
(`runtime/builder/Containerfile`). Each build targets one architecture
(`--target linux-amd64|linux-arm64`, default the build host's); core and
integrations run npm on the locked Node, so they build on a host of the target
architecture, while the other profiles only fetch and inventory pinned files and
build for either target anywhere. Every archive in one release is built for the
same target, and `manifest --platform` names it; it refuses Ubuntu requirements
or `runtime/bin` executables of another architecture.

```sh
export TMPDIR=/var/tmp
CGO_ENABLED=0 go build -o /var/tmp/runtime-release ./cmd/runtime-release
./scripts/build-core-runtime.sh /var/tmp/new-core-release
./scripts/build-profile-runtime.sh integrations /var/tmp/new-integrations-profile
cp /var/tmp/new-integrations-profile/integrations.tar.gz /var/tmp/new-core-release/
python3 - <<'PY_ARTIFACTS'
import json
from pathlib import Path
out = Path('/var/tmp/new-core-release')
artifacts = [json.loads((out / 'artifact.json').read_text()),
             json.loads(Path('/var/tmp/new-integrations-profile/artifact.json').read_text())]
(out / 'artifacts.json').write_text(json.dumps(artifacts))
PY_ARTIFACTS
/var/tmp/runtime-release manifest --directory /var/tmp/new-core-release \
  --artifacts-file /var/tmp/new-core-release/artifacts.json --version 0.0.0-runtime-test \
  --platform ubuntu-24.04-amd64 --commit "$(git rev-parse HEAD)"
```

It verifies the complete closure, writes `release.json` and reports its exact
SHA-256. Transfer only `core.tar.gz`, `integrations.tar.gz` and `release.json`
from that directory to the recipient. Build scratch and `artifact.json` are not
installation inputs. The checked-in npm/non-Ubuntu artifact locks are exact build inputs; Ubuntu
requirements declare direct packages and qualified **minimum** versions. Manifest schema version 2's
`packages[].version` field means minimum version, with Debian version
ordering, not an exact pin. Ubuntu dependencies come from the customer's apt;
ensure its package indexes are current (`apt-get update`) before planning.
The operator never updates indexes implicitly. A missing/older requirement is
shown in plan as `ubuntu.package.<name>` and simulated against the host candidate;
apply repeats the solve inside the journaled staging/activation phase. Apt runs
non-interactively, cannot remove or downgrade packages or change held packages,
and must meet the minimum on post-install readback. An unavailable/too-old
candidate refuses with `ubuntu_package_requirement_unsatisfied`; refresh the
customer repositories or resolve pins/holds. Before an operation starts, obtain a
fresh plan; continue an incomplete operation with its original approval. Newer installed
Ubuntu packages satisfy the requirement and do not block check/apply/upgrade.

### Troubleshooting host apt failures

`runtime_package_install_failed` and `runtime_package_solve_failed` include an
operator-only stderr excerpt (at most 2048 bytes) with an `apt` cause class.
The incomplete operation receipt's `apt_failure` preserves the same diagnostic
for `host operation show`; normal phase advancement clears it. Credentials, URL
userinfo, queries and fragments are redacted; URLs retain the mirror and a
package archive basename, not arbitrary repository paths. Very long output keeps
only its tail; an unknown class or missing detail is not evidence of a cause.
Consult local apt/dpkg logs if the excerpt is insufficient.

- `mirror_index_mismatch`: a mirror 404, hash mismatch or unexpected size usually
  means stale indexes or an out-of-sync mirror. Run `sudo apt-get update` on the
  customer host and check that Ubuntu release, updates and security sources are
  consistent. If necessary select a synchronized mirror; do not disable signature
  or hash checks or pin an obsolete package version to bypass the failure.
- `unmet_dependencies`: inspect apt's named dependency and the configured suites,
  repository components, pins and candidates. Make those sources consistent.
- `held_or_broken_packages`: inspect `apt-mark showhold` and `dpkg --audit`.
  Resolve the customer's held/broken or interrupted transaction deliberately;
  the operator does not remove holds or run a repair transaction automatically.
- `dpkg_lock`: let the owning apt/dpkg or unattended-upgrades process finish.
  Do not delete lock files or kill a package writer to force progress.

These classes are diagnostic hints, not permission to retry automatically.
Before installation starts, refresh the plan and approval after changing apt
state. For an incomplete operation, retain its original approval and inspect
its phase, native dpkg state and entry closure before deliberate continuation.
No index update, repair, removal, downgrade or hold change is implicit.

Only non-Ubuntu archive verification and staging are offline. The manifest
retains complete component/file digests and upstream licence records for those
archives, including Node third-party notices and npm package notices/licences.
These records do not grant
rights beyond upstream terms; in particular the Claude SDK/bridge dependencies
retain their supplied terms, not a blanket MIT licence for the bundle.

Optional archives use the same trust boundary and link-free format. Build a
selected, release-qualified profile from its checked-in lock the same way
(for example `./scripts/build-profile-runtime.sh editor NEW_OUTPUT`), copy its
archive beside the others and add its `artifact.json` to the same descriptor
array before writing the manifest, in a fresh directory.

Transfer every archive named by the manifest, not just `core.tar.gz`.
The helper writes, verifies and stages **all** manifest profiles; it cannot
silently call core-only verification a complete profile verification. Every
profile needs a complete file/component/licence inventory. Npm components require their corresponding complete native locks even in optional
archives; Ubuntu debs are never shipped. The uv archive also carries the exact release source and every crate
in that source's Cargo.lock, with retained notices and declarations; keep those
sources with the archive when redistributing. Editor executable aliases use its
bundled Node and real target paths, not the recipient's ambient Node.

A buildable lock alone is not a qualified or advertised capability. Exclude a
profile from the delivered manifest when its licence/redistribution closure or
mapped-user workflow remains unverified; report a typed reason with the release
evidence. Never copy personal skills, provider configuration or credentials.
Profile selection and install/activation still belong to the host executor;
this helper does not write runtime selectors or provider/editor configuration.

Non-Ubuntu locks need a compatible Ubuntu platform. Ubuntu owns all of its
packages and their security updates, including git, gh, tmux and profile tools.
Qualify the direct requirements in a disposable current Ubuntu 24.04 container
with `bash scripts/test-ubuntu-requirements.sh`; this is a real apt transaction,
not mapped-user workflow or live installation acceptance.

For copyleft redistribution, provide corresponding source or a compliant offer
as the applicable licences require. A retained copyright inventory alone is not
that offer. The uv profile carries its locked source graph; Ubuntu source
provision and any provider entitlement remain release/operator obligations,
not a blanket licence grant from a development release.

Before installing, the runtime release can be checked unprivileged with the
`bin/runtime-release` of a product package whose own bytes matched GitHub's
stated digest. Take the version and the manifest digest from the GitHub
release, never from a checksum file beside the download:

```sh
gh api repos/Open-Habitat/open-habitat/releases/tags/<tag> \
  --jq '.assets[] | select(.name == "release-linux-<arch>.json") | .digest'
/path/to/product/bin/runtime-release verify \
  --directory /srv/incoming/runtime \
  --version <exact-runtime-version> \
  --manifest-sha256 <64-hex digest after "sha256:">
```

It always emits JSON and takes no `--json` flag. The directory must contain
`release.json` and **every** archive named by the manifest. The version is the
**runtime** version, which may differ from the product version when a newer
product reuses unchanged runtime bytes. Exit 0 with `data.status=verified`
means the manifest hashes to the given digest and the complete archive closure
matches it; it is not installed-host qualification.

For private staging, root may use `runtime-release stage` with the same inputs
and `--stage-parent <existing-root-owned-0700-directory>`. The caller must
establish trusted parent ancestry; this build tool is not an installation
executor. It verifies the pinned target, complete inventory, file bytes,
licence references and npm locks before extracting into a new private child;
it never activates that child, starts a service or installs/downgrades a package.
No installation readiness follows from staging alone. Newer Ubuntu security
updates satisfy the declared minimums; never downgrade or hold packages to match
an old build. The customer's apt owns all Ubuntu dependency closure and updates.

Use `bash scripts/test-ubuntu-requirements.sh` to qualify the apt adapter in a
disposable Ubuntu container. It does not prove multi-user daemon startup,
provider consent, customer projects, quota preparation or live activation.
The older networkless runtime VM recipes expect the previous archived-deb
format; they are not schema-2 qualification. Initial installation must pass the
new product's host plan/apply checks and the customer's real acceptance.

### Headless QA browser assets

The headless shell is part of the core runtime, which installs it at
`/opt/open-habitat/core/browsers/` (see "Reading web pages" below). The
`browser` archive adds Python Playwright's qualification wheelhouse for QA
processes. When selecting it, also select its authenticated Python/uv/
native-build dependency profiles, and retain the wheelhouse separately from
customer dependencies. Set
`PLAYWRIGHT_BROWSERS_PATH=/opt/open-habitat/core/browsers` for QA processes. Project-local Playwright must match the archive's locked version;
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
`/opt/open-habitat/pi-runtime.json`. Host apply and upgrade also publish
`/opt/open-habitat/site-origin.json`, the declared `gateway.origin` and whether
`views` is declared, world-readable so a person's agent can give them links to
this site and knows whether it can show views; daemons treat it as display
data only. Pi and gh authorization still belong to
each person's native stores. No install or login step downloads Pi or shares a
provider key. An unmet Ubuntu minimum or non-Ubuntu archive mismatch is a typed qualification failure, not
permission to downgrade a customer security update or install apt holds.

Every installation's core runtime also carries **Taskfleet 0.20.0**, the
**workmux 0.1.278** it creates worktrees with, Taskfleet's bundled Pi skills
and a `pi` launcher, in `/opt/open-habitat/core/agent-bin` and
`/opt/open-habitat/core/taskfleet/skills`. Install and upgrade bring them like
the rest of the core runtime; there is nothing to set up per person. Each
binary is the upstream release archive pinned by SHA-256, with its licence, the
Cargo.lock it was released from and every locked crate's licence record in the
closure. A person's agents and terminal find these commands last on their
`PATH`, so `taskfleet run create` works from any conversation and its Pi
workers run the release's own Node and Pi through the launcher; a Taskfleet or
Pi the person installed in `~/.local/bin` takes precedence. The skills reach
Pi through a shipped extension (`/opt/open-habitat/core/taskfleet/extension.mjs`)
that offers them after Pi's own discovery, so a skill of the same name the
person or the repository has wins. Nothing is written into a person's Pi
settings. Taskfleet runs its supervisors and tmux
server as transient units in the person's own user manager, which the broker's
lingering keeps available. `host check` names it as `runtime.taskfleet`:
`taskfleet_runtime_planned` before the release's generation is installed,
`taskfleet_runtime_installed` when the installed bytes are the pinned ones, and
`taskfleet_runtime_drift` when they are not. Git and tmux are Ubuntu
requirements of the core runtime.

Browser conversations and the composer's `/` list load a workspace's own
project resources: skills in `.agents/skills` or `.pi/skills`, prompt
templates, `.pi/settings.json`, project MCP servers from `.pi/mcp.json` and
project extensions, including packages those settings name, which Pi installs
on first use. Pi guards these with its project trust, whose prompt RPC mode
cannot show; without a decision it skips them silently. The daemon therefore
starts Pi with its own one-run `--approve` when the working directory,
symlinks resolved, lies below the person's `~/src`, which includes Habitat's
and Taskfleet's worktrees in `~/src/<workspace>__worktrees`. Elsewhere Pi's
default stands. Trust does not limit what the agent's tools can do, and the
person's agent already runs code in these directories, so the prompt would
protect little here. Nothing is written to `~/.pi/agent/trust.json`; a
`false` the person saved there for the directory or its nearest ancestor is
honoured by leaving the flag out, as is a store the daemon cannot read, so
that Pi decides from its own read. The release's `pi` launcher
(`/opt/open-habitat/core/agent-bin/pi`), which runs Taskfleet's Pi workers and
`pi` in a Habitat terminal, applies the same rule to its working directory and
the store Pi reads (`$PI_CODING_AGENT_DIR/trust.json` when that is set), so an
unattended worker in a repository with its own skills does not stop at Pi's
trust prompt. It leaves the flag out when the caller already chose
(`--approve`, `--no-approve` and their short forms) and for `--session` and
`--resume`, which can open a session whose directory is elsewhere. Once
started, Pi applies a run's `--approve` to every directory it switches to, so
a session resumed from inside interactive Pi is trusted as well. A person's
own `pi` earlier on `PATH` is not affected.

Agents search the web through the AI provider the person already uses, with
no search key or service to set up. A shipped extension
(`/opt/open-habitat/core/web-search/extension.mjs`), loaded by the launcher and
browser conversations like the skills extension, adds the provider's own
search tool to each request: OpenAI's for the ChatGPT subscription and OpenAI
keys, Anthropic's search and fetch for Anthropic keys. On the Claude
subscription the core runtime's Claude bridge lets Claude Code run its own
WebSearch and WebFetch. Searches count against the person's plan or are billed
to their key as the provider prices them, and the queries go to that provider.
Where an organisation has turned web search off for its API key, the first
request of a conversation fails with the provider's error and the conversation
continues without search. Other providers get no search this way.

#### Reading web pages

Every agent also has a `read_page` tool. It opens a URL in the core runtime's
headless Chromium (`/opt/open-habitat/core/browsers/`) as the person and
returns the rendered page's readable text, its links and, on request, a
screenshot. It is loaded by the launcher and by browser conversations, like
the search extension. Each read starts logged out and keeps nothing. Pages go
only to the site, never to a rendering service. A read is bounded:

- 60 seconds at most (30 by default);
- 25 MB of transfers;
- two reads at a time per agent process.

Every connection of a read goes through a proxy of that read inside the
agent's process. The proxy refuses loopback, private, link-local and CGNAT
(tailnet) addresses unless the agent's own URL is such an address, and
WebRTC is kept to the proxy. A page cannot reach services on the host or the
person's network by redirect, script, worker or DNS rebinding.

Chromium runs only with its sandbox. On Ubuntu 24.04 that needs the AppArmor
profile `/etc/apparmor.d/open-habitat-headless-shell`, which grants user
namespaces to the shell in release generations, as Ubuntu's own profile does
for Google Chrome. Apply and upgrade install and load it. Without it, the tool
answers that the browser cannot start its sandbox, and nothing is read. The
shell adds about 110 MB to the core runtime download and about 285 MB on
disk on amd64; the figures for arm64 are 115 MB and 360 MB, because that
build is not stripped. Chromium's Ubuntu libraries (in the core's
`ubuntu-packages.json`) add up to 64 MB of packages and 262 MB on disk on a
minimal system; a server that already has some of them needs less.

The proc exemption group must have no ordinary members. Only logind and polkit
receive it through the installed drop-ins; never exempt the gateway, daemons,
users or a shared administrative group. Check the effective `/proc` mount and
running service groups after installation/reboot. User resource budgets such
as `MemoryMax=`, `TasksMax=` and `CPUWeight=` remain customer policy.

A person's daemon, and the Pi conversations and tools it starts, have a
private `/tmp` that disappears whenever the daemon stops, as on every upgrade.
Their `/var/tmp` is `/var/lib/open-habitat-tmp/<user>/` on the host, which
systemd creates for the daemon unit as that user, mode `0700`. It survives
restarts, upgrades and reboots as `/var/tmp` does over SSH, but no other
account can see it. The person's browser shell and SSH sessions see the
host's own `/var/tmp`, so to them an agent's files are under that path.
Like the host's `/var/tmp`, it lives on `/var`, not in the home, so it does
not count against per-user limits. The tmpfiles policy removes anything in
it that has not been used for 30 days. If you remove an account by hand,
remove its directory there too: a later account with the same name would
inherit it.

The workspace editor is optional and needs three things. First, a same-site per-person hostname namespace: for `app.example.org`, set `oauth.editor_origin` to `https://oh-code-*.example.org`. The single `*` is substituted with a deterministic 52-character lowercase identity hash. It must occur inside the leftmost DNS label; that expanded label must fit 63 characters. HTTPS DNS names only, without ports, paths, credentials, queries or fragments. The browser frames the editor beside the conversation, and its session cookie reaches the frame only when app and editor share the registrable domain.

Reserve this namespace for the gateway. Supply wildcard DNS and tunnel/ingress routing to the same gateway listener, preserving the browser's Host header, and a public-edge certificate covering the resulting hosts. This single-label form works with Cloudflare Universal SSL's `*.example.org` coverage. A zone-wide wildcard route also sends unrelated names to the gateway: only the exact configured app host serves the app, only identity-bound child hosts accept editor sessions, and other hosts are rejected (health/readiness probes remain available). Do not delegate editor child names or serve unrelated content on them. Apply the same access policy and trusted ingress-header handling to every child host. For a TLS origin hop, retain certificate verification with an explicit verified origin TLS server name and CA, or provide a certificate covering the child hosts.

Alternatively, `https://code.example.org` reserves deep children `<id>.code.example.org`. This costs an additional wildcard certificate for `*.code.example.org`; Cloudflare Universal SSL does **not** cover it (use Advanced Certificate Manager or an appropriate custom edge certificate). Route and secure those children as above. The base host itself never accepts editor sessions. A previous single-host configuration therefore fails closed at that host without breaking the app; changing DNS alone does not make a shared editor host safe. Without `editor_origin` no editor is offered. Never serve the editor on the app's own host: code-server runs extension and webview code on its origin.

Second, a pinned code-server release (4.141.0 is the verified one) unpacked into a root-owned, non-user-writable tree, and `/opt/open-habitat/editor.json` with `{"code_server": "<tree>/bin/code-server"}` and optionally `"idle_timeout_seconds"` (default 1800), root-owned like `pi-runtime.json`. Third, nothing else: the daemon writes Open Habitat's small built-in VS Code extension (it opens conversation file links at their line) next to code-server's own built-in extensions in a private per-person directory at each start, so no extension is installed into code-server or any home. The daemon starts code-server as the person on first use, on a `0600` socket with authentication off (the socket and the daemon relay are the authentication), as `open-habitat-editor.service` with `systemd-run --user` when the account lingers and otherwise as its own child; code-server stops itself when idle. Its settings, extensions and workbench state are code-server's own, under `~/.local/share/code-server/`; the host stores nothing else about the editor. Each editor process costs roughly 150 MiB idle and 0.5–0.8 GiB with a folder, a file and a terminal open, so budget memory per active person.

Agent HTML views are optional too. An agent offers a workspace HTML file or a small static site (`open-habitat agent view offer`); the person opens it beside the conversation or in a tab of its own. Each view runs on a host of its own, so the installation needs a second same-site namespace: in `site.json` set `views.origin_template`, which host apply publishes as `oauth.view_origin`, to for example `https://oh-view-*.example.org` for an app at `app.example.org`. The rules are the editor template's single-label form: one `*` in the leftmost label, substituted with a 52-character label derived from the person and the view, HTTPS without port or path, never matching the app host, and it must not be able to name an editor host (`oh-code-*` and `oh-view-*` side by side are fine). Route the namespace like the editor's (wildcard DNS and ingress to the same gateway listener with Host preserved, certificate coverage such as Cloudflare Universal SSL's `*.example.org`, the same access policy on every child host). A view host serves nothing but one view's frozen files, read from the person's own `~/.local/state/open-habitat/views/` through their daemon, with a sandboxing CSP on every response; its cookie is host-only, `SameSite=None` (the sandboxed page's own requests are cross-site) and authorizes reading that one view while the app session lasts. No unit, socket or service is added. Without `views` the browser shows no view card, so a person's daemon refuses view offers with `views_unavailable` (the agent offers the files instead) and nothing else changes; the published `/opt/open-habitat/site-origin.json` says which applies. Views are owner-only unless the operator enables shared links: `views.link_max_days` (1–365, published as `oauth.view_link_max_days`) lets a person publish, in the browser only, one of their views or file offers so that anyone who has its link can open it without signing in, for at most that many days at a time. A published file offer opens as a page the gateway writes (its files, with images, video and audio shown, a one-file table or text's beginning, and every file and the whole offer downloadable), read from the owner's `~/.local/state/open-habitat/files/` through their daemon like a view's files. Each view and offer has one address, reserved privately when the browser first needs it and kept until deleted: publishing, expiry and stopping sharing never change it, so sharing again revives earlier copies, and a newly exported version is a new view with its own address. The content lives on the address's own host of the same view namespace (`https://oh-view-<label>.example.org/<token>/`), so it needs no new DNS name or certificate; the token is the first path segment, and the content host sets and reads no cookie and serves only that view while it is public, read from the owner's daemon on every request, with `noindex` and a disallowing `robots.txt`. The gateway keeps the addresses in `/var/lib/open-habitat-gateway/view-links.json` (0600, beside the sessions; it holds the secrets). Removing the setting pauses every publication and restoring it resumes those not yet expired. A removed, loosened or unreadable file disables view addresses (the gateway logs `view_address_store_unavailable` with a fixed reason) without touching the rest of the app or the file; restore it and restart the gateway. An administrator lists current publications' metadata (never an address) and deletes any address for good in Settings › Käyttäjät ja pääsy, and revoking or withdrawing a person deletes theirs. The release that introduced stable addresses resets the earlier movable links once during `host upgrade` (the plan names `upgrade.view_addresses`): every link shared before it stops working, and a gateway started on that older file disables addresses until the upgrade's reset (`open-habitat upgrade-view-addresses`, run as the gateway account with the gateway stopped) has run. The gateway bounds public reads per address and per site (concurrent relays and a daily byte budget, reset by a restart). Habitat's `oauth.access` pin does not apply to GET/HEAD reads of currently public entry addresses (`/n/<entry>` on the app host) and their token-bearing content paths on view hosts. Private addresses, owner frames, APIs and all other application paths remain behind the pin. For "anyone" to mean the internet, both the entry route and view namespace must reach the gateway without an ingress access policy or edge cache in front of them. An upstream policy such as Cloudflare Access, or tailnet-only network reachability, still limits who can open public links; that remains the operator's choice.

A view address is a bearer secret in a URL path, so the ingress in front of the gateway must neither record nor cache it. The secret appears in three places: the entry path `/n/<entry>` on the app host, the first path segment of every request on a content host (`https://oh-view-<label>.example.org/<token>/…`), and the query of the sign-in start (`/auth/github/start?return_to=/n/<entry>`) when someone opens a private address before signing in. The gateway itself never logs these: its request diagnostics name the route class, never the path or the query, and the sign-in keeps the destination with the pending flow instead of passing it to GitHub. Every entry, redirect, error and content response carries `Cache-Control: no-store`, `Referrer-Policy: no-referrer` and `X-Robots-Tag: noindex` and sets no cookie, and the gateway rechecks publication, expiry, the site's switch and the owner's denial on every content request, so a recipient's bookmark of either URL stops working when the address does. These guarantees end at the gateway. A reverse proxy's access log, a tunnel's request logging at debug level, a CDN's request logs or log export, and URL analytics on the app or view hosts would each keep the secrets, and an edge cache that overrides `no-store` (such as a Cloudflare *Cache Everything* rule with an edge TTL) would go on serving a redirect or content after the owner made the view private, an administrator deleted it or the person was revoked. So exclude the app host's `/n/` and `/auth/github/start` paths and the whole view namespace from access logs and analytics, or keep such logs as private as `view-links.json`, and put no cache rule over the app host or the view namespace. To check an installation, publish a view, then `curl -sI https://app.example.org/n/<entry>` twice: each answer is `302` to the content host with `no-store`, and behind Cloudflare `cf-cache-status` is `DYNAMIC` or `BYPASS`, never `HIT`. Make the view private and repeat: the entry answers `200` with the app page and the content URL `404`.

The interface is in Finnish and English. Each person chooses System, Suomi or English in Settings › Appearance; the choice lives in their own `~/.config/open-habitat/preferences.json` and follows them across devices. Someone who has not chosen gets the server default, and System follows the browser: a Finnish browser gets Finnish and any other language English. The installation sets the default with `ui.default_language` (`system`, `fi` or `en`; omitted means `system`) in `site.json`, which host apply publishes as `oauth.default_language`. An administrator's choice in Settings › Server takes its place and is kept in the gateway's administration state, so a later apply does not undo it. Sign-in and the landing page know no person yet and follow the server default and the browser; the gateway answers them at the public `GET /api/v1/site/language`, which names nothing but that default.

Agent file offers need no configuration. An agent offers workspace files to the person in a conversation (`open-habitat agent file offer`); the person previews and downloads them on the app's own host. The daemon freezes a copy under the person's `~/.local/state/open-habitat/files/` (at most 200 files and 512 MiB per offer, counted against their quota) and serves only that person's offers to their own session; the gateway serves the bytes as attachments, with only images, audio and video announced by type for the app's own elements, and a sandboxing CSP on every response. Offers stay until the agent removes them.

## Integrations

Every installation ships the integration tools in the required `integrations`
profile, so a site's `profiles` always lists `core` and `integrations`. The
profile carries **himalaya 2.2.1** (IMAP), **rclone 1.71.2**, **gog
0.39.1**, **tea 0.16.0** (Gitea), **glab 1.124.0** (GitLab), **sops 3.13.3**
(the person's own SOPS, at `/opt/open-habitat/profiles/integrations/bin/sops`), **tailscale/tailscaled 1.104.4** (each person's own Tailscale node, below), **@softeria/ms-365-mcp-server 0.170.1** with the `microsoft-native`
adapter, **MSAL 5.6.0** and their own **Node 22.21.1**, and a Pi wrapper that
runs the same release's core **Pi 1.5.2** for native `pi mcp add/remove`. Each
upstream executable is pinned by archive and file SHA-256 with its upstream
licence texts as a component of the manifest's closure. CalDAV and CardDAV use
Ubuntu's `/usr/bin/curl`, which the profile declares as an Ubuntu requirement.
Nothing is downloaded at login or run time, and no tool is installed by hand.

Apply and upgrade write the `tools` section of
`/opt/open-habitat/integrations.json` (root:root `0644`, readable by mapped
users), pointing at `/opt/open-habitat/profiles/integrations/bin/<tool>` and
`/usr/bin/curl`. The profile link moves with each upgrade, so the file does not
change. The product owns only `tools`: every other section is the operator's
and is kept byte for byte. A plan refuses an existing file that is not a
single-link, root-owned regular file holding one JSON object without group or
world write (`installation.integrations_config`) rather than replacing it. IMAP, CalDAV and CardDAV are available as soon as apply
completes. Google, Microsoft and Dropbox show as waiting for the administrator's
app settings until their app section below is added; the daemon reads the file
on demand, so no restart is needed. Keep actual app values out of git and shell
arguments.

An administrator normally adds the app sections in the browser, under Settings
→ Palvelimen ylläpito → Palvelinintegraatiot, which guides the Google setup step by
step. The root broker writes the one section asked for, keeps every other byte
of the file, and does so under the same operation lock as apply, so a request
during maintenance is refused (`host_busy`) and nothing is written. Root can do
the same with `open-habitat admin integrations set|clear --provider P`, giving
the secret on stdin (`--client-secret-file -`). `admin integrations list` and
`host plan`'s `integrations` show each section's client id and who set it when;
a section edited by hand shows as root's. Secrets are never shown. To keep the
file root's alone, set

```json
"integrations": {"browser_setup": false}
```

in site.json and run apply; the broker then refuses browser and CLI writes, and
hand edits work as before. The broker's service needs `/opt/open-habitat`
writable for this, which the shipped unit declares. Every person still connects their own accounts in Settings →
Integrations; the operator configures no one's connection.

### Own machines over Tailscale

Settings → Omat koneet lets a person give their agent SSH access to their own
computer over their own tailnet. The operator configures nothing: the
integrations profile ships Tailscale's static `tailscale` and `tailscaled`,
and the person's daemon writes and starts a systemd **user** unit
(`~/.config/systemd/user/habitat-tailscale.service`) in their account. It
needs the person's user manager to run with lingering, which the broker
enables for admitted accounts; without it the page says the account's
services cannot be started. Each node runs in userspace networking, adds no
interface, route or DNS to the host, opens no TCP port, keeps its LocalAPI
socket in the account's `0700` runtime directory and its state in
`~/.local/state/habitat-tailscale`, and its locked config keeps shields up.
The host itself never joins a tailnet for this feature.

What an administrator must know and tell people: **root on this server can
use a person's grant.** The account's SSH key and the node's key are files in
the home, so root can read them or run `ssh` as the person. The grant is
bounded by the person's machine: one line in `authorized_keys` with
`restrict` and `from=` the node's tailnet address, and on a Mac Remote Login
for that one user without full disk access. By default the line has no end
and stays until the person removes it; a person who picks 7, 30 or 90 days
gets `expiry-time=` as well, which on Windows needs the machine's OpenSSH
Server 8.2 or newer. On Windows, for a member of Administrators the line goes in
`%ProgramData%\ssh\administrators_authorized_keys`, which an elevated
PowerShell writes.
The page says this before anything is saved. Removing a machine in Habitat
does not withdraw it from a copy of the key; the person removes the line on
the machine, which the page gives as a command.

### Gitea and GitLab servers

A Gitea or GitLab connection needs no app section: each person pastes their
server's address (gitlab.com by default for GitLab) and a personal access
token in Settings → Koodipalvelut, and the token lives only in their own tea
or glab file (`~/.config/glab-cli/config.yml`, one account per GitLab server). What the operator provides is the route and
the trust. The host must reach the Gitea's HTTPS address by DNS or IP over the
network, LAN or VPN the operator has set up; the connector refuses link-local,
metadata, unspecified and multicast destinations, and dials loopback only when
the person typed a loopback address. A certificate from a private CA is trusted
through the OS store (`/usr/local/share/ca-certificates/` and
`update-ca-certificates`), never through the connector. Each person's daemon
reads that store once when it starts, so after adding a CA restart the daemons
that should use it (`systemctl restart open-habitat-daemon@<user>.service`);
Git, tea and glab read it on every run. Without the route or the trust a
connection attempt answers `unreachable` or `tls_untrusted`, and nothing is
written. A self-hosted GitLab whose `external_url` names another address than
the one people connect to has its projects left out of the list (the token is
never sent elsewhere); fix `external_url` on the GitLab server.

### Dropbox app registration

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

Add this section to `/opt/open-habitat/integrations.json` beside `tools`:

```json
"dropbox": {"client_id": "<Dropbox app key>", "client_secret": "<Dropbox app secret>"}
```

These are the installation's app credentials, not a person's tokens.

Verify a real account's consent, initial quota-checked sync, local edit upload,
cloud edit download and reconnect after a daemon restart before relying on it.
The initial choice covers the **whole Dropbox**, not selected subfolders. Its
files live under `~/cloud/dropbox/<lowercase-email>/`. The first import can take
minutes or hours; the dialog stays open while it runs and can cancel it.
A daemon restart, including a release upgrade, stops a running first import and
does not resume it; the page then reports that the first sync is incomplete,
and signing in again repeats the initial choice. The same holds for Google Drive.
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

#### Dropbox account levels

A person chooses one of three levels when connecting, and *Vaihda taso…*
changes it later with a new sign-in. Dropbox enforces each one:

- **Koko Dropbox** (full) is the application above with all its scopes; files
  sync both ways under `~/cloud/dropbox/<account>/`.
- **Vain luku** (read) asks the same application for `account_info.read`,
  `files.metadata.read` and `files.content.read` only, so it needs nothing
  more from the operator. Its files are a one-way mirror of Dropbox
  (`rclone sync`): local changes never reach Dropbox and the next pass
  overwrites them. The person chooses the mirror like the two-way sync, and
  local files the first mirror pass would overwrite or delete go to the backup
  directory above.
- **Vain sovelluskansio** (app folder) needs a second application, created as
  **Scoped access → App folder** with the same permissions and redirect URI.
  It sees only `Apps/<application name>/` in the person's Dropbox, which syncs
  both ways under `~/cloud/dropbox-app-folder/<account>/`. Its section is

  ```json
  "dropbox_app_folder": {"client_id": "<App folder app key>", "client_secret": "<App folder app secret>"}
  ```

  (`admin integrations set --provider dropbox_app_folder`, or the level's row
  under Dropbox in Palvelinintegraatiot). Without it the level is shown greyed
  out and refers people to the administrator.

The level an account shows is read from what it was granted: the token
response's scopes, which rclone's config keeps beside the token
(`habitat_grant`), and the application the sign-in used. A level change that
stops a two-way sync, or moves to another root, first runs one more two-way
pass with the old login, so nothing made locally is left behind; if that pass
fails, nothing changes and the new login is revoked. After a level change, and
after any other new sign-in, the daemon revokes the replaced login at Dropbox.
A level change to another root leaves the old directory in place, no longer
synced; so does replacing the App folder application, whose accounts then
sync a directory of their own (`~/cloud/dropbox-app-folder/<account>.<id>/`)
after signing in again. A pair a critical abort set aside cannot run that last
two-way pass, so a level change away from it is refused until it is recovered.

### Google app registration

Add this section to `/opt/open-habitat/integrations.json` beside `tools`:

```json
"google": {
  "client_id": "<installed Google OAuth client ID>",
  "client_secret": "<installed Google OAuth client secret>"
}
```

Agents use gog through the absolute path the generated personal-data skill
names. Use an **installed/Desktop** OAuth client; no redirect URI is registered, the
daemon uses `http://localhost` (no port) and the person pastes it back. Tick
**Use this client for an AI-powered agent** when creating it: only agents use
this client, the flag grants nothing extra, and some Google MCP endpoints accept
only a client marked as an agent. Enable these APIs in its Google Cloud
project; one link enables them all:
<https://console.cloud.google.com/apis/enableflow?apiid=gmail.googleapis.com,calendar-json.googleapis.com,drive.googleapis.com,people.googleapis.com,sheets.googleapis.com,docs.googleapis.com,slides.googleapis.com>
(add `&project=<project number>`, the client ID's leading digits, to open it in
the right project; once the client is saved, Settings → Palvelimen ylläpito →
Palvelinintegraatiot → Google → Tunnukset → Ota API:t käyttöön Google Cloudissa opens it
filled in).

| API | Used for |
| --- | --- |
| [Gmail API](https://console.cloud.google.com/apis/library/gmail.googleapis.com) | `gog gmail` |
| [Google Calendar API](https://console.cloud.google.com/apis/library/calendar-json.googleapis.com) | `gog calendar` |
| [Google Drive API](https://console.cloud.google.com/apis/library/drive.googleapis.com) | Drive sync and `gog drive` |
| [People API](https://console.cloud.google.com/apis/library/people.googleapis.com) | `gog contacts` |
| [Google Sheets API](https://console.cloud.google.com/apis/library/sheets.googleapis.com) | `gog sheets` |
| [Google Docs API](https://console.cloud.google.com/apis/library/docs.googleapis.com) | `gog docs` |
| [Google Slides API](https://console.cloud.google.com/apis/library/slides.googleapis.com) | `gog slides` |

The Drive scope already reaches Sheets, Docs and Slides; their APIs only need
enabling. Until an API is enabled, Google answers its calls with "… API has not
been used in project N before or it is disabled" (gog reports it as not enabled
for the OAuth project), however the person signed in; the personal-data skill
tells agents to report it as this administrator action. The requested permissions are `openid`, `email`,
`https://www.googleapis.com/auth/drive`,
`https://www.googleapis.com/auth/gmail.modify`,
`https://www.googleapis.com/auth/calendar`, and
`https://www.googleapis.com/auth/contacts`. No Gmail settings/sharing or
Workspace domain-wide delegation is requested. The browser setup configures the
consent screen as **Internal**, which requires Google Workspace: only the
organisation's accounts can connect, and Google's verification is not needed.
An External app in Testing needs every tester added and its refresh tokens for
these scopes expire after seven days; in production it needs Google's
verification, not a host-side workaround. A person may leave services out on
Google's consent page: the account connects with what was granted, and the
page shows the rest as not granted. No incoming port, shared localhost
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

#### Google account levels

A person chooses **Täysi** (the scopes above) or **Vain luku** when
connecting, and *Vaihda taso…* changes it later. Both use the one client
above, so the operator registers nothing more: Vain luku asks for
`drive.readonly`, `gmail.readonly`, `calendar.readonly` and
`contacts.readonly` (each under `https://www.googleapis.com/auth/`). Add them
to the consent screen's data access beside the full set; an External app's
verification covers them as restricted scopes too. The drafts level is shown
greyed out as one Google does not offer, because Gmail's drafts scope also
sends. A read grant's Drive is a one-way mirror (`rclone sync`, rclone's own
`scope = drive.readonly`), chosen and backed up like the Dropbox mirror.

The level is read from the grant gog keeps. Google's revocation of any token
ends the person's whole grant to the client, so a level change revokes the
old grant at Google *before* the new sign-in starts, after one more two-way
Drive pass where Drive stops syncing both ways; if either fails nothing
changes (`final_sync_failed`, `revoke_failed`). A sign-in the person then
abandons leaves the account signed out until a renewal. A renewal at the same
level revokes nothing.

Before relying on a live account, verify browser consent, initial sync,
local-file upload, cloud-file download, daemon restart, all three gog services,
a second account and removal. Synthetic tests do not establish provider consent
or live synchronization. Keep the test installation's actual app values in its
operator secret management, never in this repository or command arguments.

### Microsoft app registration

Microsoft 365 uses one **single-tenant public client** registered in the
organisation's own Microsoft Entra tenant. Only that organisation's work
accounts can connect; personal Microsoft accounts (Outlook.com, OneDrive
Personal) and other organisations cannot. A single-tenant app cannot sign in
through `common` or `organizations`, so the daemon, the root broker and the
native adapter accept only the tenant's GUID.

An administrator normally sets it in the browser: Asetukset › Palvelimen
ylläpito › Palvelinintegraatiot › Microsoft 365 › *Aseta tunnukset…* walks through the
Entra admin center (`https://entra.microsoft.com`, App registrations) step by
step. By hand, in the Entra admin center:

1. *Entra ID › App registrations › New registration*: any name, *Supported
   account types: Single tenant only*, no redirect URI, *Register*.
2. *Authentication*: *Allow public client flows* enabled (device code), and
   the *Mobile and desktop applications* redirect URI
   `https://login.microsoftonline.com/common/oauth2/nativeclient`, which the
   consent link names. No client secret is created.
3. *API permissions › Add a permission › Microsoft Graph › Delegated
   permissions*: `openid`, `profile`, `User.Read`, `offline_access`,
   `Files.ReadWrite.All`, `Sites.ReadWrite.All`, `Mail.ReadWrite`,
   `Mail.Send`, `Calendars.ReadWrite`, `Contacts.ReadWrite`,
   `Team.ReadBasic.All` and `Channel.ReadBasic.All`. The last two only list
   the person's teams and channels by name so their files can be found;
   Microsoft does not require administrator consent for them, but this app's
   sign-in asks for what the tenant consented to, so an existing
   registration must have them added and consented before Teams files appear.
4. *Grant admin consent for <organisation>* (Cloud Application Administrator,
   Application Administrator or Privileged Role Administrator), so nobody is
   asked to consent and the tenant's user-consent policy cannot block a person.
   A sign-in asks for what the tenant consented to the application (Graph's
   `.default`), so an organisation that consents to less, for example
   `Mail.ReadWrite` without `Mail.Send`, still connects: the page shows each
   service's level and what was not granted, and the Outlook tool is started
   with only the granted permissions. `User.Read` is required.

The application's *Overview* shows both values. `admin integrations set
--provider microsoft --client-id <Application (client) ID> --tenant-id
<Directory (tenant) ID>` writes them through the broker; by hand the section
of `/opt/open-habitat/integrations.json` beside `tools` is:

```json
"microsoft": {
  "client_id": "<Application (client) ID>",
  "tenant_id": "<Directory (tenant) ID>"
}
```

Files sync through rclone; abraunegg/onedrive is not used. The MCP tool and
adapter run on the profile's own Node and modules, never `npx`, a global
install or ambient `node`.

The page shows **one device code** for the combined file/Outlook scopes.
After approval, the adapter redeems the grant's refresh token through MSAL and
writes only the MCP tool's native encrypted cache in an unpublished staging
directory. rclone receives its own native token configuration. No host cache or
credential copy is retained. Every native refresh uses the tenant as its
authority. The MCP cache is private to that account, uses the native
headless file-encryption backend, and is pinned by username. Pi's own
`~/.pi/agent/mcp.json` holds the server entry; no host connection registry exists.
New agent conversations discover it and the generated personal-data skill;
existing conversations may need a reload.

With a files or sites grant, the same server also lets agents find files
by Microsoft Search across every OneDrive, SharePoint site, team and shared
item the person can open, list one folder, and fetch single files into
`~/cloud/microsoft-fetched/<account>/`. It offers no file tool that uploads,
moves, shares or deletes, at any level. This needs no change to the Entra
application: the profile build rewrites the scope metadata of exactly these
tools in the pinned server so that it requests the `Files.*.All` and
`Sites.*.All` permissions the application already holds, and refuses to
build if the upstream metadata changes. Accounts connected before this
release are re-registered with the tenant's current grant when the daemon
next checks them.

If consent is still missing when a person connects, the page shows an
administrator link plainly. It goes to the tenant's own administrator:

```text
https://login.microsoftonline.com/<TENANT_ID>/v2.0/adminconsent?client_id=<APP_CLIENT_ID>&redirect_uri=https%3A%2F%2Flogin.microsoftonline.com%2Fcommon%2Foauth2%2Fnativeclient&scope=openid%20profile%20User.Read%20offline_access%20Files.ReadWrite.All%20Sites.ReadWrite.All%20Mail.ReadWrite%20Mail.Send%20Calendars.ReadWrite%20Contacts.ReadWrite%20Team.ReadBasic.All%20Channel.ReadBasic.All
```

A Conditional Access policy blocking device code is a different failure; an
administrator must decide whether that flow is allowed. Do not bypass policy.

Folder choice selects whole OneDrive roots and whole document libraries from
**followed SharePoint sites** and from the **Teams the person has joined**
(each team's site, and the own site of each private or shared channel they
belong to; a standard channel's files are a folder of its team's library),
not every site in the tenant or individual subfolders. A site reached both
ways is offered once, named as followed. To add another site, follow it in
Microsoft first, then reconnect to rediscover libraries. Without
`Team.ReadBasic.All` the folder step says that Teams files were left out and
why; without `Channel.ReadBasic.All` it offers the teams' libraries and says
that private and shared channels were left out. Each library repeats the
sign-in's token in the account's rclone config, whose size is bounded, so a
person in very many teams gets the teams that fit, whole, and is told the
rest were left out. A shared channel the person belongs to without being a
member of a team that hosts it is not discovered. Re-login offers folder choice again, with the current
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
verify the consent-required link before admin consent and any applicable
device policy. Synthetic tests cannot establish real tenant consent or token
refresh.

#### Microsoft account levels

A person chooses a level when connecting, and *Vaihda taso…* changes it later
with a new sign-in. Every token of an Entra application carries all the
permissions consented to that application, whatever a sign-in asks, so each
level is its **own application**, registered exactly as above (single tenant,
public client, the same redirect URI, admin consent) but with the level's
delegated permissions:

| Level | Section | Delegated permissions besides `openid`, `profile`, `User.Read`, `offline_access` |
|---|---|---|
| Täysi (full) | `microsoft` | `Files.ReadWrite.All`, `Sites.ReadWrite.All`, `Mail.ReadWrite`, `Mail.Send`, `Calendars.ReadWrite`, `Contacts.ReadWrite` |
| Kaikki paitsi postin lähetys (nosend) | `microsoft_nosend` | `Files.ReadWrite.All`, `Sites.ReadWrite.All`, `Mail.ReadWrite`, `Calendars.ReadWrite`, `Contacts.ReadWrite` |
| Luonnokset, muu vain luku (drafts) | `microsoft_drafts` | `Files.Read.All`, `Sites.Read.All`, `Mail.ReadWrite`, `Calendars.Read`, `Contacts.Read` |
| Vain luku (read) | `microsoft_read` | `Files.Read.All`, `Sites.Read.All`, `Mail.Read`, `Calendars.Read`, `Contacts.Read` |

Every level's application also has `Team.ReadBasic.All` and
`Channel.ReadBasic.All`, beside `openid`, `profile`, `offline_access` and
`User.Read`: they read team and channel names only, and the files are read
or synced through the level's own files and sites permissions.

The nosend level is the full level without `Mail.Send`: mail is read,
organised and drafted but never sent. Graph cannot change a calendar without
sending invitations to attendees, nor files without the right to create a
sharing link, so those stay possible at this level. The drafts level sends
nothing: an event with attendees sends invitations and a file grant can
create a public sharing link, so only mail is writable. A level section has
the same two fields as `microsoft`
(`admin integrations set --provider microsoft_nosend|microsoft_drafts|microsoft_read`,
or Microsoft 365's guided setup in Palvelinintegraatiot, which walks the
levels still missing one application at a time and saves each at its end);
the tenant is the same for all four. A level without its application is shown greyed out and
refers people to the administrator; only the full level is needed for the
integration to be offered. The consent link a person may be shown names the
level's application and permissions.

The level an account shows is read from its grant (the tenant's answer to
each status check), never from what was chosen: an organisation that
consented to less shows what it granted, and a grant matching no level shows
its services one by one. An account keeps using the application its native
configs name; if the operator replaces or removes that application the
account asks to sign in again (`app_changed`). Read-only files (drafts and
read) are a one-way mirror (`rclone sync`) of the chosen roots: local changes
never reach Microsoft and the next pass overwrites them. A level change that
stops a two-way sync first runs one more two-way pass with the old login; if
it fails, nothing changes. Microsoft cannot revoke a single refresh token, so
the replaced login is deleted from the home but stays valid at Microsoft until
it expires or the person signs out of all sessions in their Microsoft account.
The level for files in selected folders only (`Files.SelectedOperations.Selected`)
is not offered.

## Agent command search path

Users install optional agent executables in their own `~/.local/bin`. The administrator installs shared tools in `/usr/local/bin` and verifies that `/usr/local` and `/usr/local/bin` are root-owned and not writable by any mapped user or group (for example, `stat -c '%U:%G %a' /usr/local /usr/local/bin` should show `root:root 755` for both). Debian installations may default to group-writable `root:staff 2775`; restrict that access before mapping users. Review provenance and updates because shared programs run with each invoking user's credentials. Browser-started Pi and its children search `$HOME/.local/bin:$HOME/.cargo/bin:/usr/local/bin:/usr/bin:/bin`, then the release's own directories (Claude Code and the core runtime's Taskfleet, workmux and `pi`), with the account's own directories taking precedence. The daemon takes HOME from its verified Unix account binding, not browser input. Configure each user's SSH login shell to use the same ordering if it does not already; systemd does not source shell profiles. Host-managed `gh` and `git` actions still use fixed `/usr/bin` executables and restricted environments, never a user's override. The separately pinned Pi runtime does not come from this PATH.

Before starting the broker, install the tmpfiles policy and establish the base
`/run/open-habitat` (`root:gateway 0750`) and `/run/open-habitat/users`
(`root:gateway 0710`) directories. Systemd tmpfiles restores these after reboot.
The shipped broker and both listener templates require the storage guard.
Both listeners additionally require `open-habitat-binding@<name>.service`,
which takes the broker's ledger lock, refuses incomplete/revoked/unbound state,
and verifies native account, binding config and (with per-user limits) quota
before reconstructing an
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
`quota.state: unavailable` is not evidence of working quota observation.
Without per-user limits it reports `quota.state: not_in_use` from the installed
storage policy. Installing
templates alone cannot establish a complete multi-user installation; test the
effective gates and both native user managers on the customer host.

Withdrawing a person (Settings › Käyttäjät ja pääsy › Poista pääsy, or
`open-habitat admin access remove --github-id <id>`) also stops what Habitat
started for the web: once the withdrawal is committed, the broker stops
`open-habitat-daemon@<name>.service`, which ends the Pi conversations the
browser started, and both sockets, and the broker journal logs
`broker_withdrawal_stop`. The account, home, credentials, the person's user
manager with their terminal tmux, Taskfleet workers and editor units,
lingering and SSH stay. If the stop fails or outlasts its budget, access is
already withdrawn and stays so, but the reply is `outcome_uncertain` and the
journal says `units_running`; run `admin access remove` again, which repeats
only the stop (the broker also retries it each time it starts, before it serves). Restore, and
then the person's next sign-in, bring the sockets back.

Removing a person from `site.json`'s `identities.admission` and running
`host apply` stops the same units in the same way, once the broker has
observed the reduced admission, unless a browser admission or a listed team
still admits the person. Apply asks the broker, on every run, to stop
everyone root revoked this way or a withdrawal withdrew. Losing a team's
admission (the person left, the team was removed or their record forgotten)
stops nothing. If a stop fails, the revocation is
already in force and the person's sessions are gone, but apply fails with
`revoked_listeners_running` and keeps entries closed; read the broker
journal's `broker_withdrawal_stop` and continue the same approved input,
which repeats only the stop (the broker also retries it each time it starts).
Adding the person back to `site.json`, applying, and then their next sign-in
bring the sockets back. An installation gate that refuses socket starts while
a revoked person's socket is active therefore needs no manual cleanup after a
withdrawal or a revocation.

## Start and prove first use

After successful apply, inspect the selected version and administrative readback:

```sh
/opt/open-habitat/current/open-habitat version --json
/opt/open-habitat/current/open-habitat admin settings show --json
/opt/open-habitat/current/open-habitat admin users list --json
```

Apply has already set the declared nonzero quota (per-user limits only) and
started the units. Keep
those values in the site if using declarative convergence. Optionally set the
unmanaged displayed name with `admin settings update --name <name> --json`.
Check the real HTTPS ingress with certificate validation, then sign in as an
admitted identity and inspect the new account, quota, home and daemon socket.
A deferred administrator holds the role from that first sign-in. The person's
native Pi/provider authorization remains a separate first-use step. A redirect
from `/auth/github/start` alone proves neither callback nor sign-in.

### SSH login into a Habitat account

Every account the broker creates has the shell `/usr/sbin/nologin`, so the
browser is the only way in. When a person should also reach the same Unix
user over SSH, for example the owner of a personal installation, name them
in the site:

```json
"identities": {
  "admission": ["123456"],
  "login_shell": {"shell": "/bin/bash", "subjects": ["123456"]}
}
```

Each subject must also be in `identities.admission`, so that removing
someone's admission in the same file also removes their shell. The shell
must be listed in `/etc/shells` and be a root-owned executable. Host apply
publishes the declaration to the broker and then changes existing accounts
with `usermod`: a newly named person's account gets the shell, and an
account whose subject is removed goes back to `nologin`. That holds once
apply has completed: an apply that fails or is interrupted on the way may
leave a removed person's shell in place, so rerun it until it succeeds
before relying on SSH being closed. A person who signs
in for the first time afterwards is created with the shell their entry
says. The broker accepts exactly the declared shell for a named account and
`nologin` for every other; a shell changed by hand, or by `chsh`, is account
drift that stops broker startup until apply or root puts it back.

The product sets only the shell. SSH keys, `sshd` access rules and `sudo`
are root's to manage outside Open Habitat. Grant `sudo` with a rule that
names the user in `/etc/sudoers.d/`, not by adding the account to the
`sudo` group: the broker refuses any Habitat account with a supplementary
group, and such an account stops broker startup. The accounts have no
password; `sshd` with `UsePAM yes` (Ubuntu's default) accepts key login
for them, while `UsePAM no` treats them as locked. Know
what that combination means: browser sessions, the browser shell and every
agent run as that same Unix user, so if that account can use `sudo`, anyone
or anything that reaches it through the browser can become root, exactly as
an SSH session as that user could. Declare it only for a person whose
browser access you would trust with that.

A release upgrade publishes no declaration. Change `login_shell` with host
apply, before or after the upgrade; an upgrade plan whose site declares a
change that apply has not published reports `upgrade.login_shell` as
`login_shell_not_applied`. An operator binary older than this field refuses
a site that contains it, so upgrade first and add the field afterwards.

`/healthz` shows a responding service, not a fully functional installation. `/readyz`, `admin readiness show` and `doctor --component gateway|daemon --json` do not prove provider access, quota enforcement or user isolation. Do not treat their foundation responses as deployment approval.

## Daily operation and recovery

- **Version and upgrade:** identify the running binary with `version --json`
  and `readlink -f /opt/open-habitat/current`. Ordinary apply is not a release
  upgrade and never silently switches a predecessor. Use the explicit named-release upgrade above; it accounts for native work,
  not just the gateway. Do not hand-switch `current`, replay an uncertain operation or restore
  an older ledger. The older `maintenance enter` command is only an unrelated
  marker; it is not the installer HTTP fence or a request drain.

- **Recovered browser load failures:** `journalctl -u open-habitat-gateway.service -o cat --since today | grep '"event":"client_load_failed"'` selects browser reports. `phase` distinguishes a first-load landing from a retained stale view; `read` and `reason` identify the first failed read in that episode (session, snapshot, onboarding, or identity pairing; network, HTTP, invalid reply, deadline, or identity mismatch). `status` is the observed HTTP status when available, otherwise 0. `read_duration_ms` is elapsed time in the failing load attempt, `episode_duration_ms` is time from entering the failure state to a validated recovery, and `attempts` counts that failed attempt and subsequent load attempts. Durations saturate at one day and attempts at 10,000. `online` is the browser's hint at failure, not evidence that the host was reachable. Reports are untrusted client observations, not server diagnoses. `user` is the authenticated account when reporting, not proof of the identity at failure; `request_id` joins the reporting POST, not the failed read. The browser keeps only one volatile episode and sends once after a matching session/snapshot pair succeeds. Closing/reloading the tab, a login requirement, a lost report, or rate limiting can leave no event. No anonymous reports are accepted. The gateway budget allows a burst of 20 and refills one report every three seconds across the installation; it returns 429 when exhausted. Nothing is retried and no UI changes depend on delivery.
- **Logs and failures:** `journalctl -u open-habitat-gateway.service -u open-habitat-broker.service --since today` and `journalctl -u 'open-habitat-daemon@<username>.service' --since today` read classified JSONL stderr diagnostics. Mutating, failed and slow (≥250 ms) requests appear as `http_request` records; `slow: true` marks those over 1 s, and a gateway and daemon record with the same `request_id` belong to one browser request (for example `journalctl -u open-habitat-gateway.service -u 'open-habitat-daemon@*' -o cat | grep '"request_id":"<id>"'`). Restrict journal access and retention. For failures, inspect `systemctl status` of the corresponding socket/service, `journalctl`, socket owner/mode and parent ACLs, quota enforcement and free space, config owner/parent paths, OAuth callback/HTTPS and pinned Pi selector. Broker startup refuses pending or drifted ledger/account/ACL/quota state; investigate it rather than deleting state or blindly restarting. A broken administrator state stops gateway startup; invalid session state may discard sessions and require login. Login records are not joined across services, and the system does not provide an audit log.
- **Free space without per-user limits:** nothing stops one home from filling
  the shared filesystem. Watch `df -h /home` (the administrator storage page
  shows the same figures) and act before it is full: a full disk makes every
  person's writes fail with "no space left", and on a single filesystem it can
  also stop journald, the broker's and gateway's state writes and package
  updates. The product does not reserve space or clean anything up for you.
- **Backups:** back up `/home` with ownership, ACLs and user credentials protected; `/var/lib/open-habitat/broker` as **one consistent snapshot** including its monotonic head and an independently retained high-water record; `/var/lib/open-habitat-gateway`; the protected gateway configuration/TLS secrets; the UID-pool and quota/boot policy; and the selected release and Pi runtime provenance. Keep backup keys separate from the server. Do not back up `/run` as persistent authority. Test a restore offline and reestablish UID/GID, quotas, ACLs and socket activation before reopening ingress. A stale broker ledger can reassign another person's UID: if the snapshot's high-water cannot be proved current, do not restore it onto a host with newer identities. There is no supported one-command recovery, deprovision or rollback operator for arbitrary installations. Lost session state requires new browser login; lost native home/history or credentials cannot be recreated from the release archive.

Local automation invokes the shipped host operator; it must not replace its lock, qualification or broker transactions with ad-hoc state edits.

### Rootless container session prerequisites

The container profile needs kernel user namespaces, disjoint subordinate UID/GID
ranges for every mapped account, `newuidmap`/`newgidmap`, cgroup v2 and a native
systemd user manager with linger. Set per-tenant budgets on `user-<uid>.slice`;
container memory controls must run inside a delegated user service/scope. A
setuid child of the gateway alone is not a delegated session. Supply each user
`XDG_RUNTIME_DIR=/run/user/<uid>` (owned by that UID, mode 0700) and their own
user bus. Never supply another user's runtime directory or a rootful socket.

The authenticated container profile includes its session initializer and user
unit. Apply publishes `runtime/` at the immutable profile path
`/opt/open-habitat/profiles/containers` and installs its authenticated
`open-habitat-containers.service` in the system user-unit directory.
Each mapped user enables/starts it in their own manager **before their first
container**: `systemctl --user enable --now open-habitat-containers.service`.
The enabled user unit then runs after each boot; apply never starts it as root
or enables it for unrelated local accounts.
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


### Continuing an activated apply after gateway config_io

If a running apply stopped at `converging` because `/etc/open-habitat` was
root:root 0700 without ACLs, keep ingress closed and use the independently
verified corrected product package. Inspect `stat`/`getfacl` first, then as
root run only `chmod 0711 /etc/open-habitat`. Keep site, secret source files,
runtime pins and installed generation unchanged. This is a
customer bootstrap-permission repair, not permission to rewrite generated
files, reset journals or reseed identities.

Inspect the original journal with `host operation show <id> --json`, then use
the new product's `host check --site /etc/open-habitat/site.json --json`.
The parent error must disappear; `operation.fence / recovery_required` and
unready gateway/control checks remain expected until continuation. Do not take
a new plan ID over that fence. Invoke:

```sh
"$oh" host apply --site /etc/open-habitat/site.json \
  --approved-plan <ORIGINAL_APPLY_APPROVAL> --output=jsonl
```

The successor may finish only late apply phases (`converging`, `verifying`,
`verified`) with matching durable receipt/fence and original approval. It
reconstructs the original protected-input binding using the trusted installed
executable's digest; changed site values or protected secret-file
identity still refuse. An apply interrupted under a product that still bound
the release key cannot be continued by one that does not.
It does not publish the successor binary or rerun apt/initialization/activation:
it verifies installed config/generation, closes HTTP entry, applies only the
bounded gateway unit policy repair described below, verifies units, clears
the two failed gateway/revoke unit start limits, starts their fixed units,
converges settings and verifies native postconditions before reopening entry.
The same operation ID/approval must complete with a higher sequence; an exact
retry verifies completion without restarting services. Split or unknown state,
earlier phases and changed inputs remain fenced. The installed service binary
stays the original approved product; the corrected operator is used for future
maintenance. An installed product replacement requires a separately qualified
successor upgrade, not this repair.

Require successful terminal `applied` (or verified `no_change` on repeat),
completed operation, `host check`, active broker/gateway/revoke units and
CA-validating public `/healthz` before the normal reboot/post-boot checks.
Do not reboot first or claim browser OAuth/provider authorization from this
recovery; those still require the admitted person's browser.


### Continuing an apply stopped before publication

Releases up to `v0.1.0-pilot.8` staged generations under `/var/lib/open-habitat`
and failed with `host_observation_unavailable` (EXDEV) where `/var` is a
separate filesystem, leaving a running apply fenced at `staging` with entry
closed. Such an apply, or any apply fenced at `started`, `quiescing` or
`staging`, has published nothing that a fresh apply would not repeat: it closed
HTTP entry, may have installed Ubuntu minimum versions and removed its private
stage. A corrected release continues that same operation under a new approval.

Keep ingress closed. Deliver the successor release and product package as for
a fresh installation, change only `site.release` to the successor and run its
operator:

```sh
"$oh" host apply --site /etc/open-habitat/site.json --dry-run --json
"$oh" host apply --site /etc/open-habitat/site.json \
  --approved-plan <NEW_APPLY_PLAN_ID> --output=jsonl
```

The preview reports `operation.fence: pass /
apply_prepublication_continuation_verified` and names the fenced operation
under `plan.continuation`. Approve that new plan ID; the original approval
refuses with the new product. The plan binds the exact journal record, so any
change to the operation makes it stale. Under the lock the operator observes
the plan again, requires that nothing was published or initialized (no
generation, selector, profile link, Pi or editor selector, broker state,
installation identity or gateway configuration, and no staged journal file),
then records the new approval and input binding on the same operation ID with
a higher sequence and runs the whole apply. The result is `applied` with the
original operation ID; `host operation show` shows the successor target. An
interruption is continued with the same new approval.

Any later phase, a published generation or link, broker state or a split
journal stays fenced for diagnosis. Preparation is not repeated: the
successor's preparation policies must match what `host prepare` installed,
otherwise the plan stays blocked at `storage.boot_policy`. The empty
`/var/lib/open-habitat/staging` left by the earlier release is no longer used.
Do not reset the journal or delete the fence.

### Gateway listen ports and low-port recovery

The declared gateway TCP port supports 1–65535, on a local address or wildcard
(`0.0.0.0`/`[::]`). Check/plan resolve the address and verify it belongs to this
host; low ports additionally require systemd PID 1's permitted and bounding sets to
include `CAP_NET_BIND_SERVICE`. Unavailable observations block before mutation.
If the customer's `ip_unprivileged_port_start` is raised above 1024, a
high port below that threshold is rejected too: high-port policy stays
capability-free and the product never changes the sysctl.
These are point-in-time checks, not port reservations: keep the declared port
free of other services and keep the address configured through activation.

The gateway currently binds TCP directly; its inherited socket is the private
Unix administration listener, not a public TCP listener. The installer therefore
renders `AmbientCapabilities=CAP_NET_BIND_SERVICE` and
`CapabilityBoundingSet=CAP_NET_BIND_SERVICE` **only for ports below 1024**.
At higher ports both sets are empty. The service remains non-root with
`NoNewPrivileges=yes`; no file capability, sysctl relaxation, reverse proxy or
operator drop-in is needed or permitted.

For an already activated apply stopped at `converging` with `listen_failed`
on port 443, use this corrected operator and the **original approval** exactly
as in the activated-apply continuation above. Keep runtime, protected inputs,
selectors, generation, and installed executable unchanged; do not prepare again,
reset a journal, or obtain a replacement approval. Under the operation lock the
operator recognizes only the exact prior product unit (or its already repaired
bytes), installs the declared-port capability policy, reloads systemd, clears
the gateway/revoke start limits, starts broker/revoke and restarts the gateway
before converging and
reading back quota/administrator settings. Foreign unit bytes or overrides
remain blockers. Interrupted policy publication/reload can be retried with the
same approval. Immutable generation snapshots remain unchanged; a later upgrade
recognizes this exact repaired live gateway policy when qualifying its predecessor.
For that upgrade, pin the installed generation's release and executable digest,
not the version of the maintenance operator used to repair it.

Require the same operation ID to complete at a higher sequence, successful host
check, active gateway/broker/revoke, and external CA-validating `/healthz` after
HTTP entry reopens. Until then HTTP stays fenced; an active process or private
control success alone is not public HTTPS acceptance. Only then perform the
normal reboot and repeat the checks. No human OAuth/provider consent is implied.

### Cold-boot session-policy observation

Ubuntu may leave its static, D-Bus-activated polkit service inactive until the
first authorization request. Host check accepts only loaded/inactive/dead with
MainPID=0 and the exact configured proc exemption group; it does not start the
service as a side effect. A running polkit or logind process must have that group
in its actual kernel status, and logind must be running. Failed, masked or
misconfigured services still block. Do not add a customer boot unit or manually
start polkit merely to obtain a passing read-only check.

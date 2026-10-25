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

Obtain the product package from an **independently trusted release channel**.
Its checksum inventory detects corruption, not a malicious replacement. Verify
that channel's source/version approval before executing `bin/open-habitat` as
root. Extract the package into a root-owned, non-writable directory, retaining
its `bin/` and `web/` layout. No source checkout, Fleetrepo, npm or Go is needed
on the installation host.

Each architecture has its own product package (`open-habitat-VERSION-linux-amd64`
or `-linux-arm64`) and its own signed runtime release, whose manifest names its
platform (`ubuntu-24.04-amd64` or `ubuntu-24.04-arm64`); the operator refuses a
release for another architecture with `release_platform_mismatch`.
A published release that carries both architectures names every
architecture-specific asset after its architecture: the manifest and
signature are `release-linux-<arch>.json` and `release-linux-<arch>.sig`, and
the archives are `<profile>-linux-<arch>.tar.gz`. Save the manifest and
signature as `release.json` and `release.sig`, the names the operator reads;
keep the archives' names, because the signed manifest names them.
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
administrators return `deferred_until_bound`; after their first successful
binding, rerun apply to grant their role. Per-user quota overrides, committed
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

Deliver the independently signed successor runtime manifest/archives to the same
incoming release directory, and its verified product package to a root-owned
non-writable directory. Change only `site.release`; converge admission, roles,
profiles or quota changes separately before planning the release transition.
The signed successor must name this exact predecessor, its executable digest,
the compatibility protocol and every successor binary/web file. A package checksum supplied by the package itself
is not independent release authentication.

A product-only replacement still needs a new signed release manifest: the
transition authenticates the successor executable and web assets, not only the
runtime archives. Reuse unchanged runtime archive bytes and descriptors, but
issue a distinct release version/digest with the exact predecessor and successor
product inventory. Leaving `site.release` on the old runtime manifest cannot
install a new product. Keep the approved trust key; never copy its private key
to the host. Publish the new manifest/signature together with the product and
identify unchanged archive hashes in the handoff.

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

On a trusted Linux build host with Go and rootless Podman, build the core and
integrations archives every release carries, and sign their descriptors
together. The scripts build their own multi-architecture builder image
(`runtime/builder/Containerfile`). Each build targets one architecture
(`--target linux-amd64|linux-arm64`, default the build host's); core and
integrations run npm on the locked Node, so they build on a host of the target
architecture, while the other profiles only fetch and inventory pinned files and
build for either target anywhere. Every archive in one release is built for the
same target, and `sign --platform` names it; signing refuses Ubuntu requirements
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
# Development/test only. Keep this private file outside the release directory.
/var/tmp/runtime-release key-create --key-file /var/tmp/development-release.key
/var/tmp/runtime-release sign --directory /var/tmp/new-core-release \
  --artifacts-file /var/tmp/new-core-release/artifacts.json \
  --key-file /var/tmp/development-release.key --version 0.0.0-runtime-test \
  --platform ubuntu-24.04-amd64 --commit "$(git rev-parse HEAD)"
```

The signing result reports the exact manifest SHA-256. Transfer only
`core.tar.gz`, `integrations.tar.gz`, `release.json` and `release.sig` from that
directory to the recipient. Build scratch, `artifact.json` and private keys are not installation
inputs. The checked-in npm/non-Ubuntu artifact locks are exact build inputs; Ubuntu
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

Only non-Ubuntu archive verification and staging are offline. The signed manifest
retains complete component/file digests and upstream licence records for those
archives, including Node third-party notices and npm package notices/licences.
These records do not grant
rights beyond upstream terms; in particular the Claude SDK/bridge dependencies
retain their supplied terms, not a blanket MIT licence for the bundle.

Optional archives use the same trust boundary and link-free format. Build a
selected, release-qualified profile from its checked-in lock the same way
(for example `./scripts/build-profile-runtime.sh editor NEW_OUTPUT`), copy its
archive beside the others and add its `artifact.json` to the same descriptor
array before signing, in a fresh unsigned directory.

Transfer every archive named by the signed manifest, not just `core.tar.gz`.
The helper signs, verifies and stages **all** manifest profiles; it cannot
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


The authenticated product package includes `bin/runtime-release`. Use that
verifier from an independently authenticated product package (not an executable
supplied by an untrusted runtime). It runs unprivileged and always emits JSON;
it takes no `--json` flag:

```sh
/path/to/authenticated-product/bin/runtime-release verify \
  --directory /srv/incoming/runtime \
  --key-file /path/to/independently-approved-release-key.pub \
  --version <exact-runtime-version> \
  --manifest-sha256 <independently-approved-64-hex-manifest-digest>
```

The directory must contain `release.json`, `release.sig` and **every** archive
named by the manifest. The version is the signed **runtime** version, which may
differ from the product version when a newer product reuses unchanged runtime
bytes. Exit 0 with `data.status=verified` authenticates the manifest and verifies
the complete archive closure; it is not installed-host qualification.

For an independent Ed25519 implementation, the signed payload is the ASCII
bytes `open-habitat.release.v1` followed by one NUL byte (`0x00`), followed by the
**exact file bytes** of `release.json`, including any trailing newline. Do not
parse/reserialize the JSON or sign/verify a hex digest instead. `release.sig`
is the raw 64-byte signature; the approved public key is raw 32-byte Ed25519,
not PEM or base64. For example, with Python's cryptography package:

```python
from pathlib import Path
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
key = Ed25519PublicKey.from_public_bytes(Path("approved-release-key.pub").read_bytes())
key.verify(Path("release.sig").read_bytes(),
           b"open-habitat.release.v1\x00" + Path("release.json").read_bytes())
```

That primitive signature check alone does not verify the target version,
manifest digest, archive membership, sizes or hashes. The supported verifier
above also checks those. A key downloaded beside a bundle is not trusted until
its bytes match an independently approved pin.

For private staging, root may use `runtime-release stage` with the same inputs
and `--stage-parent <existing-root-owned-0700-directory>`. The caller must
establish trusted parent ancestry; this build tool is not an installation
executor. It verifies signatures, target, complete inventory, file bytes,
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
provider key. An unmet Ubuntu minimum or non-Ubuntu archive mismatch is a typed qualification failure, not
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

## Integrations

Every installation ships the integration tools in the required `integrations`
profile, so a site's `profiles` always lists `core` and `integrations`. The
signed profile carries **himalaya 2.2.1** (IMAP), **rclone 1.71.2**, **gog
0.39.1**, **tea 0.16.0** (Gitea), **@softeria/ms-365-mcp-server 0.170.1** with the `microsoft-native`
adapter, **MSAL 5.6.0** and their own **Node 22.21.1**, and a Pi wrapper that
runs the same release's core **Pi 1.3.0** for native `pi mcp add/remove`. Each
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

### Gitea servers

A Gitea connection needs no app section: each person pastes their server's
address and a personal access token in Settings → Integrations, and the token
lives only in their own tea file. What the operator provides is the route and
the trust. The host must reach the Gitea's HTTPS address by DNS or IP over the
network, LAN or VPN the operator has set up; the connector refuses link-local,
metadata, unspecified and multicast destinations, and dials loopback only when
the person typed a loopback address. A certificate from a private CA is trusted
through the OS store (`/usr/local/share/ca-certificates/` and
`update-ca-certificates`), never through the connector. Each person's daemon
reads that store once when it starts, so after adding a CA restart the daemons
that should use it (`systemctl restart open-habitat-daemon@<user>.service`);
Git and tea read it on every run. Without the route or the trust a connection
attempt answers `unreachable` or `tls_untrusted`, and nothing is written.

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
daemon uses `http://localhost` (no port) and the person pastes it back. Enable Drive API, Gmail API, Google Calendar API and People API in
its Google Cloud project. The requested permissions are `openid`, `email`,
`https://www.googleapis.com/auth/drive`,
`https://www.googleapis.com/auth/gmail.modify`,
`https://www.googleapis.com/auth/calendar`, and
`https://www.googleapis.com/auth/contacts`. No Gmail settings/sharing or
Workspace domain-wide delegation is requested. The browser setup configures the
consent screen as **Internal**, which requires Google Workspace: only the
organisation's accounts can connect, and Google's verification is not needed.
An External app in Testing needs every tester added and its refresh tokens for
these scopes expire after seven days; in production it needs Google's
verification, not a host-side workaround. Partial consent is rejected. No incoming port, shared localhost
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
   `Mail.Send`, `Calendars.ReadWrite` and `Contacts.ReadWrite`.
4. *Grant admin consent for <organisation>* (Cloud Application Administrator,
   Application Administrator or Privileged Role Administrator), so nobody is
   asked to consent and the tenant's user-consent policy cannot block a person.

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

If consent is still missing when a person connects, the page shows an
administrator link plainly. It goes to the tenant's own administrator:

```text
https://login.microsoftonline.com/<TENANT_ID>/v2.0/adminconsent?client_id=<APP_CLIENT_ID>&redirect_uri=https%3A%2F%2Flogin.microsoftonline.com%2Fcommon%2Foauth2%2Fnativeclient&scope=openid%20profile%20User.Read%20offline_access%20Files.ReadWrite.All%20Sites.ReadWrite.All%20Mail.ReadWrite%20Mail.Send%20Calendars.ReadWrite%20Contacts.ReadWrite
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
verify the consent-required link before admin consent and any applicable
device policy. Synthetic tests cannot establish real tenant consent or token
refresh.

## Agent command search path

Users install optional agent executables in their own `~/.local/bin`. The administrator installs shared tools in `/usr/local/bin` and verifies that `/usr/local` and `/usr/local/bin` are root-owned and not writable by any mapped user or group (for example, `stat -c '%U:%G %a' /usr/local /usr/local/bin` should show `root:root 755` for both). Debian installations may default to group-writable `root:staff 2775`; restrict that access before mapping users. Review provenance and updates because shared programs run with each invoking user's credentials. Browser-started Pi and its children search `$HOME/.local/bin:/usr/local/bin:/usr/bin:/bin`, with the account's own directory taking precedence. The daemon takes HOME from its verified Unix account binding, not browser input. Configure each user's SSH login shell to use the same ordering if it does not already; systemd does not source shell profiles. Host-managed `gh` and `git` actions still use fixed `/usr/bin` executables and restricted environments, never a user's override. The separately pinned Pi runtime does not come from this PATH.

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
release key, runtime pins and installed generation unchanged. This is a
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
executable's digest; changed site values, trust-key bytes or protected
secret-file identity still refuse.
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

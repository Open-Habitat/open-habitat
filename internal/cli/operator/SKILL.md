---
name: operator
description: Install, upgrade and administer an Open Habitat host as root with the shipped `open-habitat host` and `admin` commands. Use for a first installation, host apply, a release upgrade, TLS rotation, a stopped host operation, and for who may sign in, site onboarding, the site AI key and integration app credentials.
cli_version: "0.0.0-dev"
schema_version: 1
---
# Open Habitat operator

You are operating a host that several people work on. Each has a Linux
account, a home, credentials and running agents there, and the separation
between them is the product. What you change as root reaches all of them: a
restarted session service can disrupt people's running work, a wrong permission
can expose one person's secrets to another, and broker state repaired by hand
can hand one person's UID to someone else. The work is done when an admitted
person has signed in through their own browser and their own Pi has reached
its provider, not when a command returns.

This text matches the binary that printed it. Every command and subcommand
answers `--help` with its flags and examples, and
`site/schema.json` with `site/example.json` in the product package define the
site file; that detail is not repeated here. The longer operator guide, with
step-by-step recoveries and the app registrations at Google, Microsoft and
Dropbox, is `docs/operations.md` in the Open-Habitat/open-habitat repository
on GitHub. Read it at the tag of this release (`v` and the version above),
because the main branch can describe a newer release.

## How host maintenance works

The administrator declares the installation in one root-owned file,
`/etc/open-habitat/site.json`, and the `host` commands converge the machine
to it. Nothing is changed on a guess:

    open-habitat host config path --json
    open-habitat host config show --site /etc/open-habitat/site.json --json
    open-habitat host check --site /etc/open-habitat/site.json --json
    open-habitat host plan --site /etc/open-habitat/site.json --json
    open-habitat host apply --site /etc/open-habitat/site.json --dry-run --json

These, and `--dry-run` of `prepare` and `upgrade`, only read. They take no
operation lock, change no quota, start no service and install no file (reads
may change access times), so run them freely. A blocked qualification exits 1
with its document on stderr under `error.result.data` and an empty stdout; a check
reported unavailable has not passed.

A dry run returns a plan ID that fingerprints what was observed. The live
command takes that ID as `--approved-plan` and streams with `--output=jsonl`
(not `--json`): versioned progress and exactly one terminal result, error or
cancelled event. The approval belongs to the administrator. Show them the
plan and what it will interrupt, and run the live command on their yes, at a
time they chose when it disrupts people. `host prepare` restarts proc, logind
and polkit policy and so disturbs every session on the machine; `host apply`
restarts the gateway when its configuration changes, which drops browser
connections; `host upgrade` can interrupt people's running agents.

There is no force, reset or supersede route, by design: the fences below are
what keeps a half-finished operation from being papered over. If a route is
refused, the refusal names what to diagnose.

- Before an operation starts, `stale_plan` means the host changed since the
  observation; take a fresh dry run and a fresh approval.
- Once an operation has started, it continues only with the same protected
  inputs (site file, secret files, release) and its original approval, except
  for verified `prepare` at `session_restarting` and pre-publication `apply`
  continuations: those use a fresh preview approval as the guide describes.
  Otherwise keep inputs unchanged and delivery tooling quiet; restoring a
  changed file's bytes does not restore its identity.
- An exact repeat of a finished apply verifies the native postconditions and
  returns `no_change` without rewriting a receipt or restarting anything;
  the required Chrome check/install still runs afterwards.
- A run that ends without a terminal event has an unknown outcome. It is not
  evidence that nothing changed or that HTTP is closed. Read `host operation
  show <operation-id> --json` before anything else; a journal phase there is
  durable intent, not proof the step completed.
- A failure returned after maintenance began reports `entry_closure`. With
  `verified_closed` the HTTP entry points are fenced. With `unavailable` the
  closure could not be persisted (the binary tries to stop the gateway as a
  last resort): keep external ingress closed and inspect the gateway.
  A later `server_browser_required` failure is different: entry is already
  open and the generation transition complete; retry with a fresh apply plan.
- Exit 2 is a system or native action failure: inspect before retrying.
  Signals exit 130 and 143.
- Foreign or partial broker state and malformed journals stay closed for
  diagnosis. Deleting or editing them is how a UID gets reassigned.

## What the installation needs

The supported host is Ubuntu 24.04 amd64 or arm64 with ext4 holding `/home`.
With `storage.enforce_user_quota: true`, `/home` is a separate mount with
journaled quotas. With `false`, it may share the root filesystem and
`storage.default_limit_bytes` must be absent: one person can fill the shared
disk, so the operator watches free space. The customer owns the machine, its
volumes and mounts, OS updates, ingress, the TLS certificate and the GitHub
OAuth registration. The product does not format disks, convert a mounted
filesystem or accept cloud or account repair hooks; those stay the
customer's own work.

**Trust.** Releases are unsigned. The whole trust is the SHA-256 that GitHub
states for an asset (`assets[].digest` from `gh api
repos/Open-Habitat/open-habitat/releases/tags/<tag>`). A checksum file from
the same download proves integrity, not authenticity. Check the product
package against GitHub's digest before running anything from it as root, and
extract it as root into a trusted directory no user can write, keeping its
0755 executable and directory modes. The runtime release goes to the fixed
directory `/var/lib/open-habitat/release` as trusted root-owned files: the
release's `release-linux-<arch>.json` saved as `release.json`, with every
archive the manifest names for the selected profiles. `site.release.version`
is the manifest's version and `site.release.manifest_sha256` is GitHub's
digest of that manifest; the binary accepts exactly those bytes and checks
every archive and product file against them. The runtime version can differ
from the product version, when a newer product reuses unchanged runtime
bytes. `bin/runtime-release` in the package checks a downloaded runtime
release unprivileged, before anything is installed:

    /path/to/product/bin/runtime-release verify \
      --directory /srv/incoming/runtime \
      --version <exact-runtime-version> \
      --manifest-sha256 <GitHub-stated 64-hex manifest digest>

The directory holds `release.json` and every archive the manifest names.
Verification results are JSON. Exit 0 with `data.status=verified` says the
manifest matches the digest and the complete archive closure matches the manifest,
not that a host is qualified.

**The site file.** Adapt `site/example.json`. No environment expansion or
includes apply. What the schema cannot tell you:

- The site file and each secret file it references are root-owned 0600
  single-link regular files under root-owned parents nobody else can write.
  Secrets stay out of argv, the environment, receipts and the release tree;
  have the administrator place them in their files instead of passing them
  through the conversation.
- `/etc/open-habitat` is root:root 0711 (or 0755) without access or default
  ACLs. 0700 fails because the gateway has to traverse it to its own
  generated directory. Source secrets live in a separate root:root 0700
  directory. Create both before delivering inputs:

      install -d -o root -g root -m 0711 /etc/open-habitat
      install -d -o root -g root -m 0700 /etc/open-habitat/secrets

  Check and plan report a wrong parent as
  `gateway_parent_requires_root_0711_or_0755_no_acl`. Apply refuses instead
  of rewriting the customer's permissions, so after looking at `stat` and
  `getfacl`, an otherwise root:root, ACL-free 0700 parent is repaired by
  hand with `chmod 0711 /etc/open-habitat` and nothing wider: no recursive
  change, no ACL, no chmod of secrets or generated files.
- Generated gateway configuration and TLS copies are written to
  `/etc/open-habitat/gateway` (root:gateway-group 0750, files 0640); per-user
  bindings are separate, under
  `/etc/open-habitat-daemon/daemon/user-mappings/`. Both are the product's
  to write. ACLs found on the generated secret parent are refused, not
  cleared.
- The gateway UID/GID and the reserved UID/GID pool must be unused, and the
  pool kept away from other account creators. The product creates the gateway
  account, broker files and user bindings itself; precreated ones are
  refused. The gateway's service identity stays exclusive and non-login,
  since another member of its group could read OAuth and TLS secrets.
- GitHub admission and administrator subjects are numeric ids. Profiles
  always include `core` and `integrations`. With per-user limits, the default
  quota is nonzero.
- With the `editor` profile, `editor.origin_template` is a separate wildcard
  HTTPS origin such as `https://oh-code-*.example.org`: one `*` in the first
  DNS label, at most 11 other characters in that label (a 52-character
  identity replaces the `*`), no `{identity}` placeholder, and not matching
  the application origin.
- Identity and mount choices become immutable once made.
  People's bindings and native data are not desired state: no apply resets
  a committed binding, a personal file or a per-user quota override.
- Missing runtime-profile inputs block installation. Missing integration app
  credentials leave that provider unavailable, not a reason to invent app setup.

**Units.** The product's service and socket units are fixed. Foreign
overrides and full instance units are refused, because a drop-in can add a
root hook or a capability under correct base bytes. Resource budgets
therefore go on user slices, not on the product's units.

**Packages.** Ubuntu owns its packages and their security updates. The
manifest's `packages[].version` is a qualified minimum, so newer installed
versions pass. Plans list unmet `ubuntu.package.<name>` actions and simulate
apt, and refuse on an unavailable or too-old candidate. The binary does not
update indexes, set holds or ship Ubuntu debs, so bring the apt indexes up to
date before planning, resolve holds or pins on the customer's side, then take
a fresh plan. Installing needs repository access. Required Google Chrome is
an exception: apply and upgrade add its apt repository and install its minimum
after entry reopens, updating that repository's index. Non-Ubuntu archives are
exact and pinned by the manifest.

## Preparing, applying, verifying

Preparation, apply and upgrade are three separate operations with separate
approvals; apply never prepares or upgrades implicitly.

`host prepare` (live form: `--approved-plan <prepare-id>
--approve-disruption --output=jsonl`) proves with a disposable UID that a
declared quota really refuses writes and cleans up (no probe without per-user
limits), installs the home, storage and binding boot gates, creates the empty
proc exemption group and restarts the
session policy services. It creates no per-user binding and does not enable
sign-in. It refuses quota accounting without enforcement, a wrong or missing
home UUID and unsafe group membership.

`host apply` (live form: `--approved-plan <apply-id> --output=jsonl`)
rechecks the approval under the root operation lock, stages verified
immutable runtime generations, installs unmet Ubuntu minimums through apt
without removals, downgrades or held-package changes, installs the gateway
account and units, and seeds only an empty broker. HTTP entry
stays behind a root-owned fence while the gateway starts. It writes only the
`tools` section of `/opt/open-habitat/integrations.json` and keeps every
other section's bytes.

Apply sets the default quota (with per-user limits) and administrator roles
through the gateway's private administrative API and reads them back; root does
not edit the gateway's settings files. A requested administrator who has not signed in yet
comes back `deferred_until_bound`: the gateway holds the grant and applies it
at the sign-in that creates that person's account, with no further apply.
Administrators a browser administrator designated
(`designated_administrators` in `admin settings show`) are not site.json's;
apply neither removes nor requires them. An admission removed from site.json
is revoked before the new admission list is published unless another source
still admits that person.

After installation, and again after a reboot, look at what actually runs: the
boot gates, broker, gateway, per-user listener ACLs, and daemons starting as
distinct kernel UIDs. A live process is not readiness, and two daemons
starting under two UIDs does not prove browser sign-in or provider
entitlement. Read a component's configuration path from the installed unit's
`ExecStart`, not from an assumed default. Keep ingress closed until an
admitted person's GitHub callback in the browser and their own Pi provider
authorization have succeeded. No provider credential is shared between
people unless an administrator sets the site AI key.

`host check` starts nothing. After a cold boot Ubuntu may leave the
D-Bus-activated polkit inactive until its first request, and check accepts
exactly that state with the configured proc exemption group; a running polkit
or logind has to carry the group in its kernel status, and logind has to be
running. Failed, masked or misconfigured services still block, so there is no
reason to start polkit by hand or add a boot unit to get a passing check.

The gateway binds its TCP port itself, as a non-root service. Any port
1–65535 on a local or wildcard address works. Check and plan verify the
address belongs to the host and, for a port below 1024, that systemd can
grant `CAP_NET_BIND_SERVICE`; the unit gets that one capability only for
such ports and none above them. Where the customer raised
`ip_unprivileged_port_start` above 1024, a higher port below that threshold
is rejected, because the product does not change the sysctl. No file
capability, sysctl change, reverse proxy or drop-in is needed or accepted.
The checks are point-in-time: keep the port free and the address configured
through activation.

## Upgrading to a named release

An upgrade moves the host from one exact release to a successor that names
it. Even a product-only change needs a release with its own version and
manifest digest, naming the exact predecessor and every successor binary and
web file; unchanged runtime archives are reused. Leaving `site.release` on
the old manifest cannot install new product bytes. There is no downgrade,
automatic rollback or ledger restore, so the move is forward only.

Deliver the successor's manifest and archives and its verified product
package, change only `site.release` (converge any other desired state
separately, before or after), and preview with the successor's own binary:
`host upgrade --site /etc/open-habitat/site.json --dry-run --json`. The live
form adds `--approved-plan ID --approve-maintenance --output=jsonl`. Its
first run only stages: it returns `staged` and `plan.owner_binary` without
switching anything or installing packages. Run that exact binary with the
same arguments to enter maintenance, and use it, never the `current`
selector, for any recovery of that upgrade.

`--approve-interruption` additionally lets the upgrade interrupt observed
work in product daemons, not people's user-manager services. A live daemon
counts as unobservable even when it lists nothing running, because the list is not a
barrier against a request arriving; without this approval the upgrade refuses
instead of claiming a drain. User-manager services, SSH and tmux survive.
A failure after quiescence leaves HTTP and native entry fenced: inspect the
generation-owned journal and the actual postconditions, and continue the
same operation.

After an apply that a corrected binary finished (below), the next upgrade
names the installed generation's release and executable digest as its
predecessor, not the repairing binary's version.

## Administration while the host runs

The `admin` commands talk to the running gateway and broker. Apart from the
site-declared admission, roles and quota default, apply leaves this state
alone; browser administrators edit the same records, so read before writing.
`admin --help` lists everything, including roles, storage limits and removing a person for
good; the mutating commands take `--dry-run`, which is the way to see a
change before making it. Secrets are given on stdin (`--key-file -`,
`--client-secret-file -`). Two replies deserve care where they appear:
`host_busy` means host maintenance holds the lock and nothing was written,
and `outcome_uncertain` (exit 2) means the change may have committed and
nothing retries it, so read the current state and decide.

**Who may sign in** has three sources, all kept by the broker. site.json
`identities.admission` is root's and host apply converges it; such an id is
changed in site.json. Runtime entries are added and withdrawn by a browser
administrator or `admin access add|remove`. New admissions require site.json
`identities.runtime_admission: true`; withdrawals remain available when false.
Apply leaves these entries alone; host plan's `runtime_admission` shows actor
and time. Listed GitHub teams are the third source, managed in the browser;
adding teams or new members needs the switch. Withdrawal overrides membership.
The commands take the numeric id, which `admin access lookup --login LOGIN`
resolves. Withdrawing ends web access and stops the person's product daemon,
its Pi conversations and sockets; the account, files, SSH and user-manager
processes stay. Adding the id again returns the person to the same account. In
`admin access list`, a `denied` entry that is not withdrawn is a withdrawal
that was never confirmed: repeat the remove or the add.

**Site onboarding** (default repositories and their mode, integration steps,
the AI offer) is one versioned document, read with `admin onboarding show`
and replaced whole with `admin onboarding update`. `version_conflict` means
someone saved in between: read again and merge instead of reusing the old
version.

**The site AI key** (`admin ai-key`) lets new people skip the AI step: each
new person's Pi gets a copy at the sign-in that creates their account, and
`seed` gives one to someone who joined earlier. No path writes over a
person's own key or subscription. The dry run of `seed` asks that person's
own daemon what would happen (`absent`, `earlier`, `current`, `own` or
`unknown`). Setting a new key replaces the copies of an earlier key of the
same provider; `replaced` in the reply says how it went per person, and
`not_reached` people keep the old key until seeded again. Deleting the key
leaves the copies where they are. Two consequences are the administrator's to
accept, so tell them before setting or seeding: the key's account pays for
everyone holding a copy, and a copy cannot be recalled, only revoked at the
provider; and seeding writes into another person's credentials.

**Integration app credentials** for Google, Microsoft and Dropbox live in
`/opt/open-habitat/integrations.json`, beside the `tools` section apply owns,
and never in the site file or argv. While site.json
`integrations.browser_setup` is true (the default), a browser administrator
or `admin integrations set|clear` has the broker write one provider's
section. `admin integrations list` and host plan's `integrations` show the
client id and who set it when, never the secret; source `operator` marks a
section root edited by hand (root:root 0644). Setting `browser_setup` false
and applying makes the file root's alone again.

## Rotating the TLS certificate

The certificate and key the site file names (`gateway.tls_cert_file`,
`gateway.tls_key_file`) are the sources; `/etc/open-habitat/gateway/tls.crt`
and `tls.key` are copies apply generates; neither they nor `gateway.json`
are edited by hand. Renewal, its schedule and any DNS credentials are the
customer's, and DNS administration credentials do not belong on the host. The
new certificate covers the application hostname and every editor hostname or
wildcard.

Rotation is an ordinary apply with changed sources, so it follows the rules
above: finish any incomplete operation first, and replace both sources before
planning, not during the operation. Check the new chain's expiry and names
and that it matches the key (compare `openssl x509 -pubkey -noout` with
`openssl pkey -pubout`). Stage each file beside its source as root-owned
0600, with no stale `.renewing` path or link in the way, and rename it over
the source, keeping a protected copy of the old pair until the new one is
verified:

    install -o root -g root -m 0600 "$newcert" "$cert.renewing"
    install -o root -g root -m 0600 "$newkey" "$key.renewing"
    mv -T "$cert.renewing" "$cert"
    mv -T "$key.renewing" "$key"

Then take a new `host apply --dry-run` plan and approve it. There is no hot
reload: apply copies the files and restarts `open-habitat-gateway.service`,
which interrupts browser connections and touches no home or credential.
Afterwards the apply has succeeded, the gateway unit is active and `host
check` passes; from outside, `curl --fail https://APP_HOST/healthz` without
`-k`, and `openssl s_client -connect APP_HOST:443 -servername APP_HOST
-verify_hostname APP_HOST -verify_return_error </dev/null` validates the peer;
pipe its certificate to `openssl x509 -noout -serial -dates -ext subjectAltName`
to inspect serial, expiry and names, for editor hosts too. Where an ingress proxy
terminates TLS, that edge is rotated and verified on its own and the hop to the origin is checked
with its own server name and CA.

## Finishing a stopped apply with a corrected binary

Two known situations stop an activated apply at `converging`, with HTTP
fenced: the gateway failing with `config_io` because `/etc/open-habitat` was
0700, and `listen_failed` on a port below 1024 under a product whose unit
lacked the bind capability. Both are finished, not restarted: an
independently verified corrected product package continues the same
operation with the original approval.

    "$oh" host apply --site /etc/open-habitat/site.json \
      --approved-plan <ORIGINAL_APPLY_APPROVAL> --output=jsonl

Until then keep ingress closed and the site, secret files, release pins,
selectors and installed generation unchanged (for `config_io`, the single
`chmod 0711` above is the whole repair), and do not prepare again or take a
new plan over the fence; `operation.fence / recovery_required` in the
corrected package's `host check` is expected until the continuation. The
corrected binary finishes only the late phases of that operation. It does
not publish itself, rerun runtime-package installation or reinitialize anything, so the installed
service binary stays the originally approved product, and replacing it is a
separate named upgrade. Foreign unit bytes or overrides, unverified earlier
phases, changed inputs and split or unknown state stay fenced.

It is finished when the same operation ID completes at a higher sequence
with terminal `applied` (a repeat gives `no_change`), `host check` passes,
the broker, gateway and revoke units are active and a CA-validating
`/healthz` answers from outside; reboot and repeat the checks only after
that. The guide's sections on continuing an activated apply and on low-port
recovery walk through each case.

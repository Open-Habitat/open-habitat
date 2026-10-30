---
name: operator
description: Install, converge and diagnose Open Habitat hosts through the shipped privileged operator and native administrative APIs.
cli_version: "0.0.0-dev"
schema_version: 1
---
# Open Habitat operator

Extract the independently authenticated product package as root, in a trusted
non-user-writable directory, preserving its 0755 executable/search modes.
Use it on Ubuntu 24.04 amd64,
with a separately mounted journaled-quota ext4 /home. The customer owns the
machine, persistent volume/mount configuration, OS updates, ingress, TLS and
OAuth registration. Never format a disk, convert a mounted filesystem or
supply cloud/account repair hooks through this operator.

Read site/schema.json and adapt site/example.json. The site and its secret-file
references require root-owned non-writable parents and mode 0600 single-link
regular files. The shared /etc/open-habitat parent must be root:root 0711
(or 0755), with no access/default ACLs, NOT 0700: the gateway must traverse it.
Keep source secrets in a separate root:root 0700 directory such as
/etc/open-habitat/secrets; the site/key themselves stay root-only 0600.
Generated /etc/open-habitat/gateway is root:gateway-group 0750 with 0640 files;
ordinary users can traverse the shared parent but cannot read those files.
Create bootstrap parents before delivering inputs:

    install -d -o root -g root -m 0711 /etc/open-habitat
    install -d -o root -g root -m 0700 /etc/open-habitat/secrets

Check/plan reject unusable existing bootstrap metadata with
`gateway_parent_requires_root_0711_or_0755_no_acl`. After inspecting stat/getfacl,
an otherwise root:root, ACL-free 0700 parent is repaired by the operator with
`chmod 0711 /etc/open-habitat`. Do not chmod source secrets or generated files,
add an ACL, or recursively change ownership. Apply refuses rather than rewriting
customer bootstrap permissions. No environment expansion or includes apply. Keep secrets out of
argv, environment, receipts and the release tree. The site declares numeric
GitHub admission/admin subjects, the reserved empty UID/GID pool, gateway IDs,
home UUID, nonzero default quota, exact runtime manifest target and profiles;
profiles always include core and integrations.
For editor, select the editor profile and set editor.origin_template to a
separate wildcard HTTPS origin such as https://oh-code-*.example.org. The *
must occur once in the first DNS label and leave room for a 52-character
identity (at most 11 other characters in that label). No {identity} placeholder
is accepted. It must not match the application origin.
Do not precreate the gateway account/group, broker files or user bindings.
Gateway IDs must be unused initially; its service identity must remain exclusive
and non-login. Named/default ACLs on its generated secret parent are refused,
not cleared. Product service/socket fragments are fixed: foreign overrides and
full instance units refuse, including privilege-changing hooks/capabilities.
Put resource budgets on user slices rather than actor-unit overrides.
Undelivered site integration declarations are blockers, not fictitious app setup.
Apply writes only the tools section of /opt/open-habitat/integrations.json and
keeps every other section's bytes; add Google, Microsoft or Dropbox app
registrations there as root (root:root 0644), never in the site or argv.
Identity/mount choices become immutable; personal bindings and native data are
not desired-state records.

Inspect before mutation:

    open-habitat host config path --json
    open-habitat host config show --site /etc/open-habitat/site.json --json
    open-habitat host check --site /etc/open-habitat/site.json --json

The fixed incoming runtime directory is /var/lib/open-habitat/release; place
the release's `release-linux-<arch>.json` there as `release.json`, with the
selected archives, as trusted root-owned files. The trust pin is
site.release.manifest_sha256: the SHA-256 GitHub states for that manifest asset
(`assets[].digest` from `gh api repos/Open-Habitat/open-habitat/releases/tags/<tag>`),
never a checksum file from the same download. site.release.version is the
manifest's version. The operator accepts exactly the manifest bytes that hash
to the pin and checks every archive and product file against that manifest; it
reads no signature or key, and a leftover release.sig or
/etc/open-habitat/release-key.pub is ignored. Check the product package's bytes
against GitHub's stated digest too before running it as root; its own checksums
are integrity, not authenticity.

The product package includes `bin/runtime-release`, which checks a runtime
release unprivileged before installation and always emits JSON (it takes no
`--json` flag):

```sh
/path/to/product/bin/runtime-release verify \
  --directory /srv/incoming/runtime \
  --version <exact-runtime-version> \
  --manifest-sha256 <GitHub-stated 64-hex manifest digest>
```

The directory must contain `release.json` and **every** archive named by the
manifest. The version is the **runtime** version, which may differ from the
product version when a newer product reuses unchanged runtime bytes. Exit 0
with `data.status=verified` means the manifest matches the digest and the
complete archive closure matches the manifest; it is not installed-host
qualification. While releases are still signed, an added `--key-file` also
requires `release.sig` to verify against that raw 32-byte key.

Prepare explicitly in a maintenance window:

    open-habitat host prepare --site /etc/open-habitat/site.json --dry-run --json
    open-habitat host prepare --site /etc/open-habitat/site.json --approved-plan <prepare-id> --approve-disruption --output=jsonl

Use the returned plan ID. Preparation proves real disposable-UID EDQUOT and
cleanup, installs the home/storage and broker-owned binding gates, creates the
empty proc exemption group and restarts proc/logind/polkit policy. It never
creates per-user bindings or enables sign-in. Accounting without enforcement,
wrong/missing home UUID, unsafe membership and incomplete preparation refuse.

Ensure the host's apt package indexes are current before planning. Ubuntu owns
all its packages, dependency closure and security updates. Manifest schema 2
`packages[].version` means qualified minimum, not an exact pin. Newer installed
Ubuntu versions satisfy checks. Plans list unmet `ubuntu.package.<name>` actions
and simulate apt; unavailable or too-old candidates refuse. Refresh customer
repositories or resolve holds/pins, then obtain a fresh approval. The operator
does not update indexes, impose holds or ship Ubuntu debs. Non-Ubuntu archives
remain exact and pinned by the manifest; Ubuntu installation needs repository/network access.

Then inspect and approve apply separately:

    open-habitat host plan --site /etc/open-habitat/site.json --json
    open-habitat host apply --site /etc/open-habitat/site.json --dry-run --json
    open-habitat host apply --site /etc/open-habitat/site.json --approved-plan <apply-id> --output=jsonl

Apply revalidates approval under the root operation lock. It stages verified
immutable generations, installs unmet Ubuntu minimum-version requirements through
the host apt without removals, downgrades or held-package changes, installs numeric gateway sysusers and systemd
units, and seeds only an empty broker. HTTP entry points stay behind a durable
root-owned fence while the gateway starts. Default quota and roles use the
private gateway administrative API with readback; root never edits its settings.
Admission removals revoke under the old admission before monotonic publication;
the broker alone observes its high-water mark. No committed binding or personal
file is reset. Requested unbound administrator grants are deferred_until_bound:
apply records them as pending in the gateway, which grants the role at the
sign-in that creates that person's binding, with no further apply. Roles a
browser administrator designated (designated_administrators in admin settings
show) are not site.json's: apply neither removes nor requires them. Per-user
quota overrides are preserved.

An exact repeat verifies native postconditions and returns no_change without
rewriting a receipt or restarting services. Before an operation starts,
stale_plan requires a fresh approved observation. After it starts, changed
protected inputs block continuation: a new approval cannot supersede the
incomplete operation. Restoring bytes alone does not restore reference identity.
Inspect operation evidence and entry_closure; there is no force/supersede route.
Keep declaration and protected inputs unchanged during maintenance; the binding
is rechecked around actions.
Interrupted apply continuation accepts only the same protected
inputs and original approval and reobserves native steps. Foreign/partial broker
state and malformed journals stay closed for diagnosis, never force/reset.
Ordinary apply performs neither preparation nor a release upgrade implicitly.

Check/plan/dry-run never create the operation lock, change quotas, start services
or install files. Filesystem reads may change access times. Blocked reads exit 1
with their document under stderr error.result.data; stdout is empty. Live
maintenance requires --output=jsonl, not --json: versioned progress plus exactly
one terminal result/error/cancelled event. A crash has no terminal event: its outcome and entry state are unknown, not
a promise that nothing changed or that HTTP is closed. A returned apply failure
after maintenance starts reports entry_closure=verified_closed or unavailable.
For unavailable keep external ingress closed and inspect the gateway; the
operator attempts to stop that gateway if it cannot persist closure. Signals
exit 130/143. System/native action failures exit 2; inspect before retrying.

    open-habitat host operation show <32-lowercase-hex-operation-id> --json
    open-habitat admin settings show --json
    open-habitat admin users list --json

The site onboarding (default repositories and their mode, integration steps,
AI offer) is gateway administration state, not site.json: host apply never
sets or resets it, and a browser administrator edits the same record. Read it
with `admin onboarding show --json`, change the data, then replace the whole
document with `admin onboarding update --file FILE|- --expected-version N`,
first with `--dry-run`. version_conflict means someone saved in between: read
again and merge rather than reusing the old version. A change applies only to
onboardings that start afterwards.

The site AI key lets new people skip the AI step: `admin ai-key set --provider
openai|anthropic|deepseek --key-file -` (stdin, never argv) stores it in the
gateway's own file and makes the onboarding offer `site_key`; `admin ai-key
delete --offer OFFER` removes it and sets what new people get instead; `admin
ai-key show` names only the provider and last four characters. Each new
person's Pi gets a copy at the sign-in that creates their account, and never
over a key they have. `admin ai-key seed --github-id ID` gives it to someone
who joined earlier: run it with `--dry-run` first, which asks that person's own
daemon for one word (`absent`, `earlier`, `current`, `own` or `unknown`) and
writes nothing; the write is decided again under Pi's lock and never replaces
the person's own key or subscription. `admin ai-key copies` lists who was given
which key. Setting a new key replaces every copy the site gave of an earlier
key of the same provider (`replaced` in the reply says per person how it went;
`not_reached` people keep the old key until seeded again); deleting the key
leaves copies where they are. The key's account pays for all of them, and a
copy cannot be recalled: only revoking the key at the provider stops it. Tell
the operator this, and that seeding writes into another person's credentials,
before doing either.

Who may sign in has two sources, both kept by the broker. site.json
`identities.admission` is root's (host apply converges it, as before).
Runtime entries are admitted and withdrawn by a browser administrator or
`admin access add|remove --github-id ID`, only while site.json sets
`identities.runtime_admission: true`; host apply never removes them, and host
plan reports them with actor and time under `runtime_admission`. Resolve a
login first with `admin access lookup --login LOGIN`, then pass the id; run
each change with `--dry-run` first. `remove` ends web access only (the Unix
account, files, SSH and processes stay) and refuses a site.json id: edit
site.json instead. `add` on a withdrawn id returns the person to the same
account. outcome_uncertain (exit 2) means the change may have committed: read
`admin access list` and decide; nothing retries it. A `denied` entry that is
not withdrawn is such an unconfirmed withdrawal; repeat remove or add.

Google, Microsoft and Dropbox app credentials live in
/opt/open-habitat/integrations.json beside the tools host apply owns. While
site.json `integrations.browser_setup` is true (the default), a browser
administrator or `admin integrations set|clear --provider P` has the broker
write one provider's section; host apply keeps those bytes. Give the secret on
stdin (`--client-secret-file -`), never in argv; Microsoft takes `--tenant-id`
instead of a secret. `admin integrations list` and host plan's `integrations`
show the client id and who set it when (source `operator` for a section root
edited by hand); secrets are never shown. host_busy means host maintenance
holds the lock and nothing was written; outcome_uncertain (exit 2) means read
the list before repeating. Set browser_setup false and run host apply to make
the file root's alone again.

A journal phase is durable intent, not proof of completion. Runtime process
liveness is not readiness. Generated gateway config and TLS copies are under
/etc/open-habitat/gateway/; per-user bindings remain separately under
/etc/open-habitat-daemon/daemon/user-mappings/. Inspect the installed unit
ExecStart for explicit component configuration instead of guessing a default. After installation/reboot verify gates, broker,
gateway, per-user listener ACLs and production daemon startup as distinct kernel
UIDs. Keep ingress closed until an admitted browser GitHub callback and that
person's own Pi/provider authorization succeed. No shared provider credentials
are installed unless an administrator sets the site AI key. Native two-UID startup alone does not prove browser sign-in or
provider entitlement.


## Explicit named successor upgrade

A product-only replacement still requires a distinct release version and
manifest digest, naming the exact predecessor and every successor binary/web
file. Reuse unchanged runtime archives/descriptors; leaving site.release on the
old runtime manifest cannot install new product bytes. Publish the new manifest
with the product.

Change only the declared release; converge other desired state separately.
Pin the successor's manifest by its GitHub-stated digest in
site.release.manifest_sha256. Deliver the successor naming its exact predecessor and complete product
inventory, with its runtime archives and root-owned verified package. Preview
using that successor's `host upgrade --site /etc/open-habitat/site.json --dry-run
--json`. A real invocation requires `--approved-plan ID --approve-maintenance
--output=jsonl`. It first returns `staged` and `plan.owner_binary` without
switching selectors or installing packages. Invoke that exact immutable binary
with the same arguments to enter maintenance; never recover through `current`.

`--approve-interruption` additionally authorizes interruption of observed native
work and persistent user services. A live daemon is conservatively unobservable
even when its current list is idle: list is not an in-flight request barrier.
Without approval it refuses, rather than claiming drain. No unrelated SSH/tmux
session is killed. Failure after quiescence retains closed HTTP/native entry and
cold-start fences. Inspect the versioned generation-owned journal and actual
postconditions; matching continuation only, never a new approval over uncertain
state. Split/malformed publications require diagnosis, not deletion/reset.
No downgrade, automatic rollback or ledger restore exists.


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

After a maintenance-only apply repair, a later upgrade must pin the
installed generation's release and executable digest as its predecessor, not
the repairing operator's version.

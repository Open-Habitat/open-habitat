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
references require root-owned non-writable parents and private single-link
regular files. No environment expansion or includes apply. Keep secrets out of
argv, environment, receipts and the release tree. The site declares numeric
GitHub admission/admin subjects, the reserved empty UID/GID pool, gateway IDs,
home UUID, nonzero default quota, exact runtime manifest target and profiles.
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
Undelivered integration declarations are blockers, not fictitious app setup.
Identity/mount choices become immutable; personal bindings and native data are
not desired-state records.

Inspect before mutation:

    open-habitat host config path --json
    open-habitat host config show --site /etc/open-habitat/site.json --json
    open-habitat host check --site /etc/open-habitat/site.json --json

The fixed incoming runtime directory is /var/lib/open-habitat/release; place the
signed manifest, signature and selected archives there as trusted root-owned
files. The raw 32-byte independently approved Ed25519 public key belongs at
/etc/open-habitat/release-key.pub, never taken on trust from that same bundle.
Site release.version and release.manifest_sha256 must match exactly. Verify
runtime bytes with an independently trusted verifier before root execution.
The product archive's checksums alone are integrity, not authenticity.


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

Prepare explicitly in a maintenance window:

    open-habitat host prepare --site /etc/open-habitat/site.json --dry-run --json
    open-habitat host prepare --site /etc/open-habitat/site.json --approved-plan <prepare-id> --approve-disruption --output=jsonl

Use the returned plan ID. Preparation proves real disposable-UID EDQUOT and
cleanup, installs the home/storage and broker-owned binding gates, creates the
empty proc exemption group and restarts proc/logind/polkit policy. It never
creates per-user bindings or enables sign-in. Accounting without enforcement,
wrong/missing home UUID, unsafe membership and incomplete preparation refuse.

Then inspect and approve apply separately:

    open-habitat host plan --site /etc/open-habitat/site.json --json
    open-habitat host apply --site /etc/open-habitat/site.json --dry-run --json
    open-habitat host apply --site /etc/open-habitat/site.json --approved-plan <apply-id> --output=jsonl

Apply revalidates approval under the root operation lock. It stages verified
immutable generations, installs exact offline tool packages without downloads,
removals, holds or downgrades, installs numeric gateway sysusers and systemd
units, and seeds only an empty broker. HTTP entry points stay behind a durable
root-owned fence while the gateway starts. Default quota and roles use the
private gateway administrative API with readback; root never edits its settings.
Admission removals revoke under the old admission before monotonic publication;
the broker alone observes its high-water mark. No committed binding or personal
file is reset. Requested unbound administrator grants are deferred_until_bound;
rerun apply after that person's binding to grant the role. Per-user quota
overrides are preserved.

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

A journal phase is durable intent, not proof of completion. Runtime process
liveness is not readiness. Generated gateway config and TLS copies are under
/etc/open-habitat/gateway/; per-user bindings remain separately under
/etc/open-habitat-daemon/daemon/user-mappings/. Inspect the installed unit
ExecStart for explicit component configuration instead of guessing a default. After installation/reboot verify gates, broker,
gateway, per-user listener ACLs and production daemon startup as distinct kernel
UIDs. Keep ingress closed until an admitted browser GitHub callback and that
person's own Pi/provider authorization succeed. No shared provider credentials
are installed. Native two-UID startup alone does not prove browser sign-in or
provider entitlement.


## Explicit named successor upgrade

Change only the declared release; converge other desired state separately.
Deliver the signed successor naming its exact predecessor and complete product
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

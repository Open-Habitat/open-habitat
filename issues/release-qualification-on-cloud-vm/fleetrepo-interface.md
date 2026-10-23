# Fleetrepo operator for the short-lived qualification VM

Open Habitat's `scripts/cloud-qualify.py run` calls this operator by name and
holds no cloud credentials itself. This is the contract it needs from Fleetrepo.
Everything below is a requirement on the Fleetrepo side; the open-habitat side is
already implemented against it and tested with a fake operator.

## Name and placement

- Executable **`open-habitat-qualification-vm`** on `PATH` on Alder (the
  qualification host), installed and converged by a Fleetrepo fleet unit like
  the other operators. Open Habitat also accepts `--operator PATH`.
- Stdlib Python in the style of `infra/open-habitat-test/provision.py`, reading
  `hetzner.api_token` from `infra/secrets/open-habitat-test-hetzner.yaml` through
  `sops --decrypt --extract`, never through argv, environment or a plaintext
  file. Scoped to the existing `native-agent-host` test project; it never
  touches a resource without `service=open-habitat-qualification`.

## Commands

All commands take `--json` (required) and print one document on stdout:
`{"schema_version": 1, "data": {...}, "warnings": []}` on success, or
`{"schema_version": 1, "error": {"code": "...", "message": "..."}}` on stderr
with exit 1. Exit 2 is invalid usage. No prompts. Never print the token.

### `create --run-id ID --ssh-public-key FILE --ttl-minutes N [--server-type T] [--location L] --json`

`ID` matches `^[0-9a-z][0-9a-z-]{5,40}$` (the harness sends
`YYYYMMDDtHHMMSS-xxxxxx`). `FILE` is a per-run Ed25519 public key the harness
generated; the operator registers it as a per-run Hetzner SSH key named after
the run. `N` is 30–240 (default harness value 180); refuse larger.

Before creating, run the same expiry sweep as `reap` and refuse with
`qualification_capacity_exceeded` when two unexpired qualification servers
already exist. Refuse with `qualification_price_exceeded` when the catalog's
gross hourly price of server plus volume exceeds a constant cap (proposal:
EUR 0.05/h).

Resources, all labelled `service=open-habitat-qualification`,
`managed-by=fleetrepo`, `run-id=ID`, `expires-at=<unix seconds>`:

- **Server**: stock `ubuntu-24.04` image by name (record the resolved image ID),
  type allowlist `cx33` (default: 4 vCPU, 8 GB, 80 GB disk; the full runtime
  union needs the room) and `cx43`; location allowlist `nbg1` (default), `fsn1`,
  `hel1`; public IPv4 enabled. The image's own apt sources must be left as
  shipped (the harness asserts the stock `mirror.hetzner.com` mirror).
- **Volume**: 10 GB, **no `format`** and `automount: false`, attached to the
  server. The harness formats it as the customer would and refuses a device that
  already carries a signature.
- **Firewall**: inbound TCP 22 and 443 only, from the operator-observed exact
  egress address of the qualification host (`/32`, observed the same way as
  `ssh_egress.py`), applied to this server only. No other inbound rules.
- **SSH host key**: generate an ephemeral Ed25519 host key pair locally and pass
  it in `user_data` cloud-init: `ssh_keys: {ed25519_private, ed25519_public}`,
  `ssh_genkeytypes: []`, `ssh_deletekeys: true`. `user_data` must contain
  nothing else that changes the host: no `package_update`, `package_upgrade`,
  packages, runcmd or write_files. Updates are part of what is qualified. Delete
  the private host key file after `create` returns.

Wait until the server is `running` and TCP 22 accepts connections (bounded,
e.g. 300 s). On any failure after the first resource exists, delete what was
created for this run before returning the error.

Success `data`:

```json
{
  "run_id": "20261023t120000-ab12cd",
  "project": "native-agent-host",
  "server": {"id": 123, "name": "oh-qualify-20261023t120000-ab12cd", "type": "cx33",
             "location": "nbg1", "image": {"name": "ubuntu-24.04", "id": 161547269},
             "created": "2026-10-23T12:00:05Z"},
  "ipv4": "203.0.113.10",
  "ssh": {"port": 22, "user": "root",
          "known_hosts": "203.0.113.10 ssh-ed25519 AAAAC3Nza..."},
  "volume": {"id": 456, "size_gb": 10,
             "device": "/dev/disk/by-id/scsi-0HC_Volume_456"},
  "firewall": {"id": 789, "allowed_cidrs": ["198.51.100.4/32"], "ports": [22, 443]},
  "expires_at": "2026-10-23T15:00:05Z",
  "labels": {"service": "open-habitat-qualification", "run-id": "20261023t120000-ab12cd",
             "expires-at": "1792767605", "managed-by": "fleetrepo"},
  "price": {"hourly_eur_gross": "0.0153"}
}
```

The harness reads `ipv4`, `ssh.port`, `ssh.user`, `ssh.known_hosts`,
`volume.device`, `server` and `expires_at`; the rest is evidence.

### `destroy --run-id ID --json`

Idempotent. Deletes the server, then detaches and deletes the volume, firewall
and SSH key carrying `run-id=ID` and the service label. Success only when none
remain: `data = {"run_id", "deleted": [{"kind", "id"}], "remaining": []}`. A
partial deletion is an error (`qualification_teardown_incomplete`) listing what
remains; the harness then reports a failed qualification with
`server_may_remain`.

### `reap --json`

Deletes every qualification-labelled server whose `expires-at` has passed, and
every qualification-labelled volume, firewall or SSH key whose run has no server
and is older than 30 minutes. Reports what it deleted and what failed.

### `list --json`

Every qualification-labelled resource with its run ID and expiry; for diagnosis.

## Cleanup guarantee

A crashed, killed or disconnected harness must never leave a paid server:

1. The harness calls `destroy` in a `finally`, on SIGINT and SIGTERM, and after
   `--keep-on-failure` only by expiry.
2. Every resource carries `expires-at`; `create` sweeps before creating.
3. A Fleetrepo systemd timer on Alder runs `reap` every 10 minutes. A failed reap
   or a resource still present 30 minutes after its expiry sends `notify-jari`.
4. The TTL is capped at 240 minutes and concurrency at two servers. That bounds
   the spend rate, not the duration while Alder itself is down: every deletion
   path above runs on Alder, and Hetzner has no server-side scheduled deletion.
   Run the same `reap` timer on a second Fleetrepo machine that can decrypt the
   test-project secret, so an outage of one host does not stop expiry. Until that second reaper exists, a Alder outage leaves at most two
   small servers running until Alder returns.

## TLS

No DNS or certificate work in Fleetrepo. The harness generates a per-run CA and
a leaf for the fixed origin `https://qualification.invalid`, keeps the CA key on
the qualification host, installs only the leaf on the VM and checks
`/healthz` with CA and hostname validation against the VM's IPv4 on port 443.
Public-CA issuance is outside this qualification.

## Not wanted

No Fleetrepo files, scripts, binaries or keys on the VM beyond the cloud-init
host key and the per-run authorized key. No reuse of the long-lived test
server, its firewall or its SSH key. No release download or install step in the
operator; that is the harness's customer path.

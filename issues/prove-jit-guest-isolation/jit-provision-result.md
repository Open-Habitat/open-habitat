# Bounded JIT guest harness — intermediate evidence, not acceptance

**Status:** harness harvested from preserved run `01m3ah86vg1s1nvqjv4fq1s5b5` commit `b082cd0` onto current main after policy `1d83fc4`; original branch/worktree untouched. This is an opt-in `./scripts/vm-test.sh jit-provision --json` scenario, NOT part of clean CI or a passing two-UID first-login proof. Parent `@prove-jit-guest-isolation` stays open. No production ensure/authorize deadline changed, no host/Alder/Fleetrepo write, no credentials, real identities, ingress, or global installation.

The fixture reads **committed blobs** from Fleetrepo commit `e044c03133074db3bb37d64e1e03c0bf4b9ade7d` (policy code `8253c880ba96d98d41d5f1c2d24a9253f9cc4b67`) via `git show`, independent of the current checkout HEAD, and verifies hashes *before* emitting the ISO seed. Source is read-only; the source repo defaults to `/home/maintainer/Sources/fleetrepo` and may be selected with `FLEETREPO_JIT_SOURCE` (repository root). An absent commit or changed blob fails closed. The pinned SHA-256 hashes of paths under `infra/native-agent-host-test/` are:

| Path | SHA-256 |
|---|---|
| `jit_policy.py` | `1333a57d2fc00e3e015e4d6800683ba4f50cdbf3ebacaea72a9d6328cfff23e8` |
| `jit_acl_prepare.py` | `20af327b7d64fe3546c166fb6c74b6cf54d77c471f871a1e22d4d8bb95bc9122` |
| `jit_guest_fixture.py` | `4f4f21e9e04637368f38b3044b8ab23c9ef7e2309c09aaeb3f72dc19cb99be6c` |
| `jit_guest_proof.py` | `8e596a613ae45cafa0a89ca342adb37022a83efd0826850e218c8da8573e3e51` |
| `test-jit-guest.sh` | `90a05994b174a1767a28dcd691aac03e6ef9ee9cca2d9ef21ad5687981c4c480` |
| `native-agent-host-jit-policy-gate.service` | `4f5c2cd4fb1050c18729bc89c68f688b63d673a0c81bf112b51bf28c0edd4a87` |
| `native-agent-host-jit-policy-gate@.service` | `5943cb8a58a0136fcb07858774faa39ee2ad91361ee3ebf24cb62778effee22b` |
| `native-agent-host-broker.socket.d/10-fleetrepo-jit-gate.conf` | `7ebe6f363cc8c87d2c114c01c5cdf2b05715104478224ade3074b46794d66191` |
| `native-agent-host-daemon@.socket.d/10-fleetrepo-jit-gate.conf` | `118f129b5169c753a8096bea6f935a94d32afe77db86b813fe8356338f561e7e` |

The isolated rootless Podman/QEMU PID1 guest uses the immutable Ubuntu image SHA-256 `612b2c0cc1bc413a6cb8c38fd611794caf0f2b436c50013d8b3794db12ad7354`, no container network, emulated user networking with `restrict=on`, read-only product ISO and bounded/cleaned private overlays. It checks whole synthetic UID/GID pool vacancy before seeding, boot ACL gates and broker socket peer/UID, then invokes the *real* broker Writer.Handle and Linux executor at `/opt/native-agent-host/current/native-agent-host`. No fixture provider is exposed to a network or packaged as production code. Failed first ensure returns nonzero with a versioned JSON error on stderr; no passing receipt is fabricated and no interrupted journal is cleared.

## Observed failure and limits

Preserved source-run diagnostic guest: first ensure from kernel UID 21003 produced **no broker reply**, exchange duration **2.932s**, `pending_phase=account`, `broker_state=active`, VM exit 0 after 139 seconds; outer scenario exited nonzero `boot_proof_failed`. Earlier attempts failed on a fixture seed mode (repaired) and no-reply after 175s. `internal/provision/transport_linux.go` uses a **2s per-exchange context** spanning sequential executor phases. These facts do not show whether account creation ran or what deadline/recovery policy is safe. The journal was observed, not removed to manufacture success. Production timeout, cancellation and partial-journal recovery need a separate implementation/decision before retrying full JIT proof.

Full two-UID allocation, first login, committed bindings, rerun/rename/concurrency, post-allocation peer/ACL denial, gh failure, revocation, reboot ACL restoration and deployment remain **unproven**. Historical static `two-user-routing` is separate and cannot substitute for this proof.

## Harvest verification

Harness commit `0890d443351cd69fa2e5c314cb37262eacfafc52`, optimized-Python acceptance correction `cd7157888fc88005cc888ea95ae58fa3cc8d8c93`. Source-run attempts above are historical evidence only, not a passing current run. On the committed tree at `cd71578`:

- `bash test/vm/test-vm-test.sh`: exit 0 (offline argv, schema, immutable-source/hash rejection, optional pinned Fleetrepo seed, cleanup wiring and optimized-Python failed-proof rejection).
- `PATH=/home/maintainer/Sources/native-agent-host/.tools/go/bin:$PATH go test -race ./internal/provision ./internal/gateway ./internal/daemon`: exit 0.
- `./scripts/vm-test.sh two-user-routing --json`: first attempt exit **2**, `boot_proof_failed` (`BrokenPipeError` in baseline proof); retry exit **0**, `product-two-user-routing`, 189s. This is the historical **static** scenario, not JIT. The first failure is not concealed by the retry.
- `./scripts/ci-local.sh --clean --json`: exit **0**, `{"status":"passed","clean":true}`. `issuectl doctor --json`: exit 0, no warnings/violations; `git diff --check`: exit 0. Go comes from a repository-local preexisting tool cache, not an installation.
- One targeted independent final-diff review (`gpt-6-astra`) found that Python `assert` statements in the outer JIT proof validator could be stripped by `PYTHONOPTIMIZE=1`, falsely accepting failed proof JSON if the VM powered off cleanly. Replaced acceptance assertions with explicit checks; offline regression rejects a failed proof both normally and under `python3 -O`. No review finding was left to file. The review did not establish another privilege-boundary defect.

The opt-in run, started on clean committed harness revision `0890d44` (before the parser fix), returned exit **2**, canonical JSON `boot_proof_failed`, VM exit 0, 212s. First ensure returned no reply after **4.429s**; broker was active; `pending_phase=null`. This **differs** from the preserved guest's `account` journal. A second opt-in run on clean committed `bdb3181` with the fixed parser again returned exit **2**, canonical JSON `boot_proof_failed`, VM exit 0, 191s; first ensure got no reply after **2.943s**, broker active, `pending_phase=home`. All three guest runs failed before committing bindings. The guest proof records only a snapshot after the exchange, so we cannot infer the exact ordering of socket closure and executor phases from these observations. The two-second exchange deadline can close the socket before the client receives a reply; it does not alone explain every observed phase difference. This is an unresolved diagnostic difference, not a green allocation test. No guest journal was cleared; only each entire disposable guest was torn down on poweroff.

# Atomic revocation and native-gh failure — bounded guest slice

**Observed 2026-09-25 UTC.** Parent @prove-jit-guest-isolation remains **open**. No real GitHub identity, token, host, Fleetrepo checkout, ingress or deployment was changed. The test runs the committed product binary under systemd in a disposable offline guest, with a synthetic loopback provider and guest-only `gh` fault controls. The review and tests concern the exact clean committed source `1b607206485969f5356d751fa96c6480363b9913`; this receipt-only follow-up commit does not change the executable fixture.

## Observations

The guest proof first preserves the existing two newly provisioned UIDs, real broker/socket/kernel-peer isolation, callback/session/snapshot and negative token checks. It then exercises:

- A failed synthetic `gh auth login` and a mismatched numeric `gh api user` ID, each **before session issuance**: callback HTTP 503 `native_adapter_error`; `/auth/session` and snapshot HTTP 401; replay HTTP 403; no credential file remains. Subsequent *fresh* callbacks for these known deterministic failures establish the normal A and B sessions. These are not retries of an unacknowledged delivery.
- A second callback for A with a changed provider handle: identical committed ID/UID/name binding and no additional `gh auth login`. This is a sequential rerun, **not** parallel-first-callback evidence.
- A root-only atomic `allowlist.json.next` replace under the root ledger lock, after file fsync and before directory fsync, raising epoch 2→3 and removing A. The operation does not clear the ledger, pending journal, account or native-gh credential. Both established A browser sessions deny `/auth/session` and snapshot (four HTTP 401 responses). A new A callback denies HTTP 403 before handoff, with no new session. The epoch is **global**: B's old session also denies HTTP 401; a fresh allowed B callback restores a B-only snapshot with no A route. This is a fail-closed global session cutover, not proof that B's old session stays valid.
- A **pre-install** lost acknowledgement for a fresh B browser: a guest-only `gh auth status` process kills its verified per-UID daemon parent during the one-shot handoff. One additional child record with `parent_pid` equal to the observed B daemon MainPID is required, followed by a changed daemon MainPID. The callback is HTTP 503; the fresh browser has no session/snapshot (401/401), state replay is 403, the protected pre-existing credential inode is unchanged and no second `gh` call occurs in this bounded observation. This is not a post-install credential-write crash proof or a guarantee against any delayed out-of-band delivery.

The guest scans browser captures (including denied bodies/cookies), all available per-unit boot journals (failure or >1 MiB fails closed), process argv/environ, root configs and child argv logs for synthetic tokens; the protected per-user credential and fixture provider inputs are intentional exceptions. The host also scans source, binary and bounded serial output. This does **not** prove absence from heap memory, pipes, every possible sink, or real OAuth credential revocation.

## Exact clean-tree receipts

All three commands below exited **0** against `1b607206485969f5356d751fa96c6480363b9913`, with product binary SHA-256 `f917899f6487f2d360796099b1175aad77c42395dc8c4a201b7cbf3482597d3c`, immutable guest image SHA-256 `612b2c0cc1bc413a6cb8c38fd611794caf0f2b436c50013d8b3794db12ad7354` and tool image ID `1fcba77437f7aa1094f784c23d5e9197d6a7d532bcac860ee311aa94f77775f2`:

| Command | Scope | Duration | Result |
|---|---|---:|---|
| `./scripts/vm-test.sh jit-login --json` | `jit-login-slice` | 266 s | passed; revocation statuses `[401,401,401,401]`, fresh revoked callback `403`, B reauthenticated; `fail-login` and `wrong-id` each callback `503`, session `401`, replay `403`, credential absent; lost ack callback `503`, new browser session/snapshot `401/401`, replay `403`, verified parent death/one observed `gh` call; rename and token scan passed |
| `./scripts/vm-test.sh jit-provision --json` | `jit-provision` | 221 s | passed; new accounts, idempotent ensure, peer/UID/pending/ACL denials |
| `./scripts/vm-test.sh two-user-routing --json` | `product-two-user-routing` | 159 s | passed; separate historical static-account baseline |

Both JIT commands used the pinned **read-only** Fleetrepo source commit `e044c03133074db3bb37d64e1e03c0bf4b9ade7d`. Exact reviewed private policy SHA-256 values checked before fixture rendering:

| Pinned file | SHA-256 |
|---|---|
| `jit_policy.py` | `1333a57d2fc00e3e015e4d6800683ba4f50cdbf3ebacaea72a9d6328cfff23e8` |
| `jit_acl_prepare.py` | `20af327b7d64fe3546c166fb6c74b6cf54d77c471f871a1e22d4d8bb95bc9122` |
| `native-agent-host-jit-policy-gate.service` | `4f5c2cd4fb1050c18729bc89c68f688b63d673a0c81bf112b51bf28c0edd4a87` |
| `native-agent-host-jit-policy-gate@.service` | `5943cb8a58a0136fcb07858774faa39ee2ad91361ee3ebf24cb62778effee22b` |
| `native-agent-host-broker.socket.d/10-fleetrepo-jit-gate.conf` | `7ebe6f363cc8c87d2c114c01c5cdf2b05715104478224ade3074b46794d66191` |
| `native-agent-host-daemon@.socket.d/10-fleetrepo-jit-gate.conf` | `118f129b5169c753a8096bea6f935a94d32afe77db86b813fe8356338f561e7e` |
| `jit_guest_fixture.py` | `4f4f21e9e04637368f38b3044b8ab23c9ef7e2309c09aaeb3f72dc19cb99be6c` |
| `jit_guest_proof.py` | `8e596a613ae45cafa0a89ca342adb37022a83efd0826850e218c8da8573e3e51` |
| `test-jit-guest.sh` | `90a05994b174a1767a28dcd691aac03e6ef9ee9cca2d9ef21ad5687981c4c480` |

Additional clean committed checks on this revision: `go test -race ./internal/provision ./internal/gateway ./internal/daemon ./internal/nativegh` exit 0; `bash test/vm/test-vm-test.sh` exit 0; `./scripts/ci-local.sh --clean --json` exit 0 (`{"schema_version":1,"data":{"status":"passed","clean":true},"warnings":[]}`); `issuectl doctor --json` exit 0, no warnings/violations; `git diff --check` exit 0. Go code was not changed in this slice.

## Failed alternatives and review

Earlier non-passing runs were **not** used as evidence: the first revocation run returned exit 2 when the original assertion incorrectly expected B's old epoch-2 session to survive the epoch-3 global cutover. Subsequent exit-2 runs caught a count of a deliberately failed `gh login` attempt, an assertion against snapshot *file contents* not actually exposed by the snapshot API, and finally a guest receipt whose revoked callback status had been overwritten by the later lost-ack start status. Each assertion was corrected and the entire scenario rerun on a clean committed revision. A concurrent intermediate static-baseline VM run returned exit 2 (`identity_mapping_denied`); its serial rerun on the final revision passed. No failed run is labeled green.

An independent final-diff security review (deepseek-flash, with a preceding deepseek-flash review and gemini-3.8-flash focused verification) checked actual broker/gateway/daemon path, token capture and negative assertions. Actionable fixture defects found during review and runs were fixed: socket stop/start must precede revocation, global epoch invalidates B's old session, bounded journal scan must check read success and not silently truncate, and lost-ack evidence must verify the daemon PID and count *all* new child calls rather than only `gh auth login`. Final candidate concerns were refuted against `internal/provision/writer_linux.go` (revocation is allowlist removal, policy epoch read live, head high-water advances on broker exchange) and `internal/transport/transport_linux.go` (single write/response without delivery retry). No confirmed authorization bypass or token leak remains from this bounded diff. Review output is in gitignored scratch, not a public credential artifact.

## Still open

No parallel first callbacks (same or different numeric IDs), **post-install** lost acknowledgement, partial journal crash/recovery, reboot ACL re-preparation, all-phase fault injection, live person/real GitHub consent, deployed Fleetrepo convergence or ingress were proved. The pre-install kill has an existing B credential; it proves no *new* session and one observed `gh` call, not durable credential-install crash containment. Current fixture has no production fault hook. The parent issue's broader acceptance remains outstanding; do not close it or claim pilot readiness from this slice.

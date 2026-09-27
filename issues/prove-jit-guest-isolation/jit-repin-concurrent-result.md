# Synthetic JIT pinned-gate and concurrent broker clients — bounded intermediate

Parent `@prove-jit-guest-isolation` stays **open**. This is an opt-in disposable PID1 guest broker-ensure slice, not simultaneous OAuth callbacks, live deployment, reboot acceptance, or real identity verification. No host/Fleetrepo/live guest mutation, real GitHub subject/token, ingress, firewall change, root-service activation on the host, or operator reboot was performed. The earlier static `two-user-routing` baseline remains a separate scenario.

## Immutable checker provenance and offline negative control

The guest fixture reads committed blobs using `git show`, not the Fleetrepo checkout state, at `85ac4588c9de4c1ceb1fccf58d57753ca58a7688`; it checks each SHA-256 before emitting cloud-init. Exact nine file/digest pairs:

| Fleetrepo `infra/native-agent-host-test/` file | SHA-256 |
| --- | --- |
| `jit_policy.py` | `4dc927a15fe7a2bc30cd05a5f04961f67d14a30866acd6f65a363fb53b2aa2a7` |
| `jit_acl_prepare.py` | `20af327b7d64fe3546c166fb6c74b6cf54d77c471f871a1e22d4d8bb95bc9122` |
| `native-agent-host-jit-policy-gate.service` | `4f5c2cd4fb1050c18729bc89c68f688b63d673a0c81bf112b51bf28c0edd4a87` |
| `native-agent-host-jit-policy-gate@.service` | `5943cb8a58a0136fcb07858774faa39ee2ad91361ee3ebf24cb62778effee22b` |
| `native-agent-host-broker.socket.d/10-fleetrepo-jit-gate.conf` | `7ebe6f363cc8c87d2c114c01c5cdf2b05715104478224ade3074b46794d66191` |
| `native-agent-host-daemon@.socket.d/10-fleetrepo-jit-gate.conf` | `118f129b5169c753a8096bea6f935a94d32afe77db86b813fe8356338f561e7e` |
| `jit_guest_fixture.py` | `4f4f21e9e04637368f38b3044b8ab23c9ef7e2309c09aaeb3f72dc19cb99be6c` |
| `jit_guest_proof.py` | `8e596a613ae45cafa0a89ca342adb37022a83efd0826850e218c8da8573e3e51` |
| `test-jit-guest.sh` | `90a05994b174a1767a28dcd691aac03e6ef9ee9cca2d9ef21ad5687981c4c480` |

Offline `test-jit-pinned-lock.py` checks the actual nine immutable blobs and directly exercises the pinned shared-lock function on independent directory descriptors: immediate contention waits for exclusive release, then obtains a shared lock; bounded timeout refuses while the writer still holds the exclusive lock. This is *not* an end-to-end systemd activation contention proof. The negative shim still rejects corrupted pinned policy bytes without emitting cloud-init. Pending-journal and drift denials are unchanged and remain fail-closed.

## Two bounded guest attempts

1. First opt-in `jit-provision --json`: exit 2 (`boot_proof_failed`), VM exit 0 after 166 guest seconds. Sanitized result `concurrent UID allocation or route missing`, `pending_phase=verify`, `broker_state=active`, exchange 16.622 seconds. This earlier fixture launched both clients but did not synchronize their sends; no per-child broker reply or executor step survived harness cleanup. No attribution to the gate lock race or a specific verification failure is justified. This is RED, not a success receipt. A local finder identified incorrect generation/rerun assumptions and the outdated optional render guard; both were fixed before attempt 2. No pending state was cleared outside the disposable guest.
2. Second and final opt-in `jit-provision --json`: **exit 0**, scope `jit-provision`, 224 guest seconds, product source revision `8ad99510532699ca5791914045507ef6f3272c75`, product binary SHA-256 `1bf211a77a9a6d13b882e43b54d6d543b783f8430919b8b0bb6bf7bef0ca5cd7`, guest image SHA-256 `612b2c0cc1bc413a6cb8c38fd611794caf0f2b436c50013d8b3794db12ad7354`. Both numeric gateway-UID children connected to the broker Unix socket before either was released to send its request. The guest then observed two new UID-21032/21033 accounts and committed bindings (order-independent subject-to-UID checks), stable rerun routes at generation 3, active daemon sockets, wrong peer and wrong UID denial, stopped-instance pending gate/writer denial, pre-preparation boot gate refusal, and exact EACCES for sibling home/UDS/directory access. The passed host parser requires `concurrent_clients_released=true`; its negative oracle rejects a missing flag.

Both clients were connected and eligible to send concurrently, but this receipt does **not** time-stamp actual broker admission overlap or demonstrate a particular gate-versus-writer lock interleaving. The offline lock test establishes only the bounded retry/refusal implementation. Fleetrepo's immutable Python suite contains separate pending/drift negative fixtures; this product guest checked pending but did not inject drift, so no new guest drift-denial claim is made. An independent verifier noted a possible fail-closed `activating` sibling socket check in the immutable gate; neither guest result proves that race caused a failure. No parallel OAuth callbacks, actual GitHub login, real-user isolation, persistent live-host activation, interrupted broker reconciliation, or operator-observed reboot is claimed.

## Review and verification

Independent security/privilege/concurrency finder `claude-fable-5-1` and verifier `gpt-6-astra` reviewed the candidate diff. Finder's generation and guard defects were fixed; an overclaim that two launched processes proved overlapping work was corrected by requiring both peers to connect before their release. Verifier's potential sibling `activating` race is unresolved, fail-closed, and not established by these receipts. Reviews are in ignored `history/`; no review residual met the separate issue-filing bar beyond the already-open parent. Final verifier `gpt-6-astra` re-reviewed the post-barrier diff and found no must-fix/should-fix false positive for this limited claim. `history/assessment-jit-repin.md` records the assessed fixed findings and the speculative sibling-race residual; no separate issue was filed.

## Final clean-tree gates

Committed executable revision `c57727fe01331fe1ca73091ba33b67477ba715b7`: `go test -race ./internal/provision ./internal/gateway ./internal/daemon`, `bash test/vm/test-vm-test.sh`, `issuectl doctor --json` (zero warnings/violations) and `git diff --check` passed. The second JIT guest result above was run on this executable diff before the commit; its envelope's `product_commit=8ad9951` describes the pre-change product binary source, not the committed fixture revision. No executable changes followed the guest run. `./scripts/vm-test.sh two-user-routing --json` passed separately, scope `product-two-user-routing`, 212 guest seconds, precreated UID 21001/21002, with product binary source `8ad9951` (the run began before the fixture commit, without intervening executable edits); it does not prove JIT. `./scripts/ci-local.sh --clean --json` passed exit 0 on clean committed `c57727f`, final envelope `{"schema_version":1,"data":{"status":"passed","clean":true},"warnings":[]}`. CI does not boot the opt-in JIT guest; this documentation-only receipt does not change the tested executable diff. Parent remains open.

## Tool/sub-workflow failure — discussion

The first guest attempt failed closed (above), preventing any success claim for that attempt. The original offline edit command contained a Python quoting SyntaxError; the edit was reapplied correctly and `bash test/vm/test-vm-test.sh` passed. The initial read of the process skill used a nonexistent path; it was re-read at the installed path. The final guest and independent offline verification do not depend on these failed steps. The earlier attempt's full diagnostic was deleted by the harness, so its executor failure remains unknown. No further guest attempt is permitted in this slice.

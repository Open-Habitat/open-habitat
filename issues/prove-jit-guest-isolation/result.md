# First-login isolation: established evidence and remaining observations

## Closed without the live reboot proof (2026-10-06)

Jari decided on 6 October 2026 to close this issue with its existing evidence:
the live reboot proof cannot be run on the current test installation, so it is
not run.

The 5 October attempt (Taskfleet run `01m46b27na102a8k8ya7ars2x2`, with
Fleetrepo helper run `01m46b6rs6v3jnv1a0wg8eqp5n`) stopped before privileged
access, synthetic login or reboot. The deployed gateway talks only to GitHub's
fixed token and user endpoints, the loopback fake provider accepts only fixture
credentials, and the installed `gh` is real. No reviewed VM-only path lets two
synthetic callbacks exercise the deployed gateway and broker without
redirecting real GitHub traffic or touching the real person's binding and
credentials. A fabricated callback, broker-state edit or reboot with zero
bindings would not prove the claim, so none was made.

**Not established:** isolation between two bound users after an actual reboot
of the test server. Everything below remains the evidence for what *was*
shown. Any future attempt needs a separately reviewed synthetic provider and
native-gh arrangement for the deployed path and exclusive use of the VM.

Reconciled on 2026-10-01 against the broker-crash guest result and the later
[Jari decision on interrupted provisioning](../reconcile-interrupted-jit-provisioning/item.md).
The issue remains open. No live test-server smoke was run for this edit.

## Established evidence

| Behavior | Observed result and source | Limit |
| --- | --- | --- |
| First login allocates separate Linux accounts; routes, homes and sockets remain separate | [Socket activation](jit-socket-activation-result.md) and [revocation guest](jit-revocation-result.md), including `jit-login` and `jit-provision` at `1b607206`: new UIDs, mapped snapshots, kernel peer checks and foreign home/socket denials passed. | Disposable systemd guests and synthetic GitHub identities. The static `two-user-routing` baseline starts with existing accounts. |
| Repeat login and changed GitHub handle retain the binding | [Revocation guest](jit-revocation-result.md), `1b607206`: same numeric identity retained its UID/name binding without another native gh login. | Sequential case; concurrency is covered separately below. |
| Simultaneous first-login callbacks | [Concurrent callback guest](jit-concurrent-result.md), `4ea1356d`: same-ID and distinct-ID rounds both returned `[303,303]`, with one binding per identity and three isolated snapshots. At `1f74f1f`, a later controlled C-before-B round also passed. | Provider rendezvous establishes simultaneous gateway callbacks, not every broker scheduling interleaving. |
| Revocation denies existing and new browser sessions | [Revocation guest](jit-revocation-result.md), `1b607206`: old A sessions returned 401 and new A callback 403; B needed a fresh login after the global epoch change. | Request-time browser authorization, not deletion of native credentials or cancellation of existing native work. |
| Native gh failure or uncertain handoff does not create a usable browser session | [Revocation guest](jit-revocation-result.md), `1b607206`: failed login, wrong native identity and pre-install acknowledgement loss denied the session. [Post-install daemon diagnostic](jit-post-install-daemon-diagnostic-result.md), `4467e26`: retained credential, lost daemon and callback 503 with session/snapshot 401/401. | The later diagnostic receipt-preservation change was checked offline, not rerun in a PID1 guest. A daemon kill is not a broker crash during account creation. |
| Pending journal prevents use of uncertain account state | [Journal test](jit-journal-intermediate-result.md): a fresh Writer at each phase returned `state_unavailable`, issued no route, called no executor and left state unchanged. [Broker-crash guest](jit-broker-crash-result.md), `b8941ba`: real post-account SIGKILL; restarted broker hit the `secureFile` pending guard, issued no route and left journal bytes unchanged. | One real PID1 guest crash at `account`, not disk-loss durability or recovery. A's browser route was denied while its native process/DAC access persisted. |
| Selected inconsistent state denies access | `jit-provision` at `3d2121c` denied daemon-config mode drift. Packaged callback guest at `1f74f1f` denied an NSS alias, corrupt head, mismatched generation and rolled-back allowlist epoch. | Selected request-time faults; no universal drift claim and no claim that the Fleetrepo activation gate checks daemon config. |
| Packaged product and pinned Fleetrepo input were used | [Concurrent callback receipt](jit-concurrent-result.md) records verified archive, embedded commit and binary hash, plus nine immutable Fleetrepo blobs at `85ac4588`. | Web assets were verified in the package but not served by this guest. Older guest receipts used locally compiled binaries. |

### Latest concurrent and drift run

The successful `jit-concurrent` run at
`1f74f1f918f45d2cb457b876dac5d13ed4100426` exited 0 after 250 guest seconds.
Archive SHA-256:
`121d6d947f370d58c77c163d878f4323d10f1634bdb3a071544c7d49e3adef5f`.
Binary SHA-256:
`fbe014477589ed9e8c8350b06338c79c570b1142d53d84d41bb786c5dc5f92c7`.
Same-ID and C-first distinct-ID rounds returned `[303,303]`; mapped snapshots,
foreign-UID denials and the four ledger/NSS drift cases passed.

Earlier distinct-ID `[503,503]` results exposed a guest-only fake-git bug:
it assumed B and C would always receive UIDs in that order. The corrected
fixture checks actual NSS identity/home and deliberately exercises the reverse
order. A trial product timeout increase did not fix the failure and was
reverted. Failed runs remain failures; this successful run establishes one
controlled valid ordering. Detailed earlier attempts and review history remain
in the linked receipts and this file's Git history before this rewrite.

## What remains

**Post-reboot isolation with bound users.** Jari's 25 September decision
replaced further reboot-harness expansion with an operator-observed test-server
smoke. The [old reboot diagnostic](jit-reboot-result.md) is failed historical
evidence, not the next work plan. Fleetrepo's
`issues/rebuild-test-vm-first-use/result.md` at revision
`d27243fe9a0a7b5b0ab4868ba3deb3856bd4af6f` records a 29 September reboot,
policy/ACL preparation, service startup and denied unprivileged socket access.
It explicitly had zero user bindings. It therefore does not establish login,
per-user routing or restored isolation between two bound users after reboot.
Host-specific facts remain in that private repository.

**Actual broker-crash refusal observed.** The [broker-crash guest](jit-broker-crash-result.md)
passed at `b8941ba`: a real systemd-managed broker SIGKILL after B's Unix
account step left a pending journal and no binding. On socket-activated restart,
the broker refused at `secureFile`'s pending check *before* Writer.Startup and
issued no route. The earlier guest marker had been placed at the later Writer
check, so it falsely suggested a config/socket failure; the corrected
fixture-only marker proves the actual guard. A's native process and home access
continued, but A's browser requests were also denied; browser availability
for the other identity is **not** established under the fault. No reboot,
disk-durability or recovery claim follows. The recovery issue was closed
`wontfix` on 28 September.

**New stream behavior.** The general `/events` endpoint still returns 404 at
`da841c5`. This says nothing about other streaming routes. Revocation of a
future conversation stream belongs with
[agent control](../build-agent-control/item.md); request-time results above
are not connected-stream proof.

## Reading the receipts

The linked reports identify their tested revisions, failed attempts, reviews
and CI results. Their older “still open” lists describe the time of each run;
later successful results and Jari's later decisions determine remaining work.
The accepted evidence does not require a separate operator recovery procedure
or proof of every imaginable concurrency or drift case.

The 30 September broker-crash attempt was corrected and passed in the disposable
guest on 1 October. The issue remains open for the operator-observed bound-user
post-reboot check.

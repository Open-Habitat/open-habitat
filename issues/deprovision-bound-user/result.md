# Deprovisioning investigation — partial, blocked

The mapped Unix account **was not deleted**. No product deletion endpoint, migration, guest write, Fleetrepo change, real credential, or service action was attempted. The issue remains in progress. ADR 0007 is proposed, not accepted and not an implemented contract.

## Inspected boundary

At product revision `d5ec12c` (starting HEAD), `internal/provision/writer_linux.go` chooses the first UID absent from `bindings.json`, and the version-1 ledger parser in `state_linux.go` and `writer_linux.go` has only live bindings. `broker_linux.go:Startup` verifies every row as a present account. A pending marker refuses all broker routes. `internal/gateway/revoke.go` calls broker `authorize` before invalidating existing sessions and pre-cutoff OAuth states; it cannot do so while a broker writer holds the exclusive state lock. New OAuth states after cutoff remain permitted. Authenticated requests reauthorize and compare the mapped identity (`internal/gateway/auth.go`), but requests already running cannot be recalled.

The checked-in *private* Fleetrepo `infra/native-agent-host-test/JIT-POLICY.md` describes the pilot.11 four-file v1 state and explains that `broker-high-water.json` is written at seeding only, not updated with later assignments. The checked-in Fleetrepo `jit_policy.py` requires exactly v1 binding keys and verifies bound UIDs against NSS (lines 157–210). These are source inspections, **not a read of the guest's state**. The current durable state does not prove that an absent UID has never previously been allocated and removed, and the current activation gate cannot represent a retired binding. This is the precise migration blocker; the root operator must authenticate history or conservatively quarantine every UID whose history cannot be proved, and the Fleetrepo activation policy must be changed and staged with the product's format. The gateway revocation/freeze ordering needs a separate proof before any filesystem mutation. Simply dropping a ledger row or running `userdel -r` is unsafe.

## Next safe work

Agree ADR 0007's format and authority boundary with Jari, then design a verified v1 migration and an independent durable no-reuse commitment with Fleetrepo's root gate and rollback. Stage synthetic two-UID, wrong-subject, pending journal, process/FD, lock, failure-at-every-phase, reboot, restored-state, return-login and sibling-preservation tests before enabling deletion. A real guest action belongs to a separate approved Fleetrepo operator with its own private receipts. This work deliberately stops before creating new deletion authority.

## Verification

Documentation validator, committed clean-tree gate and independent security review results are recorded below when available. None constitutes a guest or migration proof.

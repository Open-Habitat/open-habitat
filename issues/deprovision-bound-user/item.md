---
created: 2026-09-29
updated: 2026-09-29
type: task
reporter: jari
status: open
priority: high
lane: provision-deprovision
collision: [internal/provision/, docs/]
---

# Deprovision bound Unix user safely

## User decision (2026-09-29)
Jari asked to reset his TEST account by removing the entire mapped Unix user, not merely selected `~/src`/Pi/GitHub leaves. Fleetrepo should offer explicit separate modes for personal home reset and full mapped-user removal, and execute the latter for his own test binding. A future full-server reinstall option may be designed separately but the VM is NOT authorized for rebuild/deletion now. The previous personal-leaf reset run was cancelled before further guest writes; pilot.11 is live, personal deletion not verified. See private Fleetrepo @prepare-jari-reset-release. Do not use real identity in synthetic tests.

## Product boundary
Today `internal/provision` treats every committed broker binding as a live NSS user and allocates from UIDs not in active bindings. `userdel -r` alone strands the binding and makes the broker/policy refuse; deleting the binding alone may recycle a UID with old sockets/credentials and break user isolation. Extend the root broker's owned state with an explicit, crash-safe deprovision/tombstone lifecycle retaining no-reuse history, safe logout/session invalidation ordering and new-login behavior. Root-only authenticated operator; never gateway authority to delete a home or arbitrary browser UID. Record architecture/format choice and trust boundary in ADR before implementing. Pre-release format may change but migration from the currently deployed pilot.11 must be explicit; fail closed on partial phase, preserve siblings and Access. Do not turn this into a generic multi-host credential broker.

## Acceptance
- Two independent users in synthetic guest: deprovision one and delete exactly that Unix account/home and per-user socket/mapping while retaining the other; no reuse of its UID; same subject's next consented login gets a fresh isolated account or an explicit fail-closed explanation. No old cookie or pending OAuth state can revive access. No silent profile/credential leakage.
- Crash/partial journal, active process/FD, concurrent ensure, rollback/restart and second attempt tests; no real home/provider/test host in automated tests. Clean `./scripts/ci-local.sh --clean --json` from committed tree, independent security review and exact evidence. Product operator provides only a safe primitive; Fleetrepo owns the concrete test guest deletion and receipts.
- If a safe tombstone or account deletion cannot be bounded, report the precise barrier rather than raw `userdel`, ledger edit or test-VM rebuild.

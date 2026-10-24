---
created: 2026-10-24
updated: 2026-10-24
type: bug
status: untriaged
priority: normal
provenance: other
provenance_detail: Observed while running the required VM checks for onboarding-default-repositories
source_ref: taskfleet:01m5p7md6jc61z9ze0cfam1pve/observed:vm-scenarios-broken
originating_run: 01m5p7md6jc61z9ze0cfam1pve
originating_run_kind: spinoff
---

# VM scenarios two-user-routing and host-boot-binding fail on main

## Description

Both VM scenarios that exercise two real UIDs fail on `main` (02783d53, 2026-10-24), before any product behaviour under test is reached.

**`./scripts/vm-test.sh two-user-routing --json`** fails with `boot_proof_failed`: `systemctl start open-habitat-broker.socket returned non-zero exit status 5`. Since f63e8958 (2026-10-22) `systemd/open-habitat-broker.socket` and `open-habitat-daemon@.socket` `Require=open-habitat-storage.service` (and the daemon socket `open-habitat-binding@%i.service`), but `test/vm/product-fixture.py` installs neither unit, and the storage check needs the installed policy that only `host prepare` writes. The fixture was last brought up to date in b456d7d2 (2026-10-21), when it still passed.

**`./scripts/vm-test.sh host-boot-binding --json`** fails with `binding_proof_failed`; the guest proof reports `{"status":"failed","scope":"host-boot-binding-session","reason":"admitted sibling not restored"}`. Reproduced on `main` and on a branch that only adds a reply field (twice). The two first-login ensures succeed; a later boot does not restore the admitted sibling's runtime directory/socket. One run under CPU contention instead failed earlier with `broker ensure {'version': 1, 'failure': 'drift'}` right after `groupadd` (account step), which suggests executor command timeouts under emulated-guest load.

Impact: there is currently no passing VM scenario with real UIDs, systemd and the real broker, so claims that TESTING.md assigns to the VM ("first-login provisioning", "two precreated user routes", cold boot binding restore) cannot be evidenced. `onboarding-default-repositories` had to substitute a distinct-UID container test (`scripts/test-onboarding-defaults-uids.sh`).

Direction: bring `product-fixture.py` onto production preparation (as `host-boot-binding-fixture.py` does) or install the storage/binding units with a prepared policy; diagnose the sibling-restore failure in `host-boot-binding-proof.py` boots against the binding gate's current behaviour.

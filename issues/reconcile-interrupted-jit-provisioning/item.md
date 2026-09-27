---
created: 2026-09-27
updated: 2026-09-27
type: task
status: untriaged
priority: normal
provenance: other
source_ref: taskfleet:01m3h4wk5gzvn6hyhf9f4z9vmt/operator-reconciliation
originating_run: 01m3h4wk5gzvn6hyhf9f4z9vmt
originating_run_kind: spinoff
---

# Reconcile interrupted JIT account provisioning safely

## Description

The root broker's writer leaves `pending.json` (and potentially a `.next` file) if it dies after journaling a new binding. On startup and on every request, the product intentionally refuses this state. `docs/adr-0004-first-login-user-provisioning.md` calls for operator reconciliation, but no reviewed procedure for distinguishing each pending phase, reconciling the Linux account/home/config/socket/unit and bindings/head, updating the high-water receipt, and safely removing the marker is documented. Fleetrepo's `infra/native-agent-host-test/JIT-POLICY.md` explicitly says its high-water receipt is initial-only and a separately reviewed update procedure is needed before recovery. `activation_install.py stop/revert` does not reconcile an interrupted account.

A broker SIGKILL after account creation can strand a reserved UID, permanently denying broker activation and subsequent logins. Merely removing the marker or reseeding could reassign another person's UID or accept a rolled-back ledger. The operator procedure and high-water update belong in Fleetrepo, which owns the concrete host's root state, account commands, backup receipts and installation runbook; the product should continue failing closed, not silently repair root-owned state. Implement a root-only, lock-taking, read-only diagnostic and a reviewed phase-specific recovery/abandon procedure with snapshot/high-water attestation, explicit operator approval, and disposable-guest crash evidence before enabling its use on a real host. No real guest was modified by this report.

Related parent: @prove-jit-guest-isolation. This report is about a missing recovery path, not proof of a successful recovery or permission to run one on the live server.

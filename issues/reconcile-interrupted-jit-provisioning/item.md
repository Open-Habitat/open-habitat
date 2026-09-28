---
created: 2026-09-27
updated: 2026-09-28
type: task
status: wontfix
priority: normal
provenance: other
source_ref: taskfleet:01m3h4wk5gzvn6hyhf9f4z9vmt/operator-reconciliation
originating_run: 01m3h4wk5gzvn6hyhf9f4z9vmt
originating_run_kind: spinoff
closed: 2026-09-28
disposition_note: Jari decided the unlikely interrupted first-user provision does not justify a separate recovery project. Keep pending-state fail-closed; do not clear its marker or retry ambiguous host phases. Reopen only after an observed interruption or a concrete availability requirement warrants exact phase/identity-verified idempotent recovery.
disposition_reason: wontfix
---

# Assess safe idempotent retry of interrupted JIT provisioning

## Decision and scope

Jari's 2026-09-27 direction: this crash is unlikely and does **not** justify a separate operator-reconciliation project. Consider only one approach: make each provisioning phase safe to retry when already completed, then resume an interrupted operation on a later attempt. If safe idempotent retry cannot be demonstrated, **do not implement recovery**; retain the current fail-closed behavior. A crashing server cannot return a useful error for the request that lost its connection. This is a conditional investigation, not approval to remove a pending marker or to provision again blindly.

Today the writer writes `pending.json` **before** each host step and refuses any pending marker on startup and on every request. A marker names the intended phase, not proof whether a host command completed before the crash. An account, home, binding file, runtime ACL, systemd unit or ledger publication could be partly present. Retrying `groupadd`/`useradd` by accepting any existing name or UID would risk adopting another person's account; removing the marker or lowering the ledger/high-water mark could reassign a UID. The existing behavior stays in place unless an exact, lock-held, identity- and phase-verified retry is shown safe across every crash boundary, including already-written `bindings.json` versus `head.json` and Fleetrepo's initial-only high-water receipt.

## Conditional acceptance criteria

- Show, with disposable guest crash injection before and after **each** journaled phase and publication, that an already-completed phase is recognized by exact expected ownership/content/identity rather than by mere existence, and that incomplete/foreign state still fails closed.
- Prove a restart or subsequent request can resume without granting another subject the reserved UID, changing a committed binding, losing monotonic epoch/generation, or bypassing socket policy. No OAuth token is replayed after a lost acknowledgement; the browser may initiate a new login attempt.
- If any phase cannot meet these conditions at proportionate cost, record why and close this conditional task without implementing a manual recovery path. Never clear `pending.json` on the live test server merely to make a retry proceed.

Related parent: @prove-jit-guest-isolation. The original review proposed a root-only operator recovery runbook; Jari explicitly chose the idempotent-or-no-recovery policy instead.

## Decisions

### 2026-09-27T18:06:13Z · @jari

2026-09-27: Interrupted first-user provisioning is too unlikely to warrant an operator recovery procedure. Only consider phases that can safely be recognized as already done and retried/resumed; if that is not feasible, do not implement recovery. A crashed server need not report an error to the disconnected request. Keep fail-closed behavior rather than blindly accepting existing account paths or clearing the pending marker.

## Comments

### 2026-09-28T12:10:54Z · @intake

Rejected (wontfix): Jari decided the unlikely interrupted first-user provision does not justify a separate recovery project. Keep pending-state fail-closed; do not clear its marker or retry ambiguous host phases. Reopen only after an observed interruption or a concrete availability requirement warrants exact phase/identity-verified idempotent recovery.

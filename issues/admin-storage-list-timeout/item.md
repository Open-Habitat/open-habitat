---
created: 2026-10-12
updated: 2026-10-14
type: bug
reporter: agent
status: open
priority: normal
provenance: ai-review
source_ref: review:storage-quotas/finding:sha1:685ab43ea0f55b30cfcf8e347228b6ed4f2319bf
review_source: ai-review
originating_run: 01m4qdw3e900ec6ah6yrzm7m0v
originating_run_kind: spinoff
review_target: internal/gateway/quota.go
assessment_classification: SPIN_OFF
assessment_outcome: confirmed
lane: server-admin
preparation: pending
---

# Administrator storage list times out as bound users grow

## Description

# Administrator storage listing exceeds the fixed control deadline as bound user count grows

## Problem

`internal/gateway/quota.go` reads quotas sequentially for every committed binding. Each `quota_read` takes the broker's exclusive ledger lock and verifies the Unix account, unit and socket through several `systemctl show` subprocesses (`internal/provision/executor_linux.go`). The root CLI and root control server both use fixed five-second per-request deadlines (`internal/cli/admin_linux.go`, `internal/cli/revoke_linux.go`). At ordinary subprocess latencies of 100–200 ms per bound account, 25–50 accounts exhaust that budget, although the broker's UID pool contains up to 4096 accounts. `admin storage list` then says the result is unknown or the gateway is unavailable, with no capacity/overcommit report. The browser list has no fixed timeout but accumulates the same linear latency. A single account with unit drift also aborts the whole result instead of showing healthy accounts alongside an unavailable row.

## Reproduction

In a fixture with 50 committed bindings, make each Unix-unit verification take 100 ms while retaining the real five-second root control deadline, then invoke `admin storage list`. The sequential broker calls exhaust the control deadline before all rows return. A single bound account whose unit is missing independently makes the entire gateway storage list unavailable.

## Quick Test

The fixed implementation should list all healthy bound accounts within the control budget and identify an unavailable row without hiding the remaining users. Repeat with 50 accounts and one drifted unit; the broker must still derive each UID from the committed ledger.

## Evidence and direction

The sequential loop and five-second deadlines were confirmed by final review of the quota implementation (product source `543f5cf3c7523f601654949f71ffb86318a51555`). This is a reachable design limit, not a claim of a current 25-person test guest: the guest currently has one bound account. Prove it with a controlled mock executor delay across 30–50 bound users, then design a bulk/paginated broker quota view and a per-row unavailable state, retaining committed-UID selection and authorization in the broker and gateway. A larger blanket timeout alone keeps the page linearly slow and all-or-nothing. Do not create a second usage store.

Related: @implement-user-storage-quotas

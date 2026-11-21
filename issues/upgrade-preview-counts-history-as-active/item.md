---
created: 2026-11-21
updated: 2026-11-22
type: bug
status: fixed
priority: normal
provenance: other
provenance_detail: Observed during a published-release pilot installation
source_ref: taskfleet:01m8011p0b8m9jf6cayg20mx93/observation:upgrade-catalog-missing-state
originating_run: 01m8011p0b8m9jf6cayg20mx93
originating_run_kind: spinoff
lane: release-runtime
lane_seq: 3
preparation: ready
closed: 2026-11-22
---

# Upgrade preview counts native history rows without state as active turns

## Description

Observed during a named-release upgrade from 0.1.3 to 0.1.4: an unattended installer waited its entire quiet-window budget and stopped because preview reported active turns even though the daemon-owned Pi children were idle and no other Pi writers existed.

Cause: `internal/daemon/agent_conversation_list_linux.go` now lists the native history catalog as well as daemon-owned conversations. A historical row may have `lifecycle: resting` or `archived` and no `state` at all. `internal/host/upgrade_native_linux.go:observeUpgradeWork` decodes only `state`; the absent field becomes the empty string. `upgradeSessionActive("")` conservatively returns true, so every such history row becomes an active turn. Synthetic reproducer: a list reply with `sessions: [{"agent_id":"pi:example","lifecycle":"resting"}]` causes `active_turns: 1` with `turns_observable: true` despite no running Pi.

Expected: the upgrade observation understands the catalog schema and distinguishes inactive history from active daemon work. Preserve fail-closed behavior for genuine unknown or unreadable work. Do not blindly treat archived rows as idle: archive visibility overrides lifecycle even for a live external writer. Add regression coverage for missing state/resting history, archived history, actual daemon states, native writers and malformed/unobservable replies.

Operational workaround: keep the published package and the approved plan unchanged; independently corroborate the supported conversation inventory against a root process/cgroup census, then perform the supported bootstrap stage and exact owner activation with the launch's existing `--approve-maintenance --approve-interruption`. No catalog, journal, fence, admission, quota, selector or security-policy edits. Permanent product correction remains needed even if that supervised upgrade succeeds. Final verification is recorded separately after the operation finishes.

## Comments

### 2026-11-21T21:48:18Z · @upgrade-agent

Supervised workaround verified: published 0.1.4 installed through the unchanged approved bootstrap/owner plan; operation completed at seq 6, exact owner repeat returned no_change, operation readback completed, host check 21/21 passed before and after, all supported administration/admission/quota/home/security observations compared equal, every running product executable matched the verified successor digest, and CA-validated public health/sign-in/OAuth-redirect checks passed. No product-state edit or release-authentication bypass was used. Human OAuth callback acceptance was not tested. This remains an untriaged product defect requiring a permanent observation fix.

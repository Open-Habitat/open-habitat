---
created: 2026-11-07
updated: 2026-11-14
type: bug
status: fixed
priority: normal
provenance: other
source_ref: taskfleet:01m6vcjv9yj5rkrstma9kbar47/occurrence:upgrade-start-failed-busy
originating_run: 01m6vcjv9yj5rkrstma9kbar47
originating_run_kind: spinoff
lane: host-upgrade
lane_seq: 1
preparation: ready
closed: 2026-11-14
---

# Upgrade work inventory counts failed conversation starts as active turns

## Description

## Observed occurrence

The published pilot.21 upgrade preview on Birch reports `active_turns: 1` for one live daemon even though its supported `agent conversation list --json` reports only `stopped` and `start_failed`. The automatic installer waited 15 minutes and handed the otherwise approvable target to a worker as `birch_busy`. No real running turn was observed; no conversation content is included here.

## Reproduction and cause

With a daemon containing a failed-to-start conversation, run the published successor's `host upgrade --site /etc/open-habitat/site.json --dry-run --json`. Compare `plan.work[].active_turns` against the predecessor's conversation-list state projection, run as that user.

In `internal/host/upgrade_native_linux.go:observeUpgradeWork`, every session state other than idle/stopped/failed increments ActiveTurns. `start_failed` therefore counts as running work. The daemon explicitly treats start_failed as settled without a live child (`conversation_linux.go`), and keeps it visible for recovery; deleting the conversation to satisfy maintenance would lose evidence/user intent.

## On-the-spot installer correction

Fleetrepo's root-side preview helper now corroborates a positive, observable count through the current predecessor's supported conversation-list CLI as the same UID/GID (no supplementary groups). Only when this independent state inventory reproduces the product's count does it subtract start_failed entries, retaining `reported_active_turns` and a state-only projection as evidence. Unreadable/malformed/changing inventories and unknown/running/starting states stay busy. No product binary, conversation, journal, fence or selector was manually patched. The upgrade still requires explicit maintenance/interruption approval and all original plan/preservation/public checks.

## Permanent correction needed

Make the product's work inventory distinguish a failed start from an active turn, with a regression test. Preserve conservative handling of unobservable and unfamiliar states and the existing explicit live-daemon interruption approval. Fleetrepo's compatibility workaround should then be removed once no supported predecessor needs it.

Evidence: Alder `/var/tmp/agent-keep/birch-v0.1.0-pilot.21/01m6vbf3whpnh6wb0q3h1yyyy8/` (original and corrected previews, before/after comparison, operation terminals) and `/var/tmp/agent-keep/open-habitat-upgrade/01m6vbf3whpnh6wb0q3h1yyyy8/agent-birch-commands.jsonl`.

Release source: `241d5ae8f73f10d4be6276428704c27d7b9aa0cc`. Program origin: `01m6vbf3whpnh6wb0q3h1yyyy8`; worker origin: `01m6vcjv9yj5rkrstma9kbar47` (spinoff).

## Comments

### 2026-11-07T16:22:58Z · @agent

Workaround verified on Birch: pilot.19 → published pilot.21 completed at 2026-11-07T16:19:28Z under plan 1ad52d45a00a6db734362c83d53f6baf50061df8809a446c5567635830a293a4, exact-owner operation 11c5062a935c8b50c27cde1dacdfe8c4 completed seq 6, repeat no_change and operation readback completed. Final host check 21/21; before/after users, access/admission, settings projection/hash, bindings hash, native quotas, homes, user managers and product digests compare preserved; public HTTPS/sign-in/OAuth redirect/editor/view checks pass. Taskfleet supervisor and tmux PIDs survived. Fleetrepo helper/program regression suite: 51 tests pass. A separate installer count-only host-check comparison was corrected to accept the newly added passing runtime.taskfleet check while retaining every predecessor check identity. No product binary was patched; the product inventory bug remains open for correction. Human OAuth callback acceptance untested.

## Resolution

### 2026-11-14T07:36:10Z · @issuectl

Fixed settled-state classification with regression coverage; see result.md. Live check: not performed; focused host tests and contract checks passed.

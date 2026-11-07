---
created: 2026-11-07
updated: 2026-11-07
type: bug
status: untriaged
priority: normal
provenance: other
source_ref: taskfleet:01m6vcjv9yj5rkrstma9kbar47/occurrence:upgrade-start-failed-busy
originating_run: 01m6vcjv9yj5rkrstma9kbar47
originating_run_kind: spinoff
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
